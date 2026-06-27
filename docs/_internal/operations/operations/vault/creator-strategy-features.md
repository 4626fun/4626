# Creator strategy features

> **Creator-facing name:** launch bundle ($499 USDC). **Code key:** `vault_full_deploy`. **Share split at finalize:** 30/30/30/10 (auction / vesting / Solana bridge / LP reserve). [Operator terminology](../../OPERATOR-TERMINOLOGY.md)

## Operator checklist

1. Creator pays **`vault_full_deploy`** ($499 USDC) via USDC transfer, x402, or Stripe → row in `creator_strategy_features`.
2. `/api/creator/strategy/list` shows `deployPlan.deployable = true` when bundle is active.
3. Deploy UI gates on paid bundle before dry-run ([vault deploy paywall](/vault/creator-strategy-features)).
4. Phase 3 weights: Charm 45% + Ajna 45% + 10% idle (Solana mesh is Phase 2b Pipe A, not Phase 3 TVL).
5. Post-activation provisioning is operator/async — `pending` rows are valid for deploy.

**Status:** v1 (MVP) — database + payment verification + activation API shipped. UI and automated provisioning are follow-ups.

**Canonical code paths:**
- Catalog: [`frontend/server/_lib/creatorStrategy/catalog.ts`](../../frontend/server/_lib/creatorStrategy/catalog.ts)
- Payment verifier (USDC on Base): [`frontend/server/_lib/creatorStrategy/usdcPayment.ts`](../../frontend/server/_lib/creatorStrategy/usdcPayment.ts)
- Payment verifier (x402 / EIP-3009): [`frontend/server/_lib/creatorStrategy/x402.ts`](../../frontend/server/_lib/creatorStrategy/x402.ts)
- Payment verifier (Stripe): [`frontend/server/_lib/creatorStrategy/stripe.ts`](../../frontend/server/_lib/creatorStrategy/stripe.ts)
- Price overrides / discounts: [`frontend/server/_lib/creatorStrategy/priceOverrides.ts`](../../frontend/server/_lib/creatorStrategy/priceOverrides.ts)
- DB helpers: [`frontend/server/_lib/creatorStrategy/activations.ts`](../../frontend/server/_lib/creatorStrategy/activations.ts)
- API — activate (USDC tx-hash): [`frontend/api/_handlers/creator/strategy/_activate.ts`](../../frontend/api/_handlers/creator/strategy/_activate.ts)
- API — activate (x402): [`frontend/api/_handlers/creator/strategy/_x402-activate.ts`](../../frontend/api/_handlers/creator/strategy/_x402-activate.ts)
- API — Stripe checkout: [`frontend/api/_handlers/creator/strategy/stripe/_checkout.ts`](../../frontend/api/_handlers/creator/strategy/stripe/_checkout.ts)
- API — Stripe webhook: [`frontend/api/_handlers/creator/strategy/stripe/_webhook.ts`](../../frontend/api/_handlers/creator/strategy/stripe/_webhook.ts)
- API — list: [`frontend/api/_handlers/creator/strategy/_list.ts`](../../frontend/api/_handlers/creator/strategy/_list.ts)
- DB tables: [`supabase/migrations/20260419170000_creator_strategy_features.sql`](../../supabase/migrations/20260419170000_creator_strategy_features.sql) + [`20260419180000_creator_strategy_payment_paths.sql`](../../supabase/migrations/20260419180000_creator_strategy_payment_paths.sql)

## Product model

`CreatorOVault` is a single-asset ERC-4626 vault denominated in the
**creator coin (CREATOR)** — depositors put CREATOR in, receive vault
shares, and redeem CREATOR back out (`ERC4626(IERC20(_creatorCoin))`
in `contracts/vault/CreatorOVault.sol`). Every productive strategy
operates on that CREATOR balance: Charm pairs it with USDC into an
active V3 LP, Ajna lends through the creator's ERC-4626 Ajna sleeve,
Solana bridges it to a wrapped Solana mint. USDC only shows up as the
counter-asset inside individual strategies, not as a vault-level asset.

Every greenfield vault deploy requires a **paid full stack** — there is
no free baseline and no à-la-carte strategy pick at purchase time.
Creators buy **`vault_full_deploy`** ($499 USDC); that single payment
expands into Charm + Ajna + Solana mesh + Meteora entitlement (see
below). Legacy individual feature rows from operator comps still resolve
for grandfathered creators (e.g. AKITA), but new public purchases use
the bundle only.

