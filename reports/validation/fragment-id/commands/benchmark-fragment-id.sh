#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/fragment-id-root.txt")
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
node - "$source_root/.cache/fragment-id-current-source.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const gates = JSON.parse(fs.readFileSync('reports/validation/fragment-id/release-gates-node24.json'));
assert.equal(gates.pass, true); assert.equal(gates.gates.length, 7);
const source = require('./benchmarks/sources.cjs').captureSourceIdentity();
assert.equal(source.sourceHash, JSON.parse(fs.readFileSync(process.argv[2])).sourceHash);
const baseline = JSON.parse(fs.readFileSync('baseline-engine/dist/native-build.json'));
assert.equal(baseline.binarySha256, 'ca4c8081fe104e56131ed8e4beddc39dcbef1074e26b31ec70968f2f3aadcc30');
assert.equal(createHash('sha256').update(fs.readFileSync('baseline-engine/dist/rustdom.node')).digest('hex'), baseline.binarySha256);
const candidate = JSON.parse(fs.readFileSync('dist/native-build.json'));
assert.equal(candidate.binarySha256, '69577fc60935fd561f37cfb0b2bfbbd7cf970434448ffb7e795877f17706d23e');
for (const name of ['package-node24.log', 'package-node22.log']) {
  const log = fs.readFileSync('reports/validation/fragment-id/' + name, 'utf8');
  const reportPath = [...log.matchAll(/Guardado: (reports\/distribution\/[^\r\n]+\.json)/g)].at(-1)[1];
  const report = JSON.parse(fs.readFileSync(reportPath));
  assert.equal(report.pass, true); assert.equal(report.runs.length, 20);
  assert.equal(report.artifact.native.binarySha256, candidate.binarySha256);
}
fs.writeFileSync('reports/validation/fragment-id/runtime-source.json', JSON.stringify(source, null, 2) + '\n');
NODE
workloads=(fragment-id-first fragment-id-last fragment-id-miss shadow-id-last document-name-miss)
for repetition in forward reverse; do
  for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
    if [[ "$repetition" == forward ]]; then stages=(baseline candidate); else stages=(candidate baseline); fi
    for stage in "${stages[@]}"; do
      printf 'Stage=%s repetition=%s node=%s\n' "$stage" "$repetition" "$("$executable" --version)" >> reports/validation/fragment-id/benchmarks.log
      if [[ "$stage" == baseline ]]; then
        RUSTDOM_BENCHMARK_PACKAGE="$validation_root/baseline-engine" "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/fragment-id/benchmarks.log 2>&1
      else
        "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/fragment-id/benchmarks.log 2>&1
      fi
      tail -2 reports/validation/fragment-id/benchmarks.log
    done
  done
done
printf 'Fragment ID benchmarks completed\n'
