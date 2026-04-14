# Security Audit: 4626 CRE Keeper Runtime

**Scope:** Off-chain TypeScript CRE keeper code in `wenakita/4626`  
**Files audited:** 22 TypeScript source files across `cre/config.ts`, `cre/runner.ts`, `cre/cre-workflows/_shared/`, `cre/utils/`, and `cre/actions/`  
**Audit date:** 2025  
**Auditor:** Automated security review

---

## Executive Summary

The CRE keeper runtime is generally well-structured with meaningful security controls: dry-run mode simulation, ERC-4337 ownership verification before signing, registry verification on vault operations, and good input sanitisation in the queue layer. However, several high and critical issues exist that could allow fund loss, double-execution of state-mutating operations, replay attacks, or silent failures during bridge/relay operations.

| Severity | Count |
|---|---|
| CRITICAL | 3 |
| HIGH | 8 |
| MEDIUM | 9 |
| LOW | 7 |
| INFO | 6 |
| **Total** | **33** |

---

## CRITICAL Findings

---

### CRT-01 — Solana Entry Relay: No Idempotency / Double-Execution Risk on Partial Relay Failure

**File:** `cre/actions/keepr-solana-relay-entries.action.ts`, lines 110–167  
**Category:** Replay/double-execution; Error handling

**Description:**  
`executeSolanaRelayEntries` reads all pending entries from the Solana PDA ring buffer, submits a Solana `relay_entries` instruction to flush the on-chain buffer, and then — in a separate step — calls `SolanaBridgeAdapter.processLotteryEntryFromSolana()` on Base. These two transactions are not atomic.

If the Solana `relay_entries` transaction succeeds (clearing the PDA buffer) but the Base `processLotteryEntryFromSolana` call fails, all entries are silently dropped. There is no local state checkpoint, no retry record, and the PDA buffer is already cleared.

Conversely, if the Base write succeeds but the Solana relay instruction fails, the next execution cycle will re-read the same entries (still in the PDA buffer) and attempt to call `processLotteryEntryFromSolana` again, resulting in double-processing lottery entries for affected users.

```typescript
// Line 142-144: Solana tx fires first
const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], { commitment: 'confirmed' });

// Line 162-167: Base write fires separately — no rollback if this fails
const txResult = await writeContract({
  address: solanaBridgeAdapter,
  ...
  functionName: 'processLotteryEntryFromSolana',
  args: [keeperBytes32, allEntries],
});
```

**Attack Scenario / Failure Mode:**  
A transient Base RPC outage between the two steps causes all pending lottery entries to be permanently lost (ghost entries never credited on Base). A user who purchased a lottery ticket on Solana would never receive entry credit.

**Recommended Fix:**  
1. Persist a local checkpoint (file or DB) of the entries read from Solana before any mutation.  
2. Submit the Base transaction first; only fire the Solana `relay_entries` flush after Base confirms.  
3. Make `processLotteryEntryFromSolana` idempotent (e.g. use the Solana sequence number as a deduplification key on-chain), or add a two-phase commit pattern.

---

### CRT-02 — Fee Settlement: Double-Settlement on Retry Without Idempotency Guard

**File:** `cre/actions/keepr-solana-settle-fees.action.ts`, lines 186–235  
**Category:** Replay/double-execution; Error handling

**Description:**  
`executeSolanaFeeSettlement` calls the Solana `settle_fees` instruction and then reads `keeperAta.amount` to determine what was collected. It then calls `SolanaBridgeAdapter.receiveFeeFromSolana()` on Base with that amount. The check-and-act pattern has a window:

1. `settle_fees` instruction moves withheld fees into the keeper ATA.
2. `feeVaultAmount = await getAccount(...).amount` — reads the *entire current balance* of the ATA, not just what was settled in this batch.
3. If any previous settlement run partially succeeded (fees in ATA but Base call failed), the next run will re-read the full ATA balance and call `receiveFeeFromSolana` again, crediting the same fees twice on Base.

```typescript
// Line 199-200: reads whole ATA balance, not delta from this run
const feeVaultAccount = await getAccount(connection, keeperAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
const feeVaultAmount = BigInt(feeVaultAccount.amount.toString());
```

**Attack Scenario / Failure Mode:**  
If the Base RPC times out after the Solana settlement succeeds, the ATA retains the balance. The next scheduled run sees the same balance, calls `receiveFeeFromSolana` again, and the gauge receives double the fees.

**Recommended Fix:**  
Track the ATA balance *before* calling `settle_fees` (using a checkpoint), compute the delta, and use only that delta in `receiveFeeFromSolana`. Alternatively, drain the ATA to zero after each successful Base call and use that zero-state as the idempotency guard.

---

### CRT-03 — `forceEnqueue` Auth Check: Timing Gap / Race Between Auth Check and Action Dispatch

**File:** `cre/cre-workflows/_shared/charmManager.ts`, lines 328–329; `ajnaManager.ts`, lines 430–431  
**Category:** Input validation; Keeper key security

**Description:**  
`forceEnqueue` mode authenticates callers by comparing the `authToken` in the inbound manual payload against `KEEPR_API_KEY` retrieved from the CRE secrets store:

