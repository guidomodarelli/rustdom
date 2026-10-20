#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-members-root.txt")
parent_runtime=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent_runtime/target/ci199"
export VALGRIND_LIB="$task_root/.tools/valgrind/usr/libexec/valgrind"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$task_root/.tools/valgrind/usr/bin:$PATH"
cd "$validation_root"
for directory in src scripts types; do cp -a "$source_root/$directory/." "$directory/"; done
cp "$source_root/tests/collection-members.spec.cjs" tests/collection-members.spec.cjs
cp "$source_root/tests/helpers/collection-query-memory.cjs" tests/helpers/collection-query-memory.cjs
cargo fmt
for file in data.rs constants.rs mod.rs collection_members.rs collection_queries.rs selector_element.rs tree.rs; do
  cp "src/dom/$file" "$source_root/src/dom/$file"
done
npm run test:validation > reports/validation/collection-members/validation-harness.log 2>&1
npm run validate > reports/validation/collection-members/validate-node24.log 2>&1
cp reports/validation/latest.json reports/validation/collection-members/release-gates-node24.json
for gate in rust-format rust-lint rust-tests build javascript-tests html5-corpus wpt-contracts; do
  cp "reports/validation/$gate.log" "reports/validation/collection-members/$gate.log"
done
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target/ci198" cargo clippy --locked --all-targets -- -D warnings > reports/validation/collection-members/clippy-198.log 2>&1
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target/ci198" cargo test --locked > reports/validation/collection-members/rust-tests-198.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm test > reports/validation/collection-members/full-node22.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm run test:corpus > reports/validation/collection-members/corpus-node22.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm run test:wpt > reports/validation/collection-members/wpt-node22.log 2>&1
npm run test:memory > reports/validation/collection-members/general-memory.log 2>&1
npm run test:native-memory > reports/validation/collection-members/native-memory.log 2>&1
npm run package > reports/validation/collection-members/package.log 2>&1
npm run test:package > reports/validation/collection-members/package-node24.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" node "$parent_runtime/.tools/npm-11/node_modules/npm/bin/npm-cli.js" run test:package > reports/validation/collection-members/package-node22.log 2>&1
printf 'Collection members final validation passed\n'
