#!/usr/bin/env python3
"""Extract fully-linked creation bytecode from a Foundry artifact JSON.

Solc embeds library placeholders as ASCII `__$<34 hex>$__` (20 bytes) in the
bytecode.object string. Naive hex truncation at the first non-hex char silently
produces truncated initcode — wrong CREATE2 hashes and bytecode-store seeds.

Linking follows Foundry's default CREATE2 library rule:
  deployer = EIP-2470 Deterministic Deployment Proxy
  salt     = foundry.toml `create2_library_salt` (default 0)
  address  = create2(deployer, salt, keccak256(library.creationCode))

Usage (CLI):
  python3 script/lib/extract_linked_bytecode.py <artifact.json> [<root_dir>]
  prints pure lowercase hex (no 0x) to stdout
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

# EIP-2470 deterministic deployment proxy (Foundry default library deployer).
EIP2470_DEPLOYER = bytes.fromhex("4e59b44847b379578588920ca78fbf26c0b4956c")
# Foundry default create2_library_salt when unset / zero.
DEFAULT_LIBRARY_SALT = bytes(32)

PLACEHOLDER_RE = re.compile(r"__\$[0-9a-fA-F]{34}\$__")


def _cast_keccak(data: bytes) -> bytes:
    """Keccak256 via cast (always available in this repo's toolchain)."""
    out = subprocess.check_output(
        ["cast", "keccak", "0x" + data.hex()],
        text=True,
    ).strip()
    if out.startswith("0x"):
        out = out[2:]
    return bytes.fromhex(out)


def _create2_address(deployer: bytes, salt: bytes, init_code: bytes) -> bytes:
    init_hash = _cast_keccak(init_code)
    return _cast_keccak(b"\xff" + deployer + salt + init_hash)[12:]


def _load_bytecode_record(artifact_path: Path) -> dict:
    raw = artifact_path.read_text(encoding="utf-8").strip()
    decoder = json.JSONDecoder()
    bytecode_obj = None
    full = None
    idx = 0
    while idx < len(raw):
        value, end = decoder.raw_decode(raw, idx)
        if isinstance(value, dict) and "bytecode" in value:
            bytecode_obj = value["bytecode"]
            full = value
        idx = end
    if bytecode_obj is None or not bytecode_obj.get("object"):
        raise SystemExit(f"bytecode.object missing in {artifact_path}")
    return {"bytecode": bytecode_obj, "artifact": full}


def _versioned_artifact_sort_key(path: Path, lib_name: str) -> tuple:
    """Sort key for `<Lib>.<solcVersion>[.<profile>].json` (numeric semver, not lex).

    Lexicographic sort wrongly prefers `0.8.9` over `0.8.34`. Different solc builds of
    the same library can yield different CREATE2 addresses — picking the wrong artifact
    silently links consumers to an empty/wrong library address.
    """
    name = path.name
    prefix = f"{lib_name}."
    if not name.startswith(prefix) or not name.endswith(".json"):
        return ()
    mid = name[len(prefix) : -len(".json")]
    key: list = []
    for part in mid.split("."):
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, part))
    return tuple(key)


def _resolve_library_artifact(root: Path, source_path: str, lib_name: str) -> Path:
    """Map solc linkReference path → Foundry out/<file>/<Contract>.json."""
    # source_path like contracts/shared/lottery/manager/LotteryManager4626PricingLib.sol
    file_name = Path(source_path).name  # LotteryManager4626PricingLib.sol
    out_dir = root / "out" / file_name
    candidate = out_dir / f"{lib_name}.json"
    if candidate.is_file():
        return candidate

    # Multi-solc / profile builds emit `<Contract>.<solcVersion>[.<profile>].json`
    # without a bare `<Contract>.json` (e.g. CreatorOracleQuoteLib.0.8.35.json).
    if out_dir.is_dir():
        versioned = sorted(
            (p for p in out_dir.glob(f"{lib_name}.*.json") if p.is_file()),
            key=lambda p: _versioned_artifact_sort_key(p, lib_name),
        )
        if versioned:
            return versioned[-1]

    # Fallback: search out/
    matches = list((root / "out").rglob(f"{lib_name}.json"))
    if not matches:
        matches = sorted(
            (
                p
                for p in (root / "out").rglob(f"{lib_name}.*.json")
                if p.is_file() and p.name.startswith(f"{lib_name}.")
            ),
            key=lambda p: _versioned_artifact_sort_key(p, lib_name),
        )
    if len(matches) == 1:
        return matches[0]
    if matches:
        # Prefer exact file stem match, then newest semver among remaining.
        for m in matches:
            if m.parent.name == file_name:
                return m
        return matches[-1]
    raise SystemExit(
        f"Cannot resolve library artifact for {source_path}:{lib_name} "
        f"(expected {candidate})"
    )