```typescript
const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
const canForceEnqueue = manual.forceEnqueue === true && manual.authToken === apiKey
```

The `KEEPR_API_KEY` secret is the same credential used to authenticate *all* API calls (including `fetchActiveVaults`, `enqueueStrategyAction`, etc.). By requiring this secret in the inbound manual payload, any operator who can submit a manual CRE trigger payload can also access the full `KEEPR_API_KEY` — effectively reading back the API key by constructing a forced enqueue payload. On Chainlink's CRE platform, manual payloads are visible in execution logs.

Furthermore, if `manual.authToken` is logged during execution (e.g., via a serialized dump of the payload), the API key leaks into execution logs.

**Attack Scenario / Failure Mode:**  
An operator with read access to CRE execution logs who constructs a failing `forceEnqueue` payload can infer the correct `KEEPR_API_KEY` by observing whether the "missing or invalid authToken" branch fires. A compromised `KEEPR_API_KEY` would allow the attacker to call the Keepr API directly, enqueue arbitrary strategy actions, and trigger on-chain rebalances or bucket moves.

**Recommended Fix:**  
Use a separate, purpose-limited `FORCE_ENQUEUE_AUTH_TOKEN` secret for manual override authentication, distinct from the general-purpose API key. Never log the inbound payload when it contains an auth token field. Consider a HMAC/timestamp-bound signature instead of a static token comparison.

---

## HIGH Findings

---

### HGH-01 — Solana Keypair Exposed via `require('crypto')` / `SOLANA_KEEPER_KEYPAIRS` Env Without Sanitisation in Error Messages

**File:** `cre/utils/solana.ts`, lines 19–56  
**Category:** Keeper key security

**Description:**  
`loadKeeperKeypair` reads from `process.env.SOLANA_KEEPER_KEYPAIRS` and `SOLANA_KEEPER_KEYPAIR` which contain raw base58 or JSON-array Solana private keys. The error thrown when parsing fails (`Keypair.fromSecretKey(...)`) will include the raw `secretKeyStr` value in some execution environments' stack traces. Additionally, if `SOLANA_KEEPER_KEYPAIRS` contains multiple keys as a comma-separated string, any logging of the raw env var (e.g., via `console.error(process.env)` in error handlers) would expose all keys.

```typescript
export function parseKeypair(secretKeyStr: string): Keypair {
  if (secretKeyStr.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));  // raw key in error
  }
  return Keypair.fromSecretKey(bs58.decode(secretKeyStr));  // raw key in error if decode fails
}
```

**Attack Scenario / Failure Mode:**  
A misconfigured key value (e.g., wrong format) causes `JSON.parse` or `bs58.decode` to throw an error whose message may include partial key material. If CRE execution logs are shipped to third-party log aggregators, the key could be captured.

**Recommended Fix:**  
Wrap `parseKeypair` in a try-catch that throws a sanitised error message without the raw key value. Validate the secret key format before passing it to `Keypair.fromSecretKey`.

---

### HGH-02 — `SOLANA_SHARE_OFT_MAPPING` Parsed with `JSON.parse` Without Validation — Arbitrary Relay Target

**File:** `cre/actions/keepr-solana-relay-entries.action.ts`, line 58; `keepr-solana-settle-fees.action.ts`, line 68  
**Category:** Input validation; Solana relay safety

**Description:**  
```typescript
const shareOFTMapping = JSON.parse(process.env.SOLANA_SHARE_OFT_MAPPING ?? '{}');
```
The resulting `shareOFTMapping[mintStr]` value is cast directly to `0x${string}` without address validation:
```typescript
const shareOFT = shareOFTMapping[mintStr] as `0x${string}` | undefined;
```
A malformed or malicious environment variable can inject an arbitrary Base address as the `shareOFT` argument passed to `processLotteryEntryFromSolana` and `receiveFeeFromSolana`. If an attacker gains write access to the environment (e.g., through Chainlink node configuration), they can redirect lottery entries and fee flows to an attacker-controlled contract.

**Recommended Fix:**  
Validate each value from `shareOFTMapping` against a regex/EVM address check (`isAddress()`) before use. Cross-reference mapped addresses against the on-chain `CreatorRegistry` to confirm they are legitimate ShareOFT contracts.

---

### HGH-03 — Winner Relay: `log.args` Cast with `as any` — Missing Field Validation

**File:** `cre/actions/keepr-solana-winner-relay.action.ts`, line 183  
**Category:** Input validation; TypeScript type safety

**Description:**  
```typescript
const { winner, creatorCoin, sharesPaid } = log.args as any;
```
The `winner` and `creatorCoin` fields are used directly as Base addresses to look up in `twinToSolanaPubkey` and `creatorCoinToMint` maps. No address validation is performed on the emitted event fields before the lookup. A malformed or reorg'd log could yield `undefined` or a non-address value, potentially causing a match on a map entry keyed to an empty string or `undefined`.

```typescript
const solanaMint = creatorCoinToMint[creatorCoin.toLowerCase()];  // creatorCoin may be undefined
```

