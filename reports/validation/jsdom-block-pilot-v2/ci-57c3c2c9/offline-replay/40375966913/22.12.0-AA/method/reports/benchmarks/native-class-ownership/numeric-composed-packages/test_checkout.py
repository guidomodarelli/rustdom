"""Exercise sparse hydration against actual temporary Git repositories, never the user's checkout."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import types
import unittest

location = Path(__file__).with_name('checkout.py')
reader = types.ModuleType('numeric_current_checkout')
reader.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), reader.__dict__)

class SparsePackageContracts(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='numeric-sparse-contract-')
        self.addCleanup(temporary.cleanup)
        self.repository = Path(temporary.name)
        reader.git(self.repository, 'init', '--initial-branch=main')
        reader.git(self.repository, 'config', 'core.autocrlf', 'false')
        for relative, contents in [('entrypoint.cjs', b'entrypoint payload\n'), ('data/sample[1].json', b'{"value":17}\n'), ('unrelated/untouched.txt', b'not requested\n')]:
            target = self.repository / relative; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(contents)
        reader.git(self.repository, 'add', '--', 'entrypoint.cjs', 'data/sample[1].json', 'unrelated/untouched.txt')
        reader.git(self.repository, '-c', 'user.name=Sparse fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Temporary behavior fixture')
        reader.git(self.repository, 'sparse-checkout', 'set', '--no-cone', '--stdin', input_bytes=b'/entrypoint.cjs\n')

    def test_materializes_literal_file_preserving_initial_checkout(self):
        result = reader.populate(self.repository, ['data/sample[1].json'])
        self.assertTrue(result['prepared'])
        self.assertEqual((self.repository / 'data/sample[1].json').read_bytes(), b'{"value":17}\n')
        self.assertEqual((self.repository / 'entrypoint.cjs').read_bytes(), b'entrypoint payload\n')
        self.assertFalse((self.repository / 'unrelated/untouched.txt').exists())
        self.assertEqual(reader.git(self.repository, 'status', '--porcelain=v1'), b'')

    def test_untracked_foreign_file_blocks_mutation(self):
        target = self.repository / 'foreign.txt'; target.write_bytes(b'foreign')
        with self.assertRaises(RuntimeError):
            reader.populate(self.repository, ['data/sample[1].json'])
        self.assertEqual(target.read_bytes(), b'foreign')
        self.assertFalse((self.repository / 'data/sample[1].json').exists())

    def test_line_ending_conversion_blocks_mutation(self):
        environment = {**os.environ, 'GIT_CONFIG_COUNT': '1', 'GIT_CONFIG_KEY_0': 'core.autocrlf', 'GIT_CONFIG_VALUE_0': 'true'}
        command = [sys.executable, '-B', '-c',
            "import runpy,sys;from pathlib import Path;api=runpy.run_path(sys.argv[1]);api['populate'](Path(sys.argv[2]),['data/sample[1].json'])",
            str(location), str(self.repository)]
        result = subprocess.run(command, env=environment, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'core.autocrlf=false', result.stderr)
        self.assertFalse((self.repository / 'data/sample[1].json').exists())

    def test_tracked_foreign_change_blocks_mutation(self):
        target = self.repository / 'entrypoint.cjs'; target.write_bytes(b'foreign tracked change')
        with self.assertRaises(RuntimeError):
            reader.populate(self.repository, ['data/sample[1].json'])
        self.assertEqual(target.read_bytes(), b'foreign tracked change')
        self.assertFalse((self.repository / 'data/sample[1].json').exists())

    def test_unsafe_paths_rejected(self):
        for relative in ['../escape', '/absolute', '.git/config', 'data/../entrypoint.cjs', 'x\ny', 'C:/file', 'data\\file']:
            with self.subTest(relative=relative), self.assertRaises(ValueError):
                reader.populate(self.repository, [relative])
        self.assertFalse((self.repository / 'data/sample[1].json').exists())

    def test_current_manifest_resolves_exact_selected_artifact(self):
        repository = location.resolve().parents[4]
        paths = reader.required(repository)
        self.assertIn('reports/validation/node-windows-shutdown/hosted-2a53/confirmed/numeric/artifact-12628261403/artifact.zip', paths)
        self.assertIn('benchmarks/sources.cjs', paths)
        self.assertIn('reports/validation/range-numeric-composed-package/20261026/packages.tar.xz', paths)
        self.assertNotIn('reports/validation/node-windows-shutdown/hosted-2a53/confirmed/numeric/artifact-12629065421/artifact.zip', paths)

    def test_optimized_cli_rejected_without_touching_checkout(self):
        before = reader.git(self.repository, 'status', '--porcelain=v1')
        result = subprocess.run([sys.executable, '-O', str(location), str(self.repository)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)
        self.assertEqual(reader.git(self.repository, 'status', '--porcelain=v1'), before)

if __name__ == '__main__':
    unittest.main()
