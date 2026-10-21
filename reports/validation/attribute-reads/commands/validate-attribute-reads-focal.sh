#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/attribute-reads-root.txt")
while IFS= read -r file; do cp "$source_root/$file" "$validation_root/$file"; done < "$source_root/.cache/attribute-reads-owned-sources.txt"
cd "$validation_root"
mkdir -p reports/compatibility reports/memory
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/attribute-reads.spec.cjs tests/native-attribute-reads.spec.cjs tests/attribute-collections.spec.cjs tests/attribute-names.spec.cjs tests/attribute-cache.spec.cjs tests/id-lookups.spec.cjs tests/form-data-observable-types.spec.cjs tests/form-data.spec.cjs > "reports/validation/attribute-reads/focal-final-$version.log" 2>&1
  tail -8 "reports/validation/attribute-reads/focal-final-$version.log"
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/attribute-reads/benchmark-contracts-$version.log" 2>&1
  tail -8 "reports/validation/attribute-reads/benchmark-contracts-$version.log"
  "$executable" --expose-gc scripts/attribute-reads-memory.cjs > "reports/validation/attribute-reads/gc-$version.log" 2>&1
  tail -2 "reports/validation/attribute-reads/gc-$version.log"
done
printf 'Attribute read functional, harness and ownership checks passed\n'
