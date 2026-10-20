#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
baseline_runtime=$(cat "$task_root/.cache/name-queries-root.txt")
dependency_runtime=$(cat "$task_root/.cache/collection-members-root.txt")
validation_root=$(mktemp -d /home/guido/rustdom-fragment-id-XXXXXX)
tar -xf "$source_root/.cache/fragment-id-base-645f2ec.tar" -C "$validation_root"
printf '%s\n' "$validation_root" > "$task_root/.cache/fragment-id-root.txt"
ln -s "$dependency_runtime/node_modules" "$validation_root/node_modules"
cp -a "$baseline_runtime/dist" "$validation_root/dist"
mkdir -p "$validation_root/baseline-engine/src" "$validation_root/reports/validation/fragment-id"
cp -a "$baseline_runtime/dist" "$validation_root/baseline-engine/dist"
cp "$validation_root/package.json" "$validation_root/baseline-engine/package.json"
cp -a "$validation_root/src/environments" "$validation_root/baseline-engine/src/environments"
ln -s "$dependency_runtime/node_modules" "$validation_root/baseline-engine/node_modules"
cp "$task_root/.cache/fragment-id.spec.cjs" "$validation_root/tests/fragment-id.spec.cjs"
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
node -e 'const fs=require("node:fs"),crypto=require("node:crypto"),assert=require("node:assert/strict");const source=require("./benchmarks/sources.cjs").captureSourceIdentity();assert.equal(source.sourceHash,"bacff4caae10b43c593997c4f12b48ab3c9a292707d174f8680b25b44ba63998");const binary=crypto.createHash("sha256").update(fs.readFileSync("dist/rustdom.node")).digest("hex");assert.equal(binary,"ca4c8081fe104e56131ed8e4beddc39dcbef1074e26b31ec70968f2f3aadcc30");const fixture=fs.readFileSync("tests/fragment-id.spec.cjs");fs.writeFileSync("reports/validation/fragment-id/baseline.spec.cjs",fixture);fs.writeFileSync("reports/validation/fragment-id/baseline.json",JSON.stringify({capturedAt:new Date().toISOString(),baselineCommit:"645f2ec514986f51893d8cb7f01b50610da54eec",sourceHash:source.sourceHash,nativeBinarySha256:binary,reference:require("jsdom/package.json").version,fixtureSha256:crypto.createHash("sha256").update(fixture).digest("hex"),archiveScope:"All tracked root entries except historical reports; no product sources/fixtures omitted.",source},null,2)+"\n");'
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/fragment-id.spec.cjs > "reports/validation/fragment-id/baseline-$version.log" 2>&1
  tail -8 "reports/validation/fragment-id/baseline-$version.log"
done
printf 'Fragment ID baseline passed: %s\n' "$validation_root"
