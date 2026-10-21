#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
root=$(cat "$task_root/.cache/attribute-copy-root.txt")
baseline=/home/guido/rustdom-element-collection-ffhkkq/baseline-engine
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$root"
output=reports/benchmarks/attribute-copy
mkdir -p "$output"
ps -eo pid,comm,pcpu > "$output/processes-before.txt"
cat /proc/loadavg > "$output/load-before.txt"
node "$task_root/.cache/attribute-copy-benchmark-identity.cjs" > "$output/identity-before.log"
sleep 15
workloads=(clone-shallow-attributes clone-deep-children clone-deep-chain clone-template-content import-deep-children import-template-content clone-shallow-template clone-nested-templates form-data-construct attribute-get)
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  "$executable" --expose-gc benchmarks/attribute-copy.cjs > "$output/micro-$version.log" 2>&1 || { tail -n 80 "$output/micro-$version.log"; exit 1; }
  tail -n 3 "$output/micro-$version.log"
  for round in 1 2; do
    if [ "$round" = 1 ]; then stages=(baseline candidate); else stages=(candidate baseline); fi
    for stage in "${stages[@]}"; do
      printf 'BENCH %s round%s %s\n' "$version" "$round" "$stage"
      log="$output/public-$version-round$round-$stage.log"
      if [ "$stage" = baseline ]; then
        RUSTDOM_BENCHMARK_PACKAGE="$baseline" "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" > "$log" 2>&1 || { tail -n 80 "$log"; exit 1; }
      else
        "$executable" --expose-gc benchmarks/compare.cjs "${workloads[@]}" > "$log" 2>&1 || { tail -n 80 "$log"; exit 1; }
      fi
      tail -n 3 "$log"
    done
  done
done
node "$task_root/.cache/attribute-copy-benchmark-identity.cjs" verify > "$output/identity-after.log"
cat /proc/loadavg > "$output/load-after.txt"
printf 'BENCHMARKS COMPLETED\n'
