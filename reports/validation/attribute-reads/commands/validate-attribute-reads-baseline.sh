#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/attribute-reads-root.txt")
cp "$source_root/tests/attribute-reads.spec.cjs" "$validation_root/tests/attribute-reads.spec.cjs"
cd "$validation_root"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/attribute-reads.spec.cjs tests/attribute-collections.spec.cjs tests/attribute-names.spec.cjs tests/attribute-cache.spec.cjs > "reports/validation/attribute-reads/baseline-$version.log" 2>&1
  tail -8 "reports/validation/attribute-reads/baseline-$version.log"
done
