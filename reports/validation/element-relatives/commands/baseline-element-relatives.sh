#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/element-relatives-root.txt")
cd "$validation_root"
cp package.json baseline-engine/package.json
cp "$source_root/tests/element-relatives.spec.cjs" tests/element-relatives.spec.cjs
"$task_root/.tools/node/bin/node" -e 'const fs=require("node:fs");const paths=["dist/vendor-jsdom/lib/jsdom/living/nodes/ParentNode-impl.js","dist/vendor-jsdom/lib/jsdom/living/nodes/NonDocumentTypeChildNode-impl.js"];const metrics={capturedAt:new Date().toISOString(),baselineCommit:"b7b1cf226c41c9c29bc17778d61084650c4eea19",files:paths.map((path)=>({path,lines:fs.readFileSync(path,"utf8").trimEnd().split("\n").length}))};fs.writeFileSync("reports/validation/element-relatives/baseline-metrics.json",JSON.stringify(metrics,null,2)+"\n");'
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/element-relatives.spec.cjs > "reports/validation/element-relatives/baseline-$version.log" 2>&1
  tail -8 "reports/validation/element-relatives/baseline-$version.log"
done
printf 'Element relatives baseline runtime: %s\n' "$validation_root"