**Recommended Fix:**  
Validate `winner` and `creatorCoin` as valid EVM addresses using `isAddress()` before proceeding. Use typed event parsing via viem's `parseEventLogs` rather than `as any`.

---

### HGH-04 — Singleton Wallet/Public Clients Are Untyped (`any`) and Not Reset Between Runs

**File:** `cre/utils/onchain.ts`, lines 153, 160–162  
**Category:** TypeScript type safety; Transaction safety

**Description:**  
```typescript
let _erc4337Config: Erc4337Config | null | undefined = undefined;
let _publicClient: any = null;
let _walletClient: any = null;
```
The singleton clients are typed as `any`, bypassing TypeScript's type system entirely. The `_erc4337Config` singleton caches per-process ERC-4337 config using `undefined` as "not yet initialised" and `null` as "disabled", which works but is fragile — if the module is imported in different call contexts expecting different execution configs (e.g., one vault using Privy, another using raw private key), the first caller's config could be reused for subsequent callers because the `if (_erc4337Config !== undefined)` guard short-circuits (line 314).

However, when `executionContext` is provided directly (line 293), the function bypasses the cache entirely and always resolves fresh — this is correct for Ajna but means an ERC-4337 path and a legacy path can co-exist in memory concurrently.

**Recommended Fix:**  
Type `_publicClient` and `_walletClient` using their proper viem types. Add an explicit `resetClients()` function for testing contexts. Document clearly that the singleton pattern is process-scoped.

---

### HGH-05 — No Transaction Pre-Simulation Before Live ERC-4337 `sendUserOperation`

**File:** `cre/utils/onchain.ts`, lines 533–545  
**Category:** Transaction safety

**Description:**  
The ERC-4337 flow in `sendErc4337UserOperation` sends a `UserOperation` directly without pre-simulating the inner call. The dry-run path (`isDryRun()`) does call `simulateContract` correctly, but for live execution paths through ERC-4337, there is no call simulation before the `UserOperation` is submitted to the bundler.

```typescript
const userOpHash = await sendUserOperation(bundlerClient, {
  account,
  calls,
  // ... no simulation step
});
```

If the inner call would revert (e.g., stale oracle state, already-executed action), the bundler still charges a gas fee and the UserOp status could be silently failed. `writeContract` returns `{ success: false }` on catch, but not on a reverted UserOp where `receipt.status` is unclear (see line 561: `const status = receiptAny?.receipt?.status; return { success: status ? status === 'success' : true }`).

**Attack Scenario / Failure Mode:**  
A reverted UserOp returns `success: true` because `status` is `undefined` in some bundler receipt formats. The caller believes the action succeeded and does not retry or alert.

**Recommended Fix:**  
Pre-simulate ERC-4337 calls using `publicClient.simulateContract` before submitting `sendUserOperation`. Treat an absent `status` field as `false` (fail-safe default) rather than `true`.

---

### HGH-06 — Privy `walletRpc` Uses `any` Return Type — Signature Validation Can Silently Pass on Malformed Response

**File:** `cre/utils/privyWalletApi.ts`, lines 116–128; `cre/utils/onchain.ts`, lines 269–278  
**Category:** TypeScript type safety; Keeper key security

**Description:**  
`walletRpc<T>` is generically typed but returns `any` in practice (line 136: `walletRpc<any>(...)`). The `signMessage` implementation in `onchain.ts` validates the signature format with a regex but extracts the value using optional chaining with a default empty string:

```typescript
const sig = String(out?.data?.signature ?? '').trim();
if (!/^0x[0-9a-fA-F]+$/.test(sig)) {
  throw new Error('privy_personal_sign_invalid_signature');
}
```

If the Privy API changes its response structure (e.g., `out.data.sig` vs `out.data.signature`), the regex check against an empty string `''` fails and the error is correctly thrown. However, `secp256k1SignHash` in `privyWalletApi.ts` has a similar pattern (line 142-143) — on Privy API error, `res?.data?.signature` evaluates to `undefined`, the regex fails, and the error thrown is `'privy_secp256k1_sign_invalid_signature'` rather than the actual API error message, making debugging difficult.

**Recommended Fix:**  
Type the Privy response structures explicitly. Distinguish between "API returned an error" (non-ok HTTP status, already caught) and "API returned unexpected response shape" to produce actionable error messages.

---

### HGH-07 — Bridge Monitor: `fetchSolanaInfraStatusWithFallback` Falls Back to `registerSolanaBridgeToken` (Build-Only POST) When Auth Fails — Potential Auth Bypass Signal

**File:** `cre/actions/bridge-integrity-monitor.action.ts`, lines 417–447  
**Category:** Bridge monitor integrity; Input validation

**Description:**  
The bridge monitor's `fetchSolanaInfraStatusWithFallback` uses a fallback path: if `/deploy/solanaInfraStatus` returns 401/403, it falls back to calling `/deploy/registerSolanaBridgeToken` with `buildOnly: true`. This fallback is designed for environments where the auth token lacks permission for `solanaInfraStatus` but can call the register endpoint.

