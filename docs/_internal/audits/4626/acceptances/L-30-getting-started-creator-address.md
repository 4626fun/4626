# L-30 — `docs/getting-started/index.md` hardcoded creator coin address

- Finding: L-30 (Linear: 4626-378)
- Severity: Low
- Disposition: **Already safe — acceptance only**. The doc's example address is a truncated placeholder (`0x5b67...75`), not a full, interactable ERC-20 address. No fix required.

## Verification

`docs/getting-started/index.md` (line 27) contains:

> 3. Enter your Creator Coin address (e.g., `0x5b67...75` for akita)

This is eight hex characters + ellipsis + two hex characters. It cannot be copy-pasted into a deployment form; wagmi / viem address validation will reject it immediately. The risk flagged by L-30 ("new developers will interact with a defunct contract") is not reachable from this doc.

A full-search of `docs/getting-started/` for any complete `0x[0-9a-fA-F]{40}` pattern returned zero matches (`grep -n "0x[0-9a-fA-F]\{40\}" docs/getting-started/index.md`).

## Fix posture

No change to the doc. The truncated style is intentional — it communicates "this is an example of a Creator Coin address, not a canonical one" without giving readers a usable literal. If a future revision ever introduces a full 40-hex address, it must be:

- clearly labeled as testnet-only, OR
- replaced with a placeholder like `0x…creatorCoinAddress`, OR
- sourced from the creator registry with a link to the canonical API.

## Follow-ups

- Add a lint check (future) that rejects any non-zero 40-hex address in `docs/getting-started/**` so the truncation convention is enforced automatically.