def _library_creation_hex(root: Path, source_path: str, lib_name: str) -> str:
    art = _resolve_library_artifact(root, source_path, lib_name)
    rec = _load_bytecode_record(art)
    bc = rec["bytecode"]["object"]
    if bc.startswith("0x"):
        bc = bc[2:]
    if not re.fullmatch(r"[0-9a-fA-F]+", bc):
        raise SystemExit(f"Library {lib_name} creation bytecode still has placeholders: {art}")
    return bc.lower()


def extract_linked_creation_bytecode(
    artifact_path: Path,
    root: Path | None = None,
    library_salt: bytes = DEFAULT_LIBRARY_SALT,
) -> str:
    """Return fully linked creation bytecode as lowercase hex (no 0x)."""
    artifact_path = Path(artifact_path)
    root = Path(root) if root is not None else artifact_path.parents[2]  # out/X.sol/Y.json → repo

    rec = _load_bytecode_record(artifact_path)
    bytecode_obj = rec["bytecode"]
    bc = bytecode_obj["object"]
    if bc.startswith("0x"):
        bc = bc[2:]

    link_refs = bytecode_obj.get("linkReferences") or {}
    if not link_refs:
        if PLACEHOLDER_RE.search(bc) or not re.fullmatch(r"[0-9a-fA-F]+", bc):
            raise SystemExit(
                f"Unlinked placeholder in {artifact_path} but no linkReferences metadata"
            )
        return bc.lower()

    # Build library address map from CREATE2 prediction (Foundry default).
    lib_addrs: dict[tuple[str, str], str] = {}
    for source_path, libs in link_refs.items():
        for lib_name in libs:
            lib_hex = _library_creation_hex(root, source_path, lib_name)
            addr = _create2_address(EIP2470_DEPLOYER, library_salt, bytes.fromhex(lib_hex))
            lib_addrs[(source_path, lib_name)] = addr.hex()

    # Replace placeholders by byte offset from linkReferences.
    # solc stores the object as a hex string with ASCII placeholder tokens
    # occupying 40 hex-chars (20 bytes) at the documented start offset.
    # Work on a mutable hex string using character offsets = byte_offset * 2.
    out = bc
    for source_path, libs in link_refs.items():
        for lib_name, positions in libs.items():
            addr_hex = lib_addrs[(source_path, lib_name)]
            for pos in positions:
                start = int(pos["start"])
                length = int(pos["length"])
                if length != 20:
                    raise SystemExit(f"Unexpected link length {length} (want 20) in {artifact_path}")
                char_start = start * 2
                char_end = char_start + length * 2
                slot = out[char_start:char_end]
                # Slot is either pure hex zeros or the `__$...$__` ASCII form encoded as... 
                # In Foundry JSON, the object is a *string* where placeholders appear as
                # literal `__$..$__` characters (40 chars), not hex-encoded.
                if len(slot) != 40:
                    raise SystemExit(
                        f"Link slot length mismatch at {start}: got {len(slot)} chars in {artifact_path}"
                    )
                out = out[:char_start] + addr_hex + out[char_end:]

    if PLACEHOLDER_RE.search(out) or not re.fullmatch(r"[0-9a-fA-F]+", out):
        raise SystemExit(
            f"Bytecode still contains unlinked placeholders after linking: {artifact_path}"
        )
    return out.lower()


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(
            "Usage: extract_linked_bytecode.py <artifact.json> [repo_root]",
            file=sys.stderr,
        )
        return 2
    artifact = Path(argv[1])
    root = Path(argv[2]) if len(argv) > 2 else None
    print(extract_linked_creation_bytecode(artifact, root=root), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
