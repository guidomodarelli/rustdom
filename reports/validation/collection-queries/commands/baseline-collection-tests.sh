#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-queries-root.txt")
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
mkdir -p reports/validation/collection-queries
cp "$source_root/tests/collection-queries.spec.cjs" tests/collection-queries.spec.cjs
node -e 'const fs=require("fs");const source=fs.readFileSync("node_modules/jsdom/lib/jsdom/living/node.js","utf8"); const start=source.indexOf("exports.listOfElementsWithClassNames");const end=source.indexOf("// https://dom.spec.whatwg.org/#converting-nodes-into-a-node");const metrics={capturedAt:new Date().toISOString(),mainFile:"jsdom/lib/jsdom/living/node.js",mainLines:source.split("\n").length-1,featureLines:source.slice(start,end).split("\n").length-1,featureScope:"Three original live getElementsBy* query helpers, excluding shared HTMLCollection and topology"};fs.writeFileSync("reports/validation/collection-queries/baseline-metrics.json",JSON.stringify(metrics,null,2)+"\n");'
node --test tests/collection-queries.spec.cjs > reports/validation/collection-queries/baseline-node24.log 2>&1
"$task_root/.tools/node-22/bin/node" --test tests/collection-queries.spec.cjs > reports/validation/collection-queries/baseline-node22.log 2>&1
tail -9 reports/validation/collection-queries/baseline-node24.log
tail -9 reports/validation/collection-queries/baseline-node22.log
