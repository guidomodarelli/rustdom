"""Exercise real complete and A/A-rejected XML archives and reject altered records."""
import copy
import importlib.util
import io
import json
import os
import statistics
import subprocess
import sys
import tarfile
from pathlib import Path
import unittest
import zipfile

ROOT = Path(__file__).parent
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location('xml_observations', ROOT / 'verify-xml-observations.py')
VERIFIER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFIER)


class XmlObservationTests(unittest.TestCase):
    def setUp(self):
        self.bundle = zipfile.ZipFile(ROOT / 'xml-validation/39697882498/artifact.zip')
        self.addCleanup(self.bundle.close)
        self.index = json.loads(self.bundle.read('experiment.json'))

    def verify(self, index=None):
        return VERIFIER.verify_observations(self.index if index is None else index, self.bundle.read)

    def consume_in_subprocess(self, flags=(), optimize_environment=None):
        """Run the real observations API against the complete recorded ZIP in another interpreter."""
        script = '''
import importlib.util, json, sys, zipfile
spec = importlib.util.spec_from_file_location('xml_observations', sys.argv[1])
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
with zipfile.ZipFile(sys.argv[2]) as archive:
    print(json.dumps(reader.verify_observations(json.loads(archive.read('experiment.json')), archive.read)))
'''
        environment = dict(os.environ)
        environment.pop('PYTHONOPTIMIZE', None)
        if optimize_environment is not None:
            environment['PYTHONOPTIMIZE'] = optimize_environment
        return subprocess.run([sys.executable, '-B', *flags, '-c', script,
                               str((ROOT / 'verify-xml-observations.py').resolve()),
                               str((ROOT / 'xml-validation/39697882498/artifact.zip').resolve())],
                              env=environment, capture_output=True, text=True, encoding='utf8')

    def test_subprocess_consumer_verifies_the_real_complete_archive(self):
        result = self.consume_in_subprocess()
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertIs(report['verified'], True)
        self.assertIs(report['accepted'], True)
        self.assertEqual(report['measuredDurations'], 14976)

    def test_optimized_interpreters_cannot_run_the_real_observations_consumer(self):
        for flags, environment_value in [(('-O',), None), (('-OO',), None), ((), '1'), ((), '2')]:
            with self.subTest(flags=flags, optimize=environment_value):
                result = self.consume_in_subprocess(flags, environment_value)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')
                self.assertIn('requires Python assertions', result.stderr)

    def test_complete_real_archive_retains_all_samples_and_acceptance(self):
        result = self.verify()
        self.assertIs(result['accepted'], True)
        self.assertEqual(result['processes'], 468)
        self.assertEqual(result['measuredDurations'], 14976)
        self.assertIs(result['currentInputEligibilityVerified'], False)

    def test_real_failed_calibration_retains_null_and_absence_of_ab(self):
        with zipfile.ZipFile(ROOT / 'unplanned-xml/39662377152/artifact.zip') as bundle:
            result = VERIFIER.verify_observations(json.loads(bundle.read('experiment.json')), bundle.read)
        self.assertIs(result['accepted'], None)
        self.assertIs(result['abExecuted'], False)
        self.assertEqual(result['processes'], 208)
        self.assertEqual(result['measuredDurations'], 6656)

    def test_actual_full_input_capture_preserves_the_calibrated_ab_rejection(self):
        with zipfile.ZipFile(ROOT / 'xml-full-inputs-results/39896591561/artifact.zip') as outer:
            with tarfile.open(fileobj=io.BytesIO(outer.read('xml-full-inputs.tar.xz')), mode='r|xz') as archive:
                prefix = 'xml-full-inputs/capture/observations/'
                payloads = {member.name[len(prefix):]: archive.extractfile(member).read()
                            for member in archive if member.isfile() and member.name.startswith(prefix)}
        result = VERIFIER.verify_observations(json.loads(payloads['experiment.json']), payloads.__getitem__)
        self.assertIs(result['calibrated'], True)
        self.assertIs(result['accepted'], False)
        self.assertEqual(result['processes'], 468)
        failed = [row for row in result['summaries']['AB'] if row['changePercent'] > 5]
        self.assertEqual([(row['name'], row['size']) for row in failed], [('xml-serializer-getter-error', 1)])

    def test_changed_reported_aggregate_is_rejected(self):
        changed = copy.deepcopy(self.index)
        changed['comparisons'][0]['changePercent'] += 1
        with self.assertRaises(AssertionError): self.verify(changed)

    def test_changed_embedded_samples_cannot_replace_original_stdout(self):
        changed = copy.deepcopy(self.index)
        changed['runs'][0]['observations']['results'][0]['measuredBatchMs'][0] *= 2
        with self.assertRaises(AssertionError): self.verify(changed)

    def test_missing_row_and_reordered_workers_are_rejected(self):
        missing = copy.deepcopy(self.index)
        missing['referenceComparison'].pop()
        reordered = copy.deepcopy(self.index)
        reordered['runs'][0], reordered['runs'][1] = reordered['runs'][1], reordered['runs'][0]
        for changed in [missing, reordered]:
            with self.subTest(kind='missing' if changed is missing else 'reordered'):
                with self.assertRaises(AssertionError): self.verify(changed)

    def test_changed_corpus_output_and_warmup_policy_are_rejected(self):
        output = copy.deepcopy(self.index)
        output['calibration']['rows'][0]['outputHash'] = 'altered'
        warmup = copy.deepcopy(self.index)
        warmup['settings']['XML_SERIALIZER_WARMUP_BATCHES_BY_SIZE']['1'] = 16
        for changed in [output, warmup]:
            with self.assertRaises(AssertionError): self.verify(changed)

    def test_worker_cannot_relabel_the_actual_runtime_root(self):
        changed = copy.deepcopy(self.index)
        changed['runs'][0]['runtimeRoot'] = changed['candidate']
        with self.assertRaises(AssertionError): self.verify(changed)

    def test_reused_stdout_cannot_count_the_same_real_samples_twice(self):
        changed = copy.deepcopy(self.index)
        original = changed['runs'][0]
        duplicate = changed['runs'][3]
        duplicate['stdoutFile'], duplicate['stderrFile'] = original['stdoutFile'], original['stderrFile']
        duplicate['observations'] = copy.deepcopy(original['observations'])
        stored = changed['calibration']['rows'][0]
        stored['phases'][3] = copy.deepcopy(stored['phases'][0])
        samples = {label: [value / run['observations']['results'][0]['batchSize']
                          for run in changed['runs'][:16] if run['label'] == label
                          for value in run['observations']['results'][0]['measuredBatchMs']]
                   for label in ['A', 'B']}
        stored['baselineMs'] = statistics.median(samples['A'])
        stored['candidateMs'] = statistics.median(samples['B'])
        stored['changePercent'] = (stored['candidateMs'] / stored['baselineMs'] - 1) * 100
        self.assertLessEqual(abs(stored['changePercent']), changed['calibration']['budgetPercent'])
        with self.assertRaises(AssertionError): self.verify(changed)


if __name__ == '__main__': unittest.main()
