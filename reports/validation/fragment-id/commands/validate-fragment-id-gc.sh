#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/fragment-id-root.txt")
cp "$task_root/.cache/fragment-id-memory.cjs" "$validation_root/tests/helpers/fragment-id-memory.cjs"
cd "$validation_root"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --expose-gc tests/helpers/fragment-id-memory.cjs > "reports/validation/fragment-id/gc-$version.log" 2>&1
  tail -8 "reports/validation/fragment-id/gc-$version.log"
done
printf 'Fragment ID memory validation passed\n'
