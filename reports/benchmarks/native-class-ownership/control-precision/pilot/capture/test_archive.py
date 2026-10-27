"""Real filesystem/transport contracts; generated adverse headers are data, never executable modules."""
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parent
specification = importlib.util.spec_from_file_location('current_pilot_archive_reader', SOURCE / 'archive.py')
reader = importlib.util.module_from_spec(specification)
specification.loader.exec_module(reader)


class ArchiveContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='rustdom-pilot-archive-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def generated(self, entries, tail=b''):
        """Small literal USTAR fixtures exercise decoding boundaries without allocating their declared bodies."""
        body = bytearray()
        for name, kind, content, size in entries:
            entry = tarfile.TarInfo(name); entry.type = kind; entry.size = len(content) if size is None else size
            body.extend(entry.tobuf(format=tarfile.USTAR_FORMAT))
            body.extend(content); body.extend(b'\0' * ((-len(content)) % 512))
        body.extend(b'\0' * 1024); body.extend(tail)
        target = self.root / ('adverse-' + str(len(list(self.root.glob('adverse-*')))) + '.tar.gz')
        target.write_bytes(gzip.compress(bytes(body)))
        return target, hashlib.sha256(target.read_bytes()).hexdigest()

    def test_roundtrip_keeps_raw_partial_data_and_inventory_without_loading_archived_code(self):
        data = self.root / 'input'; data.mkdir()
        (data / 'report.json').write_bytes(b'{"complete":false,"observed":[]}\n')
        (data / 'producer.cjs').write_bytes(b'archived implementation is data')
        (data / 'empty.log').write_bytes(b'')
        archive = self.root / 'data.tar.gz'
        receipt = reader.pack(data, archive)
        verification = reader.read_archive(archive, receipt['archiveSha256'])
        self.assertEqual(verification['regularFiles'], 4)
        destination = self.root / 'unpacked'
        extracted = reader.read_archive(archive, receipt['archiveSha256'], destination)
        self.assertTrue(extracted['extracted']); self.assertFalse(extracted['DOMExecuted'])
        self.assertIsNone(extracted['performanceAccepted'])
        for member in data.iterdir():
            self.assertEqual(member.read_bytes(), (destination / member.name).read_bytes())
        self.assertFalse(json.loads((destination / 'report.json').read_bytes())['complete'])

    def test_external_digest_is_required_and_existing_output_is_preserved(self):
        data = self.root / 'input'; data.mkdir(); (data / 'data.json').write_bytes(b'{}')
        archive = self.root / 'data.tar.gz'; receipt = reader.pack(data, archive)
        with self.assertRaises(AssertionError):
            reader.read_archive(archive, '0' * 64)
        destination = self.root / 'existing'; destination.mkdir(); (destination / 'foreign').write_bytes(b'preserve')
        with self.assertRaises(AssertionError):
            reader.read_archive(archive, receipt['archiveSha256'], destination)
        self.assertEqual((destination / 'foreign').read_bytes(), b'preserve')
        with self.assertRaises(AssertionError):
            reader.pack(data, archive)

    def test_rejects_aliases_traversal_platform_devices_and_control_characters(self):
        for name in ['../outside', '/absolute', 'a/../b', 'a//b', 'a\\b', 'c:drive', 'nul.json', 'dir/CON', 'trailing.', 'space ', 'a\nb', 'e\u0301']:
            with self.subTest(name=name), self.assertRaises(AssertionError):
                reader.relative_name(name)

    def test_rejects_extensions_links_special_files_and_oversized_headers_before_body_allocation(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.XHDTYPE, tarfile.GNUTYPE_LONGNAME]:
            archive, checksum = self.generated([('criterion/member', kind, b'', 0)])
            with self.subTest(kind=kind), self.assertRaises(AssertionError):
                reader.read_archive(archive, checksum)
        archive, checksum = self.generated([('criterion/huge', tarfile.REGTYPE, b'', reader.POLICY['maximumArchiveMemberBytes'] + 1)])
        with self.assertRaises(AssertionError):
            reader.read_archive(archive, checksum)

    def test_rejects_duplicate_case_aliases_and_hidden_trailing_content(self):
        archive, checksum = self.generated([('criterion/Data', tarfile.REGTYPE, b'a', None), ('criterion/data', tarfile.REGTYPE, b'b', None)])
        with self.assertRaises(AssertionError):
            reader.read_archive(archive, checksum)
        archive, checksum = self.generated([], tail=b'hidden')
        with self.assertRaises(AssertionError):
            reader.read_archive(archive, checksum)

    def test_verify_also_rejects_a_coherently_rehashed_but_false_internal_inventory(self):
        manifest = json.dumps({'revision': reader.POLICY['revision'], 'dataOnly': True, 'files': {}}).encode()
        archive, checksum = self.generated([('criterion/data.json', tarfile.REGTYPE, b'{}', None),
            ('criterion/file-inventory.json', tarfile.REGTYPE, manifest, None)])
        with self.assertRaises(AssertionError):
            reader.read_archive(archive, checksum)

    def test_rejects_implicit_directory_aliases_and_file_directory_collisions(self):
        for entries in [
            [('criterion/Parent/first', tarfile.REGTYPE, b'a', None), ('criterion/parent/second', tarfile.REGTYPE, b'b', None)],
            [('criterion/parent', tarfile.REGTYPE, b'a', None), ('criterion/parent/child', tarfile.REGTYPE, b'b', None)],
            [('criterion/parent/child', tarfile.REGTYPE, b'a', None), ('criterion/parent', tarfile.REGTYPE, b'b', None)]]:
            archive, checksum = self.generated(entries)
            with self.assertRaises(AssertionError):
                reader.read_archive(archive, checksum)

    def test_optimized_cli_is_rejected_before_opening_inputs(self):
        child = subprocess.run([sys.executable, '-O', '-B', str(SOURCE / 'archive.py'), '--verify', 'unused', '0' * 64], capture_output=True)
        self.assertNotEqual(child.returncode, 0)
        self.assertIn(b'requires non-optimized Python', child.stderr)


if __name__ == '__main__':
    unittest.main()
