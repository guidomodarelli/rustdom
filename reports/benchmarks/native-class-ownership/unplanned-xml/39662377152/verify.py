"""Verify the original GitHub ZIP and recompute the completed A/A without executing benchmarks."""
import hashlib
import json
import math
from pathlib import Path
import statistics
import zipfile


def verify(directory):
    """Check raw bytes, every stdout, normalized phase medians and the calibration decision."""
    provenance = json.loads((directory / "provenance.json").read_text())
    archive = directory / "artifact.zip"
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert "sha256:" + digest == provenance["serverDigest"]
    with zipfile.ZipFile(archive) as zipped:
        assert zipped.testzip() is None
        files = [entry for entry in zipped.infolist() if not entry.is_dir()]
        expected = json.loads((directory / "files.json").read_text())["files"]
        actual = [{"path": entry.filename, "bytes": entry.file_size,
                   "sha256": hashlib.sha256(zipped.read(entry)).hexdigest()} for entry in files]
        assert actual == expected
        index_bytes = zipped.read("experiment.json")
        assert index_bytes == (directory / "experiment.json").read_bytes()
        index = json.loads(index_bytes)
        assert index["complete"] is True and index["accepted"] is None
        assert index["calibration"]["pass"] is False
        assert len(index["runs"]) == 208 and len(index["calibration"]["rows"]) == 13
        assert len({run["rowKey"] for run in index["runs"]}) == 13
        measured = 0
        for run in index["runs"]:
            assert run["stage"] == "AA" and run["exitCode"] == 0
            assert run["signal"] is None and run["error"] is None
            observed = json.loads(zipped.read(run["stdoutFile"]))
            assert observed == run["observations"]
            assert observed["node"] == index["node"] and observed["engine"] == run["engine"]
            row = observed["results"][0]
            assert f"{row['name']}/{row['size']}" == run["rowKey"]
            assert len(row["warmupBatchMs"]) == row["warmupBatches"]
            assert all(math.isfinite(value) and value > 0 for value in row["warmupBatchMs"] + row["measuredBatchMs"])
            measured += len(row["measuredBatchMs"])
        for stored in index["calibration"]["rows"]:
            key = f"{stored['name']}/{stored['size']}"
            runs = [run for run in index["runs"] if run["rowKey"] == key]
            assert len(runs) == 16
            samples = {"A": [], "B": []}
            for run, phase in zip(runs, stored["phases"], strict=True):
                row = run["observations"]["results"][0]
                assert row["outputHash"] == stored["outputHash"] and phase["label"] == run["label"]
                normalized = [value / row["batchSize"] for value in row["measuredBatchMs"]]
                half = len(normalized) // 2
                for field, values in [("medianMs", normalized), ("firstHalfMs", normalized[:half]), ("lastHalfMs", normalized[half:])]:
                    assert math.isclose(statistics.median(values), phase[field], rel_tol=1e-12, abs_tol=1e-12)
                samples[run["label"]] += normalized
            baseline = statistics.median(samples["A"])
            comparison = statistics.median(samples["B"])
            for field, value in [("baselineMs", baseline), ("candidateMs", comparison), ("changePercent", (comparison / baseline - 1) * 100)]:
                assert math.isclose(value, stored[field], rel_tol=1e-12, abs_tol=1e-12)
            assert stored["samplesPerLabel"] == {label: len(values) for label, values in samples.items()}
        calibrated = all(abs(row["changePercent"]) <= index["calibration"]["budgetPercent"] for row in index["calibration"]["rows"])
        assert calibrated is False
    return {"verified": True, "files": len(files), "processes": len(index["runs"]),
            "measuredDurations": measured, "rows": 13, "calibrated": False, "accepted": None, "abExecuted": False}


if __name__ == "__main__":
    print(json.dumps(verify(Path(__file__).resolve().parent)))
