#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
element_runtime=$(cat "$task_root/.cache/element-relatives-root.txt")
dependency_runtime=$(cat "$task_root/.cache/collection-members-root.txt")
validation_root=$(mktemp -d /home/guido/rustdom-name-queries-XXXXXX)
tar -xf "$source_root/.cache/name-queries-base-0921ab0.tar" -C "$validation_root"
printf '%s\n' "$validation_root" > "$task_root/.cache/name-queries-root.txt"
printf '%s\n' "$validation_root" > "$source_root/.cache/name-queries-root.txt"
ln -s "$dependency_runtime/node_modules" "$validation_root/node_modules"
cp -a "$element_runtime/dist" "$validation_root/dist"
mkdir -p "$validation_root/baseline-engine/src" "$validation_root/reports/validation/name-queries"
cp -a "$element_runtime/dist" "$validation_root/baseline-engine/dist"
cp "$validation_root/package.json" "$validation_root/baseline-engine/package.json"
cp -a "$validation_root/src/environments" "$validation_root/baseline-engine/src/environments"
ln -s "$dependency_runtime/node_modules" "$validation_root/baseline-engine/node_modules"
cp "$source_root/tests/name-queries.spec.cjs" "$validation_root/tests/name-queries.spec.cjs"
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
node -e 'const fs=require("node:fs"),crypto=require("node:crypto"),assert=require("node:assert/strict"); const source=require("./benchmarks/sources.cjs").captureSourceIdentity(); assert.equal(source.sourceHash,"857dbc564eb2c810ad7d87e494e0b3497c98ea4fc46c3b467dbec5d1aed618c7"); const binary=crypto.createHash("sha256").update(fs.readFileSync("dist/rustdom.node")).digest("hex"); assert.equal(binary,"f5ae22cf5fe22d95e3a51b23693738de8c9040bc1332640d9b3ecb136899fa77"); const report={capturedAt:new Date().toISOString(),baselineCommit:"0921ab08459a22b237faf1c2ba19a250720f1dd9",sourceHash:source.sourceHash,nativeBinarySha256:binary,reference:require("jsdom/package.json").version,archiveScope:"All tracked root entries except historical reports; no product sources/fixtures omitted.", source}; fs.writeFileSync("reports/validation/name-queries/baseline.json",JSON.stringify(report,null,2)+"\n");'
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/name-queries.spec.cjs > "reports/validation/name-queries/baseline-$version.log" 2>&1
  tail -8 "reports/validation/name-queries/baseline-$version.log"
done
printf 'Name query baseline passed: %s\n' "$validation_root"
