#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
root=$(cat "$task_root/.cache/attribute-copy-root.txt")
baseline=/home/guido/rustdom-element-collection-ffhkkq/baseline-engine
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export PATH="$task_root/.tools/node-22/bin:$CARGO_HOME/bin:$PATH"
cd "$root"
output=reports/benchmarks/attribute-copy/aa-control
mkdir -p "$output"
printf 'Diagnostic A/A: both stage labels load the same immutable checkpoint65 native binary and distribution. No candidate acceptance is inferred.\n' > "$output/methodology.txt"
sha256sum "$baseline/dist/rustdom.node" > "$output/native-before.sha256"
sleep 15
workloads=(clone-shallow-attributes clone-deep-children clone-shallow-template clone-nested-templates form-data-construct attribute-get)
for round in 1 2; do
  if [ "$round" = 1 ]; then stages=(first second); else stages=(second first); fi
  for stage in "${stages[@]}"; do
    printf 'AA round%s %s\n' "$round" "$stage"
    log="$output/round$round-$stage.log"
    RUSTDOM_BENCHMARK_PACKAGE="$baseline" node --expose-gc benchmarks/compare.cjs "${workloads[@]}" > "$log" 2>&1 || { tail -n 80 "$log"; exit 1; }
    tail -n 3 "$log"
  done
done
sha256sum --check "$output/native-before.sha256"
printf 'AA DIAGNOSTIC COMPLETED\n'
