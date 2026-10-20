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
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$task_root/.tools/valgrind/usr/bin:$PATH"
cd "$validation_root"
for directory in src scripts types; do cp -a "$source_root/$directory/." "$directory/"; done
cp "$source_root/tests/collection-members.spec.cjs" tests/collection-members.spec.cjs
cargo fmt
for file in data.rs constants.rs mod.rs collection_members.rs collection_queries.rs selector_element.rs tree.rs; do
  cp "src/dom/$file" "$source_root/src/dom/$file"
done
cargo clippy --locked --all-targets -- -D warnings > reports/validation/collection-members/clippy.log 2>&1
cargo test --locked > reports/validation/collection-members/rust-tests.log 2>&1
npm run build > reports/validation/collection-members/build.log 2>&1
node --test tests/collection*.spec.cjs > reports/validation/collection-members/focal-node24.log 2>&1
"$task_root/.tools/node-22/bin/node" --test tests/collection*.spec.cjs > reports/validation/collection-members/focal-node22.log 2>&1
tail -9 reports/validation/collection-members/focal-node24.log
tail -9 reports/validation/collection-members/focal-node22.log
