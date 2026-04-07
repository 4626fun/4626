---
name: telegram-linking
description: Protects the Telegram Mini App email OTP, Privy sync, and canonical-account linking flow.
triggers:
  - telegram
  - mini app
  - otp
  - privy sync
scope:
  - frontend/src/pages/telegram/
  - frontend/server/auth/
  - frontend/api/auth/
  - frontend/api/telegram/
verification:
  - pnpm -C frontend lint
  - pnpm -C frontend typecheck
  - pnpm -C frontend test
---

# telegram-linking

Use this skill when work touches Telegram Mini App onboarding, account linking, or OTP verification.

Guardrails:

- Keep a single authoritative state machine for the Mini App flow.
- Preserve inline OTP inside Telegram WebView; do not introduce Privy popups or modal auth.
- Maintain the semantic order from `AGENTS.md`: Telegram proof, inline email OTP, Privy sync wait, Telegram binding, backend persistence.
