"""Exercise the actual assembled Linux distribution and damaged independent data; no mocked platform libraries."""
import contextlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest

location = Path(__file__).with_name('assemble.py')
reader = types.ModuleType('current_numeric_package')
reader.__file__ = str(location)
exec(compile(location.read_bytes(), str(location), 'exec'), reader.__dict__)
root, node22, node24 = map(lambda value: Path(value).resolve(strict=True), sys.argv[1:4])
sys.argv = [sys.argv[0]]

class NumericPackageContracts(unittest.TestCase):
    @contextlib.contextmanager
    def changed(self, relative, contents):
        target = root / relative
        original = target.read_bytes()
        lock = root.parent / 'numeric-package-contract.lock'
        with lock.open('x', encoding='utf-8') as stream:
            stream.write(str(os.getpid()))
        try:
            target.write_bytes(contents)
            yield
        finally:
            target.write_bytes(original)
            lock.unlink()
        self.assertTrue(reader.verify(root, node24)['verified'])

    def test_complete_actual_package_in_both_sdks(self):
        for node in [node22, node24]:
            result = reader.verify(root, node)
            self.assertEqual(result['runtimeFiles'], 575)
            self.assertEqual(result['declaredCompilerInputs'], 344)
            self.assertEqual(result['artifactId'], 12628261403)
            self.assertIsNone(result['performanceAccepted'])
            self.assertFalse(result['runtimeExecuted'])

    def test_changed_javascript_runtime_is_rejected(self):
        with self.changed('candidate/dist/index.cjs', b'changed runtime'):
            with self.assertRaises(AssertionError):
                reader.verify(root, node24)

    def test_changed_native_addon_is_rejected(self):
        with self.changed('candidate/dist/rustdom.node', b'changed addon'):
            with self.assertRaises(AssertionError):
                reader.verify(root, node24)

    def test_changed_declared_source_is_rejected(self):
        with self.changed('candidate-sources/src/dom/native-tree.cjs', b'changed source'):
            with self.assertRaises(AssertionError):
                reader.verify(root, node24)

    def test_fabricated_git_identity_is_rejected(self):
        relative = 'assembly-index.json'
        index = json.loads((root / relative).read_bytes())
        index['sourceSnapshotIdentity']['sourceCommit'] = reader.POLICY['baseCommit']
        with self.changed(relative, json.dumps(index).encode()):
            with self.assertRaises(AssertionError):
                reader.verify(root, node24)

    def test_changed_hosted_receipt_is_rejected(self):
        receipt = json.loads((root / 'hosted-receipt.json').read_bytes())
        receipt['functionalQualified'] = False
        with self.changed('hosted-receipt.json', json.dumps(receipt).encode()):
            with self.assertRaises(AssertionError):
                reader.verify(root, node24)

    def test_existing_destination_is_preserved(self):
        original = (root / 'assembly-index.json').read_bytes()
        with self.assertRaises(AssertionError):
            reader.prepare(root / 'controls', root / 'candidate-sources', root, node24)
        self.assertEqual((root / 'assembly-index.json').read_bytes(), original)

    def test_output_inside_repository_is_rejected_without_creation(self):
        target = reader.REPOSITORY / '.cache/forbidden-numeric-package-output'
        self.assertFalse(target.exists())
        with self.assertRaises(AssertionError):
            reader.prepare(root / 'controls', root / 'candidate-sources', target, node24)
        self.assertFalse(target.exists())

    def test_additional_source_symlink_is_rejected(self):
        link = root / 'candidate-sources/unknown-source-link'
        link.symlink_to('src', target_is_directory=True)
        try:
            with self.assertRaises(AssertionError):
                reader.verify(root, node24)
        finally:
            link.unlink()
        self.assertTrue(reader.verify(root, node24)['verified'])

    def test_dependency_target_is_bound(self):
        link = root / 'candidate/node_modules'
        original = link.readlink()
        link.unlink(); link.symlink_to('../unknown-dependencies')
        try:
            with self.assertRaises(AssertionError):
                reader.verify(root, node24)
        finally:
            link.unlink(); link.symlink_to(original, target_is_directory=True)
        self.assertTrue(reader.verify(root, node24)['verified'])

    def test_changed_transitive_policy_rejected_before_node_execution(self):
        binding = reader.POLICY['readerGraph']
        receipt = json.loads((reader.REPOSITORY / binding['path']).read_bytes())
        with tempfile.TemporaryDirectory(prefix='numeric-reader-graph-', dir='/dev/shm') as temporary:
            copy = Path(temporary)
            for relative in [binding['path'], *receipt['files']]:
                target = copy / relative; target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(reader.REPOSITORY / relative, target)
            self.assertEqual(reader.verify_reader_graph(copy)['files'], 786)
            policy = copy / 'reports/benchmarks/native-class-ownership/range-combined-packages/constants/baselines.json'
            policy.write_bytes(b'{"changedPolicy":true}')
            with self.assertRaises(AssertionError):
                reader.verify_reader_graph(copy)

    def test_optimized_cli_rejected(self):
        result = subprocess.run([sys.executable, '-O', str(location), '--verify', str(root), str(node24)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)

if __name__ == '__main__':
    unittest.main()
