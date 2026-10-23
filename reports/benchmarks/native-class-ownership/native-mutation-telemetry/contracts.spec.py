"""Exercise source derivation against the canonical graph; no DOM or profiling execution."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('native_telemetry_preparation', Path(__file__).with_name('prepare.py'))
method = importlib.util.module_from_spec(spec)
spec.loader.exec_module(method)
repository = Path(os.environ['NATIVE_TELEMETRY_REPOSITORY']).resolve()
manifest = Path(os.environ['NATIVE_TELEMETRY_MANIFEST']).resolve()
policy = json.loads((Path(__file__).parent / 'constants/protocol.json').read_text())


class Derivation(unittest.TestCase):
    def test_both_real_derivations_preserve_frozen_graph_and_create_no_capture(self):
        source = json.loads(manifest.read_text())
        source_hashes = {entry['path']: hashlib.sha256((repository / entry['path']).read_bytes()).hexdigest() for entry in source['files']}
        sampler_hashes = []
        with tempfile.TemporaryDirectory(prefix='rustdom-native-telemetry-prepare-') as temporary:
            for mode in policy['modes']:
                output = Path(temporary) / mode
                receipt = method.prepare(repository, manifest, output, mode)
                self.assertFalse(receipt['measurementExecuted']); self.assertFalse(receipt['captureImplemented'])
                self.assertIsNone(receipt['performanceAccepted']); self.assertFalse(receipt['gateReevaluated'])
                self.assertEqual(receipt['verifiedSourceFiles'], 434)
                self.assertEqual(receipt['qualifiedSamplerSha256'], policy['qualifiedSamplerSha256'])
                self.assertFalse((output / 'worker.cjs').exists())
                self.assertFalse(any(output.rglob('report.json')))
                for name, expected in receipt['derivedFiles'].items():
                    self.assertEqual(hashlib.sha256((output / name).read_bytes()).hexdigest(), expected)
                qualified = json.loads((output / 'qualified-source/preparation.json').read_text())
                for name, expected in qualified['derivedFiles'].items():
                    self.assertEqual(hashlib.sha256((output / 'qualified-source' / name).read_bytes()).hexdigest(), expected)
                sampler_hashes.append(receipt['samplerAfterSha256'])
        self.assertEqual(sampler_hashes[0], sampler_hashes[1])
        self.assertEqual(source_hashes, {name: hashlib.sha256((repository / name).read_bytes()).hexdigest() for name in source_hashes})

    def test_forged_graph_hash_cannot_replace_a_canonical_source_entry(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-native-telemetry-forged-') as temporary:
            changed = json.loads(manifest.read_text())
            changed['files'][0]['sha256'] = '0' * 64
            filename = Path(temporary) / 'manifest.json'
            filename.write_text(json.dumps(changed), encoding='utf-8')
            output = Path(temporary) / 'must-not-exist'
            with self.assertRaisesRegex(ValueError, 'input graph differs'):
                method.prepare(repository, filename, output, 'cpu')
            self.assertFalse(output.exists())

    def test_existing_output_is_preserved(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-native-telemetry-existing-') as temporary:
            output = Path(temporary)
            marker = output / 'keep.txt'; marker.write_text('preserved')
            with self.assertRaises(FileExistsError):
                method.prepare(repository, manifest, output, 'cpu')
            self.assertEqual(marker.read_text(), 'preserved')

    def test_optimized_python_refuses_derivation_before_any_work(self):
        result = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name('prepare.py'))], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('requires non-optimized Python', result.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
