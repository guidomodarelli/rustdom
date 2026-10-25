"""Exercise real complete derivations, configuration and the disabled capture boundary."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest


repository = Path(sys.argv.pop(1)).resolve()
manifest = Path(sys.argv.pop(1)).resolve()
nodes = [Path(sys.argv.pop(1)).resolve(), Path(sys.argv.pop(1)).resolve()]
method = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('current_range_control_preparation', method / 'prepare.py')
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)
policy = json.loads((method / 'constants/protocol.json').read_bytes())


class RealPreparation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = TemporaryDirectory()
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.directory = Path(cls.temporary.name)
        cls.receipts = {}
        for mode in policy['modes']:
            before = (sys.dont_write_bytecode, sys.pycache_prefix)
            cls.receipts[mode] = producer.prepare(repository, manifest, cls.directory / mode, mode)
            if before != (sys.dont_write_bytecode, sys.pycache_prefix):
                raise RuntimeError('Preparation did not restore scoped interpreter settings')

    def test_full_file_maps_and_original_sources(self):
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repository, text=True).strip()
        changes = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repository, text=True).splitlines()
        for mode, receipt in self.receipts.items():
            root = self.directory / mode
            self.assertEqual(receipt['historicalPinsVerified'], 563)
            self.assertEqual(receipt['sourceCommit'], head)
            self.assertEqual(receipt['sourceChanges'], changes)
            self.assertEqual(receipt['sourceGitErrors'], [])
            self.assertFalse(receipt['captureImplemented'])
            self.assertFalse(receipt['measurementExecuted'])
            self.assertIsNone(receipt['performanceAccepted'])
            self.assertFalse(receipt['gateReevaluated'])
            self.assertEqual(set(receipt['derivedFiles']), {path.relative_to(root).as_posix()
                for path in root.rglob('*') if path.is_file() and path != root / 'preparation.json'})
            for name, expected in receipt['derivedFiles'].items():
                self.assertEqual(hashlib.sha256((root / name).read_bytes()).hexdigest(), expected, name)
            self.assertFalse((root / policy['cacheDirectory']).exists())

    def test_real_entry_inspection_in_both_pinned_nodes(self):
        identity = json.loads((repository / policy['packageIdentity']).read_bytes())
        for mode in policy['modes']:
            for node in nodes:
                result = subprocess.run([node, self.directory / mode / policy['samplerEntry'], policy['inspectOperation']], capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr.decode())
                inspected = json.loads(result.stdout)
                self.assertFalse(inspected['samplerInvoked'])
                self.assertEqual(inspected['settings']['distributionHashes'], identity['distributions'])
                self.assertEqual(inspected['settings']['revision'], 'range-control-aa-telemetry-sampler-v1')
                self.assertEqual(inspected['settings']['warmupSamples'], 3)
                self.assertEqual(inspected['settings']['measuredSamples'], 9)
                self.assertEqual(inspected['workerArguments'], [['--expose-gc', f'--random-seed={seed}', f'--hash-seed={seed}'] for seed in range(1, 17)])

    def test_disabled_capture_exits_before_observers_or_reports(self):
        for mode in policy['modes']:
            for node in nodes:
                output = self.directory / f'not-created-{mode}-{node.parent.parent.name}.json'
                environment = dict(os.environ, GITHUB_ACTIONS='true', GITHUB_RUN_ATTEMPT='1')
                result = subprocess.run([node, self.directory / mode / 'worker.cjs', manifest, 'AA', 'rustdom', '0', 'A', output, '4'],
                    capture_output=True, env=environment)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(b'capture capability is not implemented', result.stderr)
                self.assertFalse(output.exists())
                self.assertFalse(Path(str(output) + '.telemetry.json').exists())

    def test_invalid_mode_and_existing_destination_preserved(self):
        target = self.directory / 'new-target'
        with self.assertRaisesRegex(ValueError, 'undeclared observation mode'):
            producer.prepare(repository, manifest, target, 'unknown-mode')
        self.assertFalse(target.exists())
        target.mkdir()
        sentinel = target / 'sentinel'
        sentinel.write_bytes(b'preserve original output')
        with self.assertRaises(FileExistsError):
            producer.prepare(repository, manifest, target, 'cpu')
        self.assertEqual(sentinel.read_bytes(), b'preserve original output')
        self.assertEqual(list(target.iterdir()), [sentinel])

    def test_destination_must_be_disjoint(self):
        target = repository / 'not-created-telemetry-output'
        self.assertFalse(target.exists())
        with self.assertRaisesRegex(ValueError, 'output must be disjoint'):
            producer.prepare(repository, manifest, target, 'cpu')
        self.assertFalse(target.exists())

    def test_wrong_manifest_commit_and_harness_are_rejected(self):
        original = json.loads(manifest.read_bytes())
        for name, value in [('commit', '0' * 40), ('harnessSha256', '0' * 64)]:
            modified = self.directory / f'wrong-{name}.json'
            modified.write_text(json.dumps(dict(original, **{name: value})))
            output = self.directory / f'not-created-{name}'
            with self.assertRaises(ValueError):
                producer.prepare(repository, modified, output, 'cpu')
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
