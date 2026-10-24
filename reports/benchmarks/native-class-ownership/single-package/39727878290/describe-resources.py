"""Describe all archived cleanup endpoints and schedule factors without executing a runtime."""
import json
import pathlib
import sys

source, output = map(pathlib.Path, sys.argv[1:3])
ranges, factors = [], []
for node in ["node-22", "node-24"]:
    index = json.loads((source / node / "index.json").read_text())
    assert index["complete"] and index["settings"]["revision"] == "single-package-v1"
    reports = [(entry, json.loads((source / node / entry["report"]).read_text())) for entry in index["runs"]]
    for phase in ["AA", "AB"]:
        for engine in index["settings"]["engines"]:
            for label in ["A", "B"]:
                selected_reports = [(entry, report) for entry, report in reports
                                    if entry["phase"] == phase and entry["engine"] == engine and entry["label"] == label]
                states = [(round_number, state) for _, report in selected_reports
                          for batch in report["batches"] for round_number, state in enumerate(batch["cleanupTrace"])]
                assert len(selected_reports) == 8 and len(states) == 192
                for scope, selected in [("all cleanup observations", states),
                        ("required final two clear endpoints", [(round_number, state) for round_number, state in states if round_number >= 1])]:
                    ranges.append({"node": index["node"], "phase": phase, "engine": engine, "label": label,
                        "physicalPackages": sorted({report["schedule"]["physical"] for _, report in selected_reports}),
                        "scope": scope, "observations": len(selected),
                        "memoryScope": "whole process with one selected package; not peak memory",
                        **{key + "RangeBytes": [min(state["memory"][key] for _, state in selected),
                                                max(state["memory"][key] for _, state in selected)]
                           for key in ["heapUsed", "external", "rss"]}})
        for position in range(index["settings"]["workerCount"]):
            entries = [entry for entry in index["runs"] if entry["phase"] == phase and entry["position"] == position]
            engines = list(dict.fromkeys(entry["engine"] for entry in entries))
            for engine in engines:
                pair = [entry for entry in entries if entry["engine"] == engine]
                assert len(pair) == 2
                reverse_pair = pair[0]["label"] == "B"
                assert reverse_pair == bool(position & 1)
                factors.append({"node": index["node"], "phase": phase, "position": position, "engine": engine,
                    "engineFirst": engines[0] == engine, "labels": [entry["label"] for entry in pair], "reversePair": reverse_pair})
assert len(ranges) == 32 and len(factors) == 64
(output / "memory-ranges.json").write_text(json.dumps(ranges, indent=2) + "\n")
combinations = {engine: sorted({(entry["engineFirst"], entry["reversePair"]) for entry in factors if entry["engine"] == engine})
                for engine in ["jsdom", "rustdom"]}
assert all(len(values) == 2 for values in combinations.values())
(output / "order-factors.json").write_text(json.dumps({"measurementExecuted": False, "acceptanceChanged": False,
    "pairOrderAndEngineLeadIndependent": False, "observedCombinations": combinations, "pairs": factors,
    "limits": "The shared parity is an observed design constraint; it does not establish the cause of control drift or validate an alternative experiment."}, indent=2) + "\n")
print(json.dumps({"memoryGroups": len(ranges), "processPairs": len(factors), "observedCombinations": combinations}))
