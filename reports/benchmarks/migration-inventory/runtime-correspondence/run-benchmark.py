"""Record actual source-correspondence CLI resources; no DOM engine is loaded."""
import hashlib
import json
import os
import pathlib
import statistics
import subprocess
import sys
import time

WARMUP_PROCESSES = 2
MEASURED_PROCESSES = 5
TIMEOUT_SECONDS = 30
root = pathlib.Path(sys.argv[1])
output = root / "benchmark"
assert not any(output.iterdir()), "Preserve existing benchmark output"
raw = output / "raw"
raw.mkdir()
tools = pathlib.Path("/mnt/c/Users/guido/ghq/projects/rustdom/.tools")
prepared = pathlib.Path("/tmp/rustdom-hosted-main-results-6n_lsanc/hosted-main/prepared/ownership-build")
reference = pathlib.Path("/tmp/rustdom-inventory-strings-e0b7lhj6/node_modules/jsdom")
fixture = json.loads((root / "source-fixture.json").read_text())
report = {"complete": False, "scope": "source inspection tooling; no DOM, Rust execution or performance acceptance",
          "warmupProcesses": WARMUP_PROCESSES, "measuredProcesses": MEASURED_PROCESSES,
          "samples": [], "sources": fixture}


def save():
    (output / "benchmark.json").write_text(json.dumps(report, indent=2) + "\n")


save()
try:
    assert hashlib.sha256((root / "method.cjs").read_bytes()).hexdigest() == fixture["methodSha256"]
    expected = (root / "node22.json").read_bytes()
    for label, executable in [("node22", tools / "node-22/bin/node"), ("node24", tools / "node/bin/node")]:
        report[label] = json.loads(subprocess.check_output([str(executable), "-e",
            "const os=require('node:os');process.stdout.write(JSON.stringify({node:process.version,versions:process.versions,cpu:os.cpus()[0].model,cpus:os.cpus().length,platform:os.platform(),release:os.release(),totalMemoryBytes:os.totalmem()}))"]))
        env = dict(os.environ)
        env.pop("NODE_OPTIONS", None)
        for iteration in range(WARMUP_PROCESSES + MEASURED_PROCESSES):
            prefix = label + "-" + str(iteration)
            filename = root / ("benchmark-output-" + prefix + ".json")
            resources = raw / (prefix + ".resources.json")
            command = ["/usr/bin/time", "-o", str(resources), "-f",
                '{"peakRssKiB":%M,"userSeconds":%U,"systemSeconds":%S}', str(executable), str(root / "method.cjs"),
                str(root / "reference.json"), str(reference), str(prepared / "packages"), str(filename)]
            sample = {"node": label, "iteration": iteration, "phase": "warmup" if iteration < WARMUP_PROCESSES else "measured",
                      "command": command}
            report["samples"].append(sample)
            save()
            started = time.perf_counter_ns()
            with (raw / (prefix + ".stdout.log")).open("wb") as stdout, (raw / (prefix + ".stderr.log")).open("wb") as stderr:
                result = subprocess.run(command, cwd=root, env=env, stdout=stdout, stderr=stderr, timeout=TIMEOUT_SECONDS)
            sample.update(exitCode=result.returncode, elapsedMs=(time.perf_counter_ns() - started) / 1_000_000)
            save()
            assert result.returncode == 0
            actual = filename.read_bytes()
            assert actual == expected
            sample.update(outputVerified=True, outputSha256=hashlib.sha256(actual).hexdigest(),
                          resources=json.loads(resources.read_text()))
            save()
    assert hashlib.sha256((root / "method.cjs").read_bytes()).hexdigest() == fixture["methodSha256"]
    assert hashlib.sha256((root / "reference.json").read_bytes()).hexdigest() == fixture["catalogSha256"]
    report["summary"] = [{"node": label,
        "medianElapsedMs": statistics.median(sample["elapsedMs"] for sample in report["samples"] if sample["node"] == label and sample["phase"] == "measured"),
        "maxPeakRssKiB": max(sample["resources"]["peakRssKiB"] for sample in report["samples"] if sample["node"] == label and sample["phase"] == "measured")}
        for label in ["node22", "node24"]]
    report["complete"] = True
    save()
    print(json.dumps(report["summary"]))
except Exception as error:
    report["failure"] = {"type": type(error).__name__, "message": str(error)}
    save()
    raise
