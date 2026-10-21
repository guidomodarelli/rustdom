#!/usr/bin/env bash
set -euo pipefail
task_root=/mnt/c/Users/guido/ghq/projects/rustdom
managed=/mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom
root=$(cat "$task_root/.cache/attribute-copy-root.txt")
parent=$(cat "$task_root/.cache/dom-parser-final-root.txt")
export CARGO_HOME="$task_root/.tools/cargo"
export RUSTUP_HOME="$task_root/.tools/rustup"
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:$PATH"
node - "$managed" "$root" <<'NODE'
const fs = require('node:fs');
const [managed, root] = process.argv.slice(2);
for (const entry of ['src', 'scripts', 'benchmarks', 'tests', 'types', 'third-party/napi', 'package.json']) fs.cpSync(managed + '/' + entry, root + '/' + entry, { recursive: true });
NODE
cd "$root"
output=reports/validation/attribute-copy/final
mkdir -p "$output"
for toolchain in 1.99.1 1.98.1; do
  export RUSTUP_TOOLCHAIN="$toolchain"
  if [ "$toolchain" = 1.99.1 ]; then export CARGO_TARGET_DIR="$parent/target/ci199"; else export CARGO_TARGET_DIR=/home/guido/rustdom-name-queries-ui9xbm/target/ci198; fi
  printf 'START Rust%s\n' "$toolchain"
  cargo fmt --check > "$output/fmt-$toolchain.log" 2>&1
  cargo clippy --locked --all-targets -- -D warnings > "$output/clippy-$toolchain.log" 2>&1 || { tail -n 100 "$output/clippy-$toolchain.log"; exit 1; }
  cargo test --locked > "$output/rust-$toolchain.log" 2>&1 || { tail -n 100 "$output/rust-$toolchain.log"; exit 1; }
  tail -n 10 "$output/rust-$toolchain.log"
done
export RUSTUP_TOOLCHAIN=1.99.1
export CARGO_TARGET_DIR="$parent/target/ci199"
npm_entry="$parent/.tools/npm-11/node_modules/npm/bin/npm-cli.js"
npm run build > "$output/build.log" 2>&1 || { tail -n 100 "$output/build.log"; exit 1; }
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  for gate in test:validation test test:corpus test:wpt test:memory; do
    log="$output/${gate//:/-}-$version.log"
    printf 'START %s %s\n' "$version" "$gate"
    "$executable" "$npm_entry" run "$gate" > "$log" 2>&1 || { tail -n 100 "$log"; exit 1; }
    printf 'END %s %s\n' "$version" "$gate"
    tail -n 8 "$log"
  done
  "$executable" --test tests/benchmarks/*.spec.cjs > "$output/benchmark-contracts-$version.log" 2>&1 || { tail -n 100 "$output/benchmark-contracts-$version.log"; exit 1; }
  "$executable" --expose-gc scripts/attribute-copy-memory.cjs > "$output/memory-$version.log" 2>&1 || { tail -n 100 "$output/memory-$version.log"; exit 1; }
  tail -n 3 "$output/memory-$version.log"
done
export PATH="$task_root/.tools/node/bin:$CARGO_HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export RUSTDOM_VALGRIND="$task_root/.tools/valgrind/usr/bin/valgrind"
export VALGRIND_LIB="$task_root/.tools/valgrind/usr/libexec/valgrind"
node scripts/native-memory.mjs > "$output/native-memory.log" 2>&1 || { tail -n 100 "$output/native-memory.log"; exit 1; }
tail -n 10 "$output/native-memory.log"
sha256sum dist/rustdom.node > "$output/native-before-package.sha256"
"$task_root/.tools/node/bin/node" "$npm_entry" run package > "$output/package-build.log" 2>&1 || { tail -n 100 "$output/package-build.log"; exit 1; }
sha256sum --check "$output/native-before-package.sha256"
for executable in "$task_root/.tools/node/bin/node" "$task_root/.tools/node-22/bin/node"; do
  version=$("$executable" --version)
  export PATH="$(dirname "$executable"):$CARGO_HOME/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  "$executable" "$npm_entry" run test:package > "$output/package-$version.log" 2>&1 || { tail -n 100 "$output/package-$version.log"; exit 1; }
  tail -n 6 "$output/package-$version.log"
done
printf 'FINAL GATES COMPLETED\n'
