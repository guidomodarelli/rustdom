"""Exercise the numerical contract, including pairing and the pooled estimator."""
import math
import json
import pathlib
import tempfile
import unittest

from analyze import analyze, pooled_change, sensitivity


class ControlSensitivityTests(unittest.TestCase):
    def test_identical_control_is_zero_in_every_scenario(self):
        result = sensitivity([{'A': [1, 2, 3], 'B': [1, 2, 3]}] * 4, 2)
        self.assertEqual(result['nominalChangePercent'], 0)
        self.assertEqual(result['leaveOnePositionOutCalibrated'], 4)
        self.assertEqual([item['changePercent'] for item in result['leaveOnePositionOut']], [0] * 4)

    def test_preserves_positive_and_negative_changes(self):
        for multiplier in [1.1, 0.9]:
            with self.subTest(multiplier=multiplier):
                result = sensitivity([{'A': [1, 2, 3], 'B': [value * multiplier for value in [1, 2, 3]]}] * 3, 2)
                self.assertAlmostEqual(result['nominalChangePercent'], (multiplier - 1) * 100)
                self.assertEqual(result['leaveOnePositionOutCalibrated'], 0)

    def test_uses_pooled_samples_instead_of_medians_of_process_medians(self):
        positions = [{'A': [1, 1, 100], 'B': [4, 4, 4]},
                     {'A': [2, 100, 100], 'B': [4, 4, 4]}]
        self.assertAlmostEqual(pooled_change(positions), (4 / 51 - 1) * 100)

    def test_deletes_the_same_position_from_both_labels(self):
        positions = [{'A': [1], 'B': [4]}, {'A': [3], 'B': [3]}, {'A': [4], 'B': [8]}]
        result = sensitivity(positions, 2)
        self.assertEqual(result['nominalChangePercent'], (4 / 3 - 1) * 100)
        expected = [(5.5 / 3.5 - 1) * 100, (6 / 2.5 - 1) * 100, (3.5 / 2 - 1) * 100]
        self.assertEqual([item['changePercent'] for item in result['leaveOnePositionOut']], expected)
        self.assertEqual([item['omittedPosition'] for item in result['leaveOnePositionOut']], [0, 1, 2])

    def test_can_report_a_pass_that_is_sensitive_to_deletion(self):
        result = sensitivity([{'A': [10], 'B': [9]}, {'A': [10], 'B': [10]}, {'A': [10], 'B': [11]}], 2)
        self.assertTrue(result['nominalCalibrated'])
        self.assertEqual(result['leaveOnePositionOutCalibrated'], 1)
        self.assertEqual(result['nominalChangePercent'], 0)

    def test_rejects_insufficient_paired_positions(self):
        for positions in [[], [{'A': [1], 'B': [1]}]]:
            with self.subTest(positions=positions), self.assertRaisesRegex(ValueError, 'two complete paired positions'):
                sensitivity(positions, 2)

    def test_rejects_missing_or_nonpositive_duration_data(self):
        for invalid in [[], [0], [-1], [math.inf], [math.nan]]:
            with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, 'finite and positive'):
                sensitivity([{'A': [1], 'B': invalid}, {'A': [1], 'B': [1]}], 2)


class ArchivedControlContractTests(unittest.TestCase):
    def check_rejected_copy(self, mutation):
        source = pathlib.Path(__file__).parent.parent / 'independent-order/39735778846'
        with tempfile.TemporaryDirectory(prefix='rustdom-control-contract-') as temporary:
            target = pathlib.Path(temporary)
            for name in ['process-sample-diagnostics.json', 'analysis/analysis.json', 'constants/profiles.json']:
                destination = target / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes((source / name).read_bytes())
            mutation(target)
            with self.assertRaises(AssertionError):
                analyze(target)

    def test_rejects_a_missing_real_control_observation(self):
        def remove_observation(target):
            path = target / 'process-sample-diagnostics.json'
            values = json.loads(path.read_bytes())
            position = next(index for index, item in enumerate(values) if item['engine'] == 'jsdom')
            values.pop(position)
            path.write_text(json.dumps(values), encoding='utf-8')
        self.check_rejected_copy(remove_observation)

    def test_rejects_duplicate_real_control_identity(self):
        def duplicate_observation(target):
            path = target / 'process-sample-diagnostics.json'
            values = json.loads(path.read_bytes())
            values.append(next(item for item in values if item['engine'] == 'jsdom'))
            path.write_text(json.dumps(values), encoding='utf-8')
        self.check_rejected_copy(duplicate_observation)

    def test_rejects_a_reference_with_a_removed_row(self):
        def remove_row(target):
            path = target / 'analysis/analysis.json'
            value = json.loads(path.read_bytes())
            value['rows'].pop()
            path.write_text(json.dumps(value), encoding='utf-8')
        self.check_rejected_copy(remove_row)


if __name__ == '__main__':
    unittest.main()
