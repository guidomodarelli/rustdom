"""Exercise authenticated loading and sparse hydration with real Git and filesystem caches."""
from pathlib import Path
import importlib.util
import os
import py_compile
import shutil
import subprocess
import tempfile
import types
import unittest

source = Path(__file__).with_name('checkout.py')
subject = types.ModuleType('current_pilot_checkout')
subject.__file__ = str(source)
exec(compile(source.read_bytes(), str(source), 'exec'), subject.__dict__)


class CheckoutTests(unittest.TestCase):
    def fixture(self, root):
        numeric = root / subject.POLICY['checkoutAuthenticator']['path']
        numeric.parent.mkdir(parents=True)
        original = subject.REPOSITORY / subject.POLICY['checkoutAuthenticator']['path']
        shutil.copyfile(original, numeric)
        settings = numeric.parent / 'constants/ci.json'
        settings.parent.mkdir()
        shutil.copyfile(original.parent / 'constants/ci.json', settings)
        return numeric

    def test_real_git_hydration_ignores_an_executable_timestamp_valid_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            numeric = self.fixture(root)
            (root / '.gitignore').write_text('__pycache__/\n', encoding='utf-8')
            data = root / 'data/fixture.bin'
            data.parent.mkdir()
            data.write_bytes(bytes([0, 255, 13, 10, 128]))
            git = ['git', '-c', 'core.autocrlf=false', '-c', 'gc.auto=0']
            def run(*arguments, **options):
                return subprocess.check_output(git + list(arguments), cwd=root, stderr=subprocess.PIPE, **options)
            run('init', '-q')
            run('config', 'core.autocrlf', 'false')
            run('add', '--', '.gitignore', 'data/fixture.bin', subject.POLICY['checkoutAuthenticator']['path'],
                settings_path := (numeric.parent / 'constants/ci.json').relative_to(root).as_posix())
            run('-c', 'user.name=Source qualification fixture', '-c', 'user.email=fixture@example.invalid',
                'commit', '-q', '-m', 'Real sparse hydration fixture')
            run('sparse-checkout', 'set', '--no-cone', '--stdin',
                input=('/.gitignore\n/' + subject.POLICY['checkoutAuthenticator']['path'] + '\n/' + settings_path + '\n').encode())
            self.assertFalse(data.exists())
            # This cache would be accepted by timestamp/size import loading; it must never run.
            marker = root / 'untrusted-executed.txt'
            payload = ('from pathlib import Path\nPath(' + repr(str(marker)) + ').write_text("executed")\n').encode()
            original = numeric.read_bytes()
            malicious = root / 'cache-payload.py'
            malicious.write_bytes(payload + b'#' * (len(original) - len(payload)))
            os.utime(malicious, ns=(numeric.stat().st_atime_ns, numeric.stat().st_mtime_ns))
            cache = Path(importlib.util.cache_from_source(str(numeric)))
            cache.parent.mkdir()
            py_compile.compile(str(malicious), cfile=str(cache), dfile=str(numeric), doraise=True)
            malicious.unlink()
            loaded = subject.current_checkout(root)
            result = loaded.populate(root, ['data/fixture.bin'])
            self.assertTrue(result['prepared'])
            self.assertEqual(data.read_bytes(), bytes([0, 255, 13, 10, 128]))
            self.assertFalse(marker.exists())

    def test_changed_source_is_rejected_before_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            numeric = self.fixture(root)
            marker = root / 'untrusted-executed.txt'
            numeric.write_text('from pathlib import Path\nPath(' + repr(str(marker)) + ').write_text("executed")', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'changed before execution'):
                subject.current_checkout(root)
            self.assertFalse(marker.exists())

    @unittest.skipUnless(__import__('sys').platform == 'linux', 'Symlink creation tested on Linux')
    def test_linked_source_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            numeric = self.fixture(root)
            original = numeric.with_name('original.py')
            numeric.rename(original)
            numeric.symlink_to(original)
            with self.assertRaisesRegex(ValueError, 'physical current hydrator'):
                subject.current_checkout(root)


if __name__ == '__main__':
    unittest.main()
