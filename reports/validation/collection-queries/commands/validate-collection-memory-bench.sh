#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-queries-root.txt")
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
for directory in scripts benchmarks types; do cp -a "$source_root/$directory/." "$directory/"; done
for file in tests/collection-queries.spec.cjs tests/collection-query-memory.spec.cjs tests/helpers/collection-query-memory.cjs tests/benchmarks/collection-queries.spec.cjs; do
  cp "$source_root/$file" "$file"
done
npm run build:js > reports/validation/collection-queries/build-js.log 2>&1
node --test tests/collection*.spec.cjs tests/benchmarks/*.spec.cjs > reports/validation/collection-queries/memory-bench-node24.log 2>&1
"$task_root/.tools/node-22/bin/node" --test tests/collection*.spec.cjs tests/benchmarks/*.spec.cjs > reports/validation/collection-queries/memory-bench-node22.log 2>&1
tail -9 reports/validation/collection-queries/memory-bench-node24.log
tail -9 reports/validation/collection-queries/memory-bench-node22.log
