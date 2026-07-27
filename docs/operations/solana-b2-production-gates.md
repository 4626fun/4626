# Solana B2 production gates

This is the activation authority for the replacement, non-Twin lottery relay.
Source availability is not production enablement. All flags and creator relay
rows remain off until the gates below pass for the exact B2 mint.

## Architecture

1. Create the intended B2 Token-2022 mint explicitly with the
   `creator-share-hook` TransferHook and zero transfer/OFT fee. While the
   provisioner is still mint authority, `setup-creator` verifies that exact mint
   and initializes its PDAs. Then create the regular LayerZero OFT Store for the
   existing mint and transfer mint authority to the OFT Store. No second mint is
   created by `setup-creator`. The 6.9% trade fee is **not** on the mint: it is
   configured on the canonical Meteora DLMM pool (`FEE_BPS=690`,
   `CollectFeeMode.OnlyY`). Protocol LP positions must set `feeOwner` to the
   jackpot claim authority; keepers claim via `claim_dlmm_fees` (not
   `settle_fees`, which only harvests Token-2022 withheld fees). Repatriate
   claimed quote to Base with `forward_dlmm_fees` (Jupiter best-path WSOL→■ by
   default, Jito/private submit when enabled, LZ ShareOFT to `hubGaugeReceiver`,
   then `receiveBridgedFees`) — separate from lottery OApp messages.
