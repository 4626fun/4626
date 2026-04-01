---
title: Lens Integration
sidebar_position: 3
---

# Lens Integration

This repo does **not** currently ship full Lens social write/auth flows.

What is implemented today is a practical **Phase 1** path:
- Keep 4626 flows working with `https://` and `ipfs://` metadata URIs.
- Optionally use Lens Grove externally and persist Lens references for provenance.
- Surface Lens identity as an optional social profile signal when available.

## Current Status In This Codebase

### Implemented

- Portfolio profile storage supports `profile_fields` provenance metadata in `profiles.profile_fields`.
- Portfolio PATCH supports standard profile fields and now supports Lens URI fields in `profile_fields`:
  - `avatar_lens_uri`
  - `banner_lens_uri`
- Reputation aggregation includes optional `profiles.lens`.

### Not Yet Implemented

- Lens protocol auth/session flows.
- Posting/commenting via Lens protocol clients.
- First-party Grove upload pipeline in the app UI.
- A Lens-specific frontend feature flag in this repo.

## Recommended "Best Way" Right Now

1. Keep onchain metadata URIs compatible with current app constraints.

`frontend/src/pages/CoinManage.tsx` currently validates `newUri` as `ipfs://` or `https://`.
Use that rule for production updates.

2. If you use Grove externally, store both reference types.

- Keep the Grove gateway URL for rendering/use in the app.
- Keep canonical `lens://...` references in profile `profile_fields` for provenance.

3. Store Lens avatar/banner references in portfolio profile fields.

Use `PATCH /api/portfolio/me` with:
- `avatarLensUri`
- `bannerLensUri`

These are stored in `profile_fields.avatar_lens_uri` and `profile_fields.banner_lens_uri`.

4. Treat Lens social links as optional enrichment.

The reputation aggregator can include `profiles.lens` if upstream social data includes Lens.
Do not hard-depend critical UX on this field yet.

## API Example

Set Lens URI references on the authenticated profile:

```bash
curl -X PATCH "$APP_URL/api/portfolio/me" \
  -H "Content-Type: application/json" \
  -H "Cookie: cv_auth_session=..." \
  -d '{
    "avatarLensUri": "lens://abc123",
    "bannerLensUri": "lens://def456"
  }'
```

The response includes `profile.profileFields` entries with manual provenance.

## Field Conventions

- `avatarUrl` / `bannerUrl`: renderable URL used by the app (`https://` preferred for direct UI use).
- `avatar_lens_uri` / `banner_lens_uri`: canonical Lens URI references for provenance.

## Next Phase (When You Want Full Lens)

1. Add Grove upload helpers (server-side signed flow or client flow).
2. Add a Lens capability flag (for rollout control).
3. Add Lens auth + social write actions behind explicit feature gating.
