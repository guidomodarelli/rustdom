"""Exercise the bounded document contract with real HANDOFF bytes, without network or DOM."""
import argparse
import hashlib
import json
from pathlib import Path
import unittest

BASE = Path(__file__).resolve().parent
MODULE = {}
ORIGINAL = b''


class DocumentContract(unittest.TestCase):
    def test_real_document_is_preserved_exactly(self):
        section = '## Resultado de prueba\n\nContenido con acentos: á.\n\n'.encode()
        result = MODULE['prepend_document'](ORIGINAL, section)
        split = ORIGINAL.index(b'\n') + 1
        self.assertEqual(result[:split], ORIGINAL[:split])
        self.assertEqual(result[split:split + len(section) + 1], b'\n' + section)
        self.assertEqual(result[split + len(section) + 1:], ORIGINAL[split:])

    def test_existing_crlf_body_is_preserved(self):
        original = b'# Title\r\n\r\nOld body\r\n'
        self.assertEqual(MODULE['prepend_document'](original, b'## New\n\n'),
            b'# Title\r\n\n## New\n\n\r\nOld body\r\n')

    def test_exact_combined_bound_is_accepted(self):
        section = b'## New\n\n'
        original = b'# Title\n' + b'x' * (MODULE['POLICY']['maximumHandoffBytes'] - 8 - 1 - len(section))
        self.assertEqual(len(MODULE['prepend_document'](original, section)),
            MODULE['POLICY']['maximumHandoffBytes'])

    def test_combined_overflow_is_rejected(self):
        original = b'# Title\n' + b'x' * (MODULE['POLICY']['maximumHandoffBytes'] - 8)
        with self.assertRaises(ValueError):
            MODULE['prepend_document'](original, b'## New\n\n')

    def test_invalid_document_inputs_are_rejected(self):
        for original in [b'', b'# Missing newline', b'not a title\n', b'# Title\n\x00',
                b'# Title\n\xff', '# Title\n', None]:
            with self.subTest(original=repr(original)), self.assertRaises((ValueError, UnicodeError)):
                MODULE['prepend_document'](original, b'## New\n\n')

    def test_invalid_sections_are_rejected(self):
        for section in [b'', b'# Wrong level\n\n', b'## No final blank\n', b'## New\r\n\r\n',
                b'## New\n\x00\n', b'## New\n\xff\n', '## New\n\n', None,
                b'## New\n' + b'x' * MODULE['POLICY']['maximumSectionBytes'] + b'\n\n']:
            with self.subTest(section=repr(section[:40]) if section else section), self.assertRaises((ValueError, UnicodeError)):
                MODULE['prepend_document'](ORIGINAL, section)

    def test_receipts_never_overwrite_prior_evidence(self):
        import tempfile
        with tempfile.TemporaryDirectory(prefix='rustdom-handoff-receipt-') as temporary:
            filename = Path(temporary) / 'receipt.json'
            MODULE['write_receipt'](filename, {'accepted': False})
            with self.assertRaises(FileExistsError):
                MODULE['write_receipt'](filename, {'accepted': True})
            self.assertEqual(json.loads(filename.read_bytes()), {'accepted': False})


def main():
    global MODULE, ORIGINAL
    parser = argparse.ArgumentParser()
    parser.add_argument('--lock-sha256', required=True)
    parser.add_argument('--original', type=Path, required=True)
    arguments = parser.parse_args()
    lock_raw = (BASE / 'constants/metadata-reader.lock.json').read_bytes()
    if hashlib.sha256(lock_raw).hexdigest() != arguments.lock_sha256:
        raise ValueError('Metadata tests require the explicitly selected extension lock')
    lock = json.loads(lock_raw)
    for relative, pin in lock['files'].items():
        raw = (BASE / relative).read_bytes()
        if len(raw) != pin['bytes'] or hashlib.sha256(raw).hexdigest() != pin['sha256']:
            raise ValueError('Metadata test dependency differs: ' + relative)
    filename = BASE / 'metadata.py'
    MODULE = {'__name__': 'metadata_contract_under_test', '__file__': str(filename)}
    exec(compile(filename.read_bytes(), str(filename), 'exec'), MODULE)
    ORIGINAL = arguments.original.read_bytes()
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(DocumentContract))
    raise SystemExit(not result.wasSuccessful())


if __name__ == '__main__':
    main()
