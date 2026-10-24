"""Exercise report attribution against actual current and historical CI reports."""
from pathlib import Path
import copy
import json
import runpy
import zipfile


def main():
    directory = Path(__file__).resolve().parent
    verify = runpy.run_path(str(directory / "verify-metadata.py"))["verify_report_provenance"]
    receipt = json.loads((directory / "receipt.json").read_text(encoding="utf-8"))
    jobs = json.loads((directory / "jobs.json").read_text(encoding="utf-8"))
    recorded = receipt["runs"][0]
    rejected = []

    def rejects(name, report, selected):
        try:
            verify(report, selected, jobs)
        except AssertionError:
            rejected.append(name)
        else:
            raise AssertionError(f"Expected controlled provenance rejection: {name}")

    with zipfile.ZipFile(directory / f"artifact-{recorded['artifactId']}.zip") as zipped:
        for selected in recorded["structuredReports"]:
            verify(json.loads(zipped.read(selected["artifactPath"])), selected, jobs)
        selected = next(entry for entry in recorded["structuredReports"]
                        if entry["artifactPath"].endswith("-xml-iterator.json"))
        current = json.loads(zipped.read(selected["artifactPath"]))
        historical_path = next(name for name in zipped.namelist()
                               if name.endswith("-xml-iterator.json") and "2026-09-" in name)
        historical = json.loads(zipped.read(historical_path))
        historical_selection = {**selected, "artifactPath": historical_path, "capturedAt": historical["capturedAt"]}
        rejects("historical report outside this job", historical, historical_selection)
        wrong_node = copy.deepcopy(current)
        wrong_node["node"] = "v22.12.0" if selected["node"] == "v24.14.1" else "v24.14.1"
        rejects("declared iterator Node differs", wrong_node, selected)
        rejects("Node step attribution differs", current, {**selected, "node": wrong_node["node"]})
        rejects("receipt timestamp differs", current, {**selected, "capturedAt": historical["capturedAt"]})
    print(json.dumps({"currentReportsAccepted": 4, "controlledRejections": rejected,
                      "domExecuted": False, "benchmarkExecuted": False}))


if __name__ == "__main__":
    main()
