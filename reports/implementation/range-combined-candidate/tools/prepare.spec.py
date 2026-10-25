"""Exercise candidate preparation through real Git checkouts and published artifact inputs, without mocks."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from prepare import POLICY, prepare

REPOSITORY = Path(sys.argv[1]).resolve(strict=True)
ORIGIN = Path(sys.argv[2]).resolve(strict=True)


class PreparationContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix=POLICY['temporaryPrefix'])
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / 'source'
        origin_git = ORIGIN if (ORIGIN / 'objects').is_dir() else ORIGIN / '.git'
        self.assertTrue(origin_git.is_dir())
        subprocess.run(['git', 'init', str(self.source)], cwd=self.root, capture_output=True, check=True)
        # Share actual Git objects without upload-pack; clone falls back to a full transfer for shallow origins.
        alternate = self.source / '.git/objects/info/alternates'
        alternate.write_text((origin_git / 'objects').as_posix() + '\n', encoding='utf-8', newline='\n')
        if (origin_git / 'shallow').exists():
            shutil.copyfile(origin_git / 'shallow', self.source / '.git/shallow')
        for argv in [['git', '-C', str(self.source), 'config', 'core.autocrlf', 'false'],
                     ['git', '-C', str(self.source), 'sparse-checkout', 'set', '--no-cone', '/*', '!/*/', '/src/', '/scripts/', '/types/', '/tests/'],
                     ['git', '-C', str(self.source), 'checkout', '--detach', POLICY['baseCommit']]]:
            subprocess.run(argv, cwd=self.root, capture_output=True, check=True, timeout=60)

    def tearDown(self):
        resolved = self.root.resolve(strict=True)
        self.assertEqual(resolved.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(resolved.name.startswith(POLICY['temporaryPrefix']))
        self.temporary.cleanup()

    def snapshot(self):
        return subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=self.source)

    def test_public_cli_prepares_declared_sources_and_six_real_tests(self):
        proof = self.root / 'proof'
        result = subprocess.run([sys.executable, '-B', str(Path(__file__).with_name('prepare.py')),
                                 str(REPOSITORY), str(self.source), str(proof)], cwd=self.root, capture_output=True, check=True)
        record = json.loads(result.stdout)
        self.assertTrue(record['prepared'])
        self.assertEqual(record['sourceCommit'], POLICY['baseCommit'])
        self.assertEqual(record['sourceBeforeChangesRaw'], '')
        self.assertEqual(record['sourceGitErrors'], [])
        self.assertEqual(record['sourceChangesRaw'].encode(), self.snapshot())
        self.assertEqual(len(record['sourceFiles']), 10)
        self.assertEqual(len(record['copiedTests']), 6)
        self.assertTrue(all((self.source / name).is_file() for name in record['copiedTests']))
        self.assertFalse(record['runtimeIntegrated']); self.assertFalse(record['benchmarkExecuted'])
        self.assertIsNone(record['performanceAccepted']); self.assertFalse(record['gateReevaluated'])
        self.assertEqual(json.loads((proof / POLICY['preparationFile']).read_bytes()), record)

    def test_dirty_checkout_is_preserved_and_real_status_remains_in_failure(self):
        marker = self.source / 'foreign.txt'; marker.write_bytes(b'preserve this input\n')
        before = self.snapshot(); proof = self.root / 'dirty-proof'
        with self.assertRaisesRegex(AssertionError, 'dirty source'):
            prepare(REPOSITORY, self.source, proof)
        self.assertEqual(marker.read_bytes(), b'preserve this input\n')
        self.assertEqual(self.snapshot(), before)
        record = json.loads((proof / POLICY['preparationFile']).read_bytes())
        self.assertFalse(record['prepared']); self.assertEqual(record['sourceChangesRaw'].encode(), before)
        self.assertEqual(record['sourceGitErrors'], [])

    def test_clean_ancestor_cannot_masquerade_as_the_declared_base(self):
        subprocess.run(['git', 'checkout', '--detach', 'HEAD^'], cwd=self.source, capture_output=True, check=True)
        actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.source).decode().strip()
        proof = self.root / 'ancestor-proof'
        with self.assertRaisesRegex(AssertionError, 'wrong source commit'):
            prepare(REPOSITORY, self.source, proof)
        record = json.loads((proof / POLICY['preparationFile']).read_bytes())
        self.assertEqual(record['sourceCommit'], actual)
        self.assertNotEqual(actual, POLICY['baseCommit']); self.assertEqual(self.snapshot(), b'')
        self.assertFalse(record['prepared'])

    def test_altered_patch_is_rejected_before_any_source_change(self):
        replica = self.root / 'input-repository'
        packet = replica / POLICY['packet']; packet.mkdir(parents=True)
        for name in ['source.json', 'range-combined.patch', 'interaction.spec.cjs']:
            shutil.copyfile(REPOSITORY / POLICY['packet'] / name, packet / name)
        functional = replica / POLICY['functionalManifest']['path']
        functional.parent.mkdir(parents=True)
        shutil.copyfile(REPOSITORY / POLICY['functionalManifest']['path'], functional)
        with (packet / 'range-combined.patch').open('ab') as stream: stream.write(b'\n')
        proof = self.root / 'altered-proof'
        with self.assertRaisesRegex(AssertionError, 'patch digest mismatch'):
            prepare(replica, self.source, proof)
        self.assertEqual(self.snapshot(), b'')
        self.assertFalse(json.loads((proof / POLICY['preparationFile']).read_bytes())['prepared'])

    def test_build_manifest_hidden_from_git_status_is_still_authenticated(self):
        subprocess.run(['git', 'update-index', '--assume-unchanged', 'Cargo.toml'], cwd=self.source, capture_output=True, check=True)
        manifest = self.source / 'Cargo.toml'
        with manifest.open('ab') as stream: stream.write(b'\n')
        altered = manifest.read_bytes()
        self.assertEqual(self.snapshot(), b'')
        proof = self.root / 'hidden-build-input'
        with self.assertRaisesRegex(AssertionError, 'Cargo.toml'):
            prepare(REPOSITORY, self.source, proof)
        self.assertEqual(manifest.read_bytes(), altered)
        self.assertFalse(json.loads((proof / POLICY['preparationFile']).read_bytes())['prepared'])

    def test_output_overlap_or_existing_evidence_is_not_modified(self):
        existing = self.root / 'previous-proof'; existing.mkdir()
        marker = existing / 'evidence.txt'; marker.write_bytes(b'original evidence\n')
        for proof in [self.source, self.source / 'proof', existing, REPOSITORY / POLICY['packet'] / 'proof']:
            with self.assertRaises(AssertionError): prepare(REPOSITORY, self.source, proof)
        self.assertEqual(self.snapshot(), b'')
        self.assertEqual(marker.read_bytes(), b'original evidence\n')
        self.assertFalse((self.source / 'proof').exists())

    def test_windows_gitfile_is_rejected_before_git_discovery_or_writes(self):
        unsupported = self.root / 'windows-worktree'; unsupported.mkdir()
        pointer = unsupported / '.git'; pointer.write_bytes(b'gitdir: C:/foreign/worktrees/source\n')
        proof = self.root / 'unsupported-proof'
        with self.assertRaisesRegex(AssertionError, 'real Git directory'):
            prepare(REPOSITORY, unsupported, proof)
        self.assertFalse(proof.exists())
        self.assertEqual(pointer.read_bytes(), b'gitdir: C:/foreign/worktrees/source\n')

    def test_optimized_python_cannot_bypass_the_preparation_guards(self):
        proof = self.root / 'optimized-proof'
        result = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name('prepare.py')),
                                 str(REPOSITORY), str(self.source), str(proof)], cwd=self.root, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'non-optimized Python', result.stderr)
        self.assertFalse(proof.exists()); self.assertEqual(self.snapshot(), b'')


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]], verbosity=2)
