"""Check planning arithmetic, including negative clocks and invalid batch declarations."""
import unittest

from planning import linear_projection


class PlanningContracts(unittest.TestCase):
    def test_only_the_declared_timed_work_is_scaled(self):
        self.assertEqual(linear_projection(100, 2, 16), 130)
        self.assertEqual(linear_projection(100, 2, 1), 100)

    def test_negative_wall_clock_has_no_fabricated_projection(self):
        self.assertIsNone(linear_projection(-1, 2, 16))

    def test_invalid_declarations_are_controlled_errors(self):
        for elapsed, timed, batch in [(1, -1, 16), (float('nan'), 1, 16),
                                      (1, float('inf'), 16), (1, 1, 0), (1, 1, True), (1, 1, '16')]:
            with self.subTest(values=(elapsed, timed, batch)), self.assertRaises(ValueError):
                linear_projection(elapsed, timed, batch)


if __name__ == '__main__':
    unittest.main(verbosity=2)
