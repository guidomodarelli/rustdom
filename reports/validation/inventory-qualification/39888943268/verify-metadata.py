"""Verify retained CI evidence without executing DOM, GC or a workload."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import re
import zipfile


def read_json(filename):
    return json.loads(filename.read_bytes())


def main():
    directory = Path(__file__).resolve().parent
    receipt = read_json(directory / "receipt.json")
    run = read_json(directory / "run.json")
    jobs = read_json(directory / "jobs.json")["jobs"]
    metadata = read_json(directory / "artifacts.json")["artifacts"]
    assert run["id"] == receipt["runId"] and run["head_sha"] == receipt["testedHead"]
    assert run["status"] == "completed" and run["conclusion"] == "success"
    for entry in read_json(directory / "files.json"):
        filename = (directory / entry["path"]).resolve()
        assert filename.is_relative_to(directory)
        payload = filename.read_bytes()
        assert len(payload) == entry["bytes"] and hashlib.sha256(payload).hexdigest() == entry["sha256"]
    catalogs = []
    surfaces = []
    cycles = 0
    snapshot_endpoints = 0
    for profile in receipt["profiles"]:
        node = profile["node"]
        folder = directory / ("node22" if node == "v22.12.0" else "node24")
        job = next(job for job in jobs if job["name"].endswith(node.removeprefix("v")))
        assert job["conclusion"] == "success"
        artifact = next(entry for entry in metadata if entry["id"] == profile["artifactId"])
        archive = directory / f"artifact-{artifact['id']}.zip"
        checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
        assert artifact["digest"] == "sha256:" + checksum and checksum == profile["artifactSha256"]
        with zipfile.ZipFile(archive) as zipped:
            context = json.loads(zipped.read("context.json"))
            assert context["node"] == node and context["runtimeHead"] == receipt["testedHead"]
            assert context["snapshotHead"] == receipt["snapshotHead"]
            assert context["sourceCorrespondence"] == profile["sourceCorrespondence"]
            assert context["nativeBinarySha256"] == profile["nativeBinarySha256"] == context["nativeBuild"]["binarySha256"]
            assert context["canonicalRuntimeSources"]["sourceHash"] == profile["canonicalSourceHash"]
            assert context["measurementExecuted"] is False and context["performanceAccepted"] is None
            for entry in zipped.infolist():
                if not entry.is_dir() and not entry.filename.startswith("catalog/"):
                    assert (folder / entry.filename).read_bytes() == zipped.read(entry)
            text = zipped.read("contracts.log").decode("utf-8")
            counts = {key: int(value) for key, value in re.findall(
                r"^(?:# |ℹ )(tests|pass|fail|cancelled|skipped|todo) (\d+)$", text, re.M)}
            assert counts == profile["nodeTests"] == {"tests": 279, "pass": 279, "fail": 0,
                                                       "cancelled": 0, "skipped": 0, "todo": 0}
            for family, expected in profile["rustTests"].items():
                text = zipped.read(f"rust-{family}.log").decode("utf-8")
                results = re.findall(r"^test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured;", text, re.M)
                assert len(results) == 1 and tuple(map(int, results[0])) == (expected, 0, 0, 0)
            selected = json.loads(zipped.read("selected-reports.json"))
            assert len(selected["selected"]) == 4 and selected["runtimeSourcesUnchanged"] and selected["versionedCatalogUnchanged"]
            for entry in selected["selected"]:
                payload = zipped.read(entry["path"])
                assert hashlib.sha256(payload).hexdigest() == entry["sha256"] and len(payload) == entry["bytes"]
                report = json.loads(payload)
                family = Path(entry["path"]).parent.name
                assert Path(entry["path"]).name not in context["baselineReports"][family]
                captured = datetime.fromisoformat(report["capturedAt"].replace("Z", "+00:00"))
                assert datetime.fromisoformat(job["started_at"].replace("Z", "+00:00")) <= captured
                assert captured <= datetime.fromisoformat(job["completed_at"].replace("Z", "+00:00"))
                if family == "compatibility":
                    assert all(case["expected"] == case["actual"] for case in report["cases"])
                else:
                    assert report["node"] == node and report["pass"] and len(report["cycles"]) == 6
                    cycles += len(report["cycles"])
                    endpoints = report["cycles"] + ([report["final"]] if "final" in report else [])
                    snapshot_endpoints += int("final" in report)
                    for endpoint in endpoints:
                        assert endpoint["reached"] and endpoint["requiredClearSamples"] == 2
                        assert all(value == 0 for value in endpoint["state"]["survivors"].values())
            catalogs.append({name: zipped.read("catalog/" + name) for name in receipt["crossNodeIdenticalCatalogFiles"]})
            surface = json.loads(zipped.read("catalog/surface.json"))
            exclusions = json.loads(zipped.read("catalog-exclusions.json"))
            assert exclusions["node"] == node and exclusions["hostGlobalsVerifiedInRealRealm"]
            assert exclusions["actual"] == surface["exclusions"]
            surface["profile"]["node"] = "verified-per-profile"
            surface["exclusions"] = [entry for entry in surface["exclusions"] if entry["reason"] != "ecmascript-host-global"]
            surfaces.append(surface)
    assert len(catalogs) == 2 and catalogs[0] == catalogs[1] and surfaces[0] == surfaces[1]
    assert cycles == 24 and snapshot_endpoints == 2
    print(json.dumps({"verifiedMetadata": True, "profiles": 2, "nodeTestsPerProfile": 279,
                      "rustTestsPerProfile": 7, "memoryCycles": cycles,
                      "snapshotReleaseEndpoints": snapshot_endpoints, "performanceAccepted": None}))


if __name__ == "__main__":
    main()
