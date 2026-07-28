# Tribe.run (archive)

Load when: Tribe token launch, `4626fun/4626` public face, sponsor badge, or permissionless Tribe swap integration.

Cross-cutting operator prefs: [preferences-active.md](../preferences-active.md).

## Role (locked)

**Tribe token ≠ protocol token.**

| Asset | Role |
|-------|------|
| Creator coins / ShareOFT ■ (Base + OFT) | Protocol product economics — see `docs/tokenomics/` |
| Base protocol token (later) | Reserved name/symbol: **`4626` / `$4626`** (Pump.fun-style short ticker) |
| **Tribe token on `4626fun/4626`** | **Solana repo sponsor market only** — holders back the open project; creator earns Tribe trade fees; badge + holders chat |

- **Tribe.run is not hosting.** Vercel / Railway / Supabase stay on the private working tree until an explicit cutover.
- Tribe links **one public GitHub repo ↔ one Solana token forever**. The link never changes.
- Public face repo: [`4626fun/4626`](https://github.com/4626fun/4626) (scaffold shipped 2026-07-20; full code migration deferred).
- Do **not** require Tribe holdings for deploy, waitlist, vault access, or lottery on Base.
- Do **not** bridge Tribe ↔ ShareOFT or treat Tribe balance as vault collateral.

## Token name and symbol (locked)

Pump.fun used `$PUMP` (not `$PUMPFUN`). Same pattern: short brand for the protocol token; Tribe uses the long org/domain form.

| Field | Tribe (Solana sponsor market) | Protocol (Base, later) |
|-------|-------------------------------|-------------------------|
| **Name** | `4626fun` | `4626` (reserved) |
| **Symbol** | `4626FUN` | `4626` (reserved) |

**Do not launch Tribe as:** `$4626`, `$t4626`, bare `FUN`, Share/Vault/■, `AKITA`, `PROTOCOL` / `GOV`.

Image: 4626 brand mark (site/org), not a vault-share icon.

README copy: “Solana sponsor market for the open `4626fun/4626` repo — not the Base protocol token (`$4626`) or vault shares.”

## Mechanics (docs summary)

| Topic | Fact |
|-------|------|
| Eligibility | Public GitHub repo + push access; private repos ineligible |
| Supply | 1B Token-2022; ~2.5M to referrer/creator; rest seeds pool; mint revoked |
| Cost | ~0.012 SOL rent + optional first buy (same tx as create) |
| AMM | Native; no migration. Program `B1x53qgNmAdZMfPVZvu89qDmNn3RpdKajRFXqCzE7UPU` |
| Virtual liquidity | ~35 SOL virtual depth at launch |
| Creator fees | 1.00% → 0.20% by market cap; paid to wallet every trade |
| Anti-snipe | First 60s; decaying fee (starts ~99%) to creator; sells exempt |
| Buy gate | Permissionless buys after 420 SOL mcap or 24h (whichever first); sells open immediately |
| Sponsors | ≥10,000 tokens → badge + holders-only Tribe chat |
| Accounts | Invite-only mobile signup; web for existing accounts |
| Integration referral | Pass payout wallet as `referral`; default 15% of protocol fee; Token-2022 required |

Docs index: https://www.tribe.run/docs — also `llms.txt` / `llms-full.txt` for agents.

## Launch checklist (operator)

| Item | Status |
|------|--------|
| Org `4626fun` admin (`wenakita`) | Confirmed |
| Public repo `4626fun/4626` + push | Confirmed |
| Name / symbol locked (`4626fun` / `4626FUN`) | Confirmed |
| Tribe 2.0 invite / mobile account | **User** |
| Launch wallet funded (~0.012 SOL + first buy) | **User** |
| Image (4626 brand mark) | **User** at launch |
| Full scrubbed code migration into public repo | Deferred |
| Tribe launch + README sponsor badge | Deferred |

## Do not

- Launch against satellite repos (`creator-share-hook-verifiable`, `oft-solana-6ste-verifiable`, hackathon).
- Make the private `wenakita/4626` public without a scrub pass.
- Put `.env` / keys / `docs/_internal/` into the public tree.
- Treat Tribe as a deploy target for the SPA or agents.
- Call the Tribe mint “the protocol token” or reuse `$4626` for it.

## ODA / LeftClaw public contracts pin (operator)

Slim audit slice lives on [`4626fun/4626`](https://github.com/4626fun/4626) (not a full monorepo mirror). **One branch:** `main`.

| Pin | Use |
|-----|-----|
| **Current** [`contracts/`](https://github.com/4626fun/4626/tree/main/contracts) on `main` | Auditor / research source of truth — creator **and agent** vault stacks |
| Tags `audit/oda-2026-07-22`, `audit/oda-2026-07-23-remediated`, `audit/oda-2026-07-28-*` | Immutable historical pins (prefer tags over deleted `audit/*` branches) |

Private `wenakita/4626` remains build/deploy source of truth. Publishing a pin ≠ Base redeploy.
