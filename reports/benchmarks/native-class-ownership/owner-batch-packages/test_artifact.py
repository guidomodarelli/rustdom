"""Exercise the actual preserved matrix and controlled transport corruptions; never substitute runtime libraries."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest

import artifact

REPOSITORY = Path(__file__).resolve().parents[4]
COLLECTION = REPOSITORY / 'reports/validation/static-range-owner-batch-ci/40205226009'


class ArtifactContracts(unittest.TestCase):
    def test_complete_real_matrix_preserves_selected_runtime_and_actual_compiler_changes(self):
        result = artifact.inspect_collection(REPOSITORY, COLLECTION)
        self.assertEqual(len(result['qualifications']), 6)
        self.assertEqual(len(result['selectedFiles']), 577)
        self.assertEqual(result['artifactId'], 12604810857)
        self.assertTrue(result['matrixQualified'])
        self.assertFalse(result['runtimeExecuted'])
        self.assertIsNone(result['performanceAccepted'])
        self.assertFalse(result['gateReevaluated'])
        for entry in result['qualifications']:
            qualification = entry['qualification']
            self.assertEqual(len(qualification['commands']), 24)
            self.assertTrue(qualification['sourceChangesRaw'])
            self.assertEqual(qualification['sourceGitErrors'], [])
            self.assertEqual(qualification['sourceCommit'], 'f781c3b7549a86b6aa8b5a34d2bbb32038c315b7')
        origin = result['compilerSourceOrigins']['scripts/build.mjs']
        self.assertFalse(origin['compilerCheckoutPresent'])
        self.assertEqual(len(origin['fixtureCopies']), 2)

    def mutated_collection(self, relative, mutate):
        """Change only an independently copied collection member; source archives stay intact."""
        with tempfile.TemporaryDirectory(prefix='owner-batch-artifact-') as directory:
            copy = Path(directory) / 'collection'
            shutil.copytree(COLLECTION, copy)
            mutate(copy / relative)
            with self.assertRaises(AssertionError):
                artifact.inspect_collection(REPOSITORY, copy)

    def test_changed_run_attempt_cannot_reuse_the_qualified_matrix(self):
        def change(filename):
            value = json.loads(filename.read_bytes()); value['run_attempt'] += 1
            filename.write_text(json.dumps(value), encoding='utf-8')
        self.mutated_collection('run.json', change)

    def test_changed_archive_bytes_are_rejected_before_runtime_loading(self):
        def change(filename):
            with filename.open('r+b') as stream:
                stream.seek(-1, os.SEEK_END)
                value = stream.read(1); stream.seek(-1, os.SEEK_END)
                stream.write(bytes([value[0] ^ 1]))
        self.mutated_collection('artifact-12604810857/artifact.zip', change)

    def test_missing_artifact_metadata_cannot_fall_back_to_another_binary(self):
        self.mutated_collection('artifact-12604810857/metadata.json', lambda filename: filename.unlink())


if __name__ == '__main__':
    unittest.main()
