#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/id-lookups-root.txt")
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
for relative_path in benchmarks/constants/id-lookups.cjs benchmarks/id-lookups.cjs benchmarks/workload-plan.cjs benchmarks/worker.cjs tests/benchmarks/id-lookups.spec.cjs; do
  cp "$source_root/$relative_path" "$relative_path"
done
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/id-lookups/benchmark-contracts-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/benchmark-contracts-$version.log"
  "$executable" --expose-gc benchmarks/compare.cjs document-id-read document-id-miss document-id-register document-id-change svg-id-self svg-id-last svg-id-empty > "reports/validation/id-lookups/benchmark-cli-$version.log" 2>&1
  tail -2 "reports/validation/id-lookups/benchmark-cli-$version.log"
done
node - "$source_root" "$task_root" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [sourceRoot, taskRoot] = process.argv.slice(2);
const capture = require('./benchmarks/sources.cjs').captureSourceIdentity;
const source = capture(sourceRoot), runtimeSource = capture();
assert.equal(source.sourceHash, runtimeSource.sourceHash);
for (const root of [sourceRoot, taskRoot]) fs.writeFileSync(root + '/.cache/id-lookups-current-source.json', JSON.stringify(source, null, 2) + '\n');
fs.writeFileSync('reports/validation/id-lookups/runtime-source.json', JSON.stringify(runtimeSource, null, 2) + '\n');
console.log(JSON.stringify({ sourceHash: source.sourceHash, sources: source.measuredSources.length }));
NODE
printf 'ID benchmark contracts and actual CLIs passed\n'
