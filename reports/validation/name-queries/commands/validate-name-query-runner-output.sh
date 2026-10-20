#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/name-queries-root.txt")
cd "$validation_root"
cp reports/validation/javascript-tests.log reports/validation/name-queries/javascript-tests-before-output-directory-fix.log
cp reports/validation/latest.json reports/validation/name-queries/release-gates-before-output-directory-fix.json
mv reports/validation/name-queries/validate-node24.log reports/validation/name-queries/validate-node24-before-output-directory-fix.log
cp "$source_root/tests/helpers/abort-runner-memory.cjs" tests/helpers/abort-runner-memory.cjs
test ! -d reports/validation/abort-runner-node24
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/abort-native.spec.cjs > "reports/validation/name-queries/runner-output-$version.log" 2>&1
  tail -8 "reports/validation/name-queries/runner-output-$version.log"
done
printf 'Real abort runner output and memory gates passed\n'
