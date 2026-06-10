#!/usr/bin/env bash
# Pin transitive proc-macro / host-build deps for Solana platform-tools v1.51 fallback.
# v1.52+ (Cargo 1.89) is still required — see build-sbf.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Pinning SBF-compatible dependency versions in Cargo.lock…"

cargo update indexmap --precise 2.13.0
cargo update proc-macro-crate --precise 3.4.0
cargo update toml_parser --precise 1.0.6

echo "Done. Run scripts/build-sbf.sh to produce target/deploy/creator_share_hook.so"
