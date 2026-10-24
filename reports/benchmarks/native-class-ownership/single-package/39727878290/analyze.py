"""Recalculate complete paired or separate-process archives offline, preserving all observations."""
import csv
import json
import math
import pathlib
import statistics
import sys

source, output = map(pathlib.Path, sys.argv[1:3])
output.mkdir(exist_ok=False)
rows, process_rows, resources, decisions = [], [], [], []
processes = durations = owners = endpoints = required_clear = initial_not_clear = 0
for node in ["node-22", "node-24"]:
    index = json.loads((source / node / "index.json").read_text())
    assert index["complete"]
    settings = index["settings"]
    assert settings["warmupSamples"] == 3 and settings["measuredSamples"] == 9
    assert settings["controlBudgetPercent"] == 2 and settings["rustBudgetPercent"] == 5
    assert settings["workerCount"] == 8 and len(settings["rows"]) == 8
    observations = []
    for entry in index["runs"]:
        assert entry["exitCode"] == 0
        report = json.loads((source / node / entry["report"]).read_text())
        assert report["complete"]
        processes += 1
        for batch in report["batches"]:
            assert batch["complete"] and len(batch["samplesMs"]) == 9
            assert all(math.isfinite(value) and value > 0 for value in batch["samplesMs"])
            durations += len(batch["samplesMs"])
            owners += settings["warmupSamples"] + len(batch["samplesMs"])
            label = batch["label"]
            physical = report["schedule"]["physical"]
            physical = physical[label] if isinstance(physical, dict) else physical
            observations.append({"entry": entry, "batch": batch})
            process_rows.append({"node": index["node"], "phase": entry["phase"], "engine": entry["engine"],
                "position": entry["position"], "label": label, "pid": entry["pid"],
                "row": batch["name"] + "/" + str(batch["size"]), "medianMs": statistics.median(batch["samplesMs"]),
                "physical": physical, "factors": report["schedule"]["factors"], "report": entry["report"]})
            assert len(batch["cleanupTrace"]) == settings["cleanupRounds"]
            for round_number, observation in enumerate(batch["cleanupTrace"]):
                states = [observation] if "clear" in observation else list(observation.values())
                for state in states:
                    endpoints += 1
                    resources.append({"node": index["node"], "engine": entry["engine"], **state["memory"]})
                    if round_number >= settings["cleanupRounds"] - settings["requiredClearRounds"]:
                        assert state["clear"] and state["survivors"] == {"window": 0, "document": 0}
                        required_clear += 1
                    elif not state["clear"]:
                        initial_not_clear += 1
    node_rows = []
    for phase in settings["phases"]:
        for original in index["summaries"][phase]:
            values = {}
            hashes = set()
            for engine in settings["engines"]:
                for label in ["A", "B"]:
                    batches = [item["batch"] for item in observations if item["entry"]["phase"] == phase
                        and item["entry"]["engine"] == engine and item["batch"]["label"] == label
                        and item["batch"]["name"] + "/" + str(item["batch"]["size"]) == original["key"]]
                    assert len(batches) == settings["workerCount"]
                    samples = [sample for batch in batches for sample in batch["samplesMs"]]
                    assert len(samples) == 72
                    value = statistics.median(samples)
                    assert math.isclose(value, original[label][engine]["medianMs"], rel_tol=0, abs_tol=1e-12)
                    values[engine + label + "Ms"] = value
                    hashes.update(batch["outputHash"] for batch in batches)
            assert len(hashes) == 1 and next(iter(hashes)) == original["outputHash"]
            rust_change = (values["rustdomBMs"] / values["rustdomAMs"] - 1) * 100
            control_change = (values["jsdomBMs"] / values["jsdomAMs"] - 1) * 100
            calibrated = abs(control_change) <= 2 and (phase == "AB" or abs(rust_change) <= 5)
            within_budget = calibrated and rust_change <= 5
            for key, value in [("rustdomChangePercent", rust_change), ("jsdomControlChangePercent", control_change)]:
                assert math.isclose(value, original[key], rel_tol=0, abs_tol=1e-12)
            assert calibrated == original["calibrated"] and within_budget == original["withinBudget"]
            node_rows.append({"node": index["node"], "phase": phase, "row": original["key"], **values,
                "rustChangePercent": rust_change, "controlChangePercent": control_change,
                "calibrated": calibrated, "withinBudget": within_budget, "outputHash": original["outputHash"]})
    accepted = all(row["calibrated"] if row["phase"] == "AA" else row["withinBudget"] for row in node_rows)
    assert accepted == index["accepted"]
    decisions.append({"node": index["node"], "accepted": accepted, "processes": len(index["runs"]),
        "method": settings["revision"], "harnessSha256": index["harness"]["sha256"]})
    rows.extend(node_rows)

assert len(rows) == 32 and len(process_rows) == 1024 and durations == 9216 and owners == 12288
groups = []
for decision in decisions:
    for phase in ["AA", "AB"]:
        selected = [row for row in rows if row["node"] == decision["node"] and row["phase"] == phase]
        groups.append({"node": decision["node"], "phase": phase, "calibratedRows": sum(row["calibrated"] for row in selected),
            "totalRows": len(selected), "rustChangeRangePercent": [min(row["rustChangePercent"] for row in selected), max(row["rustChangePercent"] for row in selected)],
            "controlChangeRangePercent": [min(row["controlChangePercent"] for row in selected), max(row["controlChangePercent"] for row in selected)]})
analysis = {"measurementExecuted": False, "acceptanceChanged": False, "accepted": all(item["accepted"] for item in decisions),
    "decisions": decisions, "processes": processes, "durations": durations, "rows": rows, "groups": groups,
    "expectedTrackedOwnersPerKindValidatedByWorker": owners, "cleanupEndpoints": endpoints,
    "requiredClearEndpoints": required_clear, "initialNotClearEndpointsRetained": initial_not_clear,
    "limits": "Pooled medians reproduce the original decision; process medians are descriptive only. No new measurements, exclusions or causal attribution."}
(output / "analysis.json").write_text(json.dumps(analysis, indent=2) + "\n")
(output / "process-rows.json").write_text(json.dumps(process_rows, indent=2) + "\n")
with (output / "rows.csv").open("w", newline="") as stream:
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
print(json.dumps({key: analysis[key] for key in ["accepted", "processes", "durations", "groups", "cleanupEndpoints", "requiredClearEndpoints"]}))
