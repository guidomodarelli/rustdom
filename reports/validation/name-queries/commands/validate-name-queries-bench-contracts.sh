#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/name-queries-root.txt")
cd "$validation_root"
cp -a "$source_root/benchmarks/." benchmarks/
cp "$source_root/tests/benchmarks/name-queries.spec.cjs" tests/benchmarks/name-queries.spec.cjs
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/name-queries/benchmark-contracts-$version.log" 2>&1
  tail -8 "reports/validation/name-queries/benchmark-contracts-$version.log"
done
printf 'Name-query benchmark contracts passed\n'
