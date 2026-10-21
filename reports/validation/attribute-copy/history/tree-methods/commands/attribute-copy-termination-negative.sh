#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
root=$(cat "$task_root/.cache/attribute-copy-root.txt")
before_root=$(cat "$root/reports/validation/attribute-copy/ownership/before-runtime.txt")
managed=/mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom
mkdir -p "$before_root/package/tests/fixtures" "$before_root/package/scripts/constants"
cp "$managed/tests/native-attribute-copy-lifecycle.spec.cjs" "$before_root/package/tests/"
cp "$managed/tests/fixtures/attribute-copy-worker.cjs" "$managed/tests/fixtures/attribute-copy-interrupted-worker.cjs" "$before_root/package/tests/fixtures/"
cp "$managed/scripts/constants/attribute-copy-memory.cjs" "$before_root/package/scripts/constants/"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  log="$root/reports/validation/attribute-copy/ownership/termination-contracts-before-$version.log"
  if "$executable" --test "$before_root/package/tests/native-attribute-copy-lifecycle.spec.cjs" > "$log" 2>&1; then
    printf 'ERROR: old binary unexpectedly passed the regression on %s\n' "$version"
    exit 1
  fi
  grep -E 'retained a native snapshot|tests |pass |fail ' "$log"
done
