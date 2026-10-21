#!/usr/bin/env bash
set -euo pipefail
task=/mnt/c/Users/guido/ghq/projects/rustdom
root=$(cat "$task/.cache/xml-controller-root.txt")
export CARGO_HOME="$task/.tools/cargo" RUSTUP_HOME="$task/.tools/rustup"
export PATH="$CARGO_HOME/bin:$PATH"
cd "$root"
for version in 1.99.1 1.98.1; do
  export RUSTUP_TOOLCHAIN="$version"
  if [ "$version" = 1.99.1 ]; then export CARGO_TARGET_DIR=/home/guido/rustdom-dom-parser-final-OgiDlEeg/target/ci199; else export CARGO_TARGET_DIR=/home/guido/rustdom-name-queries-ui9xbm/target/ci198; fi
  cargo fmt --check > "reports/validation/xml-serializer-controller/fmt-$version.log" 2>&1
  cargo clippy --locked --all-targets -- -D warnings > "reports/validation/xml-serializer-controller/clippy-$version.log" 2>&1 || { tail -n 60 "reports/validation/xml-serializer-controller/clippy-$version.log"; exit 1; }
  cargo test --locked > "reports/validation/xml-serializer-controller/rust-$version.log" 2>&1 || { tail -n 60 "reports/validation/xml-serializer-controller/rust-$version.log"; exit 1; }
  tail -n 5 "reports/validation/xml-serializer-controller/rust-$version.log"
done
