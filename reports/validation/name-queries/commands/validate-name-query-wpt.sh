#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/name-queries-root.txt")
cd "$validation_root"
cp tests/fixtures/wpt/manifest.json reports/validation/name-queries/wpt-manifest-before-name-suite.json
mkdir -p tests/fixtures/wpt/html/dom/documents/dom-tree-accessors
cp -a "$source_root/tests/fixtures/wpt/html/dom/documents/dom-tree-accessors/document.getElementsByName" tests/fixtures/wpt/html/dom/documents/dom-tree-accessors/
cp "$source_root/tests/fixtures/wpt/manifest.json" tests/fixtures/wpt/manifest.json
cp tests/fixtures/wpt/manifest.json reports/validation/name-queries/wpt-manifest-with-name-suite.json
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" tests/wpt/run.cjs document-name-queries > "reports/validation/name-queries/wpt-names-$version.log" 2>&1
  tail -5 "reports/validation/name-queries/wpt-names-$version.log"
done
printf 'All fifteen upstream name-query WPT fixtures compared on both Node versions\n'
