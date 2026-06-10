# AlfaClub Server Module Boundaries

This folder is split into clear lanes so auth and transport do not drift into creative behavior.

## Ownership map

- `apiAuth.ts`
  - Canonical source for AlfaClub HTTP auth inputs, proxy/base resolution, and request header policy.
  - Owns env parsing for `ALFACLUB_READ_BOT_TOKEN`, `ALFACLUB_API_KEY`, `ALFACLUB_CHAT_JWT`, and proxy config.

- `chatBridge.ts`
  - Control plane for poll/ingest/dispatch/reply/reaction flow.
  - Uses `apiAuth.ts` for auth and request-shaping decisions.
  - May read runtime token state from `chatTokenStore` for the JWT refresh lane.

- `room1659Market.ts`
  - Hermit-adjacent market context enrichment.
  - Must use `apiAuth.ts` only.
  - Must not import `chatBridge.ts` or `chatTokenStore.ts`.

- `chatTokenStore.ts` + `privyTokenRefresher.ts`
  - Runtime JWT persistence and refresh lifecycle (`alfaclub_runtime_secret` lane).
  - Control-plane concerns only, never creative logic.

## Boundary rules

- Keep auth and fingerprint policy centralized in `apiAuth.ts`.
- Do not duplicate env parsing for AlfaClub auth in other modules.
- Hermit or Hermit-adjacent modules must not touch runtime secret storage or refresher logic.
- If a module needs AlfaClub HTTP access, add/consume shared helpers in `apiAuth.ts` instead of importing `chatBridge.ts`.

## Quick checklist for new changes

- Are auth headers/base/proxy decisions in `apiAuth.ts`?
- Does `room1659Market.ts` avoid `chatBridge` and `chatTokenStore` imports?
- Do bridge changes keep orchestration in `chatBridge.ts` and avoid new auth parsing duplication?

