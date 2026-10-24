"""Verify preserved CI metadata and artifact bytes without loading DOM or build trees."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import re
import zipfile


def read_json(filename):
    return json.loads(filename.read_text(encoding="utf-8"))


def checksum(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def verify_report_provenance(report, selected, jobs):
    assert report["capturedAt"] == selected["capturedAt"]
    captured = datetime.fromisoformat(report["capturedAt"].replace("Z", "+00:00"))
    assert captured.tzinfo is not None
    intervals = [step for job in jobs["jobs"] for step in job["steps"]
                 if step["name"].startswith("Ejercer XML")
                 and datetime.fromisoformat(step["started_at"].replace("Z", "+00:00"))
                 <= captured <= datetime.fromisoformat(step["completed_at"].replace("Z", "+00:00"))]
    assert len(intervals) == 1, "XML report must belong to exactly one actual product step"
    major = selected["node"].split(".")[0].removeprefix("v")
    assert intervals[0]["name"].endswith("Node " + major), "XML report belongs to another Node step"
    if selected["artifactPath"].endswith("-xml-iterator.json"):
        assert report["node"] == selected["node"], "XML iterator report declares another Node"
    elif "node" in report:
        assert report["node"] == selected["node"]


def main():
    directory = Path(__file__).resolve().parent
    receipt = read_json(directory / "receipt.json")
    for entry in read_json(directory / "files.json"):
        filename = (directory / entry["path"]).resolve()
        assert filename.is_relative_to(directory)
        assert filename.stat().st_size == entry["bytes"]
        assert checksum(filename) == entry["sha256"], entry["path"]
    observations = {"window": 0, "document": 0}
    for recorded in receipt["runs"]:
        folder = directory if recorded["fullZipVersioned"] else directory / "ownership-regression"
        run = read_json(folder / "run.json")
        jobs = read_json(folder / "jobs.json")
        assert run["id"] == recorded["runId"] and run["head_sha"] == receipt["testedHead"]
        assert run["status"] == "completed" and run["conclusion"] == "success"
        assert all(job["conclusion"] == "success" for job in jobs["jobs"])
        metadata = read_json(folder / "artifacts.json")
        artifact = next(entry for entry in metadata["artifacts"] if entry["id"] == recorded["artifactId"])
        assert artifact["digest"] == "sha256:" + recorded["artifactSha256"]
        prefix = "xml" if recorded["fullZipVersioned"] else "ownership"
        for version, profile in recorded["profiles"].items():
            label = "node22" if version == "v22.12.0" else "node24"
            probe = read_json(folder / f"{prefix}-{label}.json")
            assert probe["pass"] and probe["node"] == version
            assert probe["measurementExecuted"] is False
            assert probe["integrity"] == profile["identity"]
            assert probe["integrity"]["performanceAccepted"] is None
            assert probe["observedWindows"] == profile["observedWindows"] == 15
            assert probe["observedDocuments"] == profile["observedDocuments"] == 15
            observations["window"] += probe["observedWindows"]
            observations["document"] += probe["observedDocuments"]
            for endpoint in probe["endpoints"].values():
                assert endpoint["reached"] and endpoint["requiredClearSamples"] == 2
                assert endpoint["state"]["survivors"] == {"window": 0, "document": 0}
            for kind in ["contracts", "product"]:
                expected = profile[kind]
                if expected is None:
                    continue
                text = (folder / f"{prefix}-{kind}-{label}.log").read_text(encoding="utf-8")
                actual = {key: int(value) for key, value in re.findall(
                    r"^(?:# |ℹ )(tests|pass|fail|cancelled|skipped|todo) (\d+)$", text, re.M)}
                assert actual == expected
            if recorded["fullZipVersioned"]:
                assert read_json(folder / f"xml-relocated-{version}.json") == probe["integrity"]
                process = read_json(folder / f"xml-relocated-{version}.process.json")
                assert process["exitCode"] == 0 and process["signal"] is None and process["error"] is None
            else:
                text = (folder / f"ownership-legacy-contracts-{label}.log").read_text(encoding="utf-8")
                assert re.search(r"^(?:# |ℹ )tests 17$", text, re.M)
                assert re.search(r"^(?:# |ℹ )pass 17$", text, re.M)
        if recorded["fullZipVersioned"]:
            archive = folder / f"artifact-{recorded['artifactId']}.zip"
            assert checksum(archive) == recorded["artifactSha256"]
            with zipfile.ZipFile(archive) as zipped:
                for selected in recorded["structuredReports"]:
                    payload = zipped.read(selected["artifactPath"])
                    assert hashlib.sha256(payload).hexdigest() == selected["sha256"]
                    assert payload == (folder / "compatibility" / Path(selected["artifactPath"]).name).read_bytes()
                    report = json.loads(payload)
                    verify_report_provenance(report, selected, jobs)
                    assert len(report["cases"]) == selected["cases"]
                    assert all(case["expected"] == case["actual"] for case in report["cases"])
    assert observations == {"window": 60, "document": 60}
    print(json.dumps({"verifiedMetadata": True, "observations": observations,
                      "preparedTreeLocallyVerified": False, "performanceAccepted": None}))


if __name__ == "__main__":
    main()