"Idle reserve" is **not a feature** — it's just the portion of the
vault's CREATOR balance that isn't currently allocated to any
registered strategy (vanilla ERC-4626 `asset()` balance on the vault
contract itself). The resolver's policy is to size productive-strategy
weights so this unrouted remainder lands at 10 % of TVL, giving the
vault a predictable withdrawal buffer. That's a soft resolver
convention, not an on-chain guarantee — the contract only enforces
`charm + ajna + solana <= 10_000` and the remainder behaves like idle
by virtue of not being allocated elsewhere. The vault's own
`minimumTotalIdle` parameter is the real on-chain knob for how much
CREATOR the vault is willing to leave un-deployed.

## Primary purchase: `vault_full_deploy` ($499 USDC, all-or-nothing)

The live catalog sells **one deploy bundle** at **$499 USDC** on Base.
Payment is all-or-nothing: creators cannot buy Charm, Ajna, or Solana
mesh as separate SKUs anymore. A successful payment grants all bundled
sub-entitlements via `expandCreatorFeatureKeys`:

| Sub-entitlement | Role at deploy |
|-----------------|----------------|
| `charm_active_lp` | Phase 3 — Charm active LP on CREATOR/USDC (4_500 bps) |
| `ajna_sleeve` | Phase 3 — Ajna lending sleeve (4_500 bps) |
| `solana_ovault_mesh` | Phase 2b — OVault compose + 30% ShareOFT auto-bridge at finalize |
| `solana_meteora_alpha_vault` | Post-deploy — Meteora DLMM entitlement on share-mesh mint |

Individual à-la-carte purchases of the four keys above return **HTTP 410**
with a message to activate `vault_full_deploy` at
`/creator/strategy/features` instead.

Optional add-ons remain separate: **vanity address tiers**
(`deploy_vanity_vault_prefix_len_*`, `deploy_vanity_share_suffix_len_*`).

After payment, `dispatchProvisioning` enqueues a keeper job to
`/api/keeper/solana/provision-creator` for Solana share-mesh operator follow-up.
Deploy preflight uses share-mesh OVault checks by default (see
[solana-share-mesh-budget-paths.md](./solana-share-mesh-budget-paths.md)).

### What the bundle installs (not optional at deploy)

With `vault_full_deploy` (or legacy equivalent entitlements), Phase 3
always deploys **both** Base strategies at **45% / 45%** productive
weight with **10% idle** — not pick-one lanes:

1. **Charm (`charm_active_lp`)** — concentrated LP on CREATOR/USDC Uniswap V3
2. **Ajna (`ajna_sleeve`)** — inner ERC-4626 lending sleeve into Ajna buckets
3. **Solana mesh (`solana_ovault_mesh`)** — Phase 2b routing + Pipe A finalize
   bridge (not Phase 3 TVL weight; `solanaWeightBps` stays 0)
4. **Meteora (`solana_meteora_alpha_vault`)** — entitled post-deploy; operator
   provisions DLMM + Alpha Vault on the **share-mesh mint** after vault live

**Retired:** `solana_bridge_strategy` (legacy Phase-3 `SolanaBridgeStrategy` TVL).
New purchases are blocked (HTTP 410). Greenfield Solana share liquidity is
seeded by the 30% ShareOFT auto-bridge at finalizePhase2.

All payments are one-time USDC on Base to the protocol treasury (or Stripe /
x402 equivalents for the bundle price). Operator discounts use
`creator_strategy_price_overrides` scoped to `vault_full_deploy` or the bundle
price field in the catalog.

**Grandfathering:** AKITA was deployed before this model existed, under
the old contract that hardcoded all three strategies as required. Its
vault has Charm + Ajna + Solana installed without any
`creator_strategy_features` activations; the resolver ignores live
vaults that were deployed before the paywall went live. Only deploys
created after the new `DeploymentBatcher` bytecode is seeded on mainnet
consume the paywall (see "Mainnet rollout" at the bottom).

## Full deploy entitlement rule

Greenfield deploy requires **`vault_full_deploy`** active or pending (or
legacy operator-granted rows that expand to the same entitlements). A
vault with zero productive Phase 3 strategies would hold 100% idle — that
is blocked. Three layers enforce the rule:

1. **On-chain (hardest):** `DeploymentBatcher.deployPhase3Strategies`
   reverts with `InvalidWeight` when
   `charmWeightBps + ajnaWeightBps + solanaWeightBps == 0`.
