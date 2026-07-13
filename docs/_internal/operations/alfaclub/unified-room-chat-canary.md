# Unified room chat — room 1659 canary

Status: **ready to stage** · Code landed · Binding seed remains disabled

## What is shipped

- Registry: `alfaclub.room_channel_bindings` (room `1659` seed: `enabled=false`, `rollout_status=canary`)
- Ingress: `alfaclub.cross_channel_ingress` with original command text + validated issuer link
- Adapters: data-driven Telegram + XMTP via `roomChannelBridge.ts` / `telegramToAlfaclubRelay.ts`
- Commands: AlfaClub bridge resolves relayed issuers only from trusted ingress envelopes
- Native UI: `/rooms?tab=chat` → `GET|POST /api/v1/alfaclub/room-chat`

## Operator enable order

Do not flip production flags until each stage is verified.

1. Apply migration `20260716170000_alfaclub_cross_channel_foundation.sql`.
2. Confirm Chat tab read path against ingest for an authenticated member.
3. Enable room-access policy for `1659`; verify non-members get `403` on POST.
4. Set Telegram coordinates on the `1659` binding; verify linked Telegram + active membership.
5. Enable XMTP on the binding (requires `PROTOCOL_CSW_*`); verify Keepr bootstrap + inbound deny for non-members.
6. Run active-member backfill once.
7. Exercise cross-channel slash commands and confirm issuer is the member CSW, not the relay bot.
8. Add a second curated room binding and prove isolation before broader rollout.

## Safety notes

- AlfaClub remains transcript authority; mirrors start from activation (no history backfill).
- XMTP sends use protocol agent CSW only (`PROTOCOL_CSW_*`).
- Already-delivered XMTP messages cannot be recalled; tombstone in UI / Telegram bot-owned deletes only.
- Keep a single Railway XMTP primary consumer.
