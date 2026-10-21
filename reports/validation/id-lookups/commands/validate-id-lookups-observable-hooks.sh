#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
validation_root=$(cat "$task_root/.cache/id-lookups-root.txt")
source_root=/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom
parent_runtime=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent_runtime/target/ci199"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
cd "$validation_root"
mkdir reports/validation/id-lookups/before-observable-hook-fix
cp reports/validation/latest.json reports/validation/id-lookups/before-observable-hook-fix/release-gates-node24.json
for name in validate-node24.log rust-format.log rust-lint.log rust-tests.log build.log javascript-tests.log; do
  if [[ -f "reports/validation/id-lookups/$name" ]]; then cp "reports/validation/id-lookups/$name" reports/validation/id-lookups/before-observable-hook-fix/; fi
done
cp reports/validation/javascript-tests.log reports/validation/id-lookups/before-observable-hook-fix/javascript-tests.log
cp dist/native-build.json reports/validation/id-lookups/before-observable-hook-fix/native-build.json
for relative_path in scripts/build.mjs src/dom/native-tree.cjs src/dom/document_ids.rs src/dom/tree.rs types/native.d.cts tests/id-lookups.spec.cjs; do
  cp "$source_root/$relative_path" "$relative_path"
done
node - <<'NODE'
const fs = require('node:fs');
const source = fs.readFileSync('tests/id-lookups.spec.cjs', 'utf8');
const baseline = source.slice(0, source.indexOf("for (const realm of ['default', 'vm']) test(`should execute Document and SVG"));
if (baseline.length === 0 || baseline.length === source.length) throw new Error('Could not isolate differential baseline');
fs.writeFileSync('baseline-engine/tests/id-lookups-observable.spec.cjs', baseline);
fs.writeFileSync('reports/validation/id-lookups/baseline-observable.spec.cjs', baseline);
NODE
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test baseline-engine/tests/id-lookups-observable.spec.cjs > "reports/validation/id-lookups/baseline-observable-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/baseline-observable-$version.log"
done
cargo fmt
cargo clippy --locked --all-targets -- -D warnings > reports/validation/id-lookups/clippy.log 2>&1
cargo test --locked > reports/validation/id-lookups/rust-tests.log 2>&1
npm run build > reports/validation/id-lookups/build.log 2>&1
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  "$executable" --test tests/id-lookups.spec.cjs tests/fragment-id.spec.cjs tests/name-queries.spec.cjs tests/element-relatives.spec.cjs tests/collection*.spec.cjs tests/form-data-observable-types.spec.cjs tests/form-data.spec.cjs > "reports/validation/id-lookups/observable-hooks-$version.log" 2>&1
  tail -8 "reports/validation/id-lookups/observable-hooks-$version.log"
done
printf 'Observable lifecycle ID reads preserved on both Node versions\n'
