# Protocol Brand Assets

This directory stores protocol logos used across the frontend.

## Guardrails

- Every logo file in this folder must be listed in `manifest.json`.
- `manifest.json` must include:
  - provenance links (`officialSourceUrl`, `brandGuideUrl`)
  - a pinned `sha256` checksum for each file.
- CI enforces integrity with:

```bash
pnpm --dir frontend verify:protocol-assets
```

## Updating an Asset

1. Download the new asset from the protocol's official source.
2. Replace the file in this folder.
3. Update the corresponding entry in `manifest.json`:
   - `sha256`
   - provenance URLs (if changed)
4. Run:

```bash
pnpm --dir frontend verify:protocol-assets
```
