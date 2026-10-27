"""Check the real complete artifact and reject altered scientific observations."""
import copy
import json
from pathlib import Path
import unittest
import zipfile
from verify import verify, verify_document


class ArtifactTests(unittest.TestCase):
    def test_real_archive(self):
        result = verify(Path(__file__).resolve().parent)
        self.assertTrue(result['calibrated'] and result['accepted'])
        self.assertEqual(result['measuredDurations'], 14976)

    def test_changed_aggregates_observations_and_omitted_rows_are_rejected(self):
        root = Path(__file__).resolve().parent
        protocol = json.loads((root / 'constants/protocol.json').read_text())
        with zipfile.ZipFile(root / 'artifact.zip') as bundle:
            source = json.loads(bundle.read('experiment.json'))
            changed = copy.deepcopy(source)
            changed['comparisons'][0]['changePercent'] += 1
            with self.assertRaises(AssertionError):
                verify_document(changed, bundle, protocol)
            changed = copy.deepcopy(source)
            changed['runs'][0]['observations']['results'][0]['measuredBatchMs'][0] *= 2
            with self.assertRaises(AssertionError):
                verify_document(changed, bundle, protocol)
            changed = copy.deepcopy(source)
            changed['referenceComparison'].pop()
            with self.assertRaises(AssertionError):
                verify_document(changed, bundle, protocol)


if __name__ == '__main__':
    unittest.main()
