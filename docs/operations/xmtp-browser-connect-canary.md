---
title: XMTP Browser Connect Canary
sidebar_position: 12
---

# XMTP Browser Connect Canary (Layer 3)

Run this guide **after** Layer 1/2 tests pass and **before** or **immediately after** shipping XMTP client changes to production.

Layer 1/2 cover policy and orchestration in Vitest. Layer 3 is a **real browser + real wallet** pass on `app.4626.fun` (or a preview build pointed at production XMTP env).

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Production host | `https://app.4626.fun` (not bare `4626.fun` marketing shell) |
| Account | Verified 4626 session + Privy signed in for Smart Wallet path |
| Wallet track | **Canonical CSW:** Privy embedded EOA active and confirmed CSW owner. **EOA:** Rabby/MetaMask/Base App connected on Base mainnet |
| Install budget | Prefer an inbox with **≤ 8** active installations. Check [xmtp.chat/inbox-tools](https://xmtp.chat/inbox-tools) |
| Tabs | Close every other `4626.fun` / `app.4626.fun` tab before reset/connect |
| Browser | **Any Chromium browser with your wallet** — Brave + Rabby, Chrome + MetaMask, Base App in-app, etc. The automated helper defaults to Playwright Chromium (no extensions); use manual checklist below when Rabby lives only in Brave |
| Automated helper | `pnpm -C frontend smoke:xmtp-canary -- --headed` (optional — see [Manual Brave / Rabby](#manual-brave--rabby-no-playwright)) |

## Quick command

```bash
pnpm -C frontend smoke:xmtp-canary -- \
  --base-url https://app.4626.fun \
  --path /swap \
  --headed
```

Use `--scenario a` … `--scenario e` to run one scenario. Use `--fresh-profile` for scenario A (new browser profile dir).

## Manual Brave / Rabby (no Playwright)

Use this when Rabby (or your wallet) is installed in **Brave** but not in Playwright’s bundled Chromium — typical on Linux/WSL.

1. Open **Brave** (normal window or private window for scenario A).
2. Go to `https://app.4626.fun/swap` (or `/waitlist` to sign in first).
3. Connect **Rabby** on Base mainnet when the app asks for a wallet.
4. Follow scenarios **A–E** in this doc; tick pass/fail yourself.
5. Optional: verify installs at [xmtp.chat/inbox-tools](https://xmtp.chat/inbox-tools) for the inbox tied to your connected address.

**EOA path:** Rabby/MetaMask in Brave is the intended external-EOA track (`executionMode === 'eoa'`).

**Canonical CSW path:** you still need **Privy email OTP** signed in (embedded EOA signs XMTP). Rabby alone is not enough for Smart Wallet messaging — use waitlist email sign-in, then Connect Messaging.

The Playwright helper is optional audit tooling; manual Brave testing counts as Layer 3.

### Playwright + Brave (advanced)

If you want the helper to drive Brave with extensions, pass the Brave binary (Linux example):

```bash
pnpm -C frontend smoke:xmtp-canary -- \
  --executable-path /usr/bin/brave-browser \
  --profile-dir "$HOME/.config/BraveSoftware/Brave-Browser" \
  --headed
```

Use a **copy** of your profile dir or `--fresh-profile` — pointing at a live profile while Brave is open can lock it. On WSL, Brave is often on the Windows host; run the manual checklist in Windows Brave instead of fighting cross-OS Playwright.

## Pass criteria (all scenarios)

- **No install churn:** at most **one new** XMTP installation during scenario A; scenarios B–D must **not** create a new installation
- **Connected UI:** chat rail shows green Wi‑Fi icon; no persistent red error under Chats
- **localStorage markers:** after first connect, `cv:xmtp:installationProvisioned:production:<address>` is `1` and `cv:xmtp:installationMeta:production:<address>` JSON is stable across reload
- **Console:** no repeating `stream error` / unhandled rejection loops after connect settles

## Scenarios

### A — Fresh browser profile → first connect

**Goal:** one signature, one new install, connected chat.

1. Open a **new** Chrome profile or incognito window (or run helper with `--fresh-profile`).
2. Sign in on `https://app.4626.fun/waitlist` (email OTP) or restore session.
3. Complete wallet readiness if prompted (Enable 4626 signing / owner install).
4. Open `https://app.4626.fun/swap`.
5. Expand **Chats** (bottom-right on desktop).
6. Click **Connect Messaging** once; approve the wallet signature when prompted.
7. Wait until status is connected (green Wi‑Fi, conversation list or empty state without error).

**Pass:** exactly one signing prompt; install count +1 on inbox-tools; provisioned localStorage key written.

**Fail signals:** second signature prompt without user action; immediate “identity registration failed”; redirect to Reset installations when not at 10/10 cap.

---

### B — Hard refresh → restore without new install

**Goal:** `Client.build` restore path; no new signature or install.

1. With scenario A still connected (same browser profile), hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`).
2. Wait for app bootstrap (Privy + session restore).
3. Open Chats again if collapsed.

**Pass:** reconnects automatically or shows connected within ~30s **without** Connect Messaging CTA and **without** wallet popup.

**Fail:** new signature prompt; new installation on inbox-tools; stuck on Connect Messaging after reload.

---

### C — Smart Wallet (canonical CSW) path

**Goal:** messaging uses embedded EOA signer against canonical CSW identity.

1. Use an account where `profiles.csw_address` is the Zora CSW and embedded EOA is an on-chain owner.
2. Ensure Privy session is active (`privyAuthenticated`), not wallet-only wagmi connect.
3. Run scenario A or B on `/swap`; confirm chat label shows **Smart Wallet** mode (not external EOA-only).

**Pass:** connect succeeds with Privy embedded signer; identity address matches canonical CSW / expected inbox resolution.

**Fail:** `embedded-wallet-cannot-sign`; Connect Messaging loops while Privy shows signed out.

---

### D — Identity registration failure recovery

**Goal:** recovery without burning installs.

Use when UI shows: *“XMTP restored your local installation but identity registration failed…”*

1. Close other 4626 tabs.
2. Click **Reset local XMTP state** (not Reset XMTP installations unless at 10/10).
3. If OPFS lock message appears with one tab open, click Reset again (page reloads once).
4. Click **Connect Messaging**; approve **one** signature.

**Pass:** connected after ≤ 1 new install; error copy clears.

**Fail:** repeated registration failure without signature chance; script suggests installations reset below cap.

---

### E — Installation cap (10/10) only

**Goal:** cap recovery is deliberate and rare.

Only run when inbox-tools shows **10/10** installations.

1. Use **Reset XMTP installations** in chat settings (not local reset alone).
2. Reconnect with Connect Messaging + one signature.

**Pass:** install count drops then reconnect succeeds.

**Do not** use installation reset as the default fix for scenarios A–D.

---

## Waitlist group join (optional smoke)

After scenario A or B on a waitlist-ready account:

1. Open `/waitlist` with signing complete.
2. Confirm waitlist chat moves past **Queueing your Zora CSW identity…** within 30s.
3. On failure, check `/api/waitlist/xmtpJoin` (authenticated) and keepr agent health — join is server-side, separate from client connect.

## Helper script output

The helper records:

- DOM state (Connect Messaging visible, connected icon, error text)
- `localStorage` XMTP keys for the resolved wallet address
- Timestamps per scenario gate

Save JSON for audit:

```bash
pnpm -C frontend smoke:xmtp-canary -- \
  --report-json /tmp/xmtp-canary-$(date +%Y%m%d).json
```

## Go / No-Go

| Go | No-Go |
|----|--------|
| A + B pass on canonical account | Any unexpected second install on reload |
| C passes for CSW test account | Registration failure loop after local reset |
| Layer 1/2 green in CI | OPFS reset requires manual tab hunt every time |
| No spike in install revokes in support | Waitlist join stuck > 30s on multiple accounts |

## Rollback

If canary fails in production:

1. Revert the XMTP client commit on `main` and redeploy Vercel project `akita-llc/4626`.
2. Communicate: close extra tabs → **Reset local XMTP state** → Connect Messaging → one signature.
3. Do **not** advise mass “Reset XMTP installations” unless users are at 10/10.

## Related

- Layer 1: `frontend/src/lib/xmtp/xmtpConnectFlow.test.ts` (policy simulator)
- Layer 2: `frontend/src/lib/xmtp/xmtpConnectOrchestrator.test.ts` (mocked orchestration)
- Agent/runtime (Railway): [Eliza Runtime](/operations/deployment/eliza-runtime) — separate from browser client canary
