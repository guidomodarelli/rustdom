"""Exercise the real full-capture CLI and reject optimized interpreters with complete physical inputs."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest


class XmlCaptureRuntimeTests(unittest.TestCase):
    def consume(self, flags=(), optimize_environment=None, archive=False, expected_sha256=None):
        environment = dict(os.environ)
        environment.pop('PYTHONOPTIMIZE', None)
        if optimize_environment is not None:
            environment['PYTHONOPTIMIZE'] = optimize_environment
        inputs = ['--archive', str(self.archive), expected_sha256 or self.archive_sha256, self.node] if archive else [
            str(self.capture), str(self.preparation), self.node]
        return subprocess.run([sys.executable, '-B', *flags, str(self.reader), *inputs], env=environment,
                              capture_output=True, text=True, encoding='utf8')

    def test_archive_cli_verifies_the_same_actual_complete_capture(self):
        result = self.consume(archive=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertIs(report.pop('archiveTransportVerified'), True)
        self.assertEqual(report.pop('archiveSha256'), self.archive_sha256)
        directory = self.consume()
        self.assertEqual(directory.returncode, 0, directory.stderr)
        self.assertEqual(report, json.loads(directory.stdout))

    def test_archive_cli_rejects_a_wrong_independently_declared_digest(self):
        result = self.consume(archive=True, expected_sha256='0' * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertIn('SHA-256 differs', result.stderr)

    def test_normal_cli_verifies_the_actual_complete_capture(self):
        result = self.consume()
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        execution = json.loads((self.capture / 'execution.json').read_text(encoding='utf8'))
        self.assertIs(report['verified'], True)
        self.assertIs(report['recordedInputsVerified'], True)
        self.assertIs(report['accepted'], execution['performanceAccepted'])
        self.assertEqual(report['recordedSources'], execution['before']['inputs']['sources'])

    def test_optimized_cli_cannot_verify_the_same_complete_capture(self):
        for archive in (False, True):
            for flags, environment_value in [(('-O',), None), (('-OO',), None), ((), '1'), ((), '2')]:
                with self.subTest(archive=archive, flags=flags, optimize=environment_value):
                    result = self.consume(flags, environment_value, archive=archive)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(result.stdout, '')
                    self.assertIn('requires Python assertions', result.stderr)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture', type=Path)
    parser.add_argument('preparation', type=Path)
    parser.add_argument('node')
    parser.add_argument('archive', type=Path)
    parser.add_argument('archive_sha256')
    arguments = parser.parse_args()
    XmlCaptureRuntimeTests.reader = Path(__file__).with_name('verify-xml-current-capture.py').resolve()
    XmlCaptureRuntimeTests.capture = arguments.capture.resolve()
    XmlCaptureRuntimeTests.preparation = arguments.preparation.resolve()
    XmlCaptureRuntimeTests.node = arguments.node
    XmlCaptureRuntimeTests.archive = arguments.archive.resolve()
    XmlCaptureRuntimeTests.archive_sha256 = arguments.archive_sha256
    unittest.main(argv=[sys.argv[0]])
