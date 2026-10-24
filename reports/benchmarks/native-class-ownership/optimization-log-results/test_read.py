"""Check real V8 header parsing and complete preservation on the actual capture."""
import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest


METHOD = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('optimization_read', METHOD / 'read.py')
reader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reader)


class OptimizationReadingContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.capture = pathlib.Path(os.environ['RUSTDOM_OPTIMIZATION_CAPTURE'])
        index = json.loads((cls.capture / 'index.json').read_bytes())
        cls.lines = {}
        for worker in index['workers']:
            filename = cls.capture / pathlib.PurePosixPath(worker['directory']).name / 'stdout.log'
            with filename.open(encoding='utf-8') as stream:
                for line in stream:
                    for name, prefix in [('bailout', '[bailout ('), ('dependent', '[marking dependent code'),
                                         ('aborted', '[aborted optimizing'), ('eviction', '[evicting optimized code')]:
                        if name not in cls.lines and line.startswith(prefix):
                            cls.lines[name] = line
                    if len(cls.lines) == 4:
                        break
            if len(cls.lines) == 4:
                break

    def test_actual_bailout_preserves_reason_kind_tier_source_and_original_text(self):
        parsed = reader.parse_header(self.lines['bailout'])
        self.assertEqual(parsed['category'], 'bailout-start')
        self.assertEqual(parsed['reason'], 'not a String')
        self.assertEqual(parsed['kind'], 'deopt-eager')
        self.assertEqual(parsed['functionName'], 'isURL')
        self.assertEqual(parsed['source'], 'node:internal/url')
        self.assertEqual(parsed['tier'], 'TURBOFAN')
        self.assertEqual(parsed['raw'], self.lines['bailout'].rstrip('\r\n'))

    def test_actual_dependency_record_keeps_its_reason_and_does_not_become_a_bailout(self):
        parsed = reader.parse_header(self.lines['dependent'])
        self.assertEqual(parsed['category'], 'dependent-code')
        self.assertIn('reason', parsed)
        self.assertIn('functionName', parsed)
        self.assertNotIn('kind', parsed)

    def test_unknown_headers_are_preserved_and_payload_is_not_counted_as_an_event(self):
        raw = '[future V8 log record]'
        self.assertEqual(reader.parse_header(raw), {'category': 'unclassified-bracket-line', 'raw': raw})
        self.assertIsNone(reader.parse_header('    reading input frame\n'))

    def test_actual_aborted_optimization_keeps_its_reason(self):
        parsed = reader.parse_header(self.lines['aborted'])
        self.assertEqual(parsed['category'], 'optimization-aborted')
        self.assertEqual(parsed['reason'], 'Bailed out due to dependency change')
        self.assertEqual(parsed['targetTier'], 'TURBOFAN')

    def test_actual_eviction_keeps_the_named_shared_function(self):
        parsed = reader.parse_header(self.lines['eviction'])
        self.assertEqual(parsed['category'], 'code-eviction')
        self.assertIn('functionName', parsed)
        self.assertNotIn('kind', parsed)

    def test_real_capture_authenticates_all_workers_and_writes_every_bracket_header(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-opt-reading-') as temporary:
            output = pathlib.Path(temporary) / 'reading'
            result = reader.describe(self.capture, output)
            self.assertEqual(result['inputFilesAuthenticated'], 423)
            self.assertEqual(result['methodSourceFilesMatched'], 6)
            self.assertEqual(len(result['workers']), 4)
            header_count = sum(stream['headerLines'] for worker in result['workers'] for stream in worker['streams'])
            with (output / 'headers.jsonl').open(encoding='utf-8') as ledger:
                self.assertEqual(sum(1 for line in ledger), header_count)
            for worker in result['workers']:
                for stream in worker['streams']:
                    self.assertEqual(stream['headerLines'] + stream['payloadLines'], stream['lines'])
                    self.assertEqual(sum(stream['categories'].values()), stream['headerLines'])
            self.assertFalse(result['acceptanceChanged'])
            self.assertIsNone(result['accepted'])

    def test_real_cli_without_bytecode_flag_keeps_capture_inputs_unchanged(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-opt-readonly-') as temporary:
            output = pathlib.Path(temporary) / 'reading'
            child = subprocess.run([sys.executable, str(METHOD / 'read.py'), str(self.capture), str(output)],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(child.returncode, 0, child.stderr.decode(errors='replace'))
            result = json.loads(child.stdout)
            self.assertEqual(result['inputFilesAuthenticated'], 423)
            self.assertEqual(result['workers'], 4)
            reader.authenticate(self.capture)


if __name__ == '__main__':
    unittest.main()
