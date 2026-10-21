#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
root=$(cat "$task_root/.cache/attribute-copy-root.txt")
cd "$root"
before_root=$(mktemp -d /home/guido/rustdom-attribute-copy-before-ownership-XXXXXX)
archive=$("$task_root/.tools/node/bin/node" -p 'require("./artifacts/latest.json").archive')
tar -xzf "$archive" -C "$before_root" package/dist/native.cjs package/dist/rustdom.node package/dist/native-build.json
output=reports/validation/attribute-copy/ownership
printf '%s\n' "$before_root" > "$output/before-runtime.txt"
sha256sum "$archive" "$before_root/package/dist/rustdom.node" dist/rustdom.node > "$output/termination-binary-identities.txt"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --expose-gc "$task_root/.cache/attribute-copy-review-construction.cjs" "$before_root/package/dist/native.cjs" 4194304 > "$output/termination-before-$version.jsonl"
  "$executable" --expose-gc "$task_root/.cache/attribute-copy-review-construction.cjs" "$root/dist/native.cjs" 4194304 > "$output/termination-after-$version.jsonl"
  cat "$output/termination-before-$version.jsonl" "$output/termination-after-$version.jsonl"
done
cp "$task_root/.cache/attribute-copy-review-construction.cjs" "$output/termination-probe.cjs"
cp "$task_root/.cache/reproduce-attribute-copy-termination.sh" "$output/termination-probe-command.sh"
cp /mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom/tests/native-attribute-copy-lifecycle.spec.cjs tests/
cp /mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom/tests/fixtures/attribute-copy-interrupted-worker.cjs tests/fixtures/
cp /mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom/scripts/constants/attribute-copy-memory.cjs scripts/constants/
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/native-attribute-copy-lifecycle.spec.cjs > "$output/termination-contracts-$version.log" 2>&1 || { cat "$output/termination-contracts-$version.log"; exit 1; }
  tail -n 12 "$output/termination-contracts-$version.log"
done
