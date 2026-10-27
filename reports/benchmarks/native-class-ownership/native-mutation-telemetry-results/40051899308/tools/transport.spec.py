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
spec = importlib.util.spec_from_file_location('native_telemetry_collection', Path(__file__).with_name('collect.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
run = json.loads((evidence / 'run.json').read_text())
jobs = json.loads((evidence / 'jobs.json').read_text())
artifact = json.loads((evidence / 'artifacts.json').read_text())['artifacts'][0]
import extract
import materialize


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

    def test_another_artifact_id_cannot_borrow_identical_metadata(self):
        altered = copy.deepcopy(artifact)
        altered['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(altered, evidence / 'artifact.zip')

    def test_artifact_from_another_run_cannot_borrow_the_archive(self):
        altered = copy.deepcopy(artifact)
        altered['workflow_run']['id'] += 1
        with self.assertRaises(AssertionError):
            collector.authenticate_artifact(altered, evidence / 'artifact.zip')

    def test_reconstruction_preserves_an_existing_destination_and_user_file(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-native-existing-') as temporary:
            destination = Path(temporary) / 'existing'
            destination.mkdir()
            sentinel = destination / 'user.txt'
            sentinel.write_text('preserve this file', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                materialize.materialize(Path(__file__).resolve().parents[1], destination)
            self.assertEqual(sentinel.read_text(encoding='utf-8'), 'preserve this file')
            self.assertEqual([filename.name for filename in destination.iterdir()], ['user.txt'])

    def test_extraction_refuses_another_commit_before_touching_the_destination(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-native-wrong-source-') as temporary:
            collection = Path(temporary) / 'collection'
            collection.mkdir()
            state = json.loads((evidence / 'collection.json').read_text(encoding='utf-8'))
            state['head'] = '0' * 40
            (collection / 'collection.json').write_text(json.dumps(state), encoding='utf-8')
            destination = Path(temporary) / 'archive'
            with self.assertRaises(AssertionError):
                extract.extract(Path(temporary), collection, destination)
            self.assertFalse(destination.exists())

    def test_part_order_and_whole_file_fingerprint_cannot_redefine_published_bytes(self):
        original = json.loads((Path(__file__).resolve().parents[1] / 'parts.json').read_text(encoding='utf-8'))
        for variant in ['reordered', 'escaping', 'changed-whole-digest']:
            with self.subTest(variant=variant), tempfile.TemporaryDirectory(prefix='rustdom-native-parts-') as temporary:
                packet = Path(temporary) / 'packet'
                packet.mkdir()
                altered = copy.deepcopy(original)
                if variant == 'reordered':
                    altered['artifact.zip']['parts'][:2] = reversed(altered['artifact.zip']['parts'][:2])
                elif variant == 'escaping':
                    altered['artifact.zip']['parts'][0]['name'] = '../outside'
                else:
                    altered['artifact.zip']['sha256'] = '0' * 64
                (packet / 'parts.json').write_text(json.dumps(altered), encoding='utf-8')
                with self.assertRaises(AssertionError):
                    materialize.materialize(packet, Path(temporary) / 'destination')

    def test_optimized_python_cannot_bypass_any_transport_entrypoint(self):
        import subprocess
        for name in ['collect.py', 'extract.py', 'materialize.py']:
            with self.subTest(name=name):
                result = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name(name))], capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('non-optimized Python', result.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