2. **Resolver:** `computeStrategyWeights` returns
   `{ ok: false, reason: 'no_paid_strategies' }` when the creator has no
   Charm or Ajna entitlement (bundle not paid and no legacy rows), and
   `resolveCreatorStrategyPlan` propagates that up.
3. **API:** `GET /api/creator/strategy/list` returns a `deployPlan` with
   `deployable: false` and `blockedReason: 'no_paid_strategies'` — the UI
   disables Deploy until `vault_full_deploy` (or legacy equivalent) is active.

**Legacy partial entitlements:** if a creator has only one of
`charm_active_lp` / `ajna_sleeve` from an old comp row (not the bundle),
the resolver still supports 90% single-strategy weights. New public
purchases cannot create partial rows — use operator comp or
`vault_full_deploy` only.

## End-to-end flow

1. **Creator discovers features**
   Frontend calls `GET /api/creator/strategy/list?creator=0xCREATOR`. Server
   returns:
   - `catalog`: all available features (key, display name, description, price).
   - `activations`: this creator's current activations (`pending`, `active`,
     `failed`, `refunded`) so the UI can gate purchase buttons and show status.
   - `treasury`: the USDC destination address.
2. **Creator pays**
   Client wallet sends a plain USDC `transfer` on Base for the catalog price
   to the `treasury` address. Can come from any EOA or smart wallet the
   creator controls — the verifier matches on `Transfer.from` being the
   authenticated session address, not `tx.origin`.
3. **Client POSTs the activation**
   `POST /api/creator/strategy/activate` with
   `{ creatorToken, featureKey, paymentTxHash }`. The server:
   1. Resolves the session address from the auth cookie.
   2. Fetches the Base tx receipt.
   3. Scans logs for a `Transfer(from=session, to=treasury, value>=price)` on
      the canonical USDC contract (`0x833589fc...b54bdA02913`).
   4. Inserts a `pending` row into `creator_strategy_features`, persisting
      `payment_tx_hash` / `payment_from` / `payment_to` / `payment_verified_at`.
      Unique indexes prevent double-activation:
      - `(creator_token, feature_key) WHERE status IN ('pending','active')`
      - `payment_tx_hash`
4. **Operator provisions** (manual for v1)
   Operator polls pending rows (`SELECT ... FROM creator_strategy_features
   WHERE status='pending' ORDER BY created_at`), picks one, runs the
   runbook for that `provisionerTag`, then updates the row:
   ```sql
   UPDATE creator_strategy_features
     SET status = 'active',
         provisioned_at = NOW(),
         provisioner_ref = '<pool_pubkey_or_job_id>'
     WHERE id = $1;
   ```
   If provisioning fails terminally, mark `failed` with `failure_reason`. The
   creator can retry by paying again (a new row is created for the retry).

## Strategy gating (Phase 3)

The server resolves a creator's Phase 3 weight pair from paid
activations. With **`vault_full_deploy`** (or both legacy Charm + Ajna rows),
weights are fixed at **45% / 45% / 10% idle**:

| Entitlement shape | Charm | Ajna | Solana Phase 3 | Idle |
|-------------------|-------|------|----------------|------|
| **`vault_full_deploy`** (greenfield default) | 4_500 bps | 4_500 bps | 0 (Pipe A at finalize) | 1_000 bps |
| Legacy Charm only | 9_000 bps | 0 | 0 | 1_000 bps |
| Legacy Ajna only | 0 | 9_000 bps | 0 | 1_000 bps |
| Legacy both (no bundle row) | 4_500 bps | 4_500 bps | 0 | 1_000 bps |

Greenfield batchers always pass `solanaWeightBps = 0`; Solana share seeding
is Pipe A (30% ShareOFT bridge at finalizePhase2), not Phase 3 TVL.

This is computed by `computeStrategyWeights(activeKeys)` in
[`frontend/server/_lib/creatorStrategy/resolveWeights.ts`](../../frontend/server/_lib/creatorStrategy/resolveWeights.ts)
and exposed as a plan via `resolveCreatorStrategyPlan(db, creatorToken)`.
Idle stays at 10 % of TVL regardless of strategy count so the
withdrawal buffer is predictable.

9_000 is divisible cleanly by 1, 2, and 3, so there are never rounding
remainders — totals always sum to exactly 10_000 bps.

`pending` counts as paid: once the USDC transfer is verified, the
creator should be able to deploy immediately, without waiting for an
operator to bump the row to `active`.

