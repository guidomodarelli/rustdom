#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/id-lookups-root.txt")
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
for name in rust-format rust-lint rust-tests build; do
  cp "reports/validation/$name.log" "reports/validation/id-lookups/before-observable-hook-fix/$name.log"
done
cp "$task_root/.cache/id-lookups-review-snapshot.json" reports/validation/id-lookups/before-observable-hook-fix/review-snapshot.json
cp "$task_root/.cache/id-lookups-current-source.json" reports/validation/id-lookups/before-observable-hook-fix/source.json
for name in benchmark-contracts-v24.14.1.log benchmark-contracts-v22.12.0.log benchmark-cli-v24.14.1.log benchmark-cli-v22.12.0.log; do
  cp "reports/validation/id-lookups/$name" reports/validation/id-lookups/before-observable-hook-fix/
done
node "$task_root/.cache/copy-id-lookups-sources.cjs" "$validation_root" "$source_root" "$task_root"
node - "$source_root" "$task_root" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [repository, primary] = process.argv.slice(2);
const source = require('./benchmarks/sources.cjs').captureSourceIdentity(repository);
assert.equal(require('./benchmarks/sources.cjs').captureSourceIdentity().sourceHash, source.sourceHash);
for (const root of [repository, primary]) fs.writeFileSync(root + '/.cache/id-lookups-current-source.json', JSON.stringify(source, null, 2) + '\n');
const build = JSON.parse(fs.readFileSync('dist/native-build.json'));
fs.writeFileSync(primary + '/.cache/id-lookups-native-build-final.json', JSON.stringify({ capturedAt: new Date().toISOString(), sourceHash: source.sourceHash, build }, null, 2) + '\n');
console.log(JSON.stringify({ sourceHash: source.sourceHash, sources: source.measuredSources.length, binarySha256: build.binarySha256 }));
NODE
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/id-lookups/benchmark-contracts-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/benchmark-contracts-$version.log"
done
bash "$task_root/.cache/validate-id-lookups-final.sh"
