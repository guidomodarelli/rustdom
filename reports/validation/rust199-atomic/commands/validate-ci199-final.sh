#!/usr/bin/env bash
set -euo pipefail
source_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$source_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$source_root/.tools/cargo"
export RUSTUP_HOME="$source_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$validation_root/target/ci199"
export PATH="$source_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
cp "$source_root/src/dom/abort_state.rs" src/dom/abort_state.rs
cp "$source_root/src/dom/abort_state_binding.rs" src/dom/abort_state_binding.rs
cargo fmt
cp src/dom/abort_state.rs "$source_root/src/dom/abort_state.rs"
cp src/dom/abort_state_binding.rs "$source_root/src/dom/abort_state_binding.rs"
cargo clippy --locked --all-targets -- -D warnings > reports/validation/rust199-atomic/clippy-199-final.log 2>&1
cargo test --locked > reports/validation/rust199-atomic/rust-tests-199-final.log 2>&1
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target" cargo clippy --locked --all-targets -- -D warnings > reports/validation/rust199-atomic/clippy-198-final.log 2>&1
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target" cargo test --locked > reports/validation/rust199-atomic/rust-tests-198-final.log 2>&1
npm run build > reports/validation/rust199-atomic/build-final.log 2>&1
npm test > reports/validation/rust199-atomic/full-node24.log 2>&1
PATH="$source_root/.tools/node-22/bin:$PATH" npm test > reports/validation/rust199-atomic/full-node22.log 2>&1
export VALGRIND_LIB="$source_root/.tools/valgrind/usr/libexec/valgrind"
cargo test --no-run --locked --message-format=json > .ci199-test-executable.json 2> reports/validation/rust199-atomic/memcheck-build.log
test_executable=$(node -e 'const fs=require("fs"); const rows=fs.readFileSync(".ci199-test-executable.json","utf8").trim().split("\n").map(line=>JSON.parse(line)); process.stdout.write(rows.find(row=>row.executable&&row.profile?.test).executable);')
"$source_root/.tools/valgrind/usr/bin/valgrind" --tool=memcheck --leak-check=full --show-leak-kinds=all --errors-for-leak-kinds=definite,indirect --track-origins=yes --error-exitcode=99 --log-file=reports/validation/rust199-atomic/memcheck.log "$test_executable" 'dom::abort_state::tests::' --test-threads=1 > reports/validation/rust199-atomic/memcheck-tests.log 2>&1
npm run package > reports/validation/rust199-atomic/package.log 2>&1
npm run test:package > reports/validation/rust199-atomic/package-node24.log 2>&1
PATH="$source_root/.tools/node-22/bin:$PATH" node "$validation_root/.tools/npm-11/node_modules/npm/bin/npm-cli.js" run test:package > reports/validation/rust199-atomic/package-node22.log 2>&1
printf 'CI199 final validation passed\n'
