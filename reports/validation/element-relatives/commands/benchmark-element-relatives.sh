#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/element-relatives-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
node -e 'const fs=require("node:fs"); const {captureSourceIdentity}=require("./benchmarks/sources.cjs"); fs.writeFileSync("reports/validation/element-relatives/runtime-source.json", JSON.stringify(captureSourceIdentity(process.cwd()),null,2)+"\n");'
workloads=(element-children-refresh element-children-cached element-first-child element-last-child element-next-sibling element-previous-sibling)
for repetition in forward reverse; do
  for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
    if [[ "$repetition" == forward ]]; then stages=(baseline candidate); else stages=(candidate baseline); fi
    for stage in "${stages[@]}"; do
      printf 'Stage=%s repetition=%s node=%s\n' "$stage" "$repetition" "$("$executable" --version)" >> reports/validation/element-relatives/benchmarks.log
      if [[ "$stage" == baseline ]]; then
        RUSTDOM_BENCHMARK_PACKAGE="$validation_root/baseline-engine" "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/element-relatives/benchmarks.log 2>&1
      else
        "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/element-relatives/benchmarks.log 2>&1
      fi
      tail -2 reports/validation/element-relatives/benchmarks.log
    done
  done
done
printf 'Element relatives benchmarks completed\n'
