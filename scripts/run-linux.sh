#!/usr/bin/env bash
# Run one development command with the project-local toolchain.
set -euo pipefail
cd "$(dirname "$0")/.."
export CARGO_HOME="$PWD/.tools/cargo"
export RUSTUP_HOME="$PWD/.tools/rustup"
export PATH="$PWD/.tools/node/bin:$CARGO_HOME/bin:$PATH"
exec "$@"
