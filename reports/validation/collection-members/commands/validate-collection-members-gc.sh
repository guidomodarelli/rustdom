#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-members-root.txt")
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
cp "$source_root/tests/collection-members.spec.cjs" tests/collection-members.spec.cjs
cp "$source_root/tests/helpers/collection-query-memory.cjs" tests/helpers/collection-query-memory.cjs
node --test tests/collection-members.spec.cjs tests/collection-query-memory.spec.cjs > reports/validation/collection-members/transport-node24.log 2>&1
"$task_root/.tools/node-22/bin/node" --test tests/collection-members.spec.cjs tests/collection-query-memory.spec.cjs > reports/validation/collection-members/transport-node22.log 2>&1
tail -9 reports/validation/collection-members/transport-node24.log
tail -9 reports/validation/collection-members/transport-node22.log
