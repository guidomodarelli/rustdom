#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/id-lookups-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export VALGRIND_LIB="$task_root/.tools/valgrind/usr/libexec/valgrind"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$task_root/.tools/valgrind/usr/bin:$PATH"
{
  date -u --iso-8601=seconds
  for toolchain in stable 1.99.1; do
    printf 'RUSTUP_TOOLCHAIN=%s\n' "$toolchain"
    RUSTUP_TOOLCHAIN="$toolchain" rustc --version
    RUSTUP_TOOLCHAIN="$toolchain" cargo --version
  done
  "$task_root/.tools/node/bin/node" --version
  "$task_root/.tools/node-22/bin/node" --version
  valgrind --version
  uname -srmo
} > "$validation_root/reports/validation/id-lookups/toolchains.log"
cat "$validation_root/reports/validation/id-lookups/toolchains.log"
