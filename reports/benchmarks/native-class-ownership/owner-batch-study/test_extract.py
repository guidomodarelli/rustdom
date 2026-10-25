"""Read complete real preserved functional archives and adversarial tar data; no captured script is executed."""
import io
import json
from pathlib import Path
import tempfile
import tarfile
import unittest
import os
import py_compile
import shutil
import subprocess
import sys

from extract import read_tar

REPOSITORY = Path(__file__).resolve().parents[4]
PROOF = REPOSITORY / 'reports/validation/owner-batch-integral/20261025'


class ExtractionContracts(unittest.TestCase):
    def test_every_member_of_both_real_functional_archives_is_read(self):
        for node in ['22', '24']:
            filename = PROOF / ('node' + node + '.tar.xz')
            members = read_tar(filename, 'capture')
            descriptor = json.loads((PROOF / ('node' + node + '.json')).read_bytes())
            # The independently reviewed descriptor names every archived byte.
            expected = descriptor['members']
            self.assertEqual(len(members), len(expected) + 1)
            by_name = {entry['path']: entry for entry in members}
            self.assertEqual(by_name['capture'], {'path': 'capture', 'kind': 'directory'})
            for entry in expected:
                self.assertEqual(by_name['capture/' + entry['path']], {**entry, 'path': 'capture/' + entry['path']})

    def assert_tar_rejected(self, entries):
        with tempfile.TemporaryDirectory() as temporary:
            filename = Path(temporary) / 'adversarial.tar.xz'
            with tarfile.open(filename, 'w:xz') as archive:
                root = tarfile.TarInfo('capture'); root.type = tarfile.DIRTYPE; archive.addfile(root)
                for name, kind, raw in entries:
                    entry = tarfile.TarInfo(name); entry.type = kind
                    if kind == tarfile.REGTYPE:
                        entry.size = len(raw); archive.addfile(entry, io.BytesIO(raw))
                    else:
                        entry.linkname = '../outside'; archive.addfile(entry)
            with self.assertRaises(AssertionError): read_tar(filename, 'capture')

    def test_path_escape_and_different_root_are_rejected(self):
        for name in ['../outside', 'capture/../outside', '/absolute', 'different/file', 'capture/NUL.txt']:
            self.assert_tar_rejected([(name, tarfile.REGTYPE, b'data')])

    def test_symbolic_and_hard_links_and_devices_are_rejected(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE, tarfile.BLKTYPE, tarfile.FIFOTYPE]:
            self.assert_tar_rejected([('capture/alias', kind, b'')])

    def test_duplicate_and_case_aliases_are_rejected(self):
        for second in ['capture/file', 'capture/FILE']:
            self.assert_tar_rejected([('capture/file', tarfile.REGTYPE, b'first'), (second, tarfile.REGTYPE, b'second')])

    def test_a_file_cannot_replace_the_root_directory(self):
        self.assert_tar_rejected([('capture', tarfile.REGTYPE, b'not a directory')])

    def test_a_valid_timestamp_pyc_cannot_replace_the_reviewed_transport_source(self):
        # This is adversarial cache data in an isolated copy, not a mocked platform dependency.
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); current = Path(__file__).parent
            for name in ['extract.py', 'transport.py']:
                shutil.copyfile(current / name, root / name)
            shutil.copytree(current / 'constants', root / 'constants')
            target = root / 'transport.py'; trusted = target.read_bytes(); timestamp = int(target.stat().st_mtime)
            marker = root / 'cached-code-marker'
            poison = ('from pathlib import Path\nPath(' + repr(str(marker)) + ').write_text("cache executed")\n').encode()
            assert len(poison) < len(trusted)
            target.write_bytes(poison + b' ' * (len(trusted) - len(poison))); os.utime(target, (timestamp, timestamp))
            py_compile.compile(str(target), doraise=True)
            target.write_bytes(trusted); os.utime(target, (timestamp, timestamp))
            control = subprocess.run([sys.executable, '-B', '-c', 'import transport'], cwd=root, capture_output=True)
            self.assertEqual(control.returncode, 0, control.stderr); self.assertTrue(marker.exists()); marker.unlink()
            script = 'import runpy,json; api=runpy.run_path("extract.py"); print(json.dumps({"members":len(api["read_tar"](' + \
                'api["Path"](' + repr(str(PROOF / 'node22.tar.xz')) + '),"capture"))}))'
            actual = subprocess.run([sys.executable, '-B', '-c', script], cwd=root, capture_output=True)
            self.assertEqual(actual.returncode, 0, actual.stderr)
            self.assertEqual(json.loads(actual.stdout)['members'], 1074); self.assertFalse(marker.exists())


if __name__ == '__main__':
    unittest.main()
