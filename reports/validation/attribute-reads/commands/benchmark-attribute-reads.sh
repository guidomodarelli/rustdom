#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/attribute-reads-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
RUSTUP_TOOLCHAIN=stable cargo fmt --check > reports/validation/attribute-reads/rust-format-198.log 2>&1
node "$task_root/.cache/capture-attribute-reads.cjs" "$validation_root" "$source_root" "$task_root"
node - <<'NODE'
const fs = require('node:fs'), assert = require('node:assert/strict');
const directory = 'reports/validation/attribute-reads/';
const gates = JSON.parse(fs.readFileSync(directory + 'release-gates-node24.json'));
assert.equal(gates.pass, true); assert.equal(gates.gates.length, 7);
for (const file of ['javascript-tests.log', 'full-node22.log']) assert.match(fs.readFileSync(directory + file, 'utf8'), /(?:ℹ|#) pass 3638/);
const nativePath = [...fs.readFileSync(directory + 'native-memory.log', 'utf8').matchAll(/Guardado: (reports\/memory\/[^\r\n]+\.json)/g)].at(-1)?.[1];
assert.ok(nativePath);
const native = JSON.parse(fs.readFileSync(nativePath));
assert.equal(native.pass, true); assert.equal(native.runs.reduce((sum, run) => sum + run.tests.length, 0), 305);
const packageHashes = [];
for (const file of ['package-node24.log', 'package-node22.log']) {
  const path = [...fs.readFileSync(directory + file, 'utf8').matchAll(/Guardado: (reports\/distribution\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(fs.readFileSync(path)); assert.equal(report.pass, true); assert.equal(report.runs.length, 20);
  assert.equal(report.artifact.native.binarySha256, JSON.parse(fs.readFileSync('dist/native-build.json')).binarySha256);
  packageHashes.push(report.artifact.sha256);
}
assert.equal(new Set(packageHashes).size, 1);
NODE
workloads=(attribute-get attribute-get-miss attribute-get-ns attribute-get-ns-miss attribute-has attribute-has-miss attribute-has-ns attribute-has-ns-miss attribute-get-long attribute-get-utf16 attribute-reflection document-id-read document-id-register document-id-change document-name-miss)
for repetition in forward reverse; do
  for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
    if [[ "$repetition" == forward ]]; then stages=(baseline candidate); else stages=(candidate baseline); fi
    for stage in "${stages[@]}"; do
      printf 'Stage=%s repetition=%s node=%s\n' "$stage" "$repetition" "$("$executable" --version)" >> reports/validation/attribute-reads/benchmarks.log
      if [[ "$stage" == baseline ]]; then
        RUSTDOM_BENCHMARK_PACKAGE="$validation_root/baseline-engine" "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/attribute-reads/benchmarks.log 2>&1
      else
        "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/attribute-reads/benchmarks.log 2>&1
      fi
      tail -2 reports/validation/attribute-reads/benchmarks.log
    done
  done
done
printf 'Attribute read balanced benchmarks completed\n'
