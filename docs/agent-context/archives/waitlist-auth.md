# Waitlist & Auth (archive index)

Cross-cutting operator prefs: [preferences-active.md](../preferences-active.md).

**Load one sub-archive only** — do not read all three.

| Sub-archive | Load when |
|-------------|-----------|
| [waitlist-auth-core.md](./waitlist-auth-core.md) | Bootstrap, Privy modes, execution tracks, session, OTP, wallet sign-in |
| [waitlist-auth-ui.md](./waitlist-auth-ui.md) | Waitlist UX, layout, loading, tray, social proof, copy |
| [waitlist-auth-ops.md](./waitlist-auth-ops.md) | Collisions, merge, Airtable, AMOE, production incidents, localhost quirks |

Validate: `pnpm -C frontend validate:waitlist` (full) or `validate:waitlist:smoke` (fast). Session/API gate: `pnpm -C frontend guard:session-api-gate`.