The resolver also exposes `gateRequestedStrategyWeights(plan, requested)`
so the deploy-continue handler can reject client-supplied weights that
don't match the server plan.

### Contract side

The patched `DeploymentBatcher.deployPhase3Strategies` (in
[`contracts/helpers/batchers/DeploymentBatcher.sol`](../../contracts/helpers/batchers/DeploymentBatcher.sol))
treats `charmWeightBps == 0` / `ajnaWeightBps == 0` / `solanaWeightBps == 0`
uniformly as "skip this strategy": no factory call, no deploy, no
`addStrategy`. The returned `Phase3Result.*Strategy` / `.*Vault` /
`.*VaultAuth` addresses stay `address(0)` when skipped, so consumers
can detect skips by address-zero check.

Weight constraints the contract enforces:

- `charmWeightBps <= 10_000`
- `ajnaWeightBps <= 10_000`
- `solanaWeightBps <= 10_000`
- `charm + ajna + solana > 0` (Charm and/or Ajna entitled; greenfield bundle expects both)
- `charm + ajna + solana <= 10_000` (idle absorbs the rest)

The Uniswap V3 CREATOR/USDC pool is still created/fetched unconditionally
because it's a prerequisite for future Charm activation, so single-strategy
deploys that don't have a pre-existing pool must still pass a non-zero
`initialSqrtPriceX96`.

### Code-ids are only required when used

When a strategy is skipped, the corresponding entries in `StrategyCodeIds`
can be `bytes32(0)`. Phase 3 `solanaWeightBps` is always zero on greenfield
batchers — pass `address(0)` for `solanaKeeper` / `solanaBridgeAddress`.

## Adding a strategy post-deploy (operator / legacy only)

Public à-la-carte activation is **disabled** (HTTP 410). Operators can
still add a missing strategy to a **legacy partial vault** (deployed before
the bundle) via Safe calldata from
`scripts/activate-strategy-post-deploy.ts` — not via `/api/creator/strategy/activate`.

Example: vault went live with Charm-only from an old comp row; ops adds Ajna
on-chain and rebalances weights.

### High-level flow (operator)

1. **Confirm entitlement** — legacy row or operator comp for the missing
   strategy (creators cannot buy `ajna_sleeve` alone at the API anymore).
2. **Operator runbook** (manual for v1; see "Operator script" below):
   1. Deploy the strategy contract for the new feature using the same
      CREATE2 salt + `UniversalBytecodeStore` code-id the batcher would
      have used at Phase 3. Addresses stay deterministic.
   2. Transfer ownership of the new strategy to `protocolTreasury`.
   3. Compute the new weight triple via
      `computeStrategyWeights({old active keys ∪ new key})`. Example —
      adding Ajna to a Charm-only vault: weights shift from
      `{charm: 9_000, idle: 1_000}` to
      `{charm: 4_500, ajna: 4_500, idle: 1_000}`.
   4. Call `setStrategyWeight(charm, 4_500)` on the existing strategy
      so it sheds half its weight (the vault is `management`-authorized
      to do this via the creator's 1-click AA session / multisig).
   5. Call `addStrategy(ajnaStrategy, 4_500)` on the vault to
      register the new strategy.
   6. Flip the DB row to `status = 'active'`,
      `provisioner_ref = '<strategy_address>'`.
3. **Keeper rebalances TVL.** Once weights are updated, the normal
   `CreatorOVault.deployToStrategies` / rebalance keeper redistributes
   deployed assets on its next scheduled tick:
   - The vault's strategy manager sees Charm is over-allocated (was
     90 %, should be 45 %). The keeper calls `deallocate` on Charm to
     pull the excess back into the idle reserve.
   - Idle is now above its target. The keeper calls `deployToStrategies`
     to push the idle surplus into Ajna (now 45 % target).
   - This can take multiple keeper ticks for each strategy's
     deallocation window to settle (Charm needs to exit its concentrated
     LP position; Ajna needs to withdraw from its Ajna pool). Expected convergence time is 1–4 hours depending
     on strategy liquidity.

### Key invariants during post-deploy addition

- **Strategy addresses are deterministic.** The CREATE2 salt derivation
  (`utilsHelper.deriveBaseSalt(creatorToken, owner, chainId, version)`
  + per-strategy label) means the post-deploy strategy address is
  exactly what Phase 3 would have deployed if the creator had paid
  upfront. No surprises for indexers / Etherscan / support triage.
