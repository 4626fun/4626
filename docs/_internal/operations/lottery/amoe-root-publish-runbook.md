# AMOE root publish runbook

Operational guide for `setAllowlistRoot` and `setPointsLedgerRoot` on `LotteryAmoeRouter`.

## Pre-publish validation

Before broadcasting either root for epoch `E`:

1. **Epoch alignment** — `E` must be a closed epoch (`currentEpoch - 1` at publish time).
2. **Non-zero root** — `LotteryAmoeRouter` reverts `ZeroRoot` on `bytes32(0)`. Empty allowlist or empty ledger epochs are marked `finished_no_op` and must not be broadcast.
3. **Leaf count sanity** — compare L2 `leaf_count` against L0/L1 row counts; large negative deltas page ops.
4. **Publisher signer** — `msg.sender` must be the on-chain `allowlistPublisher` or `pointsLedgerPublisher` respectively.

## Monitoring

Watch `amoe_publisher_runs` and snapshot tables:

| Signal | Action |
|--------|--------|
| `phase = errored` on publisher run | Inspect `last_error`; reclaim runs after 10 min |
| Closed epoch past cutoff with no confirmed snapshot | Page — proofs will 503 until root publishes |
| `ManagerDeclinedEntry` spike post-publish | Check root mismatch vs proof pubInputs[4]/[6] |

TierZero / ops: alert when publish cron returns `tick: errored` or `allowlistOutcome` failures two ticks in a row.

## Epoch bricking (one-shot roots)

`setAllowlistRoot` and `setPointsLedgerRoot` are **one-shot per epoch**. A bad root cannot be corrected for the same epoch.

**Procedure when a bad root was published for epoch E:**

1. Disable AMOE submissions for epoch E (`AMOE_ZK_SUBMIT_ENABLED=0` or router pause).
2. Publish corrective roots only for **E+1** onward after fixing L0/L1 data.
3. Refund affected phase-A burns via `amoeBurnRefund` cron (`AMOE_REFUND_CRON_ENABLED=1`).
4. Document incident in `amoe_publisher_runs.last_error` and snapshot `publisher_version`.

## On-chain wiring checklist

After deploy:

```text
router.setManager(LotteryManager4626)
manager.setAuthorizedAmoeRelayer(router)   // only router may call processAmoeEntry
router.setPointsLedgerPublisher(<ledger EOA>)
// allowlistPublisher is set in router constructor; verify matches AMOE_PUBLISHER env
```

Kill-switch: `manager.setAuthorizedAmoeRelayer(address(0))`.

## Regenerating circuit v3 artifacts

After `amoe_eligibility.circom` changes:

```bash
SNARKJS_CLI=frontend/node_modules/snarkjs/build/cli.cjs \
  bash amoe/tools/zk/regen_amoe_plonk_verifier.sh
node amoe/tools/zk/regen_amoe_plonk_fixture.mjs
router.setVerifier(new AmoePlonkVerifier)
```

Public inputs are **9** (v3 adds `walletAddr` at index 8 for buyer binding).
