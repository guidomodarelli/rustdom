"""Real audit CLI contracts, including optimized interpreters; no scientific capture."""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest


class AuditContracts(unittest.TestCase):
    """Exercise the public reader against a current generated planning report."""

    @classmethod
    def setUpClass(cls):
        cls.source = pathlib.Path(__file__).resolve().parent
        cls.report = pathlib.Path(os.environ['RUSTDOM_CONFIRMATION_PLAN']).resolve(strict=True)

    def invoke(self, report, flags=(), optimize_environment=False):
        """Launch an isolated interpreter; no inherited optimization may hide the actual test mode."""
        environment = dict(os.environ)
        environment.pop('PYTHONOPTIMIZE', None)
        if optimize_environment:
            environment['PYTHONOPTIMIZE'] = '1'
        return subprocess.run([sys.executable, '-B', *flags, str(self.source / 'audit.py'), str(report)],
                              env=environment, capture_output=True, text=True, timeout=30, check=False)

    def test_real_report_is_verified(self):
        result = self.invoke(self.report)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['verified'])

    def test_corrupted_denominator_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-confirmation-audit-') as directory:
            changed = json.loads(self.report.read_text(encoding='utf-8'))
            changed['population']['processes'] = 0
            report = pathlib.Path(directory) / 'altered.json'
            report.write_text(json.dumps(changed), encoding='utf-8')
            result = self.invoke(report)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, '')

    def test_optimized_python_is_rejected_before_acceptance(self):
        for flags, optimize_environment in [(('-O',), False), (('-OO',), False), ((), True)]:
            with self.subTest(flags=flags, environment=optimize_environment):
                result = self.invoke(self.report, flags, optimize_environment)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')
                self.assertIn('optimized Python disables required checks', result.stderr)


if __name__ == '__main__':
    unittest.main()
