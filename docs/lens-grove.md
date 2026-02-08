# Lens Grove storage (Phase 1)

This phase integrates Lens Protocol storage via Grove for immutable uploads only.
We store **two references** for each upload:

- Canonical `lens://...` URI
- Renderable gateway URL (`https://api.grove.storage/...`)

## Scope

- **Portfolio profile media**: avatar + banner
- **CoinManage metadata**: image + metadata JSON
- No Lens social write/auth flows in this phase
- Immutable uploads only (no ACL/challenge signing)

## Chain + API

- Lens mainnet chain ID: **232**
- Grove upload endpoint: `POST https://api.grove.storage/?chain_id=232`

## Storage model

### Portfolio profile

Stored in `profiles.profile_fields`:

- `avatar_lens_uri`
- `banner_lens_uri`

Gateway URLs continue to be stored in:

- `avatar_url`
- `banner_url`

### CoinManage

- Image upload sets `metaImageUri` to the Grove gateway URL
- Metadata JSON upload sets `newUri` to the Grove gateway URL
- Corresponding `lens://` URIs are shown for reference/copying

## Feature flag

`VITE_ENABLE_LENS_GROVE` (defaults to **enabled** if unset)

## Notes

- Use `lens://...` for canonical references
- Use Grove gateway URLs for rendering + onchain validators in this phase
- Current Grove limit is ~125MB per upload
