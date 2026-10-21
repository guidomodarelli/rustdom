#!/usr/bin/env bash
set -euo pipefail
task=/mnt/c/Users/guido/ghq/projects/rustdom
root=$(cat "$task/.cache/xml-controller-root.txt")
managed=/mnt/c/Users/guido/.codex/worktrees/migration-inventory/rustdom
for directory in benchmarks tests; do cp -a "$managed/$directory/." "$root/$directory/"; done
mkdir -p "$root/reports/progress" "$root/reports/validation"
cp -a "$managed/reports/progress/inventory" "$root/reports/progress/"
for file in collection-queries.md attribute-reads.md; do cp "$managed/reports/validation/$file" "$root/reports/validation/$file"; done
export CARGO_HOME="$task/.tools/cargo" RUSTUP_HOME="$task/.tools/rustup" RUSTUP_TOOLCHAIN=1.99.1
original_path="$PATH"
npm_cli=/home/guido/rustdom-dom-parser-final-OgiDlEeg/.tools/npm-11/node_modules/npm/bin/npm-cli.js
cd "$root"
for executable in "$task/.tools/node/bin/node" "$task/.tools/node-22/bin/node"; do
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:$original_path"
  version=$("$executable" --version)
  for gate in test test:validation test:corpus test:wpt; do
    label=$(echo "$gate" | tr : -)
    if [ "$gate" = test ]; then arguments=(test); else arguments=(run "$gate"); fi
    "$executable" "$npm_cli" "${arguments[@]}" > "reports/validation/xml-serializer-controller/$label-$version.log" 2>&1 || { tail -n 90 "reports/validation/xml-serializer-controller/$label-$version.log"; exit 1; }
    tail -n 10 "reports/validation/xml-serializer-controller/$label-$version.log"
  done
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/xml-serializer-controller/harness-$version.log" 2>&1 || { tail -n 80 "reports/validation/xml-serializer-controller/harness-$version.log"; exit 1; }
  tail -n 10 "reports/validation/xml-serializer-controller/harness-$version.log"
done