```typescript
if (statusResponse.status !== 401 && statusResponse.status !== 403) {
  throw new Error(`deploy/solanaInfraStatus failed: ${statusDetail}`);
}
// Falls through on 401/403 to register-build-fallback...
const registerResponse = await fetch(`${apiBaseUrl}/deploy/registerSolanaBridgeToken`, {
  method: 'POST', body: JSON.stringify({ buildOnly: true, bridgeToken: params.fallbackBridgeToken }),
```

The returned `infra` from the fallback has `defaultRouteBridgeTokenAllowlisted: null` and `defaultMintRouteScalar: null`, meaning the allowlist and scalar checks are effectively skipped. An attacker who can cause the primary endpoint to return 401 (e.g., by rotating or revoking the API key) degrades the monitor to a much weaker check.

**Recommended Fix:**  
Log a CRITICAL alert when the fallback is triggered due to auth failure (401/403), not just a warning. Ensure at least the route checks (which are independent of `infra`) still execute fully. Consider refusing the monitor run entirely if the primary endpoint is 401 and there is no explicit fallback configuration.

---

### HGH-08 — `registry.ts` `fetchActiveVaults` Does Not Validate Vault Addresses Against On-Chain Registry in CRE Mode

**File:** `cre/utils/registry.ts`, lines 122–151  
**Category:** Input validation; Transaction safety

**Description:**  
The `fetchActiveVaults` function in the local-runner context fetches vault configs from the Keepr API and returns them without registry binding verification. In `vault-keeper.action.ts`, `verifyVaultRegistryBinding` is explicitly called (line 297), but no equivalent verification exists in `charm-rebalance-manager.action.ts` (line 344) or `ajna-bucket-manager.action.ts` (line 549–550) when resolving vaults from the feed.

A compromised or misconfigured API server could return vaults with attacker-controlled `oracleAddress` or `ccaStrategyAddress` values. The keeper would then read TWAP data from an attacker's oracle and potentially trigger rebalances or bucket moves based on manipulated prices.

**Recommended Fix:**  
Call `verifyVaultRegistryBinding` (or an equivalent on-chain check) for all vault registry lookups before using any address in a write operation, not just in the vault-keeper workflow.

---

## MEDIUM Findings

---

### MED-01 — Unsafe `require('crypto')` at Module Top-Level in Actions

**File:** `cre/actions/keepr-solana-relay-entries.action.ts`, lines 31–35; `keepr-solana-settle-fees.action.ts`, lines 28–32  
**Category:** TypeScript type safety; Configuration safety

**Description:**  
```typescript
const RELAY_ENTRIES_DISCRIMINATOR = require('crypto')
  .createHash('sha256')
  .update('global:relay_entries')
  .digest()
  .subarray(0, 8);
```
Using CommonJS `require()` inside an ES module file is ambiguous and environment-dependent. On some Node.js versions with `--experimental-vm-modules`, `require` may not exist. Within the Chainlink CRE runtime, the execution environment may not provide `require`. Additionally, within `keepr-solana-winner-relay.action.ts` (line 224), `require('crypto')` is called *inside* the loop body, creating a new require resolution on each iteration.

**Recommended Fix:**  
Replace `require('crypto')` with `import * as crypto from 'node:crypto'` at the file top level, consistent with `privyWalletApi.ts` which already uses the correct pattern.

---

### MED-02 — `parseManualPayload` Accepts Base64-Encoded JSON as Fallback — Potential Injection Vector

**File:** `cre/cre-workflows/_shared/charmManager.ts`, lines 94–106; `ajnaManager.ts`, lines 103–115  
**Category:** Input validation

**Description:**  
Manual payloads are parsed with a double-fallback: raw JSON, then base64-decoded JSON. A Chainlink trigger that can supply arbitrary bytes32/bytes data as the manual payload can inject a crafted base64 string that, when decoded, contains a valid JSON payload with `forceEnqueue: true` and an `authToken` equal to the API key.

While this alone does not bypass auth (the authToken must still match the secret), it means any field in the payload — including `vaultAddress`, `strategyAddress`, `charmVaultAddress` — can be controlled by whoever constructs the trigger payload. These are validated for address format but not against any allowlist of known-legitimate addresses.

**Recommended Fix:**  
Consider constraining `vaultAddress` in `forceEnqueue` payloads to the set of addresses known in the registry, rather than accepting any valid-format hex address.

---

### MED-03 — `SOLANA_WINNER_RELAY_STATE_FILE` Written to `process.cwd()/.state/` — No Atomic Write

**File:** `cre/actions/keepr-solana-winner-relay.action.ts`, lines 102–104; referenced `solana-winner-relay-state.js`  
**Category:** Error handling; Replay/double-execution

**Description:**  
The winner relay checkpoint is saved to a file in `process.cwd()/.state/`. If the state file write fails (disk full, permission error) after a Solana `record_winner` transaction has already confirmed, the checkpoint is not advanced. On the next run, the event is re-processed and `record_winner` is called again on Solana. While the Solana program may be idempotent, this creates duplicate transaction fees and may produce incorrect state if the program is not idempotent.

