#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/name-queries-root.txt")
cd "$validation_root"
node24_report=$(sed -n 's/^Guardado: //p' reports/validation/name-queries/worker-validation-v24.14.1.log)
if "$task_root/.tools/node/bin/node" -e 'const report=require(process.argv[1]); require("node:assert/strict").equal(report.runs[0].workloads[0].inputBytes,20);' "$validation_root/$node24_report" > reports/validation/name-queries/worker-metadata-before-expected-byte-fix.log 2>&1; then exit 2; fi
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  if [[ "$version" != v24.14.1 ]]; then
    "$executable" --expose-gc benchmarks/compare.cjs document-name-create document-name-live document-name-cached document-name-miss > "reports/validation/name-queries/worker-validation-$version.log" 2>&1
  fi
  report_path=$(sed -n 's/^Guardado: //p' "reports/validation/name-queries/worker-validation-$version.log")
  "$executable" -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); const report=JSON.parse(fs.readFileSync(process.argv[1])); assert.equal(report.complete,true);assert.equal(report.runs.length,4);assert.equal(report.comparisons.length,8);for(const run of report.runs)for(const workload of run.workloads)assert.equal(workload.inputBytes,21);console.log(JSON.stringify({node:report.node,workers:report.runs.length,rows:report.comparisons.length,actualBootstrapBytes:21,pass:true,timingUse:"Correctness only; excluded from final performance comparison."}));' "$report_path"
done
