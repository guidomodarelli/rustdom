#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/element-relatives-root.txt")
cd "$validation_root"
cp "$source_root/tests/element-relatives.spec.cjs" tests/element-relatives.spec.cjs
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  if "$executable" --test --test-name-pattern='host Array.from' tests/element-relatives.spec.cjs > "reports/validation/element-relatives/array-from-before-$version.log" 2>&1; then
    printf 'Unexpected passing baseline for %s\n' "$version" >&2
    exit 1
  fi
  tail -9 "reports/validation/element-relatives/array-from-before-$version.log"
done
