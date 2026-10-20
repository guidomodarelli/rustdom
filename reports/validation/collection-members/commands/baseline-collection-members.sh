#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-members-root.txt")
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
cp "$source_root/tests/collection-members.spec.cjs" tests/collection-members.spec.cjs
node -e 'const fs=require("fs");const source=fs.readFileSync("dist/vendor-jsdom/lib/jsdom/living/nodes/HTMLCollection-impl.js","utf8");fs.writeFileSync("reports/validation/collection-members/baseline-metrics.json",JSON.stringify({capturedAt:new Date().toISOString(),mainFile:"dist/vendor-jsdom/lib/jsdom/living/nodes/HTMLCollection-impl.js",mainLines:source.split("\n").length-1,scope:"Existing HTMLCollection implementation and name/property enumeration before native migration"},null,2)+"\n");'
node --test tests/collection-members.spec.cjs > reports/validation/collection-members/baseline-node24.log 2>&1
"$task_root/.tools/node-22/bin/node" --test tests/collection-members.spec.cjs > reports/validation/collection-members/baseline-node22.log 2>&1
tail -9 reports/validation/collection-members/baseline-node24.log
tail -9 reports/validation/collection-members/baseline-node22.log