Additionally, a non-atomic file write (write then rename) could leave a partial/corrupt state file if the process is killed mid-write.

**Recommended Fix:**  
Use atomic file writes (write to a temp file, then rename). Wrap checkpoint saves in a try-catch that alerts on failure. Consider using a content-addressed state (hash of the last processed event) as a secondary check.

---

### MED-04 — ERC-4337 `waitForUserOperationReceipt` Hardcoded 120s Timeout — No Configurable Retry

**File:** `cre/utils/onchain.ts`, line 548–550  
**Category:** Transaction safety; Error handling

**Description:**  
```typescript
const receipt = await waitForUserOperationReceipt(bundlerClient, {
  hash: userOpHash,
  timeout: 120_000,
});
```
A 120-second timeout is hardcoded. If the bundler is congested or the UserOp is not included within 120 seconds, the function throws and returns `success: false` with `txHash: '0x0'`. The calling code has no retry logic for this case and does not distinguish "timeout" from "revert". The UserOp may still be pending in the bundler mempool and could eventually execute after the keeper considers it failed — creating a scenario where the keeper re-submits while the original is still pending (potential double-execution).

**Recommended Fix:**  
Before re-submitting, check if the UserOp hash is still pending in the bundler. Implement a nonce-check or use replace-by-fee semantics. Expose the timeout as a configurable environment variable.

---

### MED-05 — Charm `forceEnqueue` Validation: `charmVaultAddress` Defaults to `zeroAddress` Rather Than Rejecting

**File:** `cre/cre-workflows/_shared/charmManager.ts`, line 376  
**Category:** Input validation

**Description:**  
```typescript
const forcedCharmVaultAddress = normalizeVaultAddress(manual.charmVaultAddress) ?? zeroAddress
```
If `manual.charmVaultAddress` is present but not a valid address, `normalizeVaultAddress` returns `null` and the value silently falls back to `zeroAddress`. The subsequent check:
```typescript
if (forcedCharmVaultAddress !== zeroAddress && forcedStrategy.charmVaultAddress.toLowerCase() !== forcedCharmVaultAddress) {
```
...only validates when the address is *not* zeroAddress. So an invalid `charmVaultAddress` in the payload causes the check to be skipped entirely, and the forced enqueue proceeds with whatever Charm vault the strategy is actually associated with — even if the caller intended a specific vault.

**Recommended Fix:**  
If `manual.charmVaultAddress` is provided (non-null/undefined) but fails address validation, reject with a clear error rather than falling back to `zeroAddress`.

---

### MED-06 — `getBlockTimestamp()` Uses `blockTag: 'latest'` — Susceptible to RPC Clock Drift

**File:** `cre/utils/onchain.ts`, lines 397–401  
**Category:** Transaction safety; Input validation

**Description:**  
```typescript
const block = await client.getBlock({ blockTag: 'latest' });
return block.timestamp;
```
`shouldReport` in `vault-keeper.action.ts` compares `blockTimestamp - lastReport > REPORT_INTERVAL_SECONDS`. If the RPC node serves a stale `latest` block (e.g., behind by a few blocks on a high-latency public RPC), the keeper may skip a `report()` call that is actually due, or conversely fire a `report()` slightly before the interval has elapsed on-chain. This is a low-impact drift but becomes relevant if `REPORT_INTERVAL_SECONDS` is tightly enforced on-chain.

**Recommended Fix:**  
Use `blockTag: 'finalized'` for timestamp reads, or use the `LAST_FINALIZED_BLOCK_NUMBER` constant already imported in `evm.ts` for consistency with other read calls in the CRE path.

---

### MED-07 — `alerts.ts` `sendAlert`: Webhook URL Not Validated — SSRF Risk

**File:** `cre/utils/alerts.ts`, lines 27–49  
**Category:** Configuration safety; Input validation

**Description:**  
```typescript
const webhookUrl = process.env.ALERT_WEBHOOK_URL;
// ...
const response = await fetch(webhookUrl, { ... });
```
`ALERT_WEBHOOK_URL` is used directly without any validation. If this variable is set to an internal network URL (e.g., `http://169.254.169.254/latest/meta-data/`), the keeper process would make a request to that address and include the alert payload — potentially leaking sensitive context data. On Chainlink's cloud infrastructure, metadata endpoints may be accessible.

**Recommended Fix:**  
Validate `ALERT_WEBHOOK_URL` against an allowlist of known-safe URL prefixes (e.g., `https://hooks.slack.com/`, `https://events.pagerduty.com/`) at startup. Reject non-HTTPS URLs.

---

### MED-08 — `SOLANA_FEE_ACCOUNTS` Manual Override Accepts Arbitrary Account Pubkeys Without Validation

**File:** `cre/actions/keepr-solana-settle-fees.action.ts`, lines 111–123  
**Category:** Input validation; Solana relay safety

