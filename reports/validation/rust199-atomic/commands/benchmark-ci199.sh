#!/usr/bin/env bash
set -euo pipefail
source_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$source_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$source_root/.tools/cargo"
export RUSTUP_HOME="$source_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export PATH="$source_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
export VALGRIND_LIB="$source_root/.tools/valgrind/usr/libexec/valgrind"
test_executable=$(node -e 'const fs=require("fs"); const rows=fs.readFileSync(".ci199-test-executable.json","utf8").trim().split("\n").map(line=>JSON.parse(line)); process.stdout.write(rows.find(row=>row.executable&&row.profile?.test).executable);')
"$source_root/.tools/valgrind/usr/bin/valgrind" --tool=memcheck --leak-check=full --show-leak-kinds=all --errors-for-leak-kinds=definite,indirect --error-exitcode=99 --log-file=reports/validation/rust199-atomic/memcheck-control.log "$test_executable" 'dom::abort_state::tests::should_keep_algorithm_iteration_live_and_never_reuse_removed_ids' --exact --test-threads=1 > reports/validation/rust199-atomic/memcheck-control-tests.log 2>&1
for executable in "$source_root/.tools/node/bin/node" "$source_root/.tools/node-22/bin/node"; do
  RUSTDOM_BENCHMARK_PACKAGE="$validation_root/ci199-baseline" "$executable" --expose-gc benchmarks/compare.cjs abort-lifecycle abort-any abort-propagation >> reports/validation/rust199-atomic/benchmarks.log 2>&1
  "$executable" --expose-gc benchmarks/compare.cjs abort-lifecycle abort-any abort-propagation >> reports/validation/rust199-atomic/benchmarks.log 2>&1
done
tail -8 reports/validation/rust199-atomic/benchmarks.log
