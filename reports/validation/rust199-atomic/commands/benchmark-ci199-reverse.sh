#!/usr/bin/env bash
set -euo pipefail
source_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$source_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$source_root/.tools/cargo"
export RUSTUP_HOME="$source_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export PATH="$source_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
for executable in "$source_root/.tools/node/bin/node" "$source_root/.tools/node-22/bin/node"; do
  "$executable" --expose-gc benchmarks/compare.cjs abort-lifecycle abort-any abort-propagation >> reports/validation/rust199-atomic/benchmarks.log 2>&1
  RUSTDOM_BENCHMARK_PACKAGE="$validation_root/ci199-baseline" "$executable" --expose-gc benchmarks/compare.cjs abort-lifecycle abort-any abort-propagation >> reports/validation/rust199-atomic/benchmarks.log 2>&1
done
tail -8 reports/validation/rust199-atomic/benchmarks.log
