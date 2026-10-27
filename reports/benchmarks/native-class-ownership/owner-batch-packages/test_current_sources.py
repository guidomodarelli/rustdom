"""Exercise real archive authentication while adversarial timestamp-valid bytecode is present in isolated helper copies."""
import json
import os
from pathlib import Path
import py_compile
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).parent
REPOSITORY = SOURCE.resolve().parents[3]


class CurrentSourceContracts(unittest.TestCase):
    def test_current_packaging_helpers_ignore_valid_stale_artifact_bytecode(self):
        # This is executable cache data in a disposable copy, not a mocked SDK or platform library.
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); helpers = root / 'namespace/a/b/package'; helpers.mkdir(parents=True)
            for name in ['assemble.py', 'transport.py', 'artifact.py']:
                shutil.copyfile(SOURCE / name, helpers / name)
            shutil.copytree(SOURCE / 'constants', helpers / 'constants')
            target = helpers / 'artifact.py'; trusted = target.read_bytes(); timestamp = int(target.stat().st_mtime)
            marker = helpers / 'bytecode-executed'
            poison = ('from pathlib import Path\nPath(' + repr(str(marker)) + ').write_text("cache executed")\n').encode()
            assert len(poison) < len(trusted)
            target.write_bytes(poison + b' ' * (len(trusted) - len(poison))); os.utime(target, (timestamp, timestamp))
            py_compile.compile(str(target), doraise=True, invalidation_mode=py_compile.PycInvalidationMode.TIMESTAMP)
            target.write_bytes(trusted); os.utime(target, (timestamp, timestamp))
            control = subprocess.run([sys.executable, '-B', '-c', 'import artifact'], cwd=helpers, capture_output=True)
            self.assertEqual(control.returncode, 0, control.stderr); self.assertTrue(marker.exists()); marker.unlink()
            archive = REPOSITORY / 'reports/validation/owner-batch-package/20261025/packages.tar.xz'
            collection = REPOSITORY / 'reports/validation/static-range-owner-batch-ci/40205226009'
            script = ('import runpy,json; from pathlib import Path; '
                      'assembly=runpy.run_path("assemble.py"); carrier=runpy.run_path("transport.py"); '
                      'verified=assembly["inspect_collection"](Path(' + repr(str(REPOSITORY)) + '),Path(' + repr(str(collection)) + ')); '
                      'print(json.dumps({"matrixQualified":verified["matrixQualified"],"binary":verified["binarySha256"],'
                      '"archiveSha256":carrier["digest"](Path(' + repr(str(archive)) + ')),"runtimeExecuted":verified["runtimeExecuted"]}))')
            actual = subprocess.run([sys.executable, '-B', '-c', script], cwd=helpers, capture_output=True)
            self.assertEqual(actual.returncode, 0, actual.stderr)
            result = json.loads(actual.stdout)
            self.assertTrue(result['matrixQualified']); self.assertFalse(result['runtimeExecuted'])
            self.assertEqual(result['binary'], '4b52a84d4f1b6f434e0b0160c5799c406f68671e2db3bb6b6fd936d1977a8d73')
            self.assertEqual(result['archiveSha256'], '1e4313382b809453d6af724b931f9c366519cf637a80d16038b1d143d45003aa')
            self.assertFalse(marker.exists())


if __name__ == '__main__':
    unittest.main()
