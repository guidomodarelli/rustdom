#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/fragment-id-root.txt")
cd "$validation_root"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/fragment-id.spec.cjs > "reports/validation/fragment-id/gc-contracts-$version.log" 2>&1
  tail -8 "reports/validation/fragment-id/gc-contracts-$version.log"
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/fragment-id/benchmark-contracts-$version.log" 2>&1
  tail -8 "reports/validation/fragment-id/benchmark-contracts-$version.log"
  "$executable" --expose-gc benchmarks/compare.cjs fragment-id-first fragment-id-last fragment-id-miss shadow-id-last > "reports/validation/fragment-id/worker-$version.log" 2>&1
  tail -3 "reports/validation/fragment-id/worker-$version.log"
done
printf 'Fragment ID GC contracts and real benchmark CLI passed\n'
