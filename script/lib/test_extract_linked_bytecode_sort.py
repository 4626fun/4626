#!/usr/bin/env python3
"""Unit checks for multi-solc artifact semver ordering in extract_linked_bytecode."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "extract_linked_bytecode", ROOT / "script/lib/extract_linked_bytecode.py"
)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def main() -> int:
    lib = "CreatorOracleQuoteLib"
    paths = [
        Path(f"{lib}.0.8.9.json"),
        Path(f"{lib}.0.8.30.json"),
        Path(f"{lib}.0.8.35.json"),
        Path(f"{lib}.0.8.35.ci.json"),
    ]
    ordered = sorted(paths, key=lambda p: mod._versioned_artifact_sort_key(p, lib))
    names = [p.name for p in ordered]
    assert names[0] == f"{lib}.0.8.9.json", names
    assert names[1] == f"{lib}.0.8.30.json", names
    assert names[-1] == f"{lib}.0.8.35.ci.json", names
    # Lex sort would put 0.8.9 last — guard the bug this key exists to prevent.
    lex = sorted(p.name for p in paths)
    assert lex[-1] == f"{lib}.0.8.9.json", lex
    print("OK: extract_linked_bytecode semver sort checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
