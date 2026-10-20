#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/name-queries-root.txt")
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); const build=JSON.parse(fs.readFileSync("baseline-engine/dist/native-build.json"));assert.equal(build.binarySha256,"f5ae22cf5fe22d95e3a51b23693738de8c9040bc1332640d9b3ecb136899fa77");const source=require("./benchmarks/sources.cjs").captureSourceIdentity();assert.equal(source.sourceHash,JSON.parse(fs.readFileSync(process.argv[1])).sourceHash);fs.writeFileSync("reports/validation/name-queries/runtime-source.json",JSON.stringify(source,null,2)+"\n");' "$source_root/.cache/name-queries-current-source.json"
workloads=(document-name-create document-name-live document-name-cached document-name-miss collection-class-live collection-class-cached element-children-refresh)
for repetition in forward reverse; do
  for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
    if [[ "$repetition" == forward ]]; then stages=(baseline candidate); else stages=(candidate baseline); fi
    for stage in "${stages[@]}"; do
      printf 'Stage=%s repetition=%s node=%s\n' "$stage" "$repetition" "$("$executable" --version)" >> reports/validation/name-queries/benchmarks.log
      if [[ "$stage" == baseline ]]; then
        RUSTDOM_BENCHMARK_PACKAGE="$validation_root/baseline-engine" "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/name-queries/benchmarks.log 2>&1
      else
        "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/name-queries/benchmarks.log 2>&1
      fi
      tail -2 reports/validation/name-queries/benchmarks.log
    done
  done
done
printf 'Document name query benchmarks completed\n'
