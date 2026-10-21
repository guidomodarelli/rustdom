#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/id-lookups-root.txt")
cd "$validation_root"
cp reports/validation/id-lookups/baseline-v24.14.1.log reports/validation/id-lookups/baseline-v24.14.1-before-xml-write-capture.log
cp tests/id-lookups.spec.cjs reports/validation/id-lookups/baseline-before-xml-write-capture.spec.cjs
cp "$task_root/.cache/id-lookups.spec.cjs" tests/id-lookups.spec.cjs
cp tests/id-lookups.spec.cjs reports/validation/id-lookups/baseline.spec.cjs
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/id-lookups.spec.cjs > "reports/validation/id-lookups/baseline-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/baseline-$version.log"
done
"$task_root/.tools/node/bin/node" -e 'const fs=require("node:fs"),crypto=require("node:crypto"),assert=require("node:assert/strict");const path="reports/validation/id-lookups/baseline.json";const report=JSON.parse(fs.readFileSync(path));for(const node of ["v24.14.1","v22.12.0"])assert.match(fs.readFileSync(`reports/validation/id-lookups/baseline-${node}.log`,"utf8"),/(?:ℹ|#) pass 82/);report.initialFixtureSha256=report.fixtureSha256;report.fixtureSha256=crypto.createHash("sha256").update(fs.readFileSync("tests/id-lookups.spec.cjs")).digest("hex");report.fixtureRevisedAt=new Date().toISOString();report.testsPerNode=82;report.fixtureScope="Capture open/write/close errors individually: pinned jsdom opens XML but rejects write after removing existing contents. Both engines must preserve those errors and partial effects.";fs.writeFileSync(path,JSON.stringify(report,null,2)+"\n");'
printf 'Document and SVG ID baseline passed on both Node versions\n'
