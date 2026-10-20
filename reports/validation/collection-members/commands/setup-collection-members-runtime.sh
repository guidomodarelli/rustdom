#!/usr/bin/env bash
set -euo pipefail
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
parent_runtime=$(cat "$task_root/.cache/collection-queries-root.txt")
validation_root=$(mktemp -d /home/guido/rustdom-collection-members-XXXXXX)
tar -xf "$source_root/.cache/collection-members-base.tar" -C "$validation_root"
ln -s "$parent_runtime/node_modules" "$validation_root/node_modules"
cp -a "$parent_runtime/dist" "$validation_root/dist"
mkdir "$validation_root/baseline-engine"
cp -a "$parent_runtime/dist" "$validation_root/baseline-engine/dist"
ln -s "$parent_runtime/node_modules" "$validation_root/baseline-engine/node_modules"
printf '%s\n' "$validation_root" > "$task_root/.cache/collection-members-root.txt"
printf '%s\n' "$validation_root" > "$source_root/.cache/collection-members-root.txt"
mkdir -p "$validation_root/reports/validation/collection-members"
printf 'Runtime de miembros: %s\n' "$validation_root"