2. Meteora admin `token_badge` approval precedes DLMM pool creation
   ([form](https://forms.gle/59n3zDiGS2C6qMfd7) + Meteora Discord ticket;
   keeper cannot initialize the badge — requires Meteora `operator`).
3. Finalized hook logs are ingested into `solana_lottery_entry_inbox`; the ring
   buffer is reconciliation-only.
4. The submit worker resolves one canonical Solana wallet to its parent CSW,
   forces coverage to zero, and sends the V3 `source_event_id` payload through
   the authorized Solana lottery OApp. Twin and EOA submission are forbidden.
   The OApp implementation lives in `programs/lottery-relay-oapp`; its Store PDA
   is the authenticated LayerZero origin and it sends directly to the canonical
   Base LotteryManager OApp. Only the admin-configured operator may invoke a
   send, and the program validates the exact 224-byte V3 lottery payload before
   calling Endpoint V2.
5. A submit requires both infrastructure flags and a per-creator
   `solana_creator_relay_config.relay_enabled=true` row.
6. Base VRF and payout remain authoritative. Finalized `LotteryWinner` and
   `WinnerCallbackSent` events are correlated to the confirmed source inbox
   row, then a separately gated worker records one domain-separated WinId PDA
   on Solana and requires exact finalized readback of both the one-shot WinId
   record and the mutable latest-winner record. Dropped Base callbacks and
   conflicting replays quarantine instead of settling.

The Base Uniswap lottery and VRF path are unchanged by this architecture.

### Reviewed production OApp identity

The production lottery-OApp reuses the retired upgradeable program
`GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB`. Its current upgrade authority
is the existing Vultr signer
`7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`. A read-only inventory found
obsolete creator-hook bytecode, no program-owned accounts, and only the
original deployment in the program address history. The active OFT program
`6ste…` and active creator-share hook `Ejpzi…` must never be repurposed.

The original `Ggsd…` program-id keypair is not required for an upgrade; the
public ID and current upgrade-authority signer are sufficient. The separately
reserved `5gWfMtYb9zPQyNJMvmPRBgpqTnH8JrzbVRB99pQ5jqKA` keypair remains an
unused fallback in secure custody. Reuse does **not** mean the OApp is
configured: until the upgrade, Store/Peer/ULN/nonce bootstrap, Base
authorization, and all gates below pass, every B2 entry and winner path
remains disabled.

## Gates, in order

- [ ] Offline hook, KPR, frontend, and Base LotteryManager tests pass.
- [ ] Pre-LZ mint verification passes: Token-2022 owner, expected TransferHook,
      zero transfer fee, correct decimals, provisioner is current mint authority,
      and all hook PDAs initialize at finalized commitment. CreatorConfig must
      contain exactly the configured canonical Meteora DLMM program in its AMM
      allowlist; extra or unknown AMM programs fail closed.
- [ ] Post-LZ verification proves the OFT Store now controls mint authority,
      Base↔Solana peers are reciprocal, and Registry4626 maps the same ShareOFT
      and exact B2 mint/OFT Store identity.
- [ ] Meteora admin `token_badge` is independently verified (request via
      https://forms.gle/59n3zDiGS2C6qMfd7 + Discord), then the B2 DLMM
      pool account is verified at finalized commitment with base fee 690 bps,
      max fee ≤ 690 bps, and `CollectFeeMode.OnlyY`. Protocol LP positions for
      `SOLANA_B2_PROTOCOL_POSITION_OWNER` must have on-chain `feeOwner` equal to
      `SOLANA_B2_JACKPOT_FEE_OWNER` (alias `SOLANA_DLMM_FEE_OWNER`). The
      persisted readiness record must retain a passing `meteora_token_badge`
      check.
- [ ] With submit off, one approved live B2 buy emits exactly one authenticated
      `LotteryEntryRecorded` buy-path event.
- [ ] Finalized ingest is enabled alone and that event appears once in the
      durable inbox; backlog/ring residue is reconciled.
- [ ] Solana lottery OApp peer is deployed and independently reviewed;
      the Store endpoint field equals the canonical LayerZero Endpoint V2
      program, the Store operator equals the funded payer, and
      `authorizedRemoteOFTs(30168, storeBytes32)` is verified on the canonical
      LotteryManager. The V3 payload must bind `source_event_id`.
- [ ] Base↔Solana ULN is verified as 3-of-5 optional DVNs using the current
      shared active metadata set; no single-DVN fallback is configured.
- [ ] A no-submit dry run passes with identity, pricing, amount scaling, and
      coverage `0` evidence.
- [ ] A devnet canary is run only after explicit approval and passes.
- [ ] A funded mainnet canary is run only after separate explicit approval and
      passes with one Base receipt and no duplicate on replay.
- [ ] Explicit production approval is recorded with a durable approval ref.

Only then may an operator temporarily set
`SOLANA_B2_PRODUCTION_ACTIVATION_ENABLED=1` and call machine-auth
`POST /api/keeper/solana/activate-b2-relay` with every evidence field true for
the exact mint, including separate `oappDvnPolicyConfirmed=true` evidence for
the finalized 3-of-5 metadata/address match. Turn the activation flag back off
immediately. Infrastructure submit flags are a separate change window.

Boolean claims alone cannot activate a creator. The request must also carry
durable references for offline validation, the devnet rehearsal, the 3-of-5
DVN verification, failure/retry verification, the funded-mainnet-canary
approval, and the final production approval. It must bind the exact canonical
mainnet hook `sourceEventId`, LayerZero GUID, Base transaction hash, and Solana
winner-settlement signature. The activation update succeeds only when the
database independently contains: the matching consumed single-use canary
authorization; exactly one confirmed, zero-coverage buy-path inbox row for the
GUID and Base transaction; and a confirmed winner settlement/readback joined
to that same inbox row. Missing or conflicting durable evidence leaves
`relay_enabled=false`.

The readiness endpoint is read-only unless the operator supplies
`persistEvidence=true` while `SOLANA_B2_READINESS_PERSIST_ENABLED=1`. Enable
that flag only long enough to record a completed verification result; any
later persisted failed reconciliation automatically disables the creator.

### LayerZero failure and retry semantics

The receipt worker never resends a packet from Solana after a GUID has been
recorded. `FAILED`, `SIMULATION_REVERTED`, `PAYLOAD_STORED`, and `BLOCKED` are
stored as retryable delivery evidence while the inbox row remains `submitted`.
Repair the destination gas/OApp configuration and retry `lzReceive` for the
already-verified packet (permissionless through LayerZero Scan or Endpoint V2);
the next receipt pass confirms that same GUID. `APPLICATION_BURNED`,
`APPLICATION_SKIPPED`, `MALFORMED_COMMAND`, and `UNRESOLVABLE_COMMAND` are
terminal and quarantine the inbox row. A retry must prove one Base entry for
the source event; it must never create a second Solana send.

## Default-off controls

```text
SOLANA_ORCHESTRATOR_LOTTERY_INGEST_ENABLED=0
SOLANA_ORCHESTRATOR_LOTTERY_SUBMIT_ENABLED=0
SOLANA_ORCHESTRATOR_LOTTERY_CONFIRM_ENABLED=0
SOLANA_ORCHESTRATOR_LOTTERY_WINNER_SETTLE_ENABLED=0
SOLANA_ORCHESTRATOR_CLAIM_DLMM_FEES_ENABLED=0
SOLANA_ORCHESTRATOR_FORWARD_DLMM_FEES_ENABLED=0
SOLANA_OFT_FORWARD_ENABLED=0
SOLANA_LOTTERY_INGEST_ENABLED=0
SOLANA_LOTTERY_CONFIRM_ENABLED=0
SOLANA_LOTTERY_WINNER_WORKER_ENABLED=0
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0
SOLANA_LOTTERY_LZ_TRANSPORT_READY=0
SOLANA_B2_PRODUCTION_ACTIVATION_ENABLED=0
SOLANA_B2_CANARY_AUTHORIZATION_ENABLED=0
SOLANA_B2_READINESS_PERSIST_ENABLED=0
SOLANA_LOTTERY_OAPP_SEND_ENABLED=0
SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED=0
```

The broad `SOLANA_ORCHESTRATOR_EXECUTE=1` switch cannot enable either B2 worker.

### Single-use canary lane

Production creator relay rows remain disabled during both canaries. After the
approved buy is present as one finalized `pending` inbox row and readiness is
`verified`, an operator may temporarily enable
`SOLANA_B2_CANARY_AUTHORIZATION_ENABLED` and machine-auth
`POST /api/keeper/solana/authorize-b2-canary` with the exact `sourceEventId`,
exact mint, durable approval reference, and a TTL of at most 60 minutes. The
submit worker atomically consumes that authorization once. It cannot authorize
a different event, an already-consumed event, a non-buy event, an enabled
production creator, or an unverified route. Turn the authorization flag back
off immediately.

The canary lane does **not** require setting
`SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1`: the consumed authorization is the
only temporary bypass for that production relay flag. The submit worker still
requires the LayerZero transport-ready, canonical peer, sender-authentication,
and Base LotteryManager gates, and it releases unauthorized rows back to
`pending` rather than quarantining them. Keep the production relay flag at `0`
through both canaries and until the complete acceptance checklist is approved.
During the canary window, the orchestrator may temporarily set
`SOLANA_ORCHESTRATOR_LOTTERY_SUBMIT_ENABLED=1` together with
`SOLANA_B2_CANARY_AUTHORIZATION_ENABLED=1`; restore both to `0` immediately after
the single authorized event is reconciled.

## Rollback

Set submit and relay flags to `0`, disable the creator relay row, and stop the
submit worker. Preserve the inbox, cursor, quarantine, and receipts. Do not
downgrade the hook program and do not revive Twin.

The durable-inbox, receipt, winner-settlement, and canary-authorization
migrations are additive and must be applied before the first B2 canary. Applying
them is a separate database mutation approval (it creates no Solana accounts
and spends no SOL):

```bash
pnpm -C frontend db:migrate
pnpm -C frontend ops:preflight-solana-lottery-relay-state
```

The linked project records some older migrations with MCP-generated history
versions that are not present as filenames in this checkout. In that state,
`pnpm -C frontend db:migrate` can stop with
`LegacyMigrationMissingLocalError` before applying anything. Do not use
`--include-all`, repair migration history, or pull/overwrite the migration
directory as a shortcut: those actions can replay unrelated migrations.
After separate approval, apply only the five reviewed B2 files with the linked
SQL runner, in this order, then rerun the read-only relay-state preflight:

```bash
cd frontend
pnpm -C .. dlx supabase@latest db query --linked --file supabase/migrations/20260717090000_solana_lottery_entry_inbox.sql
pnpm -C .. dlx supabase@latest db query --linked --file supabase/migrations/20260717100000_solana_lottery_entry_inbox_attempt_fencing.sql
pnpm -C .. dlx supabase@latest db query --linked --file supabase/migrations/20260720010000_solana_lottery_transport_receipts.sql
pnpm -C .. dlx supabase@latest db query --linked --file supabase/migrations/20260720020000_solana_lottery_winner_settlement.sql
pnpm -C .. dlx supabase@latest db query --linked --file supabase/migrations/20260720030000_solana_b2_canary_authorizations.sql
pnpm ops:preflight-solana-lottery-relay-state
cd ..
```

This workaround applies only the reviewed additive B2 DDL; it does not repair
the historical migration ledger. Reconcile that ledger in a separately
reviewed database-operations change before relying on the generic migration
wrapper for future releases.

There is no destructive database rollback for these tables. If a canary fails,
disable the lanes and preserve the rows, checkpoints, and receipts for
reconciliation; only a separately reviewed forward migration may alter this
schema.

## Read-only preflight commands

These commands do not sign or send transactions. Run them with the exact
cluster, creator token, B2 mint, pool, and OApp addresses recorded in the
change ticket. A missing value is a failed check, not permission to infer one.

```bash
# Canonical hook bytecode (checks relay_entries + settle_fees classification).
pnpm -C frontend ops:verify-hook-mainnet-bytecode

# Payer balance and provisioner readiness. /healthz never funds or creates an account.
solana balance "$SOLANA_KEEPER_PUBKEY" --url "$SOLANA_RPC_URL"
pnpm -C frontend ops:preflight-solana-provisioner
# This must report extended_endpoints_enabled=true; a B1-only health response
# is insufficient and remains a failed B2 gate.

# Live devnet rehearsal prerequisites. This is read-only: it checks the
# devnet/local RPC, payer balance, and canonical hook deployment/keypair, but
# does not fund, deploy, mint, or initialize anything.
pnpm -C frontend ops:preflight-solana-devnet

# If the canonical program-id secret is unavailable, do not generate or
# substitute a different keypair. A local-only rehearsal can clone the
# already-verified mainnet executable instead; it validates PDA/setup behavior
# but does NOT satisfy the live-devnet canary gate:
solana-test-validator --reset \
  --url "$SOLANA_MAINNET_RPC_URL" \
  --clone-upgradeable-program "$CREATOR_SHARE_HOOK_PROGRAM_ID" \
  --ledger /tmp/4626-b2-hook-ledger
# Point SOLANA_DEVNET_RPC_URL at http://127.0.0.1:8899 and run the approved
# rehearsal only after explicitly approving this local-ledger mutation.
```

### Devnet-only surrogate exception

If recovery of the original canonical program-id keypair has been exhausted,
the operator may approve a **separate functional devnet rehearsal** at a new
program address. This is not a replacement for the canonical-address devnet
gate and it never authorizes production enablement.

The hook embeds its program ID for PDA ownership, so do not deploy the
canonical `.so` at the new address. Instead, create a fresh devnet-only
program-id keypair in the operator's secret store and use the isolated helper:

```bash
# Read-only preview; this neither creates the artifact nor sends a transaction.
SOLANA_DEVNET_HOOK_PROGRAM_ID=<fresh-devnet-program-pubkey> \
SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR=/secure/path/devnet-surrogate-program-id.json \
bash programs/creator-share-hook/scripts/deploy-devnet-surrogate.sh --dry-run
```

Before `--execute`, record the generated public key, artifact hash, payer,
cluster, and ~2.4 SOL program-rent buffer in the change ticket. New deploy
mode creates the devnet upgradeable Program and ProgramData accounts; rollback
is a devnet upgrade with the retained authority (rent is not fully reversible).
It refuses a mainnet RPC and the canonical `Ejpzi…` ID. An existing devnet
surrogate is never upgraded automatically: it needs both `--upgrade-existing`
and `--execute`, and the helper verifies that the payer is its on-chain upgrade
authority first. After deployment, set only these
devnet-specific variables for the rehearsal process:

```bash
SOLANA_DEVNET_HOOK_PROGRAM_ID=<fresh-devnet-program-pubkey>
SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR=/secure/path/devnet-surrogate-program-id.json
SOLANA_DEVNET_HOOK_SO_PATH=/secure/artifacts/creator-share-hook-devnet.so
# Optional. Default is beside the new artifact and must not already exist.
# The helper dumps the old devnet program here before an approved upgrade.
SOLANA_DEVNET_HOOK_ROLLBACK_SO_PATH=/secure/artifacts/creator-share-hook-devnet-preupgrade.so
```

Then re-run `pnpm -C frontend ops:preflight-solana-devnet` and, with separate
approval, `pnpm -C frontend ops:pipe-b-devnet-rehearsal -- --live-devnet approve`.
When `SOLANA_DEVNET_HOOK_PROGRAM_ID` is set, Pipe B first runs
`ops:verify-hook-devnet-surrogate-bytecode`; it requires the deployed
executable bytes to equal `SOLANA_DEVNET_HOOK_SO_PATH` and to contain the
canonical relay plus C-01 hardening markers. A preallocated ProgramData account
may retain trailing zero bytes, which are reported and allowed; any differing
or nonzero trailing bytes fail the gate. A named program with merely similar
entry points is a failed rehearsal gate.
The mainnet program ID, mainnet bytecode verification, OApp sending, winner
settlement, and `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` remain unchanged.

```bash
# Hook program, mint, creator-config, pending-entry and winner PDAs.
# This strict read-only command checks finalized account ownership, canonical
# sizes, mint extensions/config, OFT-store authority, and Meteora mint
# alignment plus the Meteora admin token_badge PDA/discriminator/mint binding.
# It fails if the exact B2 mint/pool env is missing.
pnpm -C frontend ops:preflight-solana-b2-onchain
solana program show "$CREATOR_SHARE_HOOK_PROGRAM_ID" --url "$SOLANA_RPC_URL"
solana account "$SOLANA_B2_MINT" --output json --url "$SOLANA_RPC_URL"
solana account "$SOLANA_CREATOR_CONFIG_PDA" --output json --url "$SOLANA_RPC_URL"
solana account "$SOLANA_PENDING_ENTRIES_PDA" --output json --url "$SOLANA_RPC_URL"
solana account "$SOLANA_WINNER_RECORD_PDA" --output json --url "$SOLANA_RPC_URL"
solana account "$SOLANA_EXTRA_ACCOUNT_META_LIST_PDA" --output json --url "$SOLANA_RPC_URL"
# Require canonical hook ownership and exact sizes: 501 / 12352 / 89 / 86 bytes.
# Decode CreatorConfig and compare creator mint, hub creator/share bytes32, fee_bps=0,
# lottery_enabled=true, and (when configured) keeper authority.

# Meteora pool account. Decode tokenXMint/tokenYMint and require one side to be
# the exact SOLANA_B2_MINT (the other must be the approved quote mint).
solana account "$SOLANA_METEORA_POOL" --output json --url "$SOLANA_RPC_URL"

# Solana OApp program/Store/peer and Base LotteryManager peer authorization.
solana program show "$SOLANA_LOTTERY_OAPP_PROGRAM_ID" --url "$SOLANA_RPC_URL"
solana account "$SOLANA_LOTTERY_OAPP_STORE" --output json --url "$SOLANA_RPC_URL"
solana account "$SOLANA_LOTTERY_OAPP_PEER_PDA" --output json --url "$SOLANA_RPC_URL"
pnpm -C frontend ops:preflight-solana-lottery-oapp
# This also reads the finalized ULN send config for the Store, requires
# requiredDvnCount=0, optionalDvnCount=5, optionalDvnThreshold=3, and matches
# every on-chain Solana DVN address to the current active metadata set.
# Live metadata policy input: five active v2 DVNs shared by Base and Solana.
# The OApp preflight joins this read-only policy input to the finalized ULN
# addresses; no single-DVN or stale-address fallback is accepted.
pnpm -C frontend ops:preflight-solana-lz-dvns
# SOLANA_LOTTERY_OAPP_STORE_BYTES32 is the 32 raw bytes of the derived Store
# PDA, not SOLANA_LOTTERY_OAPP_PEER_BYTES32 (the Base receiver).
cast call "$LOTTERY_MANAGER" 'authorizedRemoteOFTs(uint32,bytes32)(bool)' 30168 "$SOLANA_LOTTERY_OAPP_STORE_BYTES32" --rpc-url "$BASE_RPC_URL"

# Durable inbox, receipt checkpoint, winner settlement/readback, and one-shot canary state.
pnpm -C frontend ops:preflight-solana-lottery-relay-state
# This is SELECT-only and fails when the database or any required B2 table is unavailable.
```

### Isolated transport rehearsal route

The hook/PDA rehearsal on Solana Devnet is not an end-to-end LayerZero proof:
the default lottery OApp is deliberately compiled to send only to Base mainnet
EID `30184` and the canonical LotteryManager. Never loosen that artifact or
point it at a test receiver.

An end-to-end test instead uses a fresh test-only OApp program ID compiled with
`--features test-route`. That artifact is bound to Base Sepolia EID `40245`
and must use a separately deployed Base Sepolia test receiver. Its Store
must be authorized by that receiver for Solana Devnet EID `40168`. The
test-route preflight requires LayerZero metadata to confirm explicitly supplied
testnet DVN names and threshold. If the metadata service does not publish
matching Solana Devnet and Base Sepolia records, the gate fails closed and the
test deployment is blocked. Production remains the
separately verified 3-of-5 Base ↔ Solana route.

Before a test route deployment, run the read-only source-default audit. It
requires a metadata-verified multi-DVN policy and confirms that the existing
default DVN is part of it. Solana Devnet's default is currently 1-of-1, so a
test-only Store must later receive the verified custom policy before a send;
that is not a reason to weaken the policy or block deployment of the isolated
receiver that is needed before the Store can be wired:

```bash
SOLANA_LOTTERY_TEST_DVN_NAMES=<current-testnet-DVNs> \
SOLANA_LOTTERY_TEST_DVN_THRESHOLD=<current-threshold> \
  pnpm -C frontend ops:preflight-solana-lottery-test-route
```

The Base Sepolia target for this rehearsal is the receive-only
`LotteryRelayTestReceiver4626`, not a copy of the live lottery manager. It
accepts only the Solana Devnet peer, validates the fixed V3 payload with zero
coverage, and stores an idempotent source-event receipt. It has no send, VRF,
payout, or token function. Test deployment requires a distinct approval: it
creates immutable Base Sepolia bytecode and spends quoted test ETH. Before
approval, record the artifact hash, endpoint, owner, address, and gas quote.
Rollback is an owner transaction removing peer `40168` and revoking the Store
authorization; deployed code itself cannot be removed.

Use this read-only quote immediately before requesting that approval. It
requires the intended public owner and, when available, the public deployer
address; it never reads a private key or submits a transaction:

```bash
pnpm -C frontend ops:quote-lottery-relay-test-receiver-deploy
```

The only approved deployment mechanism is the chain-locked
`DeployLotteryRelayTestReceiver4626` script. It refuses any chain other than
Base Sepolia (`84532`) and verifies the local LayerZero endpoint EID is
`40245`. Deployment does not configure a peer or authorization mapping; those
are separately approved changes after the Solana Store has been created.

No test route deployment, Store initialization, Peer configuration, receiver
authorization, or send is covered by preflight approval. Each is an explicit
test-network mutation boundary. Keep every production relay, OApp-send, and
winner-settlement flag at `0` throughout.

The current official test-only policy is 2-of-2, not 2-of-3:

| Provider | Solana Devnet DVN | Base Sepolia DVN |
| --- | --- | --- |
| LayerZero Labs | `4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb` | `0xe1a12515f9ab2764b887bf60b923ca494ebbb2d6` |
| P2P | `29EKzmCscUg8mf4f5uskwMqvu2SXM8hKF1gWi1cCBoKT` | `0x63ef73671245d1a290f2a675be9d906090f72a8d` |

The preflight reads these from LayerZero's official deployments metadata and
requires both sides to remain active V2 records. At the Store configuration
boundary, set the source and destination paths to the same 2-of-2 policy,
with the addresses in LayerZero's required alphabetical order. Re-run both the
test-route source audit and the full OApp preflight after wiring; a default
1-of-1 path is never sufficient for a send or for any production gate.

### Initial rehearsal inventory (before wiring, 2026-07-21)

The isolated Base Sepolia receiver is deployed at
`0x46F77a5E204DbD9A31870E819e671914B40477a3` in transaction
`0x324f68604527d6ed4d9392c1ce0d01a2bf85a9a17cbb5d2721bf3ddc5f057aed`.
It has the expected Base Sepolia Endpoint V2 and test owner, but its Solana
Devnet peer remains zero and it has no authorized remote Store or receipts.
The isolated Solana Devnet test-route OApp is deployed at
`AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG` in transaction
`4CnRPgyfbgErKKBRrzucvq2PZo7YhKP5noGr7TkwV7sj8FTUziMjvGZinneFUBzC9rWynmtFUfEogSvTX6wy1wuj`.
Its ProgramData account is `AyxRvMKF1oGRrWqoVXGPFS9dN2jJgB5ZtCGkN4qTRpee`,
its upgrade authority is `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`,
and its finalized executable SHA-256 is
`9dae885e08b0962c3b335139ce29c9a8d90dd7d76c8fc47fede4376b29eccef1`.
Its Store PDA `4WppNAVy7pZfSShZmK8aAjtwrc2nTTfi4gwaN3kXpUpV` and Endpoint
OApp registry `FQKSVU4AK4f7nV3vDomEpWhcVRT6wy8q7q5eu66mr9Uy` were initialized
in Devnet transaction
`4iKe6NJjYq7ztkD7zRWdW2ks9tWa4nqfJ2PcjmZyBGY8EDcRsrhZ8MrxkirBn7atKa5Vem3Eede5Nys4mDwGybu6`
for a 5,000-lamport transaction fee. The Store records
`7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY` as both admin and operator;
the Endpoint registry delegate is the same address. The test-route Peer PDA
`Gf74jCrPWx16yTe5TBG2g8khNeGwowKrvpnKSnJbmM6r` was initialized in Devnet
transaction
`2h6vdH3PdMDArZybRLpGzwABfqTBkxatTALYp4rbMMCowsqDFbBra8ExBBmY8g2TYQUof4qVAGngF4y4TTypTagD`
for a 5,000-lamport transaction fee. Its finalized 557-byte account is owned
by the test OApp and binds the Base Sepolia receiver as
`0x00000000000000000000000046f77a5e204dbd9a31870e819e671914b40477a3` with
the 200,000-gas Type-3 executor option
`0x00030100110100000000000000000000000000030d40`. The source custom ULN
configuration is recorded below. Base receiver authorization, reciprocal Base
peer, and any packet remain absent, so the route remains unable to send.

The legacy DVN metadata endpoint was found to return mainnet records even when
asked for a testnet route, so it could not validate the original candidate
list. The official deployments metadata identifies the shared non-deprecated
policy as `LayerZero Labs,P2P` with a threshold of `2`. The finalized Solana
Devnet default ULN has one required DVN, so a custom 2-of-2 Store
configuration is required after Store creation and before any send. Do not
lower the threshold merely to make the check pass.

The production OApp preflight is also blocked until the production
`SOLANA_LOTTERY_OAPP_PROGRAM_ID` and operator are supplied and the finalized
program/Store/Peer plus Base authorization are verified. A missing value is a
failed production gate; it is not a reason to deploy or infer configuration.

The Base Sepolia receiver is deployed at
`0x46F77a5E204DbD9A31870E819e671914B40477a3` from creation transaction
`0x324f68604527d6ed4d9392c1ce0d01a2bf85a9a17cbb5d2721bf3ddc5f057aed`.
Its immutable endpoint is `0x6EDCE65403992e310A62460808c4b910D972f10f`,
its owner is `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD`, and it remains
inert with a zero Solana Devnet peer and no relay receipts. Its locally
compiled Solc `0.8.30+commit.73712a01` creation code is 3,690 bytes with
SHA-256 `32bc9158469cb328f8c445e8f9382bf37a8827414ed83e36a3e0ebf59b79bbb1`.
The deployment receipt and runtime code hash must be read back after any
future environment recovery; deployment itself cannot be undone.

The Store, Peer, source/destination custom ULN, and Base Sepolia receiver
binding boundaries are complete. The test receiver is bound to the derived
Store bytes32 and authorizes it only for Solana Devnet EID `40168`; this does
not authorize any production OApp, packet send, winner settlement, or relay
entry. The next test-only mutation is a separately approved send-only packet
after a new quote and full read-only preflight.
The source-ULN dry run is:

```bash
SOLANA_LOTTERY_OAPP_ROUTE=testnet \
SOLANA_LOTTERY_OAPP_PROGRAM_ID=AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG \
SOLANA_LOTTERY_TEST_STORE_ADMIN=7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY \
SOLANA_LOTTERY_TEST_DVN_NAMES='LayerZero Labs,P2P' \
SOLANA_LOTTERY_TEST_DVN_THRESHOLD=2 \
  pnpm -C frontend ops:configure-solana-lottery-test-oapp-uln
```

The simulation passed with 84,772 compute units. It was executed as finalized
Devnet transaction
`2Uch1Z14kr5dssCBj6f8Kn6Ntf7esxR6xxmRtr8zRF8tQjLNBo42qCB3m5vWXJ7Lzx6k97fnFbXz9EufNjoevDqe`
(slot `477900600`, error `null`, 5,000-lamport fee). It created only the
source `SendConfig` PDA
`5Ze6mwWfigzfB7RkUcQqw5GiE1sD4XygFTmFZW5JJLCh` and `ReceiveConfig` PDA
`68CNCfMC6r5T8cuveGGMGfhpoDuVApSKbjguwrcKLtg2`, then apply the source
`SEND_ULN` policy with optional DVNs LayerZero Labs and P2P at threshold 2.
The 16,681,160-lamport (0.016681160 SOL) estimate was exact: 8,463,360 and
8,212,800 lamports of rent plus the transaction fee. Readback confirms the
sorted Devnet DVNs and threshold. An idempotent rerun submits no transaction.
This action did not change the Base receiver, bind or authorize a remote
Store, or send a packet. The complete route preflight now passes both
source/destination ULN gates and intentionally stops at
`oapp_receiver_peer_mismatch` while the Base Sepolia receiver remains inert.

Rollback is a separately approved
`pnpm -C frontend ops:configure-solana-lottery-test-oapp-uln -- --reset-to-default --execute`
transaction. It restores only the custom source `SEND_ULN` fields to zero and
therefore the Devnet default policy; the two config accounts remain, and the
Base receiver peer/authorization and all send flags remain unchanged. Base
receive-side DVN policy, reciprocal peer binding, and remote Store
authorization are later, separate mutation boundaries.

The Base receive-policy boundary had this read-only quote:

```bash
SOLANA_LOTTERY_OAPP_ROUTE=testnet \
SOLANA_LOTTERY_OAPP_PROGRAM_ID=AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG \
SOLANA_LOTTERY_TEST_DVN_NAMES='LayerZero Labs,P2P' \
SOLANA_LOTTERY_TEST_DVN_THRESHOLD=2 \
  pnpm -C frontend ops:configure-lottery-relay-test-receiver-uln
```

It locks the Base Sepolia receiver and owner, Endpoint V2, default receive
library, Store bytes32, metadata-selected non-read DVNs, and the owner/delegate
relationship before simulating only `EndpointV2.setConfig`. The 2026-07-21
quote succeeds for the receiver's current default 10-confirmation, LayerZero
Labs 1-of-1 policy and proposes the same no-required, optional
LayerZero Labs + P2P 2-of-2 policy as the Devnet source. The 141,340-gas quote
has a 0.00000098938 Sepolia ETH maximum at the observed fee cap. A second
LayerZero Labs metadata record marked `lzReadCompatible` is excluded: it is
not valid for ordinary push messaging. It was executed as Base Sepolia
transaction
`0xb1eb034a8a4300fde64cd3261b2f4efb3b5372841076a0b8ff5cf9529d461b19`
(block `44443899`, success, 139,069 gas, 0.000000834414 Sepolia ETH). The
`UlnConfigSet` event and app-level readback both confirm the exact sorted
2-of-2 policy. The original immediate readback raced the RPC's indexed state
and exited nonzero after the successful transaction; the script now retries
the readback before reporting a mismatch. This configuration call created no
account and neither bound the receiver peer nor authorized the Store. Its
separately approved rollback clears only this receiver app-level ULN config,
returning it to the Endpoint default.

The next separate binding/authorization boundary has this dry run:

```bash
SOLANA_LOTTERY_OAPP_ROUTE=testnet \
SOLANA_LOTTERY_OAPP_PROGRAM_ID=AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG \
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0 \
SOLANA_LOTTERY_OAPP_SEND_ENABLED=0 \
SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED=0 \
  pnpm -C frontend ops:configure-lottery-relay-test-receiver-binding
```

It confirms that the receiver still has a zero peer and no Store authorization,
then simulates two owner transactions: `setPeer(40168, Store)` at 48,216 gas
and `setAuthorizedRemoteOFT(40168, Store, true)` at 48,742 gas. The current
maximum combined quote is 0.000000678706 Sepolia ETH. The script refuses any
enabled relay-entry, OApp-send, or winner-settlement flag and fails if the
receiver already has a different peer. No account is created. If separately
approved and the second call fails, the first call alone remains fail-closed
because the Store is still unauthorized. Rollback is another separately
approved pair: revoke authorization first, then reset the peer to zero.

That boundary was approved and executed on 2026-07-21 as two Base Sepolia
owner transactions from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD`:

| Action | Transaction | Block | Gas used | Actual Sepolia ETH |
| --- | --- | ---: | ---: | ---: |
| `setPeer(40168, Store)` | `0xc968f0c923d2e54887dd70dab50be306a9f118a2d141882674f5bef879f7a545` | `44444380` | 47,830 | `0.000000286980` |
| `setAuthorizedRemoteOFT(40168, Store, true)` | `0x8b8eb69bc201431be889cd245b813a48564f304cd922dafc53fe55d3e2ebc313` | `44444381` | 48,355 | `0.000000290130` |

Both receipts have `success` status and finalized readback returns the exact
Store bytes32 peer plus `authorizedRemoteOFTs(40168, Store)=true`. The combined
actual cost was `0.000000577110` Sepolia ETH, below the approved quoted maximum
of `0.000000678706`. The first execution initially reported a postcondition
mismatch due to public-RPC indexing lag after both receipts had succeeded; the
helper now polls finalized state before reporting a mismatch and includes the
submitted hashes in any genuine postcondition error. No Solana account or
transaction was created by this boundary.

For the pool and peer accounts, retain decoded field evidence; account
existence alone does not pass mint alignment or peer authorization.

### Completed isolated transport rehearsal (2026-07-21)

This section supersedes the initial-inventory statements above that describe
the test receiver as inert. It records only the isolated Devnet -> Base
Sepolia rehearsal; it is not evidence for a production B2 mint or a permission
to enable any production flag.

The test Store now has an explicit ULN send-library configuration, created by
Devnet transaction
`65MT1srrZuzjaj6t8Ccj6nJBxAx3BLgUodnieZGC5DeAekRFwEi5fETL4LK2Xtj3L5FarY2z1jWwM2WxkPV7cD9m`.
It created the Endpoint SendLibraryConfig PDA
`2C3wC7wusXdvdtnkUPC4Q6jmoyiuUM2L55s5sNeXAxb8`, selected ULN program
`7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH`, and cost an estimated
`0.001181240 SOL` (`1,176,240` lamports of rent plus a `5,000`-lamport fee).
The default endpoint library is not accepted by preflight; it requires this
explicit configuration.

Devnet transaction
`2FgTYiQsWKcDWjYmBfn8bTp2E37aJ8RKMjapzvAWVeAsb43UXReR1a9iYJeRy9fPVfN11cDwWYaaSkGr8uZ11xpX`
initialized the durable Endpoint nonce pair for this exact Store, destination,
and Base Sepolia peer:

- outbound nonce `DYPMebDtMjRAxxJ5XErhkPktDTNrLLBMvD38BfduXKsW`;
- pending-inbound nonce `9tk8tdKCaRRgBeaJn1kzvoVWKaCnG32u9SEqwCCCBNW`.

Its simulated cost was `0.002051240 SOL` (`2,046,240` lamports of rent plus a
`5,000`-lamport fee). These are durable Endpoint path accounts, so they have
no close/unset action in this runbook. The full OApp preflight now fails closed
when either nonce account, the explicit send library, a peer binding, a remote
authorization, or the exact bilateral 2-of-2 ULN policy is absent.

The send-only rehearsal used source event
`solana-devnet-test-route:packet-v1-20260721`, source-event digest
`0xa301a8840f3cb77a2398cb10c76227dfebdf02dbe61ffbc9ca1c0accf4a68063`, and
receipt key
`0x10029efdb75c228cc3efc5e2606376b1d3dd7daa009511c6ae94b5f7f5255260`.
It used a value-free V3 payload (`buyer=0x...01`, `token=0x...02`, `amount=1`,
coverage `0`) with a hard native-fee cap of `532,777` lamports and an estimated
total Devnet bound of `537,777` lamports (`0.000537777 SOL`). The source send
was simulated first at 232,732 compute units; no production relay, OApp-send,
or winner-settlement flag was enabled.

| Test | Devnet source transaction | LayerZero GUID | Base Sepolia readback |
| --- | --- | --- | --- |
| First delivery | `5pMKcoNXutpYMStUUnb69BXAhVce6pydhrHAXdGDjkqR7WtiAMx7dyspSFbAJuNfCgdespQiyxtjxjZKiTbrRuH5` | `0xe3df4ce87faee74fda2c14aebb4749189e80b2edc49ce521e3be25f9e2f24d91` | `receivedCount=1`, `duplicateCount=0`, `rejectedCount=0`; receipt fields and GUID read back exactly. |
| Deliberate same-source replay | `59WsqC4HLuaC6gYeVuxbbDFNyEPWT1QSP1MMdFK2NHhswzyVdgrKj98UZfrkPgaZqwMVTfUh8t8XV1ttcYAeuLYD` | `0xf9218af7cd350a0fe95a2e3d909ea0a1653b265f08e186f2efa90c6fdd68530e` | `receivedCount=1`, `duplicateCount=1`, `rejectedCount=0`; the first receipt GUID stayed unchanged. |

The replay command is deliberately separate and requires both
`--allow-duplicate-source-for-replay` and `--execute`; normal sends refuse an
already-received source event. Test-route packet rollback is to leave all
production controls at `0`; if the isolated route must be disabled, the Base
Sepolia owner revokes the Store authorization and clears peer `40168`.

### Historical mainnet readiness audit (2026-07-21, before OApp bootstrap)

This snapshot records the fail-closed state before the production OApp was
upgraded and bootstrapped. It is superseded by the finalized bootstrap record
below; retain it as evidence that no production identity or route was inferred
before the separately approved mutations.

The canonical creator-share-hook program passes bytecode verification at
`EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`: it is owned by the
Upgradeable Loader, has ProgramData
`DojrYy5obEk2w9ZMpX1bLFHU4rrZqYQsZJZaXFxFGKFU`, upgrade authority
`7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`, SHA-256
`262ffe3127200be204d514b8a30f91cfffdb05edac91393a91c2eef9c0e62084`, and
the canonical `relay_entries` / `settle_fees` classification. The Vultr
provisioner health endpoint also passes: bearer authentication, funded payer,
Solana RPC, and extended endpoints are all ready.

This is not enough for B2 production. The read-only audit found the following
hard failures, all intentionally fail-closed:

- `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` is confirmed. Do not change it.
- `SOLANA_B2_MINT` and `SOLANA_METEORA_POOL` are unset, so the finalized
  mint/PDA/Meteora-alignment preflight stops at `missing_solana_b2_mint`.
- No production `SOLANA_LOTTERY_OAPP_PROGRAM_ID` or operator is configured, so
  the production OApp preflight stops at `missing_required_oapp_preflight_env`.
- The repository's intended production OApp address
  `8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC` has no account on Solana
  mainnet, and no program-ID keypair for it is present in this checkout. Do
  not generate a replacement program address implicitly: a new identity would
  require a reviewed production-artifact build, retained program-ID keypair,
  a new Store/Peer/Endpoint nonce path, reciprocal Base LotteryManager peer
  binding and remote authorization, and a freshly verified 3-of-5 ULN policy.

Accordingly, at that historical audit point no mainnet B2 mint, Hook PDA,
OApp, peer, ULN configuration,
Meteora pool, liquidity, canary, or production flag has been created or
enabled by this rehearsal. The database relay-state preflight is healthy but
empty, as expected before a production canary.

### Production OApp bootstrap procedure (completed; retained for audit/rollback)

The production OApp deployment and each subsequent account/configuration
boundary are implemented as separate, mainnet-genesis-locked commands. They
are deliberately unable to enable
`SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED`, OApp sending, or winner
settlement. A general production approval does not turn missing identity or
economic inputs into safe defaults.

Before even a dry-run upgrade, prove that `Ggsd…` is an Upgradeable Loader
program whose current authority is the exact Vultr signer `7Qi3…`. The
repository `target/deploy/lottery_relay_oapp-keypair.json` derives to the
isolated Devnet test identity `AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG`;
it must never be used on mainnet. The source fallback `8Xd…` has no on-chain
program. The unused reserved identity `5gWf…` remains in secure custody but is
not part of this upgrade. An upgrade of `Ggsd…` does not require its original
program-id keypair.

```bash
solana program show GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB \
  --url "$SOLANA_MAINNET_RPC_URL"

LOTTERY_RELAY_OAPP_PROGRAM_ID=GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB \
SOLANA_KEYPAIR_PATH=/secure/path/upgrade-authority-and-payer.json \
SOLANA_MAINNET_RPC_URL=<paid-mainnet-rpc> \
  bash programs/lottery-relay-oapp/scripts/deploy-mainnet.sh
```

The deploy dry run produces the immutable artifact SHA-256, account mode,
temporary buffer rent, incremental persistent ProgramData rent, payer balance,
and rollback. The execute form requires a durable approval reference and
upgrades only the program and its ProgramData account. The CLI normally closes
its temporary buffer and returns that buffer rent to the deploy payer; it does
not return the persistent ProgramData increase or transaction fees. An upgrade
rollback requires the backed-up prior `.so` plus the retained upgrade
authority. Permanently closing `Ggsd…` is not an upgrade rollback because it
irreversibly destroys the selected production identity.

After finalized deployment, set the production program ID, Store admin,
Vultr operator/payer, and a reviewed Base `lzReceive` gas budget. Quote each
of these separately; `--execute` requires
`SOLANA_LOTTERY_OAPP_BOOTSTRAP_APPROVAL_REF` and sends only the named Solana
transaction(s):

```bash
SOLANA_LOTTERY_OAPP_ROUTE=mainnet \
SOLANA_MAINNET_RPC_URL=<paid-mainnet-rpc> \
SOLANA_LOTTERY_OAPP_PROGRAM_ID=<finalized-production-program> \
SOLANA_LOTTERY_OAPP_ADMIN_PUBKEY=<Store-admin> \
SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY=<Vultr-provisioner-payer> \
SOLANA_LOTTERY_OAPP_BASE_RECEIVE_GAS=<reviewed-gas> \
  pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=init-store

# Follow only after each previous finalized readback:
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=set-peer
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=set-send-library
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=configure-uln
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=init-nonce
```

`init-store` requires the upgrade authority and creates Store plus Endpoint
registry. `set-peer` creates only the canonical Base LotteryManager Peer PDA.
`set-send-library` creates only an explicit ULN library selection.
`configure-uln` creates endpoint config PDAs and applies the exact current
LayerZero Labs/Google/Nethermind/Horizen/Deutsche Telekom optional 3-of-5
source policy. `init-nonce` creates only the durable Endpoint nonce pair for
the canonical Base peer. The command refuses a pre-existing divergent account
instead of overwriting it. Account rent and transaction fees are simulated and
printed immediately before each execution.

Only after the Store and fixed Peer are finalized may the Base owner quote its
receive ULN and two independent binding calls. First quote and separately
approve the canonical 32-confirmation optional 3-of-5 receive configuration:

```bash
pnpm -C frontend ops:configure-lottery-relay-mainnet-uln
```

The binding command then checks the source Store/Peer, reads
the canonical Base manager and prints the Safe-compatible calldata. If an EOA
is currently the manager owner, execution additionally needs
`BASE_LOTTERY_MANAGER_OWNER_PRIVATE_KEY` and
`SOLANA_LOTTERY_OAPP_BASE_BINDING_APPROVAL_REF`.

```bash
pnpm -C frontend ops:configure-lottery-relay-mainnet-binding
```

The precise rollback is `setAuthorizedRemoteOFT(30168, Store, false)` followed
by `setPeer(30168, bytes32(0))`; it neither changes Solana accounts nor enables
any B2 flag. Re-run the OApp preflight after every boundary and proceed to a
paid B2 mint/pool buy only when all independent gates below remain passing.

### Production OApp bootstrap record (2026-07-22)

The reviewed production program `GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB`
now runs the send-only lottery OApp bytecode. Its Store is
`3xCH7Y5vKu3SpwicCHBHyU25DZG9xyyYcRqLw6Tos58M`; Store admin and operator are
both `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`. The canonical Base peer
PDA is `6fWEAgAeqBVio6SoEH23YcWJW4kjGNQhm1YKFfscct5j` and uses the reviewed
2,000,000-gas Type-3 receive option. The source send library, optional 3-of-5
ULN policy, and Endpoint nonce pair all have finalized readback.

| Boundary | Finalized transaction |
| --- | --- |
| Program upgrade | `hGmH3rzXosvvNUye9jmBVvc9gkQpTjTwzh9Gvg6wPbvpieddHvdcC4tzgfgeQb2hGHexAZS8by4eVktbobMZaZf` |
| Store initialization | `5iLpvZQcoyab3cA13vjaPCTZBPRNqY64Uo7FSDZdXSTvM41fvLrP6YhNqAVVGBRMWfJZx3u4eimgt4ATg2GhLHAn` |
| Canonical Base peer PDA | `5usHpmZDptEtXJcJSMTaedW5JJn54H2C43hy1ELgBS4rXPXE4YyyDtteebeCQTg2pdue6Wm2BoF9tyHjgUuVryEK` |
| Explicit send library | `49G2cz8p8S9Mg4oQrML3HXQBdQJtNQ9g1KYQ74XpMVGXzqyxGwyNiuHziTqVGMQnfhqYGFaUiV7LQqMu1rWBfEdU` |
| Source optional 3-of-5 ULN | `4Vh7JaKMVL8VecmdbZN3orZza6fxtdURiT5x1eHQ945djY9jjMLBMNRFtXRvZW8a7NdV5dgZRRPGdF694XLRzv6e` |
| Endpoint nonce pair | `qtz53rg89xMyNjnZdxgEW8DEZja9iksZm7RFxE3jTsqoqNJHNjLuwMrqvn4GKunzLkMvGNYMT6rSN5nL7h6uMND` |

The Base LotteryManager receive ULN was then changed in separately approved
transaction
`0xb2204a17e4b921c1597343b0afb9fb52305d8271e07424b1733f028b6509e483`
(block `48959814`, status success, `209,144` gas) from the endpoint default four
required DVNs to no required DVNs plus the exact current optional 3-of-5 set.
The raw app configuration inherits confirmations and finalized effective
readback remains exactly 32 confirmations. This transaction did not set a
peer, authorize the Store, send a packet, or enable any worker.

The separately approved Base binding boundary then completed with two
zero-value owner transactions:

| Action | Transaction | Gas used | Actual Base ETH |
| --- | --- | ---: | ---: |
| `setPeer(30168, Store)` | `0xfdac97a26e90dac2024dae9ea7a3805f3488738fb7727a0114aded18cefe8967` | `48,182` | `0.000000289644220481` |
| `setAuthorizedRemoteOFT(30168, Store, true)` | `0xe275a2fd2fd0853aa25d3d96488ae422a6c07bb2165b5af79e1b5544a9035fed` | `51,479` | `0.000000309429688664` |

Finalized readback returns the exact Store bytes32 peer and
`authorizedRemoteOFTs(30168, Store)=true`. The combined actual cost was
`0.000000599073909145 ETH`, below the approved maximum of
`0.00000070308 ETH`. The binding command is idempotent and now additionally
locks both the reviewed `Ggsd…` production program and the canonical Base
Endpoint V2 address.

The full production OApp preflight passes the source and destination ULN,
program, Store, Peer PDA, send-library, nonce, operator, reciprocal Base peer,
and remote Store-authorization checks. This is transport configuration only:
all B2 relay, OApp-send, and winner-settlement flags remain `0`, and no packet
has been sent on the production route.

### Current local and Vultr service gate snapshot (2026-07-22)

The complete local release checks now pass: `pnpm -C frontend typecheck`,
`pnpm -C frontend lint`, `pnpm -C frontend validate:swap` (117 tests), the
Solana/keeper Vitest group (193 tests), the KPR relay group (26 tests), and deploy
guards. These checks do not create a Solana account or change a feature flag.

An authenticated, read-only check of the active Vultr environment found:

- `/opt/4626/provisioner.env` retains
  `SOLANA_LOTTERY_OAPP_SEND_ENABLED=0` and has no configured production OApp
  program ID;
- `/etc/4626/solana-keeper-orchestrator.env` retains
  `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`;
- neither active environment supplies a production OApp identity. Private
  keypair values were deliberately redacted during this check.

This service configuration is intentionally fail-closed and does not contradict
the finalized on-chain bootstrap record above. A read-only preflight succeeds
when supplied the reviewed public identity `Ggsd…` and operator `7Qi3…`:
program, Store, Peer, explicit send library, nonce pair, reciprocal Base
binding, remote authorization, and both 3-of-5 ULN directions pass. Before the
funded canary, deploy those two public values to the active Vultr service envs
while keeping OApp sending, winner settlement, submit, and production relay
flags at `0`, then restart and re-run health/preflight. Do not substitute the
Devnet-only `AfLeqn…` identity.

### Historical retired-program reuse audit (2026-07-22, before upgrade)

This audit and quote explain why `Ggsd…` was selected. The later production
bootstrap record supersedes its pre-upgrade bytecode and insufficient-balance
observations; retain them only as mutation-boundary evidence.

The upgrade authority `7Qi3…` controls three mainnet programs. `6ste…` is the
live LayerZero OFT implementation and `Ejpzi…` is the live creator-share hook;
both are excluded. `Ggsd…` is the retired candidate: its current executable is
obsolete creator-hook bytecode (SHA-256
`704c9b1de9b0703715fd39e74d8fb6fd5fdec2926fc4c4a9e660db1dbaa51f52`),
it owns zero accounts, and its address history contains only deployment
signature `3fScxVNj4DuqkMb7zDgKnh1MnkS81obM6zk2sTVNNiTCezbk3AZq72mtv9XPD62WAqpcctMmC9x9VQH4kps2XUNx`.

The reviewed replacement artifact is compiled for `Ggsd…`, is 374,616 bytes,
has SHA-256
`9e054cc56985fe3c4e1a5595428864f0600b3f82e27d9bd86a3925eb3856134b`, and
contains none of the `5gWf…`, `AfLeqn…`, or `8Xd…` identity bytes. It is staged
on Vultr at
`/opt/4626/artifacts/lottery-relay-oapp/GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB.so`.

The finalized upgrade quote is:

- temporary buffer rent: 2.608475760 SOL, expected back to payer `7Qi3…` after
  a successful CLI buffer close;
- incremental persistent ProgramData rent: 0.356240640 SOL;
- conservative transaction fee reserve: 0.050000000 SOL;
- required payer liquidity: 3.014716400 SOL;
- observed payer balance: 2.514560941 SOL;
- minimum guarded top-up: 0.500155459 SOL.

At that time the quote failed closed on insufficient balance. Funding the payer,
upgrading `Ggsd…`, or changing any service environment remains a separate
mainnet mutation boundary. Before execution, use a paid RPC tier capable of a
full Token-2022 mint-account scan and prove no live mint stores `Ggsd…` as its
TransferHook program. Public RPC 403 and Alchemy throughput 429 are failed
checks, not evidence of no references.
