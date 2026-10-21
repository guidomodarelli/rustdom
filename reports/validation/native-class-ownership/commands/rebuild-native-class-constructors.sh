#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
managed=/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom
runtime=$(cat "$task_root/.cache/native-class-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR=/home/guido/rustdom-dom-parser-final-OgiDlEeg/target/ci199
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$runtime"
output=reports/validation/native-class-ownership/constructor-guard
if [ -e "$output" ]; then printf 'Preserve existing constructor diagnostics\n' >&2; exit 1; fi
mkdir -p "$output"
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  version=$("$executable" --version)
  "$executable" "$task_root/.cache/probe-sdk-constructors.cjs" "$runtime/dist/native.cjs" "$runtime/$output/before-$version.json"
done
for relative in third-party/napi/src/bindgen_runtime/callback_info.rs third-party/napi/PATCHES.md scripts/constants/native-class-memory.cjs tests/native-class-construction.spec.cjs; do cp "$managed/$relative" "$relative"; done
rustfmt --edition 2021 third-party/napi/src/bindgen_runtime/callback_info.rs
cp third-party/napi/src/bindgen_runtime/callback_info.rs "$managed/third-party/napi/src/bindgen_runtime/callback_info.rs"
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  version=$("$executable" --version)
  if "$executable" --test tests/native-class-construction.spec.cjs > "$output/negative-$version.log" 2>&1; then printf 'The old constructor unexpectedly passed\n' >&2; exit 1; else printf 'Old constructor regression reproduced: %s\n' "$version"; fi
done
cargo fmt -- --check > "$output/fmt.log" 2>&1
cargo clippy --locked --all-targets -- -D warnings > "$output/clippy-1.99.1.log" 2>&1 || { tail -n 80 "$output/clippy-1.99.1.log"; exit 1; }
cargo test --locked > "$output/rust-1.99.1.log" 2>&1 || { tail -n 80 "$output/rust-1.99.1.log"; exit 1; }
npm run build > "$output/build.log" 2>&1 || { tail -n 80 "$output/build.log"; exit 1; }
for executable in "$task_root/.tools/node-22/bin/node" "$task_root/.tools/node/bin/node"; do
  version=$("$executable" --version)
  "$executable" "$task_root/.cache/probe-sdk-constructors.cjs" "$runtime/dist/native.cjs" "$runtime/$output/after-$version.json"
  "$executable" --test tests/native-class-construction.spec.cjs tests/napi-lifecycle.spec.cjs tests/range*.spec.cjs > "$output/focal-$version.log" 2>&1 || { tail -n 100 "$output/focal-$version.log"; exit 1; }
  tail -n 8 "$output/focal-$version.log"
done
printf 'Constructor ownership rebuild completed: %s\n' "$runtime"
