"""Verify observable descriptive moments and the real read-only CLI using published data."""
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from dispersion import POLICY, group_statistics, process_statistics


class MomentContracts(unittest.TestCase):
    def test_known_sample_mean_variance_and_ordered_contrast(self):
        result = process_statistics([1, 2, 3])
        self.assertEqual(result['meanMs'], 2)
        self.assertEqual(result['sampleVarianceMsSquared'], 1)
        self.assertEqual(result['firstLastThirdChangePercent'], 200)

    def test_identical_durations_preserve_zero_variance(self):
        self.assertEqual(process_statistics([2, 2, 2])['sampleVarianceMsSquared'], 0)
        self.assertEqual(process_statistics([2, 2, 2])['firstLastThirdChangePercent'], 0)

    def test_group_moments_match_a_hand_calculated_matrix(self):
        result = group_statistics([[1, 2, 3], [3, 4, 5]])
        self.assertEqual(result['meanMs'], 3)
        self.assertEqual(result['meanWithinProcessVarianceMsSquared'], 1)
        self.assertEqual(result['processMeansVarianceMsSquared'], 2)
        self.assertAlmostEqual(result['signedMomentContrastMsSquared'], 5 / 3)
        self.assertAlmostEqual(result['withinToMeansVarianceRatio'], 1 / 6)
        self.assertAlmostEqual(result['pooledWithinCVPercent'], 100 / 3)
        self.assertAlmostEqual(result['processMeansCVPercent'], 100 * math.sqrt(2) / 3)

    def test_negative_signed_contrast_is_retained_without_clamping(self):
        result = group_statistics([[1, 3, 5], [1, 3, 5]])
        self.assertAlmostEqual(result['signedMomentContrastMsSquared'], -4 / 3)
        self.assertEqual(result['processMeansVarianceMsSquared'], 0)
        self.assertIsNone(result['withinToMeansVarianceRatio'])

    def test_invalid_durations_and_incomplete_thirds_are_controlled_errors(self):
        for samples in [[], [1, 2], [1, 2, 3, 4], [1, 0, 3], [1, -1, 3],
                        [1, True, 3], [1, float('nan'), 3], [1, float('inf'), 3], [1, '2', 3]]:
            with self.subTest(samples=samples), self.assertRaises(ValueError):
                process_statistics(samples)

    def test_unrepresentable_variances_are_controlled_errors(self):
        with self.assertRaises(ValueError):
            process_statistics([1e308, 1, 1e308])
        with self.assertRaises(ValueError):
            group_statistics([[1e308, 1e308, 1e308], [1, 1, 1]])

    def test_incomplete_groups_are_rejected(self):
        for matrix in [[], [[1, 2, 3]], [[1, 2, 3], [1, 2, 3, 4, 5, 6]]]:
            with self.subTest(matrix=matrix), self.assertRaises(ValueError):
                group_statistics(matrix)


class PublicCLIContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='rustdom-dispersion-')
        self.root = Path(self.temporary.name).resolve()
        self.repository = Path(__file__).resolve().parents[4]
        self.cli = Path(__file__).with_name('dispersion.py')

    def tearDown(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith('rustdom-dispersion-'))
        self.temporary.cleanup()

    def test_existing_output_is_preserved_by_the_actual_cli(self):
        output = self.root / 'existing.json'
        output.write_bytes(b'Preserve caller output')
        result = subprocess.run([sys.executable, '-B', str(self.cli), str(self.repository), str(output)],
                                capture_output=True, timeout=POLICY['testCLITimeoutSeconds'])
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_bytes(), b'Preserve caller output')

    def test_optimized_python_cannot_disable_verification(self):
        output = self.root / 'forbidden.json'
        result = subprocess.run([sys.executable, '-O', str(self.cli), str(self.repository), str(output)],
                                capture_output=True, timeout=POLICY['testCLITimeoutSeconds'])
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
