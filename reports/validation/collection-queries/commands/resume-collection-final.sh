#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-queries-root.txt")
parent_runtime=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent_runtime/target/ci199"
export VALGRIND_LIB="$task_root/.tools/valgrind/usr/libexec/valgrind"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$task_root/.tools/valgrind/usr/bin:$PATH"
cd "$validation_root"
npm run test:native-memory > reports/validation/collection-queries/native-memory.log 2>&1
npm run package > reports/validation/collection-queries/package.log 2>&1
npm run test:package > reports/validation/collection-queries/package-node24.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" node "$parent_runtime/.tools/npm-11/node_modules/npm/bin/npm-cli.js" run test:package > reports/validation/collection-queries/package-node22.log 2>&1
# Only the benchmark harness and supplementary tests changed after the complete suites.
cp -a "$source_root/benchmarks/." benchmarks/
cp "$source_root/tests/collection-query-fuzz.spec.cjs" tests/collection-query-fuzz.spec.cjs
cp "$source_root/tests/benchmarks/collection-queries.spec.cjs" tests/benchmarks/collection-queries.spec.cjs
node --test tests/collection-query-fuzz.spec.cjs tests/benchmarks/collection-queries.spec.cjs > reports/validation/collection-queries/supplemental-node24.log 2>&1
"$task_root/.tools/node-22/bin/node" --test tests/collection-query-fuzz.spec.cjs tests/benchmarks/collection-queries.spec.cjs > reports/validation/collection-queries/supplemental-node22.log 2>&1
printf 'Collection validation resumed and supplementary tests passed\n'
