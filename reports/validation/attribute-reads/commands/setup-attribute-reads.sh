#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(mktemp -d /home/guido/rustdom-attribute-reads-XXXXXX)
baseline_root=$(cat "$task_root/.cache/id-lookups-root.txt")
tar -xf "$source_root/.cache/attribute-reads-base.tar" -C "$validation_root"
printf '%s\n' "$validation_root" > "$task_root/.cache/attribute-reads-root.txt"
ln -s "$baseline_root/node_modules" "$validation_root/node_modules"
cp -a "$baseline_root/dist" "$validation_root/dist"
mkdir -p "$validation_root/baseline-engine/src" "$validation_root/reports/validation/attribute-reads"
cp -a "$baseline_root/dist" "$validation_root/baseline-engine/dist"
cp -a "$validation_root/src/environments" "$validation_root/baseline-engine/src/environments"
cp "$validation_root/package.json" "$validation_root/baseline-engine/package.json"
ln -s "$baseline_root/node_modules" "$validation_root/baseline-engine/node_modules"
export PATH="$task_root/.tools/node/bin:$PATH"
cd "$validation_root"
node - <<'NODE'
const fs = require('node:fs'), assert = require('node:assert/strict'), { createHash } = require('node:crypto');
const source = require('./benchmarks/sources.cjs').captureSourceIdentity();
const binary = createHash('sha256').update(fs.readFileSync('dist/rustdom.node')).digest('hex');
assert.equal(source.sourceHash, '95f641ef6dd84ddac7bbd70119121ece19669c125d5bb3c70d9693c9770a19b1');
assert.equal(binary, 'cc8852f6ba6e3755fbe8805948c8fb71bd140323b08b86d091727aacc8ed6753');
fs.writeFileSync('reports/validation/attribute-reads/baseline.json', JSON.stringify({ capturedAt: new Date().toISOString(),
  commit: 'baa87fa3eb1a62ec6477013bb305b2a79a0c3bb6', reviewedHead: 'be90ba1ac6b7404c585a8e1905e7808d883b512b',
  checkpoint: 'checkpoint-064-id-lookups', source, nativeBinarySha256: binary, reference: require('jsdom/package.json').version }, null, 2) + '\n');
console.log(JSON.stringify({ root: process.cwd(), binary }));
NODE
