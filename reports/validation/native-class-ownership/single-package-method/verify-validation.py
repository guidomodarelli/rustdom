"""Recount preserved contract evidence without loading a runtime or measuring DOM."""
import hashlib
import json
import pathlib
import sys
import tarfile

directory = pathlib.Path(sys.argv[1])
summary = json.loads((directory / "validation.json").read_bytes())
archive = directory / summary["archive"]["path"]
assert archive.stat().st_size == summary["archive"]["bytes"]
assert hashlib.sha256(archive.read_bytes()).hexdigest() == summary["archive"]["sha256"]
with tarfile.open(archive) as evidence:
    def read_json(name):
        return json.load(evidence.extractfile(name))

    for snapshot in ["initial", "final"]:
        harness = read_json(snapshot + "/frozen-harness.json")
        for entry in harness["files"]:
            data = evidence.extractfile(snapshot + "/" + entry["path"]).read()
            assert len(data) == entry["bytes"]
            assert hashlib.sha256(data).hexdigest() == entry["sha256"]

    reports = []
    for entry in evidence.getnames():
        if entry.startswith("initial/validation/") and entry.endswith(".process.json"):
            process = read_json(entry)
            assert process["exitCode"] == 0
            report = read_json(entry.replace(".process.json", ".json"))
            assert report["complete"]
            assert sum(bool(names) for names in report["loadedAfter"].values()) == 1
            reports.append(report)

    batches = [batch for report in reports for batch in report["batches"]]
    endpoints = [endpoint for batch in batches for endpoint in batch["cleanupTrace"]]
    counts = {
        "workers": len(reports),
        "publicBatches": len(batches),
        "measuredDurations": sum(len(batch["samplesMs"]) for batch in batches),
        "trackedOwnersPerKind": sum(report["batches"][-1]["trackedOwners"]["window"] for report in reports),
        "cleanupEndpoints": len(endpoints),
        "requiredClearEndpoints": sum(len(batch["cleanupTrace"][-2:]) for batch in batches),
        "initialNotClearEndpointsPreserved": sum(not endpoint["clear"] for endpoint in endpoints),
    }
    for batch in batches:
        assert batch["complete"] and len(batch["samplesMs"]) == 9
        assert len(batch["cleanupTrace"]) == 3
        for endpoint in batch["cleanupTrace"][-2:]:
            assert endpoint["clear"] and endpoint["survivors"] == {"window": 0, "document": 0}
    for key, value in counts.items():
        assert value == summary[key], key
    outputs = {}
    for batch in batches:
        key = batch["name"] + "/" + str(batch["size"])
        outputs.setdefault(key, set()).add(batch["outputHash"])
    assert len(outputs) == 8 and all(len(hashes) == 1 for hashes in outputs.values())
    print(json.dumps({"verified": True, "performanceAcceptanceEvaluated": False, **counts}))
