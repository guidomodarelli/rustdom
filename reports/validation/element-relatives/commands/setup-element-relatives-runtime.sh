#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
parent_runtime=$(cat "$task_root/.cache/collection-members-root.txt")
validation_root=$(mktemp -d /home/guido/rustdom-element-relatives-XXXXXX)
printf '%s\n' "$validation_root" > "$task_root/.cache/element-relatives-root.txt"
mkdir -p "$source_root/.cache"
printf '%s\n' "$validation_root" > "$source_root/.cache/element-relatives-root.txt"
tar -xf "$task_root/.cache/element-relatives-base.tar" -C "$validation_root"
ln -s "$parent_runtime/node_modules" "$validation_root/node_modules"
mkdir -p "$validation_root/baseline-engine" "$validation_root/reports/validation/element-relatives"
cp -a "$parent_runtime/dist" "$validation_root/dist"
cp -a "$parent_runtime/dist" "$validation_root/baseline-engine/dist"
cp "$validation_root/package.json" "$validation_root/baseline-engine/package.json"
cp "$source_root/tests/element-relatives.spec.cjs" "$validation_root/tests/element-relatives.spec.cjs"
exec bash "$task_root/.cache/baseline-element-relatives.sh"
