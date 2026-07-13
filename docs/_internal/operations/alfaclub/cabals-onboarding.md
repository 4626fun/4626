# InverseAKITA Cabals Onboarding

Status: completed 2026-07-12

## Live Cabal

- Name: `InverseAKITA`
- Cabal ID: `267f37a4-9d45-4229-b362-6834581ac7f7`
- Public join URL: `https://cabals.com/cabal/inverseakita`
- Owner/profile: `hermit4626`
- Linked X identity: `https://x.com/hermit4626`
- Visibility: public
- Join policy: auto-join
- Reward wallet: `0x74ab91cd845ff0d2006404440af49c3bc8c1df96`

The public Cabal URL is the join/share link. A private invite code is not
required while the Cabal remains public with auto-join enabled.

## Referral attribution

The account was created after opening
`https://cabals.com/join/ELUSIVEPRIEST` in the same browser context. Before
authentication, the browser held `ref=ELUSIVEPRIEST`; Cabals consumed and
cleared that cookie during first-account onboarding. The new account must not
be recreated or signed into through an older Cabals account if preserving this
attribution matters.

Cabals does not expose incoming-referrer details on the referred user's
dashboard. Referrer-side reward/activity confirmation remains visible only to
the owner of `ELUSIVEPRIEST`.

## Wallet roles

- `0x74ab91cd845ff0d2006404440af49c3bc8c1df96` is the live Arena profile
  `1213` agent and Hyperliquid wallet. It receives Cabal fee-sharing revenue.
- `0x563ed20b02da608b01688b5ec77d9e02744a809d` is the separate Cabals
  embedded account wallet. It is not the Arena execution or reward wallet.
- Neither address is `profiles.csw_address` or `CANONICAL_CSW_ADDRESS`.
  Cabals/Arena activity must not be routed through the canonical 4626 CSW.

Before changing payout or execution configuration, verify the live Arena
wallet at `GET https://degen.virtuals.io/api/agents/1213`. The response fields
`data.agentAddress`, `data.acpAgent.walletAddress`, and `data.hlAddress` must
agree. Do not reuse the retired `0x30068c6bccf43e9eb5cdb68fb978f32f744d870c`.

## Automation gate

Cabals currently documents no public service-account or agent API. Its Terms
prohibit bot or automated access unless Cabals expressly permits it. Therefore:

- do not call Cabals' private web API from repository code;
- do not persist Cabals or Privy access tokens;
- do not automate Cabal mutations with browser sessions;
- keep InverseAKITA trading on the existing Arena/dgclaw execution lane; and
- require official API credentials plus written automation permission before
  adding a Cabals provider beside `frontend/server/_lib/arena/arenaClient.ts`.

Any future provider must be disabled and dry-run by default, enforce explicit
room/operator allowlists, audit every mutation, and preserve the separation
between Cabals/Arena wallets and canonical CSW execution.
