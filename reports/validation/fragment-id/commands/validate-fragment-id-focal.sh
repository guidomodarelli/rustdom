#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/fragment-id-root.txt")
parent_runtime=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent_runtime/target/ci199"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
cargo fmt
cargo clippy --locked --all-targets -- -D warnings > reports/validation/fragment-id/clippy.log 2>&1
cargo test --locked > reports/validation/fragment-id/rust-tests.log 2>&1
printf 'Fragment ID Rust gates passed\n'
npm run build > reports/validation/fragment-id/build.log 2>&1
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/fragment-id.spec.cjs tests/name-queries.spec.cjs tests/element-relatives.spec.cjs tests/collection*.spec.cjs > "reports/validation/fragment-id/focal-$version.log" 2>&1
  tail -8 "reports/validation/fragment-id/focal-$version.log"
done
printf 'Fragment ID focal validation passed\n'
