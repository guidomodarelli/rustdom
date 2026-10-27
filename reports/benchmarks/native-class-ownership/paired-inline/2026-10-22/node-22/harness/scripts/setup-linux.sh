#!/usr/bin/env bash
# Install development tools locally; never modify shell profiles or system packages.
set -euo pipefail
cd "$(dirname "$0")/.."
export CARGO_HOME="$PWD/.tools/cargo"
export RUSTUP_HOME="$PWD/.tools/rustup"
mkdir -p .tools
if [ ! -x "$CARGO_HOME/bin/cargo" ]; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o .tools/rustup-init.sh
  sh .tools/rustup-init.sh -y --no-modify-path --profile minimal
fi
if [ ! -x .tools/node/bin/node ]; then
  curl --proto '=https' --tlsv1.2 -fsS https://nodejs.org/dist/v24.14.1/node-v24.14.1-linux-x64.tar.xz -o .tools/node.tar.xz
  mkdir -p .tools/node
  tar -xJf .tools/node.tar.xz --strip-components=1 -C .tools/node
fi
export PATH="$PWD/.tools/node/bin:$CARGO_HOME/bin:$PATH"
npm install --offline=false --cache .cache/npm-linux
