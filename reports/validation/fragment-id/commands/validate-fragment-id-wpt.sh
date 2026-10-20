#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/fragment-id-root.txt")
cd "$validation_root"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" tests/wpt/run.cjs fragment-id-queries > "reports/validation/fragment-id/wpt-fragments-$version.log" 2>&1
  tail -5 "reports/validation/fragment-id/wpt-fragments-$version.log"
done
printf 'Four upstream fragment ID WPT fixtures compared on both Node versions\n'
