#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
baseline_runtime=$(cat "$task_root/.cache/fragment-id-root.txt")
dependency_runtime=$(cat "$task_root/.cache/collection-members-root.txt")
validation_root=$(mktemp -d /home/guido/rustdom-id-lookups-XXXXXX)
tar -xf "$source_root/.cache/id-lookups-base-859c111.tar" -C "$validation_root"
printf '%s\n' "$validation_root" > "$task_root/.cache/id-lookups-root.txt"
ln -s "$dependency_runtime/node_modules" "$validation_root/node_modules"
cp -a "$baseline_runtime/dist" "$validation_root/dist"
mkdir -p "$validation_root/baseline-engine/src" "$validation_root/reports/validation/id-lookups"
cp -a "$baseline_runtime/dist" "$validation_root/baseline-engine/dist"
cp "$validation_root/package.json" "$validation_root/baseline-engine/package.json"
cp -a "$validation_root/src/environments" "$validation_root/baseline-engine/src/environments"
ln -s "$dependency_runtime/node_modules" "$validation_root/baseline-engine/node_modules"
cp "$task_root/.cache/id-lookups.spec.cjs" "$validation_root/tests/id-lookups.spec.cjs"
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
node -e 'const fs=require("node:fs"),crypto=require("node:crypto"),assert=require("node:assert/strict");const source=require("./benchmarks/sources.cjs").captureSourceIdentity();assert.equal(source.sourceHash,"73f242643bfee440594c36b15635917118a01221cabea18bd7b85bd58553ef73");const binary=crypto.createHash("sha256").update(fs.readFileSync("dist/rustdom.node")).digest("hex");assert.equal(binary,"69577fc60935fd561f37cfb0b2bfbbd7cf970434448ffb7e795877f17706d23e");const fixture=fs.readFileSync("tests/id-lookups.spec.cjs");fs.writeFileSync("reports/validation/id-lookups/baseline.spec.cjs",fixture);fs.writeFileSync("reports/validation/id-lookups/baseline.json",JSON.stringify({capturedAt:new Date().toISOString(),baselineCommit:"859c11159ad00ab39a37acb46428164f8a386f77",sourceHash:source.sourceHash,nativeBinarySha256:binary,reference:require("jsdom/package.json").version,fixtureSha256:crypto.createHash("sha256").update(fixture).digest("hex"),archiveScope:"All tracked root entries except historical reports; no product sources/fixtures omitted.",source},null,2)+"\n");'
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/id-lookups.spec.cjs > "reports/validation/id-lookups/baseline-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/baseline-$version.log"
done
printf 'Document and SVG ID baseline passed: %s\n' "$validation_root"
