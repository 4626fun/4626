---
title: Supplementary analysis lane
sidebar_label: fba285d6…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# Supplementary analysis lane
| Field | Value |
| --- | --- |
| Session ID | `fba285d6-1444-4d1a-a56c-0a74fb4deeaf` |
| Lead session | `0a513245-3ae2-4076-a9b0-bc1de524c38f` |
| Record type | Parallel workstream export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 12:08 PM (UTC-7)</timestamp>
You are doing the smart-contracts pass of a full-codebase review of the 4626 monorepo at /home/akitav2/projects/4626. READ-ONLY: do not modify files. Foundry project at repo root (contracts/ dir, test/ dir). A prior reviewer was cut off mid-analysis of the impairment side-pocket system (CreatorOVault module stack v3: CreatorOImpairmentClaims, CreatorORecoveryEscrow, vault impairment functions tripImpairment/clearImpairmentTrip/proposeImpairmentRoot/finalizeImpairment/mintImpairmentClaim/notifyImpairmentRecovery/claimImpairmentRecovery/reinstateImpairedStrategy). Your job: VERIFY or REFUTE these candidate findings with exact file:line evidence, then produce the final contracts report.

Candidate findings to verify (find the actual contract files first — search contracts/ for ImpairmentClaims, RecoveryEscrow, impairment functions in the CreatorOVault module files):
1. No on-chain enforcement that cumulative minted impairment claims ≤ totalClaimSupply set at proposeImpairmentRoot — a manager-constructed Merkle tree whose amounts sum to more than totalClaimSupply lets early claimers over-claim and drain escrow funds belonging to other epochs (escrow holds multiple epochs' assets). Check whether mintImpairmentClaim/mintFromVault tracks cumulative minted vs totalClaimSupply, and whether claimRecovery in the escrow caps per-epoch payouts at that epoch's recovered amount.
2. notifyImpairmentRecovery transfers creator coin from vault to escrow WITHOUT decrementing the vault's internal coinBalance accounting → totalAssets() overstated until next _syncCoinBalance() → deposits processed at inflated PPS in that window. Also: can a semi-trusted keeper call notifyImpairmentRecovery arbitrarily to move vault-owned creator coin into escrow (escalation)? Who is authorized to call it?
3. Stale-root lifecycle bug: if proposeImpairmentRoot ran, then clearImpairmentTrip clears the trip (false alarm), does the proposed root + claim surface stay live so claims can still be minted against a cleared epoch? Trace epoch status transitions and what clearImpairmentTrip actually resets.
4. Withdrawal path: after finalizeImpairment the strategy stays marked impaired and excluded from totalAssets — but does _withdrawFromStrategies (or equivalent) skip impaired strategies, or can user withdrawals still pull assets from the impaired strategy (double-counting against clean book)?
5. Quick sanity checks: epoch status validation on claimImpairmentRecovery; zero-address checks for impairmentClaims/escrow before external calls; reentrancy guards on the three entry points; Merkle leaf domain separation (leaf is 96-byte preimage vs 64-byte internal nodes — prior reviewer concluded safe, confirm).

Also do a brief drift check: compare against docs/audits/x-ray/contract-audit-pass-2026-06.md and review-todo.md so you don't re-report already-known/closed items — only report NEW findings or confirm the candydates above are not already documented there.

Output: markdown report, sections VERIFIED (with severity HIGH/MEDIUM/LOW, file:line evidence, attack path, suggested fix + smallest regression test in forge), REFUTED (with the exact code that mitigates), and ALREADY-KNOWN (documented in existing audit docs). Be rigorous — read the actual Solidity, do not speculate.

## Analysis

I need to locate the impairment contract files first.

*Tools invoked:* UpdateCurrentStep, Glob, Grep

## Analysis

The `.ec505ce0-...` directory appears to be a copy or snapshot, so I'll focus on the canonical root paths instead. Now I need to examine the key contract files—CreatorOImpairmentClaims.sol, CreatorORecoveryEscrow, CreatorOVault.sol (particularly the impairment-related sections), and CreatorOVaultCoreModule.sol—to understand the structure.

*Tools invoked:* Glob, Grep

## Analysis

*Tools invoked:* Read, Read

## Analysis

The escrow itself has no per-epoch cap — enforcement (if any) must live in the vault. Let me read the vault impairment logic.

 I'm noticing that escrow's `claimRecovery` doesn't actually limit `claimedByEpochAsset` to match `recoveredByEpochAsset`, which could let one epoch's payouts drain funds meant for other epochs unless the vault enforces this constraint. Let me check how the vault's `claimImpairmentRecovery` handles this, then look at the impairment logic in both CreatorOVault and CreatorOVaultCoreModule.

*Tools invoked:* Grep

## Analysis

Looking at the actual code in CreatorOVaultCoreModule.sol to find where impairment is being handled.

*Tools invoked:* Grep

## Analysis

I need to examine the core module's implementation in that section to understand what's happening there.

*Tools invoked:* Read

## Analysis

Looking at the impairment claim logic, I'm spotting a critical vulnerability: the `mintImpairmentClaim` function validates the Merkle proof and prevents duplicate claims per account, but it never checks whether the total minted claims across all accounts exceeds the epoch's `totalClaimSupply` cap.

Since both the Merkle root and `totalClaimSupply` are set by management during `proposeImpairmentRoot`, the challenge window is the only safeguard. If management sets a root where the claim amounts sum to more than `totalClaimSupply`, the payout calculation in `claimImpairmentRecovery` becomes problematic — the gross payout formula divides `totalRecovered` by `totalClaimSupply`, but if actual claims exceed that cap, the sum of all payouts exceeds `totalRecovered`. The escrow has no per-epoch cap on claimed amounts, so over-claims drain funds from other epochs sharing the same recovery asset. Additionally, `claimImpairmentRecovery` doesn't validate the epoch status at all — it only checks that `totalClaimSupply` isn't zero, meaning claims can be processed even after the epoch transitions to Resolved.

Between proposal and finalization, claims can't be minted yet (that requires Finalized/Resolved status), so `claimUnits` would be zero and claims would revert with NothingToClaim. But if the root is cleared via `clearImpairmentRootAfterChallenge`, `totalClaimSupply` gets zeroed and subsequent claims revert. The real issue is the missing on-chain invariant: there's no check that cumulative minted claims stay within `totalClaimSupply` — a simple check against `claims.totalSupply` would catch this. This is a medium-severity finding since it requires a malicious or erroneous root from management that survives the challenge window. The cross-epoch drain through the uncapped escrow is the stronger concern, as over-payout from one epoch directly pulls tokens meant for another.

Now I'm seeing a stale root lifecycle issue: an epoch can be tripped, have a root proposed, then get cleared via `clearImpairmentTrip` (which is allowed even after root proposal). The clear sets status to Resolved but leaves the snapshot root, totalClaimSupply, recoveryAsset, and unlock time intact. Since `mintImpairmentClaim` and `notifyImpairmentRecovery` both accept Resolved status, a false-alarm epoch keeps a live claim surface indefinitely — keepers can transfer recovery assets to escrow and claimers can claim pro-rata against the stale root. This confirms finding 3: a false alarm leaves claimable tokens in circulation, and combined with keeper notification, vault assets can be siphoned to claimers.

The Resolved status likely exists to allow late mints after a legitimate epoch completes, but it conflates two different Resolved provenances (cleared trip vs completed payout), which is the core issue.

Now I need to check how `notifyImpairmentRecovery` transfers recovery assets from the vault and whether the vault tracks internal coin balance accounting properly. Looking at the impairment claim minting logic, I notice there's no enforcement of the cumulative minted claims against the total claim supply limit at the epoch level. The function checks that each account can only mint once per epoch via the `impairmentClaimMinted` mapping and validates the Merkle proof, but it doesn't track whether the total amount minted across all accounts in an epoch exceeds the `totalClaimSupply` cap.

This becomes problematic during recovery payouts. When users claim their recovery, the payout is calculated as `(totalRecovered * claimUnits) / totalClaimSupply`. If the sum of minted claim units exceeds `totalClaimSupply`, the total payouts across all users would exceed `totalRecovered`, draining escrow funds. Since the escrow holds assets for multiple epochs in a shared ERC20 balance but tracks claims per-epoch, this could drain funds belonging to other epochs. The escrow has no per-epoch cap check before transferring funds, so it blindly honors whatever the vault calculates.

This is a real vulnerability that depends on the manager constructing a malicious or buggy Merkle tree where leaf amounts sum to more than `totalClaimSupply`. Given the manager is semi-trusted and the cross-epoch fund mixing amplifies the impact, I'd rate this as medium severity.

For the second finding, I need to examine whether `notifyImpairmentRecovery` properly accounts for the transferred recovery asset. The function transfers the recovery asset from vault to escrow, but I should verify if this asset is the vault's own coin and whether the internal `coinBalance` accounting is decremented accordingly to avoid overstating total assets.

The third finding involves the lifecycle of impairment epochs. When `clearImpairmentTrip` is called on a tripped epoch, it sets the status to Resolved, but any previously proposed Merkle root remains in place. Since `mintImpairmentClaim` allows minting against both Finalized and Resolved statuses, claims can still be minted against a cleared (false alarm) epoch that had a root proposed before clearing. If no recovery was actually notified for that epoch, `totalRecovered` would be zero, making all claim payouts zero.

I also need to check the withdrawal path to see if it properly skips impaired strategies, and verify the sanity checks around zero-address validation for the impairment claims and escrow contracts before external calls.

The reentrancy guards are in place at the vault wrapper level, which is good. For the Merkle leaf domain separation, the leaf preimage is 96 bytes (from encoding epochId, account, and amount), while internal nodes are 64 bytes, so there's proper separation between leaf and node structures.

The preimage separation is confirmed safe. Now I'm moving on to check the totalAssets and coinBalance accounting logic, then trace through the withdrawal path.I have the core impairment logic and will now verify the accounting, withdrawal path, and auth modifiers.

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Read, Read

## Analysis

Now let me examine the strategies module withdrawal path and `onlyKeepers`/auth modifiers.

 I'm spotting a critical issue: `totalAssets()` relies on the tracked `coinBalance` rather than querying the live balance, and when `notifyImpairmentRecovery` transfers the recovery asset directly without going through `_pushCreatorCoinExact`, the `coinBalance` doesn't get updated if that asset happens to be the creator coin itself.

Now I'm tracing through the deposit and withdrawal flows to understand the timing. When depositing, `_pullCreatorCoinExact` syncs `coinBalance` to the actual balance after the transfer, which means deposits do re-sync. But the share calculation happens before the pull, so if `totalAssets()` is inflated at that moment, the price per share is overstated and the depositor receives fewer shares than they should — they're the ones getting harmed while existing holders benefit. For withdrawals, I need to verify whether `_ensureCoin` syncs the balance before or after the share computation, because the order determines whether withdrawers exploit the inflated asset value. I see the issue now — `notifyImpairmentRecovery` transfers the recovery asset directly without updating `coinBalance`, so if the recovery asset is the creator coin, `totalAssets` would be inflated since it still counts that transferred amount. I need to check what `recoveryAsset` actually is.

The recovery asset is set arbitrarily when proposing the impairment root, so it could be the creator coin itself. Since `notifyImpairmentRecovery` uses a raw transfer instead of decrementing `coinBalance`, if the recovery asset matches the creator coin, the balance stays overstated until the next sync. This is verifiable if the recovery asset can indeed be the creator coin.

The real concern is that keepers call `notifyImpairmentRecovery` and can move vault-owned assets to the escrow with arbitrary amounts. If the recovery asset is the creator coin, a keeper could drain creator coin from the vault into the escrow for distribution to impairment claim holders.

For the claim supply issue: `mintImpairmentClaim` doesn't verify that cumulative minted claims stay within `totalClaimSupply`. If the manager builds a merkle tree where the sum of leaf amounts exceeds `totalClaimSupply`, then when claims are redeemed, the total payout would exceed what was actually recovered. Since the escrow holds funds for multiple epochs in the same asset but doesn't cap withdrawals per epoch, over-claiming in one epoch drains tokens belonging to other epochs.

The lifecycle bug is also critical: `clearImpairmentTrip` only sets the status to Resolved but doesn't clear the proposed root data. This means claims can still be minted and recovery can still be notified on a cleared epoch, even though it was a false alarm.

Now I'm looking at the withdrawal path to see how it handles impaired strategies.

*Tools invoked:* Grep

## Analysis

The impaired strategy handling in `_withdrawFromStrategies` checks out. I'm looking at how funds flow back through the system when strategies are impaired — the `removeStrategy` path and `buyDebt` function both route recovered funds to escrow, so I need to trace through those sections more carefully to see how coinBalance gets updated in those recovery scenarios.

*Tools invoked:* Read, Read

## Analysis

Let me verify reentrancy guards and authorization on the vault entry points, and check coinBalance handling in notify.

 I'm noticing a critical difference in how the two modules handle coin balance recovery: the strategies module properly resyncs `coinBalance` after moving funds to escrow in its recovery paths, but the core module's `notifyImpairmentRecovery` function skips this step entirely when the recovery asset is the creator coin, relying only on a raw transfer without updating the balance state. This confirms the accounting gap I identified for that specific scenario.

Looking at the access control, `notifyImpairmentRecovery` is restricted to keepers via the vault's entrypoint at line 1170, but there's no amount limit on how much of the recovery asset a keeper can transfer to escrow for pro-rata distribution to epoch claim holders — that's the core escalation risk. I'm checking the `notifyImpairmentRecovery` function to verify its authorization requirements and how it handles the recovery asset transfer. Looking at the implementation around line 985-995, it directly transfers the recovery asset using a standard ERC20 transfer rather than the `_pushCreatorCoinExact` method, which means the coinBalance doesn't get decremented in this process.

Now I'm examining candidate 1 more carefully — the cumulative claim supply enforcement issue. The `mintImpairmentClaim` function doesn't verify that the sum of all minted claim amounts stays within the totalClaimSupply limit. Since the manager constructs the Merkle tree at `proposeImpairmentRoot`, they could create a tree where the sum of all leaf amounts exceeds totalClaimSupply. This would cause the per-unit payout calculation to distribute more than the total recovered amount across claimers. The escrow contract tracks recovered and claimed amounts per epoch, but it never enforces that claimed amounts don't exceed recovered amounts, and since the escrow holds a shared ERC20 balance across multiple epochs, over-claiming in one epoch could drain funds belonging to another epoch. This is a defense-in-depth gap where both the vault and escrow are missing critical caps on claim amounts.

For candidate 3, I'm tracing the state transitions in `clearImpairmentTrip`. The function sets the epoch status to Resolved and resets the impairment flags, but it doesn't clear the snapshotRoot, totalClaimSupply, or recoveryAsset fields. This means if the sequence is trip → proposeImpairmentRoot → clearImpairmentTrip, the epoch ends up in Resolved status while still retaining the snapshot and claim supply data from the proposal.

The real issue is that `mintImpairmentClaim` allows minting in both Finalized and Resolved states. A cleared epoch (Tripped → Resolved) is indistinguishable from a properly finalized epoch (Finalized → Resolved) for minting purposes, but the cleared one never went through the challenge window or finalize gating. So a manager could propose a root, then clear the trip, leaving a fully-live claim surface in Resolved state without proper validation.

For candidate 4, I'm checking the withdrawal path — `_getStrategyAssetsSafe` returns 0 for impaired strategies and `_withdrawFromStrategies` skips them entirely, so impaired strategies are excluded from both totalAssets and withdrawals. This mitigates any double-counting concern.

For candidate 5, I'm verifying sanity checks. The `claimImpairmentRecovery` function only checks that totalClaimSupply is nonzero but doesn't explicitly verify the epoch status — however, during the Tripped phase totalRecovered would be 0 anyway, so claims would yield nothing. The zero-address checks for impairmentClaims and impairmentRecoveryEscrow are present in the setup functions, and missing them in `claimImpairmentRecovery` fails safely via revert when calling balanceOf on address(0).

Now I'm checking the reentrancy guards on the three main entry points and verifying the Merkle leaf domain separation. The leaf preimage is 96 bytes (uint256, address, uint256) while internal nodes are 64 bytes, so there's no second-preimage vulnerability. The epochId is also bound into the leaf, preventing cross-epoch attacks.

*Tools invoked:* Read, Grep

