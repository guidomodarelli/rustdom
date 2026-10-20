#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/element-relatives-root.txt")
parent_runtime=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent_runtime/target/ci199"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
for directory in src scripts types; do cp -a "$source_root/$directory/." "$directory/"; done
cp "$source_root/tests/element-relatives.spec.cjs" tests/element-relatives.spec.cjs
cargo fmt
for file in mod.rs tree.rs element_relatives.rs; do cp "src/dom/$file" "$source_root/src/dom/$file"; done
cargo clippy --locked --all-targets -- -D warnings > reports/validation/element-relatives/clippy.log 2>&1
cargo test --locked > reports/validation/element-relatives/rust-tests.log 2>&1
npm run build > reports/validation/element-relatives/build.log 2>&1
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/element-relatives.spec.cjs tests/collection*.spec.cjs > "reports/validation/element-relatives/focal-$version.log" 2>&1
  tail -8 "reports/validation/element-relatives/focal-$version.log"
done
printf 'Element relatives focal validation passed\n'
