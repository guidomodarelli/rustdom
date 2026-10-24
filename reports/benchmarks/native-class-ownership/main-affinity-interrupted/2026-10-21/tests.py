"""Exercise byte integrity and semantic rejection on private copies of the actual interrupted archive."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ARCHIVE = Path(__file__).resolve().parent


class InterruptedEvidenceTests(unittest.TestCase):
    def run_verifier(self, root):
        return subprocess.run([sys.executable, "-B", str(root / "verify.py")], capture_output=True, text=True)

    def test_original_partial_archive(self):
        result = self.run_verifier(ARCHIVE)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["measuredDurations"], 1368)

    def test_rejects_altered_bytes(self):
        with tempfile.TemporaryDirectory(prefix="rustdom-interrupted-byte-test-") as temporary:
            root = Path(temporary) / "archive"
            shutil.copytree(ARCHIVE, root)
            index = json.loads((root / "node-22/index.json").read_text())
            report = root / "node-22" / index["runs"][0]["stdout"]
            report.write_bytes(report.read_bytes() + b" ")
            self.assertNotEqual(self.run_verifier(root).returncode, 0)

    def test_rejects_false_completion_after_refreshing_outer_hash(self):
        with tempfile.TemporaryDirectory(prefix="rustdom-interrupted-completion-test-") as temporary:
            root = Path(temporary) / "archive"
            shutil.copytree(ARCHIVE, root)
            filename = root / "node-22/index.json"
            index = json.loads(filename.read_text())
            index["complete"] = True
            filename.write_text(json.dumps(index, indent=2) + "\n")
            manifest_path = root / "manifest.json"
            manifest = json.loads(manifest_path.read_text())
            entry = next(entry for entry in manifest["files"] if entry["path"] == "node-22/index.json")
            entry["bytes"] = filename.stat().st_size
            entry["sha256"] = hashlib.sha256(filename.read_bytes()).hexdigest()
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
            self.assertNotEqual(self.run_verifier(root).returncode, 0)

    def test_rejects_wrong_affinity_after_refreshing_both_hashes(self):
        with tempfile.TemporaryDirectory(prefix="rustdom-interrupted-affinity-test-") as temporary:
            root = Path(temporary) / "archive"
            shutil.copytree(ARCHIVE, root)
            index_path = root / "node-22/index.json"
            index = json.loads(index_path.read_text())
            filename = index["runs"][0]["metadata"]
            report_path = root / "node-22" / filename
            report = json.loads(report_path.read_text())
            main = next(thread for thread in report["affinity"]["final"] if thread["tid"] == report["pid"])
            main["mask"] = "0"
            report_path.write_text(json.dumps(report, indent=2) + "\n")
            index["files"][filename] = hashlib.sha256(report_path.read_bytes()).hexdigest()
            index_path.write_text(json.dumps(index, indent=2) + "\n")
            manifest_path = root / "manifest.json"
            manifest = json.loads(manifest_path.read_text())
            for entry in manifest["files"]:
                if entry["path"] in ("node-22/index.json", f"node-22/{filename}"):
                    changed = root / entry["path"]
                    entry["bytes"] = changed.stat().st_size
                    entry["sha256"] = hashlib.sha256(changed.read_bytes()).hexdigest()
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
            self.assertNotEqual(self.run_verifier(root).returncode, 0)


if __name__ == "__main__":
    unittest.main()
