"""Real artifact identity/integrity regressions; no network mocks or DOM execution."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

evidence = Path(sys.argv.pop(1)).resolve()
spec = importlib.util.spec_from_file_location('shared_study_collection', Path(__file__).with_name('collect.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
run = json.loads((evidence / 'run.json').read_text())
jobs = json.loads((evidence / 'jobs.json').read_text())
artifact = json.loads((evidence / 'artifacts.json').read_text())['artifacts'][0]


class TransportIdentity(unittest.TestCase):
    def test_recorded_run_and_job_match_the_single_authorized_source(self):
        collector.authenticate_run(run, jobs)

    def test_another_source_commit_cannot_borrow_this_run(self):
        altered = copy.deepcopy(run)
        altered['head_sha'] = '0' * 40
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_another_run_cannot_borrow_the_authorization(self):
        altered = copy.deepcopy(run)
        altered['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_a_second_attempt_cannot_replace_the_first(self):
        altered = copy.deepcopy(run)
        altered['run_attempt'] = 2
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_another_job_cannot_replace_the_observed_child(self):
        altered = copy.deepcopy(jobs)
        altered['jobs'][0]['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_run(run, altered)

    def test_another_workflow_cannot_be_reclassified_as_this_study(self):
        altered = copy.deepcopy(run)
        altered['path'] = '.github/workflows/ownership-current-source.yml'
        with self.assertRaises(AssertionError):
            collector.authenticate_run(altered, jobs)

    def test_original_download_matches_api_digest_size_and_zip_crc(self):
        collector.authenticate_artifact(artifact, evidence / 'artifact.zip')

    def test_one_changed_byte_cannot_borrow_the_original_artifact_digest(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-study-transport-') as temporary:
            changed = Path(temporary) / 'changed.zip'
            shutil.copyfile(evidence / 'artifact.zip', changed)
            with changed.open('r+b') as content:
                content.seek(-1, 2)
                previous = content.read(1)[0]
                content.seek(-1, 2)
                content.write(bytes([previous ^ 1]))
            with self.assertRaises(AssertionError):
                collector.authenticate_artifact(artifact, changed)


if __name__ == '__main__':
    unittest.main(verbosity=2)
