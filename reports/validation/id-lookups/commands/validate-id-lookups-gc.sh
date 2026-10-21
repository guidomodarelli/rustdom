#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/id-lookups-root.txt")
cp "$task_root/.cache/id-lookups-memory.cjs" "$validation_root/tests/helpers/id-lookups-memory.cjs"
cat > "$validation_root/scripts/constants/id-lookups-memory.cjs" <<'JS'
/** @module id-lookups-memory Native index churn and retained-capacity budgets. */
'use strict';
module.exports = { ID_ALIAS_CHURN_CYCLES: 512, MAX_RETAINED_NAME_CAPACITY: 64 };
JS
cd "$validation_root"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --expose-gc tests/helpers/id-lookups-memory.cjs > "reports/validation/id-lookups/gc-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/gc-$version.log"
done
printf 'Document and SVG ID ownership scenarios passed\n'
