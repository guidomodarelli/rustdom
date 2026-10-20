#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/element-relatives-root.txt")
cd "$validation_root"
cp "$source_root/tests/helpers/collection-query-memory.cjs" tests/helpers/collection-query-memory.cjs
cp "$source_root/tests/element-relatives.spec.cjs" tests/element-relatives.spec.cjs
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/element-relatives.spec.cjs tests/collection-query-memory.spec.cjs > "reports/validation/element-relatives/gc-$version.log" 2>&1
  tail -8 "reports/validation/element-relatives/gc-$version.log"
done
printf 'Element relatives GC validation passed\n'
