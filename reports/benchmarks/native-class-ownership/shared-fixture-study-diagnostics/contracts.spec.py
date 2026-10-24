"""Exercise authentic published inputs and controlled corruptions, never a DOM or producer."""
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('shared_trajectories', Path(__file__).with_name('analyze.py'))
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
packet = Path(os.environ['SHARED_TRAJECTORY_PACKET']).resolve()
repository = Path(os.environ['SHARED_TRAJECTORY_REPOSITORY']).resolve()
node = Path(os.environ['SHARED_TRAJECTORY_NODE'])


class PublishedTrajectories(unittest.TestCase):
    def test_complete_authentic_packet_preserves_every_process_and_warmup(self):
        result = reader.prepare(packet)
        self.assertEqual(len(result['samples']), 2048)
        self.assertEqual(sum(len(entry['warmupMs']) for entry in result['samples']), 6144)
        self.assertEqual(sum(len(entry['samplesMs']) for entry in result['samples']), 18432)
        self.assertEqual(len(result['summary']['rows']), 32)
        self.assertFalse(result['summary']['accepted'])

    def test_changed_published_csv_cannot_borrow_the_original_manifest(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-trajectories-corruption-') as temporary:
            altered = Path(temporary)
            for name in ['files.json', *reader.policy['inputs']]:
                shutil.copyfile(packet / name, altered / name)
            with (altered / 'spans.csv').open('ab') as output:
                output.write(b'changed')
            with self.assertRaisesRegex(AssertionError, 'changed published input spans.csv'):
                reader.prepare(altered)

    def test_python_optimized_flag_stops_before_reading_inputs(self):
        result = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name('analyze.py'))], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('require non-optimized Python', result.stderr)

    def test_python_optimized_environment_stops_before_reading_inputs(self):
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('analyze.py'))], env=os.environ | {'PYTHONOPTIMIZE': '1'}, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('require non-optimized Python', result.stderr)

    def test_existing_output_is_not_overwritten(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-trajectories-existing-') as temporary:
            output = Path(temporary)
            marker = output / 'original.txt'
            marker.write_text('preserved', encoding='utf-8')
            with self.assertRaisesRegex(AssertionError, 'output must be fresh'):
                reader.analyze(repository, packet, node, output)
            self.assertEqual(marker.read_text(encoding='utf-8'), 'preserved')

    def test_symlink_parent_cannot_write_into_the_published_packet(self):
        with tempfile.TemporaryDirectory(prefix='rustdom-trajectories-alias-') as temporary:
            alias = Path(temporary) / 'packet'
            alias.symlink_to(packet, target_is_directory=True)
            with self.assertRaisesRegex(AssertionError, 'preserve the published input packet'):
                reader.analyze(repository, packet, node, alias / 'must-not-exist')
            self.assertFalse((packet / 'must-not-exist').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