**Description:**  
When the Token-2022 account scan is unavailable, the code falls back to `SOLANA_FEE_ACCOUNTS`:
```typescript
const manualAccounts = process.env.SOLANA_FEE_ACCOUNTS
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean);
allAccounts = manualAccounts.map((a) => ({ pubkey: new PublicKey(a) }));
```
No validation is performed to confirm these are valid Token-2022 accounts holding withheld fees for the correct mint. An attacker with environment variable write access could include arbitrary Solana accounts in the batch, causing the settle instruction to fail (which is safe) or potentially include attacker-controlled accounts as writable in the transaction instruction (which could facilitate CPI-based exploits depending on the program's account handling).

**Recommended Fix:**  
Validate that each account in `SOLANA_FEE_ACCOUNTS` is actually a token account for the expected mint before including it in the instruction.

---

### MED-09 — `dedupeKey` for Ajna Uses `strategy.authAddress` Instead of `strategy.strategyAddress`

**File:** `cre/cre-workflows/_shared/ajnaManager.ts`, line 620  
**Category:** Replay/double-execution

**Description:**  
```typescript
dedupeKey: strategyDedupeKey(vault.vaultAddress, strategy.authAddress, targetBucket),
```
The `strategyDedupeKey` function signature is:
```typescript
function strategyDedupeKey(vaultAddress, strategyAddress, targetBucket): string
```
But in the enqueue call, `strategy.authAddress` (the Ajna auth contract) is passed in the `strategyAddress` position, not `strategy.strategyAddress`. This means the dedupe key does not uniquely identify the strategy — two different strategies sharing the same auth contract would produce identical dedupe keys for the same target bucket, causing one to be silently dropped by the queue.

In contrast, the force-enqueue path (line 538) correctly uses `forcedStrategy.authAddress` but in the `strategyAddress` position — which is at least consistent, but the naming mismatch is a code smell that could cause confusion and incorrect deduplication.

**Recommended Fix:**  
Use `strategy.strategyAddress` in the dedupe key. The auth address is not an appropriate proxy for strategy identity since multiple strategies may share the same auth contract.

---

## LOW Findings

---

### LOW-01 — `runner.ts` Catches All Errors and Calls `process.exit(1)` — No Structured Exit Code or Error Categorisation

**File:** `cre/runner.ts`, lines 106–111  
**Category:** Error handling

**Description:**  
All errors from workflow execution are caught by a single handler that calls `process.exit(1)`. Transient errors (RPC timeout, rate limit) are treated identically to fatal configuration errors. Chainlink's CRE platform interprets process exit codes to decide whether to retry; a non-zero exit on a transient error may cause unnecessary execution termination.

**Recommended Fix:**  
Differentiate between retryable errors (exit code 2) and fatal errors (exit code 1). Log structured JSON error objects for automated parsing.

---

### LOW-02 — `VRF_TOPUP_TARGET_WEI` Computed via `BigInt(0.01e18)` — Floating-Point Precision Risk

**File:** `cre/config.ts`, lines 86–89  
**Category:** TypeScript type safety

**Description:**  
```typescript
export const VRF_TOPUP_TARGET_WEI = BigInt(0.01e18);   // 10000000000000000
export const VRF_MIN_BALANCE_WEI = BigInt(0.005e18);   // 5000000000000000
```
`0.01e18` is `1e16` which is exact in IEEE 754. `0.005e18` is `5e15` which is also exact. These happen to be safe, but this pattern is fragile — using `BigInt()` with floating-point intermediate values can silently produce wrong results for less round values (e.g., `BigInt(0.003e18)` would produce `BigInt(2999999999999999.7...)` → throw or truncate depending on the runtime).

**Recommended Fix:**  
Use `BigInt(10_000_000_000_000_000)` (explicit integer literals) or `parseEther('0.01')` from viem to avoid floating-point intermediate values in BigInt constants.

---

### LOW-03 — `formatEth` and `formatTokens` Use `Number(wei)` — Precision Loss for Large Values

**File:** `cre/utils/alerts.ts`, lines 73–82  
**Category:** TypeScript type safety

**Description:**  
```typescript
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  ...
}
```
Converting `bigint` to `Number` loses precision for values above `2^53`. A vault with more than ~9007 ETH (or equivalent token units) would silently produce an incorrect display value in alerts.

**Recommended Fix:**  
Use `formatUnits(wei, 18)` from viem, which handles bigint formatting correctly.

---

### LOW-04 — `getPublicClient` Falls Back to `https://mainnet.base.org` Public RPC

**File:** `cre/utils/onchain.ts`, lines 168–176  
**Category:** Configuration safety

**Description:**  
```typescript
const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
```
Falling back to the public Base RPC endpoint means the keeper could submit transactions and read state from a shared public endpoint with high latency, rate limits, and no SLA. A rate-limited public RPC could cause vault-keeper to miss `tend()` or `report()` intervals.

**Recommended Fix:**  
Remove the fallback. Require `BASE_RPC_URL` explicitly via `requireEnv('BASE_RPC_URL')`. Log a startup warning if it is not set.

---

### LOW-05 — `loadJsonLookupMap` in Winner Relay Reads Files Without Size Limits

**File:** `cre/actions/keepr-solana-winner-relay.action.ts`, lines 70–82  
**Category:** Input validation

**Description:**  
```typescript
const text = await readFile(filePath, 'utf8');
return normalizeLookupMap(JSON.parse(text));
```
There is no size limit on the file read. A very large file (intentionally or accidentally) could cause memory exhaustion during `JSON.parse`. On Chainlink CRE infrastructure, this could affect other running workflows.

**Recommended Fix:**  
Add a configurable maximum file size check before reading (e.g., `stat` the file and reject if > 1 MB).

---

### LOW-06 — `rotation.ts` `selectRotatingItems` Uses Wall-Clock Time — Can Produce Same Batch Across Multiple CRE Nodes

**File:** `cre/cre-workflows/_shared/rotation.ts`, lines 11–14  
**Category:** Replay/double-execution

**Description:**  
```typescript
const slotsElapsed = Math.floor(params.now.getTime() / 1000 / rotationSeconds)
const startIndex = slotsElapsed % items.length
```
Multiple CRE node executions within the same `rotationIntervalSeconds` window will select the same vault subset. This is likely intentional for consensus, but if multiple nodes submit enqueue requests simultaneously, the queue's deduplification (`dedupeKey`) must correctly handle concurrent inserts. If deduplification is server-side and uses `INSERT ... ON CONFLICT IGNORE` semantics, this is safe; if it uses a simple SELECT-then-INSERT pattern, there is a race window for duplicate enqueues.

**Recommended Fix:**  
Document the expected queue server deduplication semantics. If the server is eventually consistent, consider using the node index as a tiebreaker to assign exclusive vault subsets per node.

---

### LOW-07 — `DEFAULT_BASE_SOLANA_BRIDGE` Hardcoded Address in Bridge Monitor

**File:** `cre/actions/bridge-integrity-monitor.action.ts`, line 19  
**Category:** Configuration safety

**Description:**  
```typescript
const DEFAULT_BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as const;
```
A hardcoded fallback bridge address that cannot be overridden at runtime without code changes. If this contract is upgraded or replaced, the bridge integrity monitor will silently check the wrong contract.

**Recommended Fix:**  
Require `BASE_SOLANA_BRIDGE_ADDRESS` as a mandatory environment variable for the bridge monitor workflow. Remove the hardcoded default.

---

## INFO Findings

---

### INF-01 — TypeScript `strict` Mode and Pervasive `any` Suppression Comments

**File:** Multiple files — `evm.ts`, `charmManager.ts`, `ajnaManager.ts`, `onchain.ts`  
**Category:** TypeScript type safety

**Description:**  
There are 25+ `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments suppressing `any` type cast warnings across the codebase. Many of these are in paths that handle decoded ABI results. While viem's `decodeFunctionResult` does require some casting due to the dynamic ABI nature, the pattern of silencing all such warnings means type errors in other locations may be masked.

The `tsconfig.json` was not available for audit, but if `strict: false` is set, several of the medium/high findings above could silently compile without error.

**Recommended Fix:**  
Enable `strict: true` in `tsconfig.json`. Use typed ABI decoding where possible (viem supports full type inference with `const` ABI fragments). Replace `any` with `unknown` and perform explicit narrowing.

---

### INF-02 — No Gas Budget / Max Fee Configuration for Legacy EOA Transactions

**File:** `cre/utils/onchain.ts`, lines 659–668  
**Category:** Transaction safety

**Description:**  
The legacy `wallet.writeContract()` path does not specify `maxFeePerGas`, `maxPriorityFeePerGas`, or `gasLimit`. It relies on viem's automatic gas estimation. During periods of high Base gas prices, this could result in much higher-than-expected gas costs for `tend()` and `report()` calls.

**Recommended Fix:**  
Add configurable gas cap parameters (e.g., `MAX_GAS_PRICE_GWEI` environment variable) and reject transactions that would exceed the cap, instead alerting the operator.

---

### INF-03 — `Privy Authorization Signature` Covers Full URL but Not HTTP Method on Some Paths

**File:** `cre/utils/privyWalletApi.ts`, line 55–72  
**Category:** Keeper key security

**Description:**  
The `makePrivyAuthorizationSignature` function correctly includes `method`, `url`, and `body` in the signed payload, which provides solid replay protection for each request. This is a positive finding worth noting.

---

### INF-04 — `verifyBundlerSupportsV06` Silently Continues on Network Errors

**File:** `cre/utils/onchain.ts`, lines 479–485  
**Category:** Error handling

**Description:**  
```typescript
} catch (err: unknown) {
  if (err instanceof Error && err.message.includes('EntryPoint v0.6')) {
    throw err;
  }
  console.warn('[CRE][ERC-4337] Unable to verify bundler EntryPoint support:', err);
}
```
Network errors during the bundler verification check are swallowed with a `console.warn` and execution proceeds. If the bundler is configured incorrectly but the check is unreachable, the UserOp may silently fail.

**Recommended Fix:**  
Treat network errors during bundler verification as a warning but log to the alerting system (not just console) at `WARNING` severity.

---

### INF-05 — `ORACLE_STALENESS_THRESHOLD` / `TWAP_DURATION` Constants Defined but Not Enforced Offchain

**File:** `cre/config.ts`, lines 49–56  
**Category:** Configuration safety

**Description:**  
`ORACLE_STALENESS_THRESHOLD = 1_800` (30 min) is defined in config but the `isPriceFresh` check is only performed on-chain. The keeper's off-chain code does not check `creatorPriceTimestamp` against the threshold before triggering actions based on the oracle price. A stale oracle (e.g., no V3 pool activity for 30+ minutes) could trigger rebalances based on outdated prices.

**Recommended Fix:**  
Before triggering Charm rebalance or Ajna bucket moves, explicitly read `isPriceFresh()` from the oracle contract and skip if false.

---

### INF-06 — `loadKeeperKeypairs` Silently Silences Index Out-of-Bounds

**File:** `cre/utils/solana.ts`, line 36  
**Category:** Configuration safety

**Description:**  
```typescript
const selected = entries[Math.min(safeIndex, entries.length - 1)];
```
If `SOLANA_KEEPER_KEYPAIR_INDEX` is set to `5` but only `2` keys are configured, the keeper silently uses index `1` (the last entry) rather than failing loudly. This could cause a different keypair than intended to be used for signing, leading to authorization failures on-chain that are harder to diagnose.

**Recommended Fix:**  
If the requested index exceeds `entries.length - 1`, throw an error rather than clamping silently.

---

## Summary Table

| ID | Severity | File | Issue |
|---|---|---|---|
| CRT-01 | CRITICAL | keepr-solana-relay-entries.action.ts | Non-atomic Solana+Base relay — entry loss or double-relay |
| CRT-02 | CRITICAL | keepr-solana-settle-fees.action.ts | Double fee settlement on retry |
| CRT-03 | CRITICAL | charmManager.ts / ajnaManager.ts | forceEnqueue auth uses same key as API secret |
| HGH-01 | HIGH | utils/solana.ts | Private key bytes in error messages |
| HGH-02 | HIGH | solana-relay-entries / settle-fees | SOLANA_SHARE_OFT_MAPPING not address-validated |
| HGH-03 | HIGH | keepr-solana-winner-relay.action.ts | log.args cast as any — no field validation |
| HGH-04 | HIGH | utils/onchain.ts | Singleton clients typed as any, config cache fragility |
| HGH-05 | HIGH | utils/onchain.ts | No pre-simulation for live ERC-4337 UserOps |
| HGH-06 | HIGH | utils/privyWalletApi.ts | any return type masks Privy API structural changes |
| HGH-07 | HIGH | bridge-integrity-monitor.action.ts | Auth failure degrades monitor to weaker fallback |
| HGH-08 | HIGH | utils/registry.ts | Vault addresses not registry-verified in all workflows |
| MED-01 | MEDIUM | solana-relay-entries / settle-fees | CommonJS require() in ES module context |
| MED-02 | MEDIUM | charmManager / ajnaManager | Base64 fallback parsing is injection vector |
| MED-03 | MEDIUM | keepr-solana-winner-relay.action.ts | Non-atomic checkpoint write → duplicate record_winner |
| MED-04 | MEDIUM | utils/onchain.ts | Hardcoded 120s UserOp timeout with no retry |
| MED-05 | MEDIUM | charmManager.ts | forceEnqueue: invalid charmVaultAddress silently skips |
| MED-06 | MEDIUM | utils/onchain.ts | getBlockTimestamp uses 'latest' tag |
| MED-07 | MEDIUM | utils/alerts.ts | ALERT_WEBHOOK_URL unchecked — SSRF risk |
| MED-08 | MEDIUM | keepr-solana-settle-fees.action.ts | SOLANA_FEE_ACCOUNTS not validated as correct-mint accounts |
| MED-09 | MEDIUM | ajnaManager.ts | Dedupe key uses authAddress instead of strategyAddress |
| LOW-01 | LOW | runner.ts | All errors treated as fatal exit(1) |
| LOW-02 | LOW | config.ts | VRF constants use floating-point BigInt initialisation |
| LOW-03 | LOW | utils/alerts.ts | formatEth/formatTokens loses precision for large bigints |
| LOW-04 | LOW | utils/onchain.ts | Falls back to public RPC without warning |
| LOW-05 | LOW | keepr-solana-winner-relay.action.ts | No file size limit on lookup map file reads |
| LOW-06 | LOW | rotation.ts | Time-based rotation can produce concurrent duplicate batches |
| LOW-07 | LOW | bridge-integrity-monitor.action.ts | Hardcoded DEFAULT_BASE_SOLANA_BRIDGE address |
| INF-01 | INFO | Multiple files | 25+ any casts suppress type errors |
| INF-02 | INFO | utils/onchain.ts | No gas cap for legacy EOA transactions |
| INF-03 | INFO | utils/privyWalletApi.ts | Privy auth signature is well-constructed (positive) |
| INF-04 | INFO | utils/onchain.ts | Bundler verification silently continues on network error |
| INF-05 | INFO | config.ts | ORACLE_STALENESS_THRESHOLD not enforced off-chain |
| INF-06 | INFO | utils/solana.ts | Keypair index out-of-bounds silently clamps |

---

*End of audit report.*
