#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/collection-queries-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
output="$validation_root/reports/validation/collection-queries/toolchains.log"
"$CARGO_HOME/bin/rustup" run stable rustc -Vv > "$output"
"$CARGO_HOME/bin/rustup" run 1.99.1 rustc -Vv >> "$output"
"$task_root/.tools/node/bin/node" --version >> "$output"
"$task_root/.tools/node-22/bin/node" --version >> "$output"
