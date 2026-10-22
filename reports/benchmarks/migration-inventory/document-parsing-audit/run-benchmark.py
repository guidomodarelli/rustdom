"""Measure the real npm inventory CLI; preserve every process and verify every output."""
import hashlib
import json
import os
import pathlib
import platform
import statistics
import subprocess
import sys
import time

WARMUP_PROCESSES = 2
MEASURED_PROCESSES = 5
CLI_TIMEOUT_SECONDS = 30
root, output = map(pathlib.Path, sys.argv[1:3])
output.mkdir(exist_ok=False)
raw = output / "raw"
raw.mkdir()
tool_root = pathlib.Path("/mnt/c/Users/guido/ghq/projects/rustdom/.tools")
npm = tool_root / "node/lib/node_modules/npm/bin/npm-cli.js"
fixture = json.loads((root / "source-fixture.json").read_text())


def verify_sources():
    for entry in fixture["files"]:
        data = (root / entry["path"]).read_bytes()
        assert len(data) == entry["bytes"] and hashlib.sha256(data).hexdigest() == entry["sha256"]


verify_sources()
report = {"complete": False, "scope": "inventory tooling; no Rust execution or DOM performance acceptance",
          "machine": {"uname": list(platform.uname()), "libc": platform.libc_ver()},
          "warmupProcesses": WARMUP_PROCESSES, "measuredProcesses": MEASURED_PROCESSES,
          "timeoutSeconds": CLI_TIMEOUT_SECONDS, "samples": []}


def save():
    (output / "benchmark.json").write_text(json.dumps(report, indent=2) + "\n")


save()
try:
    for label, executable in [("node22", tool_root / "node-22/bin/node"), ("node24", tool_root / "node/bin/node")]:
        report[label] = json.loads(subprocess.check_output([str(executable), "-e",
            "const os=require('node:os');process.stdout.write(JSON.stringify({node:process.version,versions:process.versions,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()}))"]))
        expected = json.loads((root / "validation" / label / "generate.stdout.log").read_text())["outputDigests"]
        env = dict(os.environ)
        env.pop("NODE_OPTIONS", None)
        env["PATH"] = str(executable.parent) + ":" + env["PATH"]
        for iteration in range(WARMUP_PROCESSES + MEASURED_PROCESSES):
            prefix = label + "-" + str(iteration)
            directory = root / ("benchmark-catalog-" + prefix)
            resources = raw / (prefix + ".resources.json")
            command = ["/usr/bin/time", "-o", str(resources), "-f",
                       '{"peakRssKiB":%M,"userSeconds":%U,"systemSeconds":%S}', str(executable), str(npm),
                       "run", "inventory", "--", "--output", str(directory)]
            sample = {"node": label, "phase": "warmup" if iteration < WARMUP_PROCESSES else "measured",
                      "iteration": iteration, "command": command}
            report["samples"].append(sample)
            save()
            started = time.perf_counter_ns()
            with (raw / (prefix + ".stdout.log")).open("wb") as stdout, (raw / (prefix + ".stderr.log")).open("wb") as stderr:
                result = subprocess.run(command, cwd=root, env=env, stdout=stdout, stderr=stderr, timeout=CLI_TIMEOUT_SECONDS)
            sample.update(elapsedMs=(time.perf_counter_ns() - started) / 1_000_000, exitCode=result.returncode)
            save()
            assert result.returncode == 0
            actual = {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in expected}
            assert actual == expected
            sample.update(resources=json.loads(resources.read_text()), outputDigests=actual, outputVerified=True)
            save()
        print(label + " complete", flush=True)
    verify_sources()
    report["sourcesUnchanged"] = True
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
