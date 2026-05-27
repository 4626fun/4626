# Creator strategy features

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

Every productive strategy is opt-in and paid. There is no free
"baseline" strategy — a creator who activates nothing has no strategies,
which is disallowed (see "At-least-one strategy rule" below).

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

## Primary purchase: `vault_full_deploy` ($499 USDC)

The live catalog sells one deploy bundle at **$499 USDC** on Base. Payment
grants `charm_active_lp`, `ajna_sleeve`, `solana_ovault_mesh`, and
`solana_meteora_alpha_vault` via entitlement expansion. Individual à la carte
deploy-gating purchases return HTTP 410.

After payment, `dispatchProvisioning` enqueues a keeper job to
`/api/keeper/solana/provision-creator` for Solana share-mesh operator follow-up.
Deploy preflight uses share-mesh OVault checks by default (see
[ solana-share-mesh-budget-paths.md](./solana-share-mesh-budget-paths.md)).

Paid features fall into two buckets:

1. **Deploy-gating features** — installed during Phase 3 of vault deploy;
   must be paid BEFORE the deploy runs. Unpaid = the strategy is skipped
   entirely. At least ONE deploy-gating feature must be paid before deploy
   (enforced both on-chain and in the resolver — see "At-least-one
   strategy rule" below). Current deploy-gating features:
   - `charm_active_lp` — $100 USDC — Charm active-LP on CREATOR/USDC
   - `ajna_sleeve` — $100 USDC — Ajna lending sleeve (USDC lending
     collateralized by CREATOR)
   - `solana_ovault_mesh` — $100 USDC — Phase 2b OVault compose routing +
     share-mesh finalize bridge entitlement (not Phase 3 TVL)
2. **Post-deploy features** — enable infra on top of an already-running
   vault. Current post-deploy features:
   - `solana_meteora_alpha_vault` — $100 USDC — Meteora DLMM on the
     **share-mesh mint** (`■<TICKER>`). Requires `solana_ovault_mesh`
     active first.

**Retired:** `solana_bridge_strategy` (legacy Phase-3 `SolanaBridgeStrategy`).
New purchases are blocked (HTTP 410). Greenfield Solana share liquidity
is seeded by the 30% ShareOFT auto-bridge at finalizePhase2.

All payments are one-time USDC on Base to the protocol treasury. Pricing
is declared per-feature in the catalog; features can deviate from the
$100 default without a code change elsewhere.

**Grandfathering:** AKITA was deployed before this model existed, under
the old contract that hardcoded all three strategies as required. Its
vault has Charm + Ajna + Solana installed without any
`creator_strategy_features` activations; the resolver ignores live
vaults that were deployed before the paywall went live. Only deploys
created after the new `DeploymentBatcher` bytecode is seeded on mainnet
consume the paywall (see "Mainnet rollout" at the bottom).

## At-least-one strategy rule

A vault with zero productive strategies would hold 100 % idle and accrue
no yield — that's a degenerate product outcome, not a feature. Three
layers enforce the rule:

1. **On-chain (hardest):** `DeploymentBatcher.deployPhase3Strategies`
   reverts with `InvalidWeight` when
   `charmWeightBps + ajnaWeightBps + solanaWeightBps == 0`.
2. **Resolver:** `computeStrategyWeights` returns
   `{ ok: false, reason: 'no_paid_strategies' }` when the creator has
   paid for nothing, and `resolveCreatorStrategyPlan` propagates that up
   as `{ ok: false, reason, creatorToken, activeFeatureKeys }`.
3. **API:** `GET /api/creator/strategy/list` returns a `deployPlan` with
   `deployable: false` and `blockedReason: 'no_paid_strategies'` — the
   UI reads this and disables the Deploy button until the creator
   activates at least one feature.

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

The server resolves a creator's Phase 3 weight triple from their paid
activations. Paid strategies split a fixed productive budget (9_000 bps)
evenly, which leaves the unrouted remainder at 10 % of TVL:

| Paid strategies | Per-strategy weight | Example plan                       |
|-----------------|---------------------|-------------------------------------|
| 1               | 9_000 bps (90 %)    | Charm 9000 / unrouted 1000          |
| 2               | 4_500 bps (45 % ea) | Charm 4500 / Ajna 4500 / unrouted 1000 |
| 3               | 3_000 bps (30 % ea) | Charm 3000 / Ajna 3000 / Solana 3000 / unrouted 1000 |

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
- `charm + ajna + solana > 0` (at least one strategy required)
- `charm + ajna + solana <= 10_000` (idle absorbs the rest)

The Uniswap V3 CREATOR/USDC pool is still created/fetched unconditionally
because it's a prerequisite for future Charm activation, so single-strategy
deploys that don't have a pre-existing pool must still pass a non-zero
`initialSqrtPriceX96`.

### Code-ids are only required when used

When a strategy is skipped, the corresponding entries in `StrategyCodeIds`
can be `bytes32(0)`. Phase 3 `solanaWeightBps` is always zero on greenfield
batchers — pass `address(0)` for `solanaKeeper` / `solanaBridgeAddress`.

## Adding a strategy post-deploy

A creator can activate additional deploy-gating strategies AFTER their
vault is live (e.g. they deployed with Charm only at 9_000 bps, and
later want to add Ajna). This is the "grow into your strategies" path.

### High-level flow

1. **Creator pays** $100 USDC to the treasury for the new feature (e.g.
   `ajna_sleeve`) and POSTs the tx hash to
   `/api/creator/strategy/activate`. The activation row lands in
   `creator_strategy_features` with `status = 'pending'`.
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

## Current feature catalog

### `charm_active_lp` — $100 USDC (deploy-gating)

Installs the Charm Alpha Vault + `CreatorCharmStrategy` during Phase 3
and registers it on the vault at `3_000` bps. Without this activation
the deploy skips the Charm pipeline entirely (no factory call, no
`addStrategy`).

**Prerequisites:**
- Must be paid BEFORE the Phase 3 deploy call. Post-deploy enablement is
  not supported by the v1 resolver (would require a separate admin path
  that calls `addStrategy` against a live vault).

**Provisioning:** automatic — the deploy session reads the creator's
activations and passes the right `charmWeightBps`; no operator step.

### `ajna_sleeve` — $100 USDC (deploy-gating)

Installs the Ajna `AjnaVaultAuth` + `AjnaVault` + ERC-4626 adapter
strategy and registers it on the vault at `3_000` bps. Same skip
semantics as Charm.

**Prerequisites:** same as Charm — must be paid BEFORE deploy.

**Provisioning:** automatic.

### `solana_bridge_strategy` — RETIRED

Legacy Phase-3 `SolanaBridgeStrategy` TVL lane. **Not purchasable.**
Greenfield vaults seed Solana via Pipe A (30% ShareOFT auto-bridge at
finalizePhase2). See `docs/operations/solana-share-mesh-lottery-policy.md`.

### `solana_meteora_alpha_vault` — $100 USDC

Activates Solana-side liquidity for a creator that already has a
lowercase-parity bridge-wrapped mint (see
[`docs/operations/solana-bridge-naming-invariant.md`](./solana-bridge-naming-invariant.md)).

**Prerequisites (checked before accepting payment in the UI):**
- Creator coin is deployed on Base and has a parity-normalizable name/symbol.
- Creator coin is registered on the canonical v2 `SolanaBridgeAdapter` — verify with:
  ```bash
  pnpm --filter frontend exec tsx scripts/verify-solana-mint-parity.ts \
    --creator 0xCREATOR_TOKEN
  ```

**Provisioning runbook (operator, v1 manual):**
1. Ensure the Solana keeper has ~1.5 SOL for DLMM + Alpha Vault rent.
2. Create the Meteora DLMM pool against the creator's lowercase-parity
   Solana mint paired with wrapped SOL. (See Meteora section in
   [`docs/operations/solana-bridge-naming-invariant.md`](./solana-bridge-naming-invariant.md).)
3. Create the Alpha Vault against that pool.
4. Insert / re-enable the row in `creator_meteora_alpha_vaults` so
   `SolanaStrategy` picks up the routing on its next rebalance.
5. Update the `creator_strategy_features` row:
   ```sql
   UPDATE creator_strategy_features
     SET status = 'active',
         provisioned_at = NOW(),
         provisioner_ref = '<dlmm_pool_pubkey>,<alpha_vault_pubkey>'
     WHERE id = $activationId;
   ```

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
- Stripe fee: **2.9 % + $0.30** per charge ≈ $3.20 on a $100 sale.
  You net $96.80 vs $100 on the USDC paths.
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

Until step 5 passes, the frontend should keep sending the legacy
full-weight triple (`charm=3_000, ajna=3_000, solana=3_000`) and require
both paid activations before allowing deploy — this is equivalent to the
old "all strategies required" behavior and stays compatible with the
live batcher.

## Paymaster enforcement (follow-up, not yet live)

The resolver (`resolveCreatorStrategyPlan`) and gate
(`gateRequestedStrategyWeights`) are implemented but NOT yet wired into
the deploy-continue / paymaster sponsorship path. A motivated client
could still construct a UserOp with `charmWeightBps = 3_000` without
having paid for `charm_active_lp`; the on-chain patch doesn't check
payment, only accepts `0` or nonzero. Server-side enforcement (deferred
to the paymaster sponsorship handler in
[`frontend/api/_handlers/paymaster/_paymaster.ts`](../../frontend/api/_handlers/paymaster/_paymaster.ts))
must:

1. Decode the `Phase3Params.charmWeightBps` / `ajnaWeightBps` /
   `solanaWeightBps` from the UserOp calldata.
2. Call `resolveCreatorStrategyPlan(db, creatorToken)`.
3. Pass through `gateRequestedStrategyWeights(plan, requested)` and
   refuse sponsorship if the result is not `{ok: true}`.

Until this lands, treat the paywall as honor-system — clients that go
through the official frontend will be gated because the UI reads the
resolver's plan, but hand-crafted UserOps via the paymaster can bypass.

## Future work (explicitly not in v1)

- **Marketing / FAQ / explainer copy** still describes the legacy
  "every vault ships with Charm + Ajna + Solana as baseline" product.
  Known stale surfaces:
  - `frontend/src/pages/FaqHowItWorks.tsx` — "deposited tokens earn
    yield across Charm, Ajna, Solana, and an idle reserve" copy
    assumes all three are always on. Works for full-paid creators,
    but a creator who pays for only Charm won't see Ajna/Solana yield.
  - `frontend/src/pages/deploy/DeployVault.tsx` — client-side
    `DEFAULT_CHARM_WEIGHT_BPS = 3_000n` / `DEFAULT_AJNA_WEIGHT_BPS` /
    `DEFAULT_SOLANA_WEIGHT_BPS` are hardcoded. These MUST stay at the
    legacy 3_000 bps each until the new batcher bytecode is live on
    mainnet (otherwise the on-chain weight-sum check rejects
    deploys). Swap to the `/api/creator/strategy/list` `deployPlan`
    response as part of the batcher rollout.
  - `docs/integrations/solana-spoke-article.md` — long-form marketing
    piece (has a product-model-update banner pointing here; the body
    copy still needs a rewrite).
- **Paymaster gate wiring** (above).
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