- **Weight rebalancing is operator-triggered, TVL rebalancing is
  keeper-triggered.** The operator only changes `setStrategyWeight` and
  calls `addStrategy` — the vault's own rebalance keeper handles the
  actual movement of tokens between strategies. This keeps the operator
  step cheap and auditable.
- **Creator funds never leave the vault.** Deallocation pulls strategy
  positions back into vault-held idle CREATOR (not to the creator or
  operator), and deployment pushes from vault idle into the new
  strategy. The creator's share price is preserved across the
  rebalance (minus normal strategy exit costs: LP impermanent loss
  realization, Ajna interest accrual). **`solana_bridge_strategy` post-deploy
  addition is retired** — use Pipe A share mesh at deploy instead.

### Operator script

The manual runbook above will eventually be encapsulated in a single
script:

```bash
pnpm -C frontend exec tsx scripts/activate-strategy-post-deploy.ts \
  --creator 0xCREATOR \
  --feature ajna_sleeve
```

The script will:

1. Read the pending activation row from `creator_strategy_features`.
2. Read the live vault + currently-registered strategies via the
   `CreatorOVaultStrategyManager` view functions.
3. Compute the new weights via `computeStrategyWeights`.
4. Execute the batch of `setStrategyWeight` + `addStrategy` calls as a
   multicall from the operator multisig.
5. Mark the DB row `active` with `provisioner_ref`.
6. Nudge the rebalance keeper to process this creator on its next tick.

Until the script is wired, operators run the steps manually via
`cast send` and direct SQL updates.

### Things that are NOT supported in v1

- **Removing a paid strategy.** Once installed, a strategy stays
  registered. Charging a sunset fee or allowing weight=0 on a
  registered strategy would require contract / refund logic we haven't
  designed. If a creator needs to shed a strategy, the workaround is:
  `setStrategyWeight(X, 0)` (leaves the strategy registered but idle).
  The resolver would need an "inactive but paid" state to model this
  cleanly — out of scope for v1.
