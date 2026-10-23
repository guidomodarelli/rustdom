"""Exercise actual metadata transport and bounded filesystem effects; no runtime or sampler is loaded."""
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
spec = importlib.util.spec_from_file_location('ownership_extract', repository / '.cache/extract-current-ownership-result.py')
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class ExtractionTests(unittest.TestCase):
    def test_actual_complete_qualification_transport_preserves_all_recorded_bytes(self):
        packet = repository / 'reports/validation/native-class-ownership/current-ownership-method'
        expected = json.loads(gzip.decompress((packet / 'raw-members.json.gz').read_bytes()))
        with tempfile.TemporaryDirectory(prefix='ownership-extractor-tests-', dir='/home/guido/rustdom-validation') as temporary:
            destination = Path(temporary) / 'result'
            members = extractor.extract_archive(packet / 'qualification.tar.xz', destination,
                {'node22', 'node24', 'node22-legacy', 'node24-legacy'})
            self.assertEqual(len(members), 505)
            self.assertEqual([{key: entry[key] for key in ['path', 'bytes', 'sha256']} for entry in members], expected)
            self.assertEqual(len([entry for entry in destination.rglob('*') if entry.is_file()]), len(expected))

    def test_existing_destination_and_user_file_are_preserved(self):
        packet = repository / 'reports/validation/native-class-ownership/current-ownership-method/qualification.tar.xz'
        with tempfile.TemporaryDirectory(prefix='ownership-extractor-tests-', dir='/home/guido/rustdom-validation') as temporary:
            destination = Path(temporary) / 'result'
            destination.mkdir()
            (destination / 'sentinel').write_text('preserved user file')
            with self.assertRaises(FileExistsError):
                extractor.extract_archive(packet, destination, {'node22'})
            self.assertEqual((destination / 'sentinel').read_text(), 'preserved user file')

    def test_actual_relative_links_remain_inside_the_owner(self):
        with tempfile.TemporaryDirectory(prefix='ownership-extractor-tests-', dir='/home/guido/rustdom-validation') as temporary:
            root = Path(temporary)
            source = root / 'valid.tar'
            with tarfile.open(source, 'w') as archive:
                entry = tarfile.TarInfo('ownership-current/lib/data'); entry.size = 5
                archive.addfile(entry, io.BytesIO(b'valid'))
                link = tarfile.TarInfo('ownership-current/bin/tool'); link.type = tarfile.SYMTYPE; link.linkname = '../lib/data'
                archive.addfile(link)
                hard = tarfile.TarInfo('ownership-current/lib/hard'); hard.type = tarfile.LNKTYPE; hard.linkname = entry.name
                archive.addfile(hard)
            destination = root / 'result'
            entries = extractor.extract_archive(source, destination, {'ownership-current'})
            self.assertEqual(len(entries), 3)
            self.assertEqual((destination / 'ownership-current/bin/tool').read_bytes(), b'valid')
            self.assertEqual((destination / 'ownership-current/lib/hard').read_bytes(), b'valid')

    def test_escaping_duplicate_alias_and_unsupported_entries_fail_without_outside_writes(self):
        for kind in ['traversal', 'absolute', 'symlink', 'hardlink', 'duplicate', 'alias', 'device']:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory(prefix='ownership-extractor-tests-',
                    dir='/home/guido/rustdom-validation') as temporary:
                root = Path(temporary)
                source = root / 'invalid.tar'
                with tarfile.open(source, 'w') as archive:
                    name = 'ownership-current/file'
                    if kind == 'traversal': name = 'ownership-current/../../outside'
                    elif kind == 'absolute': name = str(root / 'outside')
                    elif kind == 'alias': name = 'ownership-current/./file'
                    entry = tarfile.TarInfo(name)
                    if kind in ('symlink', 'hardlink'):
                        entry.type = tarfile.SYMTYPE if kind == 'symlink' else tarfile.LNKTYPE
                        entry.linkname = '../../outside'
                    elif kind == 'device': entry.type = tarfile.CHRTYPE
                    archive.addfile(entry)
                    if kind == 'duplicate': archive.addfile(entry)
                with self.assertRaises(ValueError):
                    extractor.extract_archive(source, root / 'result', {'ownership-current'})
                self.assertFalse((root / 'outside').exists())


if __name__ == '__main__':
    unittest.main()
