"""Exercise real ZIP/filesystem restoration, corruption and hostile member contracts."""
from pathlib import Path
import hashlib
import runpy
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile

MODULE = runpy.run_path(str(Path(__file__).with_name('materialize-ci-artifact.py')))
materialize = MODULE['materialize']


class MaterializationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def archive(self, entries):
        filename = self.root/'artifact.zip'
        with zipfile.ZipFile(filename,'w',zipfile.ZIP_DEFLATED) as archive:
            for name, payload in entries:
                member = zipfile.ZipInfo('literal-name')
                member.filename = name
                member.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(member,payload)
        with zipfile.ZipFile(filename) as archive:
            members = [{'path':member.filename,'bytes':member.file_size,'crc32':member.CRC,
                'sha256':hashlib.sha256(archive.read(member)).hexdigest()} for member in archive.infolist()]
        artifact = {'id':1,'bytes':filename.stat().st_size,'sha256':hashlib.sha256(filename.read_bytes()).hexdigest(),'members':members}
        return filename, artifact

    def test_restores_bytes_and_preserves_existing_output(self):
        filename, artifact = self.archive([('datos/ámbito.json',b'{"ok":true}'),('empty',b'')])
        destination = self.root/'output'
        result = materialize(filename,artifact,destination)
        self.assertTrue(result['allMemberDigestsVerified'])
        self.assertEqual(result['files'],2)
        self.assertEqual((destination/'datos/ámbito.json').read_bytes(),b'{"ok":true}')
        self.assertEqual((destination/'empty').read_bytes(),b'')
        with self.assertRaises(FileExistsError):materialize(filename,artifact,destination)
        self.assertEqual((destination/'datos/ámbito.json').read_bytes(),b'{"ok":true}')

    def test_rejects_changed_archive_before_creating_output(self):
        filename, artifact = self.archive([('value',b'original')])
        filename.write_bytes(filename.read_bytes()+b'changed')
        with self.assertRaisesRegex(ValueError,'authenticated size or digest'):
            materialize(filename,artifact,self.root/'output')
        self.assertFalse((self.root/'output').exists())

    def test_rejects_changed_member_digest_and_preserves_partial(self):
        filename, artifact = self.archive([('value',b'original')])
        artifact['members'][0]['sha256'] = hashlib.sha256(b'different').hexdigest()
        with self.assertRaisesRegex(ValueError,'authenticated digest'):
            materialize(filename,artifact,self.root/'output')
        self.assertEqual((self.root/'output/value').read_bytes(),b'original')

    def test_rejects_missing_inventory_member(self):
        filename, artifact = self.archive([('first',b'one'),('second',b'two')])
        artifact['members'].pop()
        with self.assertRaisesRegex(ValueError,'authenticated inventory'):
            materialize(filename,artifact,self.root/'output')
        self.assertFalse((self.root/'output').exists())

    def test_rejects_traversal_and_windows_aliases(self):
        for case_index, name in enumerate(['../escape','/absolute','C:drive','folder\\escape','aux.txt','trailing.','a//b','a/./b','bad?.txt']):
            with self.subTest(name=name):
                filename, artifact = self.archive([(name,b'unsafe')])
                destination = self.root/('output-'+str(case_index))
                with self.assertRaises(ValueError):materialize(filename,artifact,destination)
                self.assertFalse(destination.exists())

    def test_rejects_casefold_and_file_directory_collisions(self):
        for entries in [[('Name',b'a'),('name',b'b')],[('parent',b'a'),('parent/child',b'b')]]:
            filename, artifact = self.archive(entries)
            with self.assertRaises(ValueError):materialize(filename,artifact,self.root/'output')
            self.assertFalse((self.root/'output').exists())

    def test_rejects_symbolic_link_member(self):
        filename, artifact = self.archive([('link',b'target')])
        with zipfile.ZipFile(filename,'w') as archive:
            member = zipfile.ZipInfo('link')
            member.create_system = 3
            member.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(member,b'target')
        artifact['bytes'] = filename.stat().st_size
        artifact['sha256'] = hashlib.sha256(filename.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError,'special member'):
            materialize(filename,artifact,self.root/'output')
        self.assertFalse((self.root/'output').exists())

    def test_cli_rejects_internal_equal_and_ancestor_destinations_without_writing(self):
        repository = self.root/'checkout'
        repository.mkdir()
        sentinel = repository/'preserve'
        sentinel.write_bytes(b'untouched')
        for destination in [repository/'new',repository,self.root]:
            result = subprocess.run([sys.executable,str(Path(__file__).with_name('materialize-ci-artifact.py')),
                str(repository),'12677667127',str(self.root/'unused.zip'),str(destination)],capture_output=True,timeout=30)
            self.assertNotEqual(result.returncode,0)
            self.assertIn(b'outside the repository',result.stderr)
            self.assertEqual(result.stdout,b'')
            self.assertEqual(list(repository.iterdir()),[sentinel])
            self.assertEqual(sentinel.read_bytes(),b'untouched')


if __name__ == '__main__':
    unittest.main()
