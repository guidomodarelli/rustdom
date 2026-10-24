"""Recompute the complete archived study and describe process spread without changing acceptance."""
import csv
import json
import math
import pathlib
import statistics
import sys

source = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=False)
rows = []
process_rows = []
resources = []
durations = 0
tracked_owners = 0
required_clear_endpoints = 0
all_endpoints = 0
initial_not_clear = 0

for node in ["node-22", "node-24"]:
    index = json.loads((source / node / "index.json").read_text())
    assert index["complete"] and not index["accepted"]
    reports = [(entry, json.loads((source / node / entry["report"]).read_text())) for entry in index["runs"]]
    for entry, report in reports:
        assert entry["exitCode"] == 0 and report["complete"]
        for batch in report["batches"]:
            durations += len(batch["samplesMs"])
            tracked_owners += index["settings"]["warmupSamples"] + len(batch["samplesMs"])
            for round_number, endpoint in enumerate(batch["cleanupTrace"]):
                for label, state in endpoint.items():
                    all_endpoints += 1
                    resources.append({"node": index["node"], "engine": entry["engine"], **state["memory"]})
                    if round_number >= index["settings"]["cleanupRounds"] - index["settings"]["requiredClearRounds"]:
                        assert state["clear"] and state["survivors"] == {"window": 0, "document": 0}
                        required_clear_endpoints += 1
                    elif not state["clear"]:
                        initial_not_clear += 1
    for phase, summary in index["summaries"].items():
        selected = [(entry, report) for entry, report in reports if entry["phase"] == phase]
        for row in summary:
            values = {}
            for engine in ["jsdom", "rustdom"]:
                sample_groups = {"A": [], "B": []}
                for entry, report in selected:
                    if entry["engine"] != engine:
                        continue
                    pair = {batch["label"]: batch for batch in report["batches"]
                            if f"{batch['name']}/{batch['size']}" == row["key"]}
                    medians = {label: statistics.median(pair[label]["samplesMs"]) for label in ["A", "B"]}
                    process_rows.append({"node": index["node"], "phase": phase, "engine": engine,
                                         "row": row["key"], "position": entry["position"],
                                         "AmedianMs": medians["A"], "BmedianMs": medians["B"],
                                         "changePercent": (medians["B"] / medians["A"] - 1) * 100,
                                         "factors": report["schedule"]["factors"],
                                         "physical": report["schedule"]["physical"],
                                         "loadOrder": report["schedule"]["loadOrder"]})
                    for label in ["A", "B"]:
                        sample_groups[label].extend(pair[label]["samplesMs"])
                assert all(len(samples) == 72 for samples in sample_groups.values())
                for label in ["A", "B"]:
                    value = statistics.median(sample_groups[label])
                    assert math.isclose(value, row[label][engine]["medianMs"], rel_tol=0, abs_tol=1e-12)
                    values[f"{engine}{label}Ms"] = value
            rust_change = (values["rustdomBMs"] / values["rustdomAMs"] - 1) * 100
            control_change = (values["jsdomBMs"] / values["jsdomAMs"] - 1) * 100
            assert math.isclose(rust_change, row["rustdomChangePercent"], rel_tol=0, abs_tol=1e-12)
            assert math.isclose(control_change, row["jsdomControlChangePercent"], rel_tol=0, abs_tol=1e-12)
            rows.append({"node": index["node"], "phase": phase, "row": row["key"], **values,
                         "rustChangePercent": rust_change, "controlChangePercent": control_change,
                         "calibrated": row["calibrated"], "withinBudget": row["withinBudget"],
                         "outputHash": row["outputHash"]})

assert durations == 9216 and len(rows) == 32 and len(process_rows) == 512
assert tracked_owners == 12288 and required_clear_endpoints == 4096
assert all_endpoints == 6144
groups = []
for node in ["v22.12.0", "v24.14.1"]:
    for phase in ["AA", "AB"]:
        selected = [row for row in rows if row["node"] == node and row["phase"] == phase]
        groups.append({"node": node, "phase": phase, "calibratedRows": sum(row["calibrated"] for row in selected),
                       "totalRows": len(selected), "rustChangeRangePercent": [min(row["rustChangePercent"] for row in selected), max(row["rustChangePercent"] for row in selected)],
                       "controlChangeRangePercent": [min(row["controlChangePercent"] for row in selected), max(row["controlChangePercent"] for row in selected)]})
memory_ranges = []
for node in ["v22.12.0", "v24.14.1"]:
    for engine in ["jsdom", "rustdom"]:
        states = [state for state in resources if state["node"] == node and state["engine"] == engine]
        memory_ranges.append({"node": node, "engine": engine,
                              "scope": "whole process with two packages; cleanup endpoints, not peaks or per-label memory",
                              **{key + "RangeBytes": [min(state[key] for state in states), max(state[key] for state in states)]
                                 for key in ["rss", "heapUsed", "external"]}})
analysis = {"measurementExecuted": False, "acceptanceChanged": False, "accepted": False,
            "processes": 64, "durations": durations, "rows": rows, "groups": groups,
            "expectedTrackedOwnersPerKindValidatedByWorker": tracked_owners,
            "cleanupEndpoints": all_endpoints, "requiredClearEndpoints": required_clear_endpoints,
            "initialNotClearEndpointsRetained": initial_not_clear, "memoryRanges": memory_ranges,
            "limits": "Process ratios are descriptive diagnostics only; no alternate acceptance estimator, causal claim, omitted samples or new timing."}
(output / "analysis.json").write_text(json.dumps(analysis, indent=2) + "\n")
(output / "process-rows.json").write_text(json.dumps(process_rows, indent=2) + "\n")
with (output / "rows.csv").open("w", newline="") as stream:
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
print(json.dumps({"groups": groups, "durations": durations, "trackedOwnersPerKind": tracked_owners,
                  "requiredClearEndpoints": required_clear_endpoints, "initialNotClear": initial_not_clear}))
