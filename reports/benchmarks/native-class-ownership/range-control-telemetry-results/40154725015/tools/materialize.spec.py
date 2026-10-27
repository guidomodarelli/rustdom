"""Exercise real lossless reconstruction and rejected inputs without executing DOM or archive code."""
import copy
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from collect import POLICY
from materialize import materialize

repository, packet = map(lambda value: Path(value).resolve(strict=True), sys.argv[1:3])
del sys.argv[1:3]
layout = POLICY['materialization']


@contextmanager
def temporary_directory():
    """Remove only this test's verified fresh directory, including on Windows."""
    parent = Path(tempfile.gettempdir()).resolve(strict=True)
    directory = Path(tempfile.mkdtemp(prefix=layout['testTemporaryPrefix'], dir=parent)).resolve(strict=True)
    try:
        yield directory
    finally:
        assert directory.resolve(strict=True) == directory and directory.parent == parent
        assert directory.name.startswith(layout['testTemporaryPrefix']) and not directory.is_symlink()
        shutil.rmtree(directory)


def digest(filename):
    observed = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            observed.update(chunk)
    return observed.hexdigest()


def thin_packet(directory):
    """Copy only real metadata for a rejection that must stop before reading the whole archives."""
    target = directory / 'input'
    target.mkdir()
    metadata = target / layout['metadataDirectory']
    metadata.mkdir()
    (target / layout['partsDirectory']).mkdir()
    for role in ['run', 'jobs', 'artifacts']:
        name = layout['metadataFiles'][role]
        shutil.copyfile(packet / layout['metadataDirectory'] / name, metadata / name)
    shutil.copyfile(packet / layout['partsManifest'], target / layout['partsManifest'])
    return target


class RangeAaMaterialization(unittest.TestCase):
    def test_both_complete_original_archives_reconstruct_and_authenticate(self):
        with temporary_directory() as directory:
            output = directory / 'reconstructed'
            result = materialize(repository, packet, output)
            self.assertTrue(result['transportAuthenticated'])
            self.assertFalse(result['DOMExecuted'])
            self.assertEqual(result['newMeasurements'], 0)
            for name, kind in [(POLICY['files']['zip'], 'zip'), (POLICY['tarName'], 'tar')]:
                self.assertEqual((output / name).stat().st_size, POLICY[kind + 'Bytes'])
                self.assertEqual(digest(output / name), POLICY[kind + 'Sha256'])
            for name in [*layout['metadataFiles'].values(), POLICY['files']['state'], POLICY['ownerFile']]:
                self.assertEqual((output / name).read_bytes(), (packet / layout['metadataDirectory'] / name).read_bytes())

    def test_existing_foreign_destination_is_unchanged(self):
        with temporary_directory() as directory:
            output = directory / 'foreign'
            output.mkdir()
            sentinel = output / 'caller.txt'
            sentinel.write_bytes(b'preserve caller data')
            with self.assertRaises(FileExistsError):
                materialize(repository, packet, output)
            self.assertEqual(sentinel.read_bytes(), b'preserve caller data')
            self.assertEqual(list(output.iterdir()), [sentinel])

    def test_packet_and_ancestor_outputs_are_rejected_before_writing(self):
        for output in [packet / 'not-created', packet.parent]:
            with self.subTest(output=output), self.assertRaisesRegex(AssertionError, 'output overlaps'):
                materialize(repository, packet, output)
        self.assertFalse((packet / 'not-created').exists())

    def test_changed_run_metadata_is_rejected_before_output_creation(self):
        with temporary_directory() as directory:
            source = thin_packet(directory)
            filename = source / layout['metadataDirectory'] / layout['metadataFiles']['run']
            altered = json.loads(filename.read_bytes())
            altered['id'] += 1
            filename.write_text(json.dumps(altered), encoding='utf-8')
            output = directory / 'not-created'
            with self.assertRaises(AssertionError):
                materialize(repository, source, output)
            self.assertFalse(output.exists())

    def test_part_path_escape_is_rejected_without_reading_an_outside_file(self):
        with temporary_directory() as directory:
            source = thin_packet(directory)
            filename = source / layout['partsManifest']
            altered = json.loads(filename.read_bytes())
            altered[POLICY['files']['zip']]['parts'][0]['name'] = '../outside'
            filename.write_text(json.dumps(altered), encoding='utf-8')
            outside = directory / 'outside'
            outside.write_bytes(b'caller outside data')
            with self.assertRaisesRegex(AssertionError, 'invalid part name'):
                materialize(repository, source, directory / 'output')
            self.assertEqual(outside.read_bytes(), b'caller outside data')

    def test_bad_part_digest_preserves_the_written_prefix_and_original_input(self):
        with temporary_directory() as directory:
            source = thin_packet(directory)
            original_manifest = (packet / layout['partsManifest']).read_bytes()
            altered = copy.deepcopy(json.loads(original_manifest))
            first = altered[POLICY['files']['zip']]['parts'][0]
            shutil.copyfile(packet / layout['partsDirectory'] / first['name'], source / layout['partsDirectory'] / first['name'])
            first['sha256'] = '0' * 64
            (source / layout['partsManifest']).write_text(json.dumps(altered), encoding='utf-8')
            output = directory / 'partial-output'
            with self.assertRaises(AssertionError):
                materialize(repository, source, output)
            self.assertEqual((output / POLICY['files']['zip']).stat().st_size, first['bytes'])
            self.assertEqual((packet / layout['partsManifest']).read_bytes(), original_manifest)
            self.assertEqual(digest(packet / layout['partsDirectory'] / first['name']),
                             json.loads(original_manifest)[POLICY['files']['zip']]['parts'][0]['sha256'])

    def test_optimized_cli_refuses_before_output_creation(self):
        with temporary_directory() as directory:
            output = directory / 'not-created'
            result = subprocess.run([sys.executable, '-O', '-B', str(Path(__file__).with_name('materialize.py')),
                                     str(repository), str(packet), str(output)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('requires non-optimized Python', result.stderr)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
