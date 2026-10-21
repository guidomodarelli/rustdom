#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/id-lookups-root.txt")
cd "$validation_root"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test baseline-engine/tests/id-lookups.spec.cjs > "reports/validation/id-lookups/baseline-enhanced-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/baseline-enhanced-$version.log"
  "$executable" --test tests/id-lookups.spec.cjs > "reports/validation/id-lookups/enhanced-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/enhanced-$version.log"
done
printf 'Enhanced public baseline and native ID contracts passed\n'
