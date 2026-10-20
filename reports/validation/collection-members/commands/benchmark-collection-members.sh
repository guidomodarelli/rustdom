#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-members-root.txt")
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
cp -a "$source_root/benchmarks/." benchmarks/
cp "$source_root/tests/benchmarks/collection-members.spec.cjs" tests/benchmarks/
node -e 'const fs=require("node:fs"); const {captureSourceIdentity}=require("./benchmarks/sources.cjs"); fs.writeFileSync("reports/validation/collection-members/runtime-source.json", JSON.stringify(captureSourceIdentity(process.cwd()),null,2)+"\n");'
workloads=(collection-class-live collection-tag-live collection-namespace-live collection-class-create collection-class-cached collection-class-many-live collection-named-hit collection-named-miss collection-property-names)
for repetition in forward reverse; do
  for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
    if [[ "$repetition" == forward ]]; then stages=(baseline candidate); else stages=(candidate baseline); fi
    for stage in "${stages[@]}"; do
      printf 'Stage=%s repetition=%s node=%s\n' "$stage" "$repetition" "$("$executable" --version)" >> reports/validation/collection-members/benchmarks.log
      if [[ "$stage" == baseline ]]; then
        RUSTDOM_BENCHMARK_PACKAGE="$validation_root/baseline-engine" "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/collection-members/benchmarks.log 2>&1
      else
        "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" >> reports/validation/collection-members/benchmarks.log 2>&1
      fi
    done
  done
done
tail -20 reports/validation/collection-members/benchmarks.log
