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
mkdir -p reports/validation/rust199-atomic
rustc --version > reports/validation/rust199-atomic/toolchain.log
cargo --version >> reports/validation/rust199-atomic/toolchain.log
# Build the unchanged published source with the same compiler for a genuine timing control.
npm run build > reports/validation/rust199-atomic/baseline-build.log 2>&1
baseline_root="$validation_root/ci199-baseline"
mkdir -p "$baseline_root"
for entry in src scripts benchmarks third-party package-lock.json Cargo.toml Cargo.lock; do cp -a "$entry" "$baseline_root/"; done
mkdir -p "$baseline_root/tests/integration"
cp tests/integration/read-dom-file.cjs "$baseline_root/tests/integration/"
cp -a dist "$baseline_root/dist"
ln -s "$validation_root/node_modules" "$baseline_root/node_modules"
cp "$source_root/src/dom/abort_state.rs" src/dom/abort_state.rs
cp "$source_root/src/dom/abort_state_binding.rs" src/dom/abort_state_binding.rs
cargo fmt
cp src/dom/abort_state.rs "$source_root/src/dom/abort_state.rs"
cp src/dom/abort_state_binding.rs "$source_root/src/dom/abort_state_binding.rs"
cargo clippy --locked --all-targets -- -D warnings > reports/validation/rust199-atomic/clippy-199.log 2>&1
cargo test --locked > reports/validation/rust199-atomic/rust-tests-199.log 2>&1
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target" cargo clippy --locked --all-targets -- -D warnings > reports/validation/rust199-atomic/clippy-198.log 2>&1
RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR="$validation_root/target" cargo test --locked > reports/validation/rust199-atomic/rust-tests-198.log 2>&1
npm run build > reports/validation/rust199-atomic/build.log 2>&1
node --test tests/abort*.spec.cjs tests/dom-parser-controller.spec.cjs tests/dom-parser-recovery.spec.cjs tests/character-data-undefined.spec.cjs tests/dom-parser-memory.spec.cjs > reports/validation/rust199-atomic/node24.log 2>&1
"$source_root/.tools/node-22/bin/node" --test tests/abort*.spec.cjs tests/dom-parser-controller.spec.cjs tests/dom-parser-recovery.spec.cjs tests/character-data-undefined.spec.cjs tests/dom-parser-memory.spec.cjs > reports/validation/rust199-atomic/node22.log 2>&1
tail -10 reports/validation/rust199-atomic/node24.log
tail -10 reports/validation/rust199-atomic/node22.log
