#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/element-relatives-root.txt")
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
for directory in src scripts types benchmarks; do cp -a "$source_root/$directory/." "$directory/"; done
for file in element-relatives.spec.cjs collection-intrinsics.spec.cjs; do cp "$source_root/tests/$file" "tests/$file"; done
for file in collection-query-memory.cjs collection-intrinsics.cjs; do cp "$source_root/tests/helpers/$file" "tests/helpers/$file"; done
cp "$source_root/tests/benchmarks/element-relatives.spec.cjs" tests/benchmarks/element-relatives.spec.cjs
npm run build:js > reports/validation/element-relatives/build-js-integrated.log 2>&1
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/element-relatives.spec.cjs tests/collection*.spec.cjs > "reports/validation/element-relatives/integrated-focal-$version.log" 2>&1
  tail -8 "reports/validation/element-relatives/integrated-focal-$version.log"
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/element-relatives/benchmark-contracts-$version.log" 2>&1
  tail -8 "reports/validation/element-relatives/benchmark-contracts-$version.log"
done
printf 'Integrated Element-relative focal and benchmark contracts passed\n'
