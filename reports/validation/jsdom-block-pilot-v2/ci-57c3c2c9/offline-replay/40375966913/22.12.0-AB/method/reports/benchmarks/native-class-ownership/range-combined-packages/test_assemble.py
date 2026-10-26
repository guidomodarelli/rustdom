"""Exercise the real prepared Linux package and independent verifiers without loading DOM or mocking dependencies."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest

import assemble


@unittest.skipUnless(os.environ.get('RUSTDOM_COMBINED_PACKAGE_ROOT'), 'Requires the authenticated real Linux package preparation')
class AssemblyContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = Path(os.environ['RUSTDOM_COMBINED_PACKAGE_ROOT']).resolve(strict=True)
        cls.node = Path(os.environ['RUSTDOM_COMBINED_NODE']).resolve(strict=True)
        binding = json.loads((assemble.SOURCE / 'constants/artifact-binding.json').read_bytes())
        cls.collection = assemble.REPOSITORY / binding['collectionDirectory']
        cls.before = assemble.verify(cls.original, cls.collection, cls.node)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='rustdom-combined-assembly-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'prepared'
        shutil.copytree(self.original, self.root, symlinks=True)

    def read_index(self):
        return json.loads((self.root / assemble.POLICY['paths']['index']).read_bytes())

    def save_index(self, index):
        (self.root / assemble.POLICY['paths']['index']).write_text(json.dumps(index), encoding='utf-8')

    def test_public_cli_verifies_real_distributions_and_actual_snapshot_identity(self):
        import subprocess
        import sys
        result = subprocess.run([sys.executable, '-B', str(assemble.SOURCE / 'assemble.py'), '--verify', str(self.root), str(self.collection), str(self.node)], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        verified = json.loads(result.stdout)
        self.assertEqual(verified['artifactId'], self.before['artifactId'])
        self.assertIsNone(verified['sourceSnapshotIdentity']['sourceCommit'])
        self.assertEqual(len(verified['sourceSnapshotIdentity']['sourceGitErrors']), 2)
        self.assertFalse(verified['runtimeExecuted'])
        self.assertIsNone(verified['performanceAccepted'])

    def test_rejects_changed_javascript_even_after_resealing_local_receipt(self):
        target = self.root / 'candidate/dist/index.cjs'
        target.write_bytes(target.read_bytes() + b'\n')
        receipt_file = self.root / assemble.POLICY['paths']['artifactReceipt']
        receipt = json.loads(receipt_file.read_bytes())
        next(entry for entry in receipt['selectedFiles'] if entry['path'] == 'dist/index.cjs').update(bytes=target.stat().st_size, sha256=assemble.digest(target))
        receipt_file.write_text(json.dumps(receipt), encoding='utf-8')
        with self.assertRaisesRegex(AssertionError, 'changed candidate distribution'):
            assemble.verify(self.root, self.collection, self.node)

    def test_rejects_native_hardlinks_with_identical_bytes(self):
        target = self.root / 'candidate/dist/rustdom.node'
        other = Path(self.temporary.name) / 'same-native.node'
        shutil.copyfile(target, other); target.unlink(); target.hardlink_to(other)
        self.assertEqual(assemble.digest(target), self.before['binarySha256'])
        with self.assertRaisesRegex(AssertionError, 'independent candidate runtime files'):
            assemble.verify(self.root, self.collection, self.node)

    def test_rejects_javascript_symlinks_and_external_dependency_resolution(self):
        target = self.root / 'candidate/dist/index.cjs'
        other = Path(self.temporary.name) / 'same-runtime.cjs'
        shutil.copyfile(target, other); target.unlink(); target.symlink_to(other)
        with self.assertRaises(AssertionError):
            assemble.verify(self.root, self.collection, self.node)
        target.unlink(); shutil.copyfile(other, target)
        dependencies = self.root / 'candidate/node_modules'
        dependencies.unlink(); dependencies.symlink_to(self.original / 'controls/node_modules', target_is_directory=True)
        with self.assertRaises(AssertionError):
            assemble.verify(self.root, self.collection, self.node)

    def test_rejects_changed_source_even_after_resealing_snapshot_index(self):
        target = self.root / 'candidate-sources/scripts/build.mjs'
        target.write_bytes(target.read_bytes() + b'\n')
        index = self.read_index()
        index['sourceSnapshotIdentity'] = assemble.run_node(self.node, 'source-identity.cjs', self.root / 'candidate-sources')
        self.save_index(index)
        with self.assertRaisesRegex(AssertionError, 'changed compiler sources'):
            assemble.verify(self.root, self.collection, self.node)

    def test_rejects_invented_clean_git_metadata(self):
        index = self.read_index()
        index['sourceSnapshotIdentity'].update(sourceCommit=assemble.SOURCE_BINDING['identity']['sourceCommit'], sourceChanges=[], sourceGitErrors=[])
        self.save_index(index)
        with self.assertRaisesRegex(AssertionError, 'preserve actual snapshot Git metadata'):
            assemble.verify(self.root, self.collection, self.node)

    def test_rejects_whole_directory_and_metadata_aliases_outside_assembly(self):
        for key in assemble.POLICY['directoryPathKeys']:
            relative = assemble.POLICY['paths'][key]
            target = self.root / relative
            self.assertTrue(target.resolve(strict=True).is_relative_to(self.root))
            self.assertFalse(target.is_symlink())
            shutil.rmtree(target)
            target.symlink_to(self.original / relative, target_is_directory=True)
            with self.subTest(key=key), self.assertRaisesRegex(AssertionError, 'physical internal directory'):
                assemble.verify(self.root, self.collection, self.node)
            target.unlink(); shutil.copytree(self.original / relative, target, symlinks=True)
        for key in assemble.POLICY['filePathKeys']:
            relative = assemble.POLICY['paths'][key]
            target = self.root / relative
            target.unlink(); target.symlink_to(self.original / relative)
            with self.subTest(key=key), self.assertRaisesRegex(AssertionError, 'physical metadata file'):
                assemble.verify(self.root, self.collection, self.node)
            target.unlink(); shutil.copyfile(self.original / relative, target)

    def test_preserves_existing_output_and_rejects_overlap_before_copying(self):
        sentinel = self.root / 'keep'; sentinel.write_text('preserve', encoding='utf-8')
        with self.assertRaisesRegex(AssertionError, 'preserve existing output'):
            assemble.prepare(self.original / 'controls', self.collection, self.original / 'candidate-sources', self.root, self.node)
        with self.assertRaisesRegex(AssertionError, 'overlaps a protected input'):
            assemble.prepare(self.original / 'controls', self.collection, self.original / 'candidate-sources', self.original / 'controls/new-output', self.node)
        self.assertEqual(sentinel.read_text(encoding='utf-8'), 'preserve')
        self.assertFalse((self.original / 'controls/new-output').exists())

    @classmethod
    def tearDownClass(cls):
        assert assemble.verify(cls.original, cls.collection, cls.node) == cls.before


if __name__ == '__main__':
    unittest.main()
