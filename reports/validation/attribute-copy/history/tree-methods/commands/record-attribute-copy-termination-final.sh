#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
root=$(cat "$task_root/.cache/attribute-copy-root.txt")
output="$root/reports/validation/attribute-copy/ownership"
sha256sum "$root/dist/rustdom.node" > "$output/termination-final-binary.sha256"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --expose-gc "$task_root/.cache/attribute-copy-review-construction.cjs" "$root/dist/native.cjs" 4194304 > "$output/termination-after-final-$version.jsonl"
  cat "$output/termination-after-final-$version.jsonl"
done
