#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/attribute-reads-root.txt")
parent_runtime=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent_runtime/target/ci199"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
files=(src/dom/attribute_operations.rs src/dom/attribute_reads.rs src/dom/mod.rs src/dom/tree.rs src/dom/native-tree.cjs src/dom/attribute-bridge.cjs scripts/build-attribute-reads.mjs scripts/build.mjs types/index.d.cts types/native.d.cts tests/attribute-reads.spec.cjs)
for file in "${files[@]}"; do cp "$source_root/$file" "$validation_root/$file"; done
cd "$validation_root"
cargo fmt
for file in src/dom/attribute_operations.rs src/dom/attribute_reads.rs src/dom/mod.rs src/dom/tree.rs; do cp "$file" "$source_root/$file"; done
cargo clippy --locked --all-targets -- -D warnings > reports/validation/attribute-reads/clippy-199.log 2>&1
cargo test --locked > reports/validation/attribute-reads/rust-199.log 2>&1
npm run build > reports/validation/attribute-reads/build.log 2>&1
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/attribute-reads.spec.cjs tests/attribute-collections.spec.cjs tests/attribute-names.spec.cjs tests/attribute-cache.spec.cjs tests/id-lookups.spec.cjs tests/form-data-observable-types.spec.cjs tests/form-data.spec.cjs > "reports/validation/attribute-reads/focal-$version.log" 2>&1
  tail -8 "reports/validation/attribute-reads/focal-$version.log"
done
printf 'Native attribute read implementation validated in Node 22 and 24\n'
