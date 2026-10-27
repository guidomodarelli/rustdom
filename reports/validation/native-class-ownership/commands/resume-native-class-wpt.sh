#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
managed=/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom
runtime=$(cat "$task_root/.cache/native-class-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR=/home/guido/rustdom-dom-parser-final-OgiDlEeg/target/ci199
original_path="$PATH"
cd "$runtime"
output=reports/validation/native-class-ownership
cp "$managed/package.json" package.json
cp "$managed/tests/wpt/run.cjs" tests/wpt/run.cjs
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:$original_path"
  version=$("$executable" --version)
  printf 'Bounded WPT validation %s, unchanged 2048 MiB old-space budget\n' "$version"
  /usr/bin/time -v -o "$output/test-wpt-bounded-$version.resources.log" "$executable" --max-old-space-size=2048 tests/wpt/run.cjs > "$output/test-wpt-bounded-$version.log" 2>&1 || { tail -n 90 "$output/test-wpt-bounded-$version.log"; exit 1; }
  tail -n 4 "$output/test-wpt-bounded-$version.log"
done
npm_entry=/home/guido/rustdom-dom-parser-final-OgiDlEeg/.tools/npm-11/node_modules/npm/bin/npm-cli.js
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$original_path"
node "$npm_entry" run test:memory > "$output/test-memory-v24.14.1.log" 2>&1 || { tail -n 90 "$output/test-memory-v24.14.1.log"; exit 1; }
tail -n 5 "$output/test-memory-v24.14.1.log"
node "$npm_entry" run package > "$output/package.log" 2>&1 || { tail -n 90 "$output/package.log"; exit 1; }
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:$original_path"
  version=$("$executable" --version)
  printf 'Ownership package validation %s\n' "$version"
  "$executable" "$npm_entry" run test:package > "$output/package-$version.log" 2>&1 || { tail -n 90 "$output/package-$version.log"; exit 1; }
  tail -n 4 "$output/package-$version.log"
done
printf 'Ownership validation resumed and completed: %s\n' "$runtime"