- **Customizing the unrouted-remainder target.** The resolver always
  sizes productive weights so ~10 % of TVL is unrouted. We don't
  currently let creators tune that (e.g. "I want 5 % idle, higher
  deployment"). Making it configurable is a future question — the
  vault's own `minimumTotalIdle` parameter also interacts with this,
  and they'd need to stay consistent.
- **Automated post-deploy activation.** The whole flow above is manual
  today. Fully automating requires (a) the operator script, (b) a cron
  that scans pending activations for live vaults, (c) guardrails to
  prevent double-activation during keeper ticks.

## Bundled sub-entitlements (reference — not sold separately)

These keys appear in `creator_strategy_features` and resolver output.
**Do not** document or sell them as standalone $100 SKUs; greenfield
creators buy **`vault_full_deploy`** only.

### `charm_active_lp` (bundled — Phase 3)

Installs the Charm Alpha Vault + `CreatorCharmStrategy` during Phase 3
and registers it on the vault. With the full bundle, weight is **4_500 bps**
(45% of productive TVL). Without entitlement, deploy skips Charm entirely.

**Provisioning:** automatic at deploy when bundle (or legacy row) is active.

### `ajna_sleeve` (bundled — Phase 3)

Installs Ajna `AjnaVaultAuth` + inner vault + ERC-4626 adapter during Phase 3.
With the full bundle, weight is **4_500 bps**. Bucket automation starts
**paused** until ops enables it (see ajna-vault-manager runbook).

**Provisioning:** automatic at deploy when bundle (or legacy row) is active.

### `solana_ovault_mesh` (bundled — Phase 2b)

Phase 2b OVault compose routing + Pipe A 30% ShareOFT auto-bridge at
finalize. **Not** Phase 3 TVL (`solanaWeightBps` always 0 on greenfield).

### `solana_meteora_alpha_vault` (bundled — post-deploy provision)

Meteora DLMM + Alpha Vault on the **share-mesh mint** (`■<TICKER>`).
Included in the bundle; operator provisions after vault is live.

### `solana_bridge_strategy` — RETIRED

Legacy Phase-3 `SolanaBridgeStrategy` TVL lane. **Not purchasable.**
Greenfield vaults seed Solana via Pipe A (30% ShareOFT auto-bridge at
finalizePhase2). See `docs/operations/solana-share-mesh-lottery-policy.md`.

### Meteora operator runbook (post-deploy)

1. Ensure the Solana keeper has ~1.5 SOL for DLMM + Alpha Vault rent.
2. Create the Meteora DLMM pool on the **share-mesh mint** paired with wrapped SOL.
3. Create the Alpha Vault against that pool.
4. Insert / re-enable `creator_meteora_alpha_vaults`.
5. Mark the bundled `solana_meteora_alpha_vault` activation `active` when done.

See [`docs/operations/solana-bridge-naming-invariant.md`](./solana-bridge-naming-invariant.md).

## Payment verification invariants

The verifier is authoritative on **log contents**, not **transaction shape**.
This means the following are all valid:
- EOA sends a plain USDC `transfer` — simplest case.
- Smart wallet UserOp bundles the transfer with other calls — the
  `Transfer(from=session, to=treasury)` log still appears.
- Multicall / Uniswap swap-and-forward — as long as a matching Transfer
  event is emitted by the USDC contract, it counts.

What the verifier enforces:
- `tx.status === 'success'` (a reverted tx is rejected with `tx_reverted`).
- At least one log on the USDC contract decoded as `Transfer`.
- `Transfer.from` equals the authenticated session address.
- `Transfer.to` equals the resolved treasury (env override or the canonical
  `protocolTreasury` Safe `0x7d429e…f2d3`).
- `Transfer.value >= feature.priceUsdc`.

Dedup: the DB enforces `UNIQUE (payment_tx_hash)`. Attempts to reuse a tx
hash for a second activation return `409 payment_already_used`.

## Refunds / operator reversals

A row can be moved to `refunded` manually:
```sql
UPDATE creator_strategy_features
  SET status = 'refunded',
      refunded_at = NOW(),
      failure_reason = COALESCE(failure_reason, 'operator_refund')
  WHERE id = $id;
```
Refunded rows are ignored by the `one-live-per-feature` unique index, so
the creator may pay again. The actual USDC refund is out-of-band (operator
sends USDC back from the treasury Safe).

## Payment paths

Three ways for a creator to pay the activation fee. Each lands the
creator in the same `creator_strategy_features` row shape with a
`payment_source` discriminator; the resolver reads them uniformly.

### 1. `usdc_base` — plain USDC transfer on Base (default)

Creator sends a plain `usdc.transfer(treasury, price)` themselves, then
POSTs `{ creatorToken, featureKey, paymentTxHash }` to
`POST /api/creator/strategy/activate`. Server reads the receipt and
matches the `Transfer(from=session, to=treasury, value>=effectivePrice)`
log. Works with any wallet — EOA, smart wallet, multicall router — as
long as a matching `Transfer` event is emitted by USDC. The creator
pays Base gas.

### 2. `x402_base` — HTTP 402 with EIP-3009 gasless authorization

Creator POSTs `{ creatorToken, featureKey }` to
`POST /api/creator/strategy/x402-activate`. If no `X-PAYMENT` header is
set, server responds `402 Payment Required` with an `accepts` body
describing the USDC amount + treasury destination (x402 protocol
version 1, scheme `exact`, network `base`). The client signs an
EIP-3009 `TransferWithAuthorization` message in-wallet (gasless for
signer), base64-encodes the payload into `X-PAYMENT`, and resubmits.
Server validates statically, then broadcasts
`usdc.transferWithAuthorization(...)` via a relayer EOA
(`X402_RELAYER_PRIVATE_KEY`, fallback to `PRIVATE_KEY`) that pays the
Base gas. On success the activation row stores the settled tx hash +
the EIP-3009 `nonce`; the `UNIQUE (payment_from, x402_authorization_nonce)`
index prevents replay across different activation rows.

Benefits:
- Single round trip (no "send tx → wait confirm → paste hash")
- Gasless for the creator (relayer pays Base gas)
- Agent-friendly (the whole flow is a single signature)

Caveats:
- Requires EIP-3009 support in the creator's wallet. Rainbow,
  Coinbase Wallet, and most modern smart wallets support it; older
  MetaMask versions need an in-dapp workaround.
- The server operates its own relayer instead of using Coinbase's
  hosted facilitator. Simpler ops posture (no external dep) but we
  must keep the relayer funded with Base ETH. Swap to the
  Coinbase facilitator by replacing `settleX402Payment` if desired.

### 3. `stripe` — credit-card Checkout

For creators without USDC on Base. Server creates a Stripe Checkout
Session via `POST /api/creator/strategy/stripe/checkout`, returning
the Stripe URL. Client redirects; user enters a card; Stripe fires
`checkout.session.completed` to
`POST /api/creator/strategy/stripe/webhook`, which finalizes the
matching `creator_strategy_features` row (payment_verified_at +
payment_intent id). USDC → USD cents conversion assumes 1 USDC = 1 USD
(USDC has 6 decimals, Stripe wants 2; we `floor(priceUsdc / 10_000)`).

Benefits:
- Zero crypto for the creator — card-only flow
- Stripe handles PCI / KYC / chargebacks

Caveats:
- Stripe fee: **2.9 % + $0.30** per charge ≈ **$14.77** on a $499 bundle sale.
  You net ~$484 on the USDC paths before other costs.
- Merchant-of-record: you become the seller of record for the card
  transaction. May have tax/VAT implications in some jurisdictions —
  Stripe Tax handles most automatically, but review before launching.
- No automatic on-ramp: Stripe pays out to a bank account in fiat.
  Off-ramping to USDC in the protocol treasury is a manual step.

### Choosing the route (UI guidance)

| Creator signal | Recommended path |
|---|---|
| Has USDC on Base already | `usdc_base` |
| Has a modern wallet (Coinbase Wallet / Rainbow / smart wallet) | `x402_base` |
| No crypto, has a credit card | `stripe` |
| Just wants it done in one click | `x402_base` if supported, else Stripe |

The UI should query `/api/creator/strategy/list` and let the creator
pick. All three paths end at the same activation row.

## Discounts and price overrides

Operators can grant per-creator or per-wallet discounts without
touching code. Insert a row into `creator_strategy_price_overrides`:

```sql
-- Partner deal: AKITA gets Charm for free.
INSERT INTO creator_strategy_price_overrides
  (creator_token, feature_key, price_usdc_override, reason, granted_by, expires_at)
VALUES
  (LOWER('0x5b674196812451b7cec024fe9d22d2c0b172fa75'),
   'charm_active_lp',
   0,
   'partner_launch_comp',
   LOWER('0xOPERATOR…'),
   '2026-06-01T00:00:00Z');

-- Launch discount: 50% off Solana Meteora for a specific buyer wallet.
INSERT INTO creator_strategy_price_overrides
  (wallet_address, feature_key, price_usdc_override, reason, granted_by)
VALUES
  (LOWER('0xBUYER…'),
   'solana_meteora_alpha_vault',
   50000000,
   'launch_promo_50pct',
   LOWER('0xOPERATOR…'));
```

Lookup precedence (highest wins):
1. `(creator_token, feature_key)` — per-vault override
2. `(wallet_address, feature_key)` — per-buyer override
3. Catalog price

The handler clamps effective price to `min(override, catalog)` so a
malformed row with `price_usdc_override > catalog` cannot accidentally
raise prices for users. Overrides respect `expires_at` and `revoked_at`
(soft-revoke preferred over DELETE for audit trail). The partial unique
indexes (`creator_strategy_price_overrides_one_live_per_creator` and
`..._one_live_per_wallet`) allow exactly one non-revoked override per
scope at a time; to replace, revoke the existing row then insert a
new one.

All three payment paths honour the override: USDC-on-Base clamps
`minAmount`, x402 clamps `max_amount_required` in the 402 response, and
Stripe converts the discounted USDC amount into cents when creating
the Checkout Session. The resulting `creator_strategy_features` row
stores both the catalog price and the effective price in `metadata` so
you can report on discount impact later.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `CREATOR_STRATEGY_FEATURE_USDC_TREASURY` | `protocolTreasury` Safe (`0x7d429e…f2d3`) | USDC destination the verifier expects in the `Transfer` event. Override only for staging / test environments. |
| `BASE_RPC_URL` | `https://mainnet.base.org` | RPC used by the verifier to fetch transaction receipts. First comma-separated entry is used. |
| `X402_RELAYER_PRIVATE_KEY` | falls back to `PRIVATE_KEY` | EOA that broadcasts settled `transferWithAuthorization` txs on Base for the x402 path. Pays Base gas. |
| `STRIPE_SECRET_KEY` | unset | Enables the Stripe checkout handler. When unset, `/stripe/checkout` returns 503. |
| `STRIPE_WEBHOOK_SECRET` | unset | Enables webhook signature verification. When unset, `/stripe/webhook` returns 503. |
| `STRIPE_RETURN_URL_BASE` | `http://localhost:5173` | Origin for Stripe Checkout success/cancel redirect URLs. Set to `https://app.4626.fun` in prod. |

## Adding a new feature

1. Add a catalog entry in
   [`frontend/server/_lib/creatorStrategy/catalog.ts`](../../frontend/server/_lib/creatorStrategy/catalog.ts)
   with a unique `key`, `priceUsdc`, `displayName`, `description`,
   `provisionerTag`, and `requires`.
2. Add the `CreatorStrategyFeatureKey` union member for the new key.
3. Document the provisioning runbook in this file under a new "Current
   feature catalog" subsection — prerequisites, steps, and which tables /
   onchain state need to be updated.
4. No migration is required; the `feature_key` column is already `TEXT`.
5. Update the AGENTS.md bullet pointing at this doc.

## Mainnet rollout for deploy-gating

The contract patch that accepts `weight == 0` for Charm / Ajna is
**committed in source but not yet live on mainnet**. Until the new
bytecode is seeded and the new `DeploymentBatcher` is deployed, the
on-chain `deployPhase3Strategies` still reverts on any zero weight, so
free-tier deploys will fail. Rollout checklist (operator):

1. `forge build` → regenerate the bytecode manifest:
   ```bash
   ./script/generate_bytecode_manifest.sh v1.9.2
   ```
2. Broadcast `SeedUniversalBytecodeStore` with the new `DeploymentBatcher`
   + `DeploymentBatcherPhase3Helper` bytecode ids.
3. Redeploy `DeploymentBatcher` via `DeployInfrastructure.s.sol`
   (CREATE2; bumped salt from the new version tag keeps the address
   deterministic).
4. Update `BASE_DEFAULTS.deploymentBatcher` /
   `VITE_DEPLOYMENT_BATCHER` to the new address.
5. Verify on mainnet with a dry-run deploy that skips Charm (expects
   `Phase3Result.charmStrategy == address(0)`).

Until step 5 passes on a new batcher cutover, treat legacy triple-weight
deploys as operator-only compatibility — greenfield clients must send
**4_500 / 4_500 / 0** (Charm / Ajna / Solana TVL) from
`/api/creator/strategy/list` `deployPlan`, not the old 3_000 triple.

## Paymaster enforcement (live)

The resolver (`resolveCreatorStrategyPlan`) and gate
(`gateRequestedStrategyWeights`) are wired into Phase 3 paymaster sponsorship in
[`frontend/api/_handlers/paymaster/_paymaster.ts`](../../frontend/api/_handlers/paymaster/_paymaster.ts):

1. Decode `Phase3Params.charmWeightBps` / `ajnaWeightBps` / `solanaWeightBps`
   from the UserOp calldata.
2. Call `resolveCreatorStrategyPlan(db, creatorToken)`.
3. Pass through `gateRequestedStrategyWeights(plan, requested)` and refuse
   sponsorship with `paywall_weight_gate:<reason>` when the result is not
   `{ok: true}`.

On-chain `deployPhase3Strategies` still does not check payment — it only
accepts zero vs nonzero weights — so paymaster gating is the production
enforcement boundary for sponsored deploy UserOps.

## Future work (explicitly not in v1)

- **Marketing / FAQ / explainer copy** may still describe the legacy
  "every vault ships with Charm + Ajna + Solana as baseline" product.
  Greenfield truth is **`vault_full_deploy`** (Charm + Ajna at 45%/45%,
  Solana via Pipe A finalize bridge, not Phase 3 TVL). Known surfaces to
  keep aligned:
  - `frontend/src/pages/FaqHowItWorks.tsx` — yield copy should match bundle
    entitlements, not assume à-la-carte strategy pick.
  - `docs/integrations/solana-spoke-article.md` — long-form marketing piece
    (banner points here; body may still need a rewrite).
- **Admin dashboard UI** for provisioning pending rows. (Today operators use
  `psql` / the Supabase SQL editor.)
- **Automated provisioning** for `solana_meteora_alpha_vault` — wire a
  keeper script that watches `pending` rows, runs the Meteora create flow,
  and flips the row to `active` on success. Requires Solana keeper funding
  for the lifetime of the product.
- **Post-deploy Charm / Ajna enablement** — today Charm and Ajna are
  deploy-gating because the contract installs them during Phase 3. Adding
  a post-deploy path requires a new admin function that calls
  `CreatorOVaultStrategyManager.addStrategy` against a live vault (owner
  or management role) after the creator pays.
- **Invoicing / receipts** — today there is no email receipt; the payment
  tx hash on BaseScan is the only artifact the creator receives.
- **Subscriptions / recurring fees** — out of scope; v1 is one-time-only.
