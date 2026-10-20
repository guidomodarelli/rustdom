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
for directory in src scripts benchmarks types; do cp -a "$source_root/$directory/." "$directory/"; done
for file in tests/collection-queries.spec.cjs tests/collection-query-memory.spec.cjs tests/helpers/collection-query-memory.cjs tests/benchmarks/collection-queries.spec.cjs tests/integration/collection-suite.cjs tests/integration/dom-suite.cjs tests/integration/realm.vm.mjs; do
  cp "$source_root/$file" "$file"
done
cargo fmt
for file in collection_queries.rs constants.rs mod.rs token_list.rs traversal.rs slot_assignment_driver.rs selector_element.rs tree.rs; do
  cp "src/dom/$file" "$source_root/src/dom/$file"
done
npm run test:validation > reports/validation/collection-queries/validation-harness.log 2>&1
npm run validate > reports/validation/collection-queries/validate-node24.log 2>&1
cp reports/validation/latest.json reports/validation/collection-queries/release-gates-node24.json
for gate in rust-format rust-lint rust-tests build javascript-tests html5-corpus wpt-contracts; do
  cp "reports/validation/$gate.log" "reports/validation/collection-queries/$gate.log"
done
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target/ci198" cargo clippy --locked --all-targets -- -D warnings > reports/validation/collection-queries/clippy-198.log 2>&1
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target/ci198" cargo test --locked > reports/validation/collection-queries/rust-tests-198.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm test > reports/validation/collection-queries/full-node22.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm run test:corpus > reports/validation/collection-queries/corpus-node22.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm run test:wpt > reports/validation/collection-queries/wpt-node22.log 2>&1
npm run test:memory > reports/validation/collection-queries/general-memory.log 2>&1
npm run test:native-memory > reports/validation/collection-queries/native-memory.log 2>&1
npm run package > reports/validation/collection-queries/package.log 2>&1
npm run test:package > reports/validation/collection-queries/package-node24.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" node "$parent_runtime/.tools/npm-11/node_modules/npm/bin/npm-cli.js" run test:package > reports/validation/collection-queries/package-node22.log 2>&1
printf 'Collection final validation passed\n'
