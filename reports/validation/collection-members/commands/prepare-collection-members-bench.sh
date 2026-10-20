#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
validation_root=$(cat "$task_root/.cache/collection-members-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
cp -a "$source_root/benchmarks/." benchmarks/
cp "$source_root/tests/benchmarks/collection-members.spec.cjs" tests/benchmarks/
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/benchmarks/*.spec.cjs > "reports/validation/collection-members/benchmark-contracts-$version.log" 2>&1
  tail -8 "reports/validation/collection-members/benchmark-contracts-$version.log"
done
node -e 'const fs=require("node:fs"); const {captureSourceIdentity}=require("./benchmarks/sources.cjs"); fs.writeFileSync("reports/validation/collection-members/runtime-source.json", JSON.stringify(captureSourceIdentity(process.cwd()),null,2)+"\n");'
rustup run stable rustc -Vv > reports/validation/collection-members/toolchains.log
rustup run 1.99.1 rustc -Vv >> reports/validation/collection-members/toolchains.log
"$task_root/.tools/node/bin/node" --version >> reports/validation/collection-members/toolchains.log
"$task_root/.tools/node-22/bin/node" --version >> reports/validation/collection-members/toolchains.log
