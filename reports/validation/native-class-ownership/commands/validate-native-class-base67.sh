#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
managed=/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom
runtime=$(cat "$task_root/.cache/native-class-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
original_path="$PATH"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$original_path"
cd "$runtime"
test "$(git rev-parse HEAD)" = 3d37f89976a48203e80cc5c435e099267f4ce346
output=reports/validation/native-class-ownership/base67
if [ -e "$output" ]; then printf 'Preserve existing base67 validation\n' >&2; exit 1; fi
mkdir -p "$output"
for version in 1.98.1 1.99.1; do
  export RUSTUP_TOOLCHAIN="$version"
  if [ "$version" = 1.98.1 ]; then export CARGO_TARGET_DIR=/home/guido/rustdom-name-queries-ui9xbm/target/ci198; else export CARGO_TARGET_DIR=/home/guido/rustdom-dom-parser-final-OgiDlEeg/target/ci199; fi
  printf 'Ownership on checkpoint67: Rust %s\n' "$version"
  cargo fmt -- --check > "$output/fmt-$version.log" 2>&1
  cargo clippy --locked --all-targets -- -D warnings > "$output/clippy-$version.log" 2>&1 || { tail -n 90 "$output/clippy-$version.log"; exit 1; }
  cargo test --locked > "$output/rust-$version.log" 2>&1 || { tail -n 90 "$output/rust-$version.log"; exit 1; }
  tail -n 7 "$output/rust-$version.log"
done
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR=/home/guido/rustdom-dom-parser-final-OgiDlEeg/target/ci199
npm run build > "$output/build.log" 2>&1 || { tail -n 90 "$output/build.log"; exit 1; }
cargo test --no-run --locked --message-format=json > "$output/test-executables.jsonl" 2> "$output/test-executables.stderr.log"
test_executable=$(node -e "const fs=require('fs');const rows=fs.readFileSync('$output/test-executables.jsonl','utf8').trim().split('\\n').map(JSON.parse);const binaries=rows.filter(row=>row.profile?.test&&row.executable);if(binaries.length!==1)throw new Error('Expected one test binary');process.stdout.write(binaries[0].executable);")
export VALGRIND_LIB="$task_root/.tools/valgrind/usr/libexec/valgrind"
"$task_root/.tools/valgrind/usr/bin/valgrind" --tool=memcheck --leak-check=full --show-leak-kinds=all --errors-for-leak-kinds=definite,indirect --track-origins=yes --error-exitcode=99 --log-file="$output/guard-memcheck.log" "$test_executable" --test-threads=1 native_class_ownership_tests > "$output/guard-memcheck-tests.log" 2>&1
npm_entry=/home/guido/rustdom-dom-parser-final-OgiDlEeg/.tools/npm-11/node_modules/npm/bin/npm-cli.js
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:$original_path"
  version=$("$executable" --version)
  "$executable" "$task_root/.cache/probe-sdk-constructors.cjs" "$runtime/dist/native.cjs" "$runtime/$output/constructors-$version.json"
  for phase in test test:validation test:corpus test:memory; do
    label=${phase//:/-}
    printf 'Ownership base67 %s: %s\n' "$version" "$phase"
    "$executable" "$npm_entry" run "$phase" > "$output/$label-$version.log" 2>&1 || { tail -n 100 "$output/$label-$version.log"; exit 1; }
    tail -n 4 "$output/$label-$version.log"
  done
  "$executable" --test tests/benchmarks/*.spec.cjs > "$output/harness-$version.log" 2>&1 || { tail -n 90 "$output/harness-$version.log"; exit 1; }
  printf 'Ownership base67 %s: WPT, old-space 2048 MiB\n' "$version"
  /usr/bin/time -v -o "$output/wpt-$version.resources.log" "$executable" --max-old-space-size=2048 tests/wpt/run.cjs > "$output/wpt-$version.log" 2>&1 || { tail -n 100 "$output/wpt-$version.log"; exit 1; }
  tail -n 4 "$output/wpt-$version.log"
done
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$original_path"
node "$npm_entry" run package > "$output/package.log" 2>&1 || { tail -n 90 "$output/package.log"; exit 1; }
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:$original_path"
  version=$("$executable" --version)
  "$executable" "$npm_entry" run test:package > "$output/package-$version.log" 2>&1 || { tail -n 100 "$output/package-$version.log"; exit 1; }
  tail -n 4 "$output/package-$version.log"
done
printf 'Ownership base67 validation complete: %s\n' "$runtime"
