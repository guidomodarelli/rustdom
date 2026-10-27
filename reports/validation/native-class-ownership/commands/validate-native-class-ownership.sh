#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
runtime=$(cat "$task_root/.cache/native-class-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$runtime"
output=reports/validation/native-class-ownership
if [ "${1:-}" != --resume-after-rust ]; then
  export RUSTUP_TOOLCHAIN=1.98.1
  export CARGO_TARGET_DIR=/home/guido/rustdom-name-queries-ui9xbm/target/ci198
  cargo fmt -- --check > "$output/fmt-1.98.1.log" 2>&1
  cargo clippy --locked --all-targets -- -D warnings > "$output/clippy-1.98.1.log" 2>&1 || { tail -n 80 "$output/clippy-1.98.1.log"; exit 1; }
  cargo test --locked > "$output/rust-1.98.1.log" 2>&1 || { tail -n 80 "$output/rust-1.98.1.log"; exit 1; }
  tail -n 8 "$output/rust-1.98.1.log"
fi
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR=/home/guido/rustdom-dom-parser-final-OgiDlEeg/target/ci199
cargo test --no-run --locked --message-format=json > "$output/test-executables.jsonl" 2> "$output/test-executables.stderr.log"
executable=$(node -e "const fs=require('fs'); const rows=fs.readFileSync('$output/test-executables.jsonl','utf8').trim().split('\\n').map(JSON.parse); const binaries=rows.filter(row=>row.profile?.test&&row.executable); if(binaries.length!==1)throw new Error('Expected one Rust test executable');process.stdout.write(binaries[0].executable);")
export VALGRIND_LIB="$task_root/.tools/valgrind/usr/libexec/valgrind"
"$task_root/.tools/valgrind/usr/bin/valgrind" --tool=memcheck --leak-check=full --show-leak-kinds=all --errors-for-leak-kinds=definite,indirect --track-origins=yes --error-exitcode=99 --log-file="$output/guard-memcheck.log" "$executable" --test-threads=1 native_class_ownership_tests > "$output/guard-memcheck-tests.log" 2>&1
tail -n 5 "$output/guard-memcheck-tests.log"
npm_entry=/home/guido/rustdom-dom-parser-final-OgiDlEeg/.tools/npm-11/node_modules/npm/bin/npm-cli.js
for node_directory in "$task_root/.tools/node-22/bin" "$task_root/.tools/node/bin"; do
  export PATH="$node_directory:$CARGO_HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  executable="$node_directory/node"
  version=$("$executable" --version)
  for phase in test test:validation test:corpus test:wpt test:memory; do
    label=${phase//:/-}
    printf 'Ownership validation %s: %s\n' "$version" "$phase"
    "$executable" "$npm_entry" run "$phase" > "$output/$label-$version.log" 2>&1 || { tail -n 100 "$output/$label-$version.log"; exit 1; }
    tail -n 4 "$output/$label-$version.log"
  done
done
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
node "$npm_entry" run package > "$output/package.log" 2>&1 || { tail -n 80 "$output/package.log"; exit 1; }
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  version=$("$executable" --version)
  printf 'Ownership package validation %s\n' "$version"
  "$executable" "$npm_entry" run test:package > "$output/package-$version.log" 2>&1 || { tail -n 100 "$output/package-$version.log"; exit 1; }
  tail -n 4 "$output/package-$version.log"
done
printf 'Native class full validation completed: %s\n' "$runtime"
