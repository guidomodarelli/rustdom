#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/name-queries-root.txt")
parent_runtime=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent_runtime/target/ci199"
export VALGRIND_LIB="$task_root/.tools/valgrind/usr/libexec/valgrind"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$task_root/.tools/valgrind/usr/bin:$PATH"
cd "$validation_root"
npm run test:validation > reports/validation/name-queries/validation-harness.log 2>&1
printf 'Validation harness passed\n'
npm run validate > reports/validation/name-queries/validate-node24.log 2>&1
cp reports/validation/latest.json reports/validation/name-queries/release-gates-node24.json
for gate in rust-format rust-lint rust-tests build javascript-tests html5-corpus wpt-contracts; do
  cp "reports/validation/$gate.log" "reports/validation/name-queries/$gate.log"
done
printf 'Node24 release gates passed\n'
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target/ci198" cargo clippy --locked --all-targets -- -D warnings > reports/validation/name-queries/clippy-198.log 2>&1
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target/ci198" cargo test --locked > reports/validation/name-queries/rust-tests-198.log 2>&1
printf 'Rust1.98 gates passed\n'
PATH="$task_root/.tools/node-22/bin:$PATH" npm test > reports/validation/name-queries/full-node22.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm run test:corpus > reports/validation/name-queries/corpus-node22.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" npm run test:wpt > reports/validation/name-queries/wpt-node22.log 2>&1
printf 'Node22 suites and corpora passed\n'
npm run test:memory > reports/validation/name-queries/general-memory.log 2>&1
npm run test:native-memory > reports/validation/name-queries/native-memory.log 2>&1
printf 'General and native memory checks passed\n'
npm run package > reports/validation/name-queries/package.log 2>&1
npm run test:package > reports/validation/name-queries/package-node24.log 2>&1
PATH="$task_root/.tools/node-22/bin:$PATH" node "$parent_runtime/.tools/npm-11/node_modules/npm/bin/npm-cli.js" run test:package > reports/validation/name-queries/package-node22.log 2>&1
printf 'Element relatives final validation and installed package passed\n'
