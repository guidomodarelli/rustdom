"""Verify the preserved incomplete study; never execute workloads or infer performance acceptance."""
import hashlib
import json
import math
from pathlib import Path


def read_json(filename):
    return json.loads(filename.read_text())


def verify(root):
    manifest = read_json(root / "manifest.json")
    actual_paths = sorted(filename.relative_to(root).as_posix() for filename in root.rglob("*")
                          if filename.is_file() and filename != root / "manifest.json")
    assert actual_paths == [entry["path"] for entry in manifest["files"]]
    for entry in manifest["files"]:
        content = (root / entry["path"]).read_bytes()
        assert len(content) == entry["bytes"]
        assert hashlib.sha256(content).hexdigest() == entry["sha256"]
    index = read_json(root / "node-22/index.json")
    assert index["complete"] is False and index.get("accepted") is None
    assert index["node"] == "v22.12.0"
    settings = index["settings"]
    assert settings["revision"] == "main-affinity-public-v1"
    assert len(index["runs"]) == 20
    for filename, digest in index["files"].items():
        assert hashlib.sha256((root / "node-22" / filename).read_bytes()).hexdigest() == digest
    hashes = {key: set() for key in settings["rows"]}
    completed = 0
    durations = 0
    for ordinal, entry in enumerate(index["runs"]):
        assert entry["phase"] == "AA" and entry["treatment"] == "A"
        assert entry["position"] == ordinal // len(settings["engines"])
        assert entry["slot"] == ordinal % len(settings["engines"])
        assert entry["label"] == settings["order"][entry["position"]]
        assert entry["engine"] == settings["engines"][entry["slot"]]
        if "exitCode" not in entry:
            assert ordinal == len(index["runs"]) - 1
            continue
        assert entry["exitCode"] == 0 and entry["signal"] is None and entry["error"] is None
        report = read_json(root / "node-22" / entry["stdout"])
        metadata = read_json(root / "node-22" / entry["metadata"])
        assert metadata["complete"] is True and metadata["exitCode"] == 0
        assert metadata["pid"] == entry["pid"] and metadata["node"] == index["node"]
        assert metadata["engine"] == report["engine"] == entry["engine"]
        assert metadata["runtimeRoot"] == index["roots"]["A"]
        assert metadata["harnessRoot"] == index["roots"]["B"]
        assert metadata["execArgv"] == ["--expose-gc"] and metadata["nodeOptionsPresent"] is False
        assert metadata["settings"] == settings
        for stage in ("configured", "final"):
            threads = metadata["affinity"][stage]
            main = next(thread for thread in threads if thread["tid"] == metadata["pid"])
            assert main["mask"] == str(settings["cpu"])
            assert any(thread["tid"] != metadata["pid"] and not thread.get("disappeared", False)
                       and thread["mask"] != str(settings["cpu"]) for thread in threads)
        assert report["warmupSamples"] == 3 and report["measuredSamples"] == 9
        assert sorted(f'{row["name"]}/{row["rows"]}' for row in report["workloads"]) == settings["rows"]
        for row in report["workloads"]:
            assert len(row["samplesMs"]) == len(row["memoryAfterCleanup"]) == 9
            assert all(math.isfinite(value) and value > 0 for value in row["samplesMs"])
            hashes[f'{row["name"]}/{row["rows"]}'].add(row["outputHash"])
            durations += len(row["samplesMs"])
        completed += 1
    assert completed == 19 and durations == 1368
    assert all(len(values) == 1 for values in hashes.values())
    assert not (root / "node").exists()
    termination = read_json(root / "termination.json")
    assert termination["complete"] is False and termination["accepted"] is None
    assert all(process.get("terminationSent") == "SIGTERM" or process.get("alreadyExited")
               for process in termination["processes"])
    return {"verifiedPartial": True, "complete": False, "accepted": None,
            "completedProcesses": completed, "measuredDurations": durations,
            "candidateBExecuted": False, "node24Executed": False}


if __name__ == "__main__":
    print(json.dumps(verify(Path(__file__).resolve().parent), indent=2))
