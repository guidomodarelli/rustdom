"""Exercise real preserved reports, child failures and one-shot filesystem behavior."""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest


METHOD = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('optimization_run', METHOD / 'run.py')
driver = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(driver)


class OptimizationLogContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.archive = pathlib.Path(os.environ['RUSTDOM_OPTIMIZATION_ARCHIVE'])
        cls.node = os.environ['RUSTDOM_OPTIMIZATION_NODE']
        cls.reference = json.loads((cls.archive / 'node-22/AA-0-jsdom-A.json').read_bytes())

    def test_real_complete_reports_keep_all_workloads_and_owner_checks(self):
        for directory, version in [('node-22', 'v22.12.0'), ('node-24', 'v24.14.1')]:
            for physical, label in [('J0', 'A'), ('J1', 'B')]:
                report = json.loads((self.archive / directory / f'AA-0-jsdom-{label}.json').read_bytes())
                result = driver.inspect_report(report, version, physical, self.reference)
                self.assertEqual(result, {'batches': 8, 'storedMeasuredDurations': 72, 'trackedWindows': 96})

    def test_missing_public_workload_is_rejected(self):
        report = copy.deepcopy(self.reference)
        report['batches'].pop()
        with self.assertRaisesRegex(AssertionError, 'incomplete or changed public workload'):
            driver.inspect_report(report, 'v22.12.0', 'J0', self.reference)

    def test_bad_durations_and_retained_owner_are_rejected(self):
        for invalid in [0, -1, float('nan'), True]:
            report = copy.deepcopy(self.reference)
            report['batches'][0]['samplesMs'][0] = invalid
            with self.assertRaises(AssertionError):
                driver.inspect_report(report, 'v22.12.0', 'J0', self.reference)
        report = copy.deepcopy(self.reference)
        report['batches'][0]['cleanupTrace'][-1]['survivors']['window'] = 1
        with self.assertRaises(AssertionError):
            driver.inspect_report(report, 'v22.12.0', 'J0', self.reference)
        report = copy.deepcopy(self.reference)
        report['loadedAfter'] = {}
        with self.assertRaisesRegex(AssertionError, 'incomplete loaded-package inventory'):
            driver.inspect_report(report, 'v22.12.0', 'J0', self.reference)

    def test_publication_rejects_invalid_values_before_output_side_effects(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-opt-pub-') as temporary:
            for ordinal, receipt in enumerate([None, False, [], {}, {'commit': 'a' * 40, 'files': {}}]):
                output = pathlib.Path(temporary) / str(ordinal)
                with self.assertRaises(ValueError):
                    driver.main({}, output, receipt, capture=True)
                self.assertFalse(output.exists())

    def test_real_child_failure_preserves_both_logs_and_process_metadata(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-opt-child-') as temporary:
            directory = pathlib.Path(temporary) / 'child'
            index = {'commands': []}
            saves = []
            with self.assertRaisesRegex(RuntimeError, 'exit=7'):
                driver.run_process([self.node, '-e', 'process.stdout.write("before");process.stderr.write("expected");process.exitCode=7'],
                                   directory, index, lambda: saves.append(len(index['commands'])), 'failure')
            self.assertEqual((directory / 'stdout.log').read_bytes(), b'before')
            self.assertEqual((directory / 'stderr.log').read_bytes(), b'expected')
            self.assertEqual(index['commands'][0]['exitCode'], 7)
            self.assertTrue(index['commands'][0]['complete'])
            self.assertGreater(index['commands'][0]['pid'], 0)
            self.assertGreaterEqual(len(saves), 3)

    def test_capture_guard_is_exclusive_and_does_not_overwrite_a_previous_run(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-opt-guard-') as temporary:
            marker = pathlib.Path(temporary) / 'nested/guard.json'
            driver.claim_capture_guard(marker, pathlib.Path(temporary) / 'first', 'a' * 40)
            before = marker.read_bytes()
            with self.assertRaises(FileExistsError):
                driver.claim_capture_guard(marker, pathlib.Path(temporary) / 'second', 'b' * 40)
            self.assertEqual(marker.read_bytes(), before)

    def test_real_child_can_keep_stdout_on_disk_without_returning_it(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-opt-log-') as temporary:
            directory = pathlib.Path(temporary) / 'child'
            index = {'commands': []}
            result = driver.run_process([self.node, '-e', 'process.stdout.write("x".repeat(16384))'],
                                        directory, index, lambda: None, 'disk-output', read_stdout=False)
            self.assertIsNone(result)
            self.assertEqual((directory / 'stdout.log').read_bytes(), b'x' * 16384)
            self.assertEqual(index['commands'][0]['exitCode'], 0)

    def test_large_file_hash_uses_bounded_traced_heap_in_a_real_process(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-opt-hash-') as temporary:
            filename = pathlib.Path(temporary) / 'large.log'
            block = b'x' * driver.SETTINGS['hashChunkBytes']
            expected = hashlib.sha256()
            with filename.open('wb') as output:
                for ordinal in range(16):
                    output.write(block)
                    expected.update(block)
            script = '''import importlib.util,json,pathlib,sys,tracemalloc
spec=importlib.util.spec_from_file_location('hash_driver',sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
tracemalloc.start();baseline=tracemalloc.get_traced_memory()[0];tracemalloc.reset_peak()
result=module.digest(sys.argv[2]);current,peak=tracemalloc.get_traced_memory()
print(json.dumps({'digest':result,'peakHeapDeltaBytes':peak-baseline,'fileBytes':pathlib.Path(sys.argv[2]).stat().st_size}))
'''
            child = subprocess.run([sys.executable, '-B', '-c', script, str(METHOD / 'run.py'), str(filename)],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(child.returncode, 0, child.stderr.decode(errors='replace'))
            observation = json.loads(child.stdout)
            self.assertEqual(observation['digest'], expected.hexdigest())
            self.assertLessEqual(observation['peakHeapDeltaBytes'], 3 * driver.SETTINGS['hashChunkBytes'])
            print('HASH_MEMORY_OBSERVATION ' + json.dumps(observation), file=sys.stderr)


if __name__ == '__main__':
    unittest.main()
