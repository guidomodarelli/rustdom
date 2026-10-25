"""Exercise the real assembled payload, resource links and preservation boundaries on Linux."""
import os
from pathlib import Path
import tempfile
import unittest

import assemble

ROOT = Path(os.environ['RUSTDOM_OWNER_BATCH_ASSEMBLED'])
COLLECTION = assemble.REPOSITORY / 'reports/validation/static-range-owner-batch-ci/40205226009'
NODE = Path(os.environ['RUSTDOM_OWNER_BATCH_NODE'])


class AssemblyContracts(unittest.TestCase):
    def test_real_package_preserves_hosted_binary_and_distinct_actual_source_identities(self):
        result = assemble.verify(ROOT, COLLECTION, NODE)
        self.assertTrue(result['verified'])
        self.assertEqual(result['candidateFiles'], 577)
        self.assertEqual(result['sourceFiles'], 346)
        self.assertFalse(result['canonicalReproductionIsHostedCompiler'])
        self.assertFalse(result['runtimeExecuted'])
        self.assertIsNone(result['performanceAccepted'])
        self.assertFalse(result['gateReevaluated'])
        self.assertEqual(result['canonicalReproductionIdentity']['sourceGitErrors'], [])
        self.assertTrue(result['canonicalReproductionIdentity']['sourceChanges'])
        self.assertIsNone(result['sourceSnapshotIdentity']['sourceCommit'])
        self.assertTrue(result['sourceSnapshotIdentity']['sourceGitErrors'])

    def corrupt_owned_assembly(self, relative, mutate):
        """Corrupt only the new agent-owned, unsealed assembly under an exclusive lock, then restore its exact member.

        The original authenticated archive, source checkout and historical controls are never mutated.
        This avoids duplicating the entire dependency tree into a memory filesystem for one changed member.
        """
        lock = ROOT.parent / '.owner-batch-assembly-contract.lock'
        with lock.open('x'):
            try:
                filename = ROOT / relative
                is_link = filename.is_symlink()
                original = filename.readlink() if is_link else filename.read_bytes()
                before = assemble.runtime_files(ROOT / 'candidate')
                try:
                    mutate(filename)
                    with self.assertRaises(AssertionError):
                        assemble.verify(ROOT, COLLECTION, NODE)
                finally:
                    if filename.is_symlink() or filename.exists():
                        filename.unlink()
                    if is_link:
                        filename.symlink_to(original, target_is_directory=True)
                    else:
                        filename.write_bytes(original)
                    self.assertEqual(assemble.runtime_files(ROOT / 'candidate'), before)
            finally:
                lock.unlink()

    def test_runtime_byte_change_is_rejected_without_rebuilding(self):
        def mutate(filename):
            with filename.open('ab') as stream:
                stream.write(b'\n')
        self.corrupt_owned_assembly('candidate/dist/abort-signal.cjs', mutate)

    def test_dependency_link_cannot_resolve_outside_its_sealed_controls(self):
        def mutate(link):
            link.unlink()
            link.symlink_to(ROOT / 'controls/node_modules', target_is_directory=True)
        self.corrupt_owned_assembly('candidate/node_modules', mutate)

    def test_existing_destination_is_preserved_before_reading_or_copying_inputs(self):
        with tempfile.TemporaryDirectory(prefix='owner-batch-existing-') as directory:
            target = Path(directory) / 'existing'; target.mkdir()
            marker = target / 'partial'; marker.write_bytes(b'preserve partial')
            with self.assertRaises(AssertionError):
                assemble.prepare(ROOT / 'controls', COLLECTION, ROOT / 'candidate-sources', target, NODE)
            self.assertEqual(marker.read_bytes(), b'preserve partial')


if __name__ == '__main__':
    unittest.main()
