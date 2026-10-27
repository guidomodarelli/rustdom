"""Exercise the real current run identity, ownership boundaries and filesystem; never mock GitHub, DOM or platform libraries."""
import copy
from contextlib import contextmanager
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import collect as adapter

repository, collection = map(lambda value: Path(value).resolve(strict=True), sys.argv[1:3])
del sys.argv[1:3]
run = json.loads((collection / 'run.json').read_bytes())
jobs = json.loads((collection / 'jobs.json').read_bytes())
reader = adapter.current_reader(repository)


@contextmanager
def owned_directory():
    """Keep all destructive cleanup inside a newly created, verified test directory."""
    parent = (repository / '.cache').resolve(strict=True)
    directory = Path(tempfile.mkdtemp(prefix='range-transport-owned-', dir=parent)).resolve(strict=True)
    try:
        yield directory
    finally:
        assert directory.resolve(strict=True) == directory and directory.parent == parent
        assert directory.name.startswith('range-transport-owned-') and not directory.is_symlink()
        shutil.rmtree(directory)


class RangeStudyTransport(unittest.TestCase):
    def test_actual_run_and_job_authenticate_after_the_pr_reference_moves(self):
        reader.authenticate_run(run, jobs)
        changed = copy.deepcopy(run)
        changed['pull_requests'][0]['head']['sha'] = '1' * 40
        reader.authenticate_run(changed, jobs)
        self.assertEqual(run['head_sha'], adapter.POLICY['head'])

    def test_other_run_source_attempt_or_workflow_is_rejected(self):
        for field, value in [('id', 1), ('head_sha', '0' * 40), ('run_attempt', 2), ('path', '.github/workflows/ci.yml')]:
            changed = copy.deepcopy(run)
            changed[field] = value
            with self.subTest(field=field), self.assertRaises(AssertionError):
                reader.authenticate_run(changed, jobs)

    def test_another_job_cannot_be_selected(self):
        changed = copy.deepcopy(jobs)
        changed['jobs'][0]['id'] += 1
        with self.assertRaises(AssertionError):
            reader.authenticate_run(run, changed)

    def test_foreign_nonempty_output_is_unchanged_before_any_api(self):
        with owned_directory() as directory:
            output = directory / 'foreign'
            output.mkdir()
            sentinel = output / 'run.json'
            sentinel.write_bytes(b'foreign data')
            original_repository = os.environ.get('GH_REPO')
            with self.assertRaises(AssertionError):
                adapter.collect(repository, output)
            self.assertEqual(sentinel.read_bytes(), b'foreign data')
            self.assertEqual(sorted(name.name for name in output.iterdir()), ['run.json'])
            self.assertEqual(os.environ.get('GH_REPO'), original_repository)

    def test_another_collection_owner_is_not_replaced_or_snapshotted(self):
        with owned_directory() as directory:
            output = directory / 'foreign'
            output.mkdir()
            marker = output / adapter.POLICY['ownerFile']
            marker.write_bytes(b'{}')
            with self.assertRaises(AssertionError):
                adapter.collect(repository, output)
            self.assertEqual(marker.read_bytes(), b'{}')
            self.assertFalse((output / 'observations').exists())

    def test_symlink_output_cannot_snapshot_into_its_target(self):
        with owned_directory() as directory:
            target = directory / 'target'
            shutil.copytree(collection, target, ignore=shutil.ignore_patterns(adapter.POLICY['files']['zip'], adapter.POLICY['tarName']))
            linked = directory / 'linked'
            try:
                linked.symlink_to(target, target_is_directory=True)
            except OSError as error:
                self.skipTest('Directory symlinks unavailable on this host: ' + str(error))
            before = sorted(str(filename.relative_to(target)) for filename in target.rglob('*'))
            with self.assertRaises(AssertionError):
                adapter.collect(repository, linked)
            self.assertEqual(sorted(str(filename.relative_to(target)) for filename in target.rglob('*')), before)

    def test_original_api_observation_survives_later_reads(self):
        snapshots = sorted((collection / 'observations').iterdir())
        self.assertTrue(snapshots)
        for snapshot in snapshots:
            observation = json.loads((snapshot / 'reader.json').read_bytes())
            self.assertFalse(observation['readerExecutedDOM'])
            if (snapshot / 'run.json').exists():
                original = json.loads((snapshot / 'run.json').read_bytes())
                self.assertEqual(original['id'], adapter.POLICY['runId'])
                self.assertEqual(original['head_sha'], adapter.POLICY['head'])
            else:
                self.assertFalse(observation['readerCompleted'])

    def test_optimized_cli_refuses_before_output_creation(self):
        with owned_directory() as directory:
            output = directory / 'not-created'
            result = subprocess.run([sys.executable, '-O', '-B', str(Path(adapter.__file__)), str(repository), str(output)],
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('requires non-optimized Python', result.stderr)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
