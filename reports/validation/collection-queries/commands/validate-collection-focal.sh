#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-queries-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR=/home/guido/rustdom-dom-parser-final-OgiDlEeg/target/ci199
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
for directory in src scripts types; do cp -a "$source_root/$directory/." "$directory/"; done
cp "$source_root/tests/collection-queries.spec.cjs" tests/collection-queries.spec.cjs
cargo fmt
for file in collection_queries.rs constants.rs mod.rs token_list.rs traversal.rs slot_assignment_driver.rs selector_element.rs tree.rs; do
  cp "src/dom/$file" "$source_root/src/dom/$file"
done
cargo clippy --locked --all-targets -- -D warnings > reports/validation/collection-queries/clippy.log 2>&1
cargo test --locked > reports/validation/collection-queries/rust-tests.log 2>&1
npm run build > reports/validation/collection-queries/build.log 2>&1
node --test tests/collection-queries.spec.cjs tests/tree*.spec.cjs tests/slot*.spec.cjs > reports/validation/collection-queries/focal-node24.log 2>&1
"$task_root/.tools/node-22/bin/node" --test tests/collection-queries.spec.cjs tests/tree*.spec.cjs tests/slot*.spec.cjs > reports/validation/collection-queries/focal-node22.log 2>&1
tail -10 reports/validation/collection-queries/focal-node24.log
tail -10 reports/validation/collection-queries/focal-node22.log
