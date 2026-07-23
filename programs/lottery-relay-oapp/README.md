# Lottery relay OApp

Send-only LayerZero V2 OApp for Solana-origin lottery entries. It accepts only
the fixed 224-byte V3 entry payload, forces the Base destination EID, and signs
Endpoint CPI sends with its Store PDA. This program does not replace the Base
LotteryManager or VRF path.

Security invariants:

- `init_store` requires the deployed program's upgrade authority, preventing a
  third party from front-running Store initialization.
- Store records separate admin and operator keys. Only the operator may send;
  only the admin may rotate that operator or configure the Base peer/options.
- Store records the canonical LayerZero Endpoint V2 program and clients reject
  any Store whose endpoint field does not match before quote or send.
- Base peer is fixed to EID `30184`; the peer bytes must be the canonical Base
  LotteryManager address left-padded to 32 bytes.
- The program rejects any non-canonical Base peer at configuration time and
  again immediately before quote/send, so a stale or corrupted Peer PDA cannot
  be used for an Endpoint CPI.
- The Base LotteryManager authorizes the derived Store bytes32 for Solana EID
  `30168`. Store bytes and Base receiver bytes are distinct identities.
- Empty, malformed, wrong-type, zero-address, zero-amount, nonzero-coverage,
  and zero-source-event payloads fail before the Endpoint CPI.

`anchor build --no-idl -p lottery_relay_oapp` produces the SBF artifact. Full
IDL generation is currently blocked by the pinned upstream LayerZero Endpoint
interface's IDL feature, so operational clients use explicit typed encoding.

## Production deployment and bootstrap

The production artifact is fixed to Solana mainnet EID `30168`, Base EID
`30184`, and the canonical Base LotteryManager. It is a separate identity from
the Devnet test OApp. The checked-out `target/deploy/*-keypair.json` is the
test-only program identity and is forbidden for a mainnet deployment.

The reviewed production identity is the retired upgradeable program
`GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB`. Read-only mainnet inspection
found that it is still controlled by upgrade authority
`7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`, contains obsolete creator-hook
bytecode, owns no accounts, and has no address history after its original
deployment. The live LayerZero OFT program `6ste…` and live creator-share hook
`Ejpzi…` are explicitly excluded from reuse.

An existing upgrade does not need the original program-id keypair: the public
program ID plus its current upgrade-authority signer is sufficient. The unused
fallback identity `5gWfMtYb9zPQyNJMvmPRBgpqTnH8JrzbVRB99pQ5jqKA` and its
keypair remain retained at
`/etc/4626/secrets/lottery-relay-oapp-mainnet-program-id.json`; do not deploy it
while the reviewed `Ggsd…` reuse path remains valid. Neither identity is a
configured OApp until the program, Store, peer, ULN, nonce, and Base binding
have all passed readback.

`scripts/deploy-mainnet.sh` is mainnet-genesis locked. Its default action only
builds the production artifact, prints its SHA-256/size, quotes the temporary
program-buffer rent, checks the payer balance and existing authority, and
submits no transaction. It rejects the Devnet test program ID and an occupied
non-program address. It also rejects a compiled artifact that does not embed
the reviewed program ID. `--execute` needs an approval reference and submits
only the program deployment/upgrade; it does not create a Store, Peer,
Endpoint configuration, Base authorization, hook mint, pool, or relay entry.

The deploy host does not need Rust/Anchor or the original `Ggsd…` program-id
keypair. Build and review the `.so` for that exact ID on a dedicated build
machine, record its SHA-256 in the change ticket, transfer that public artifact
to the deploy host, and make the helper require the same hash:

```bash
LOTTERY_RELAY_OAPP_PROGRAM_ID=GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB \
SOLANA_KEYPAIR_PATH=/secure/path/upgrade-authority-and-payer.json \
SOLANA_MAINNET_RPC_URL=<paid-mainnet-rpc> \
LOTTERY_RELAY_OAPP_SO_PATH=/secure/artifacts/lottery_relay_oapp.so \
LOTTERY_RELAY_OAPP_ARTIFACT_SHA256=<reviewed-sha256> \
  bash programs/lottery-relay-oapp/scripts/deploy-mainnet.sh
```

The helper still verifies that the binary embeds the exact program ID. A
prebuilt artifact is never accepted without its explicit reviewed SHA-256.
If the helper itself is staged outside a full repository checkout on the
deploy-only host, also set `LOTTERY_RELAY_OAPP_REPO_ROOT` to the directory that
contains its installed `kpr/` dependency tree; the helper otherwise derives
that root from its checked-out `programs/lottery-relay-oapp/scripts` location.

```bash
LOTTERY_RELAY_OAPP_PROGRAM_ID=GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB \
SOLANA_KEYPAIR_PATH=/secure/path/upgrade-authority-and-payer.json \
SOLANA_MAINNET_RPC_URL=<paid-mainnet-rpc> \
  bash programs/lottery-relay-oapp/scripts/deploy-mainnet.sh
```

After a separately quoted deployment, run exactly one action at a time through
the mainnet bootstrap helper. Every action requires finalized mainnet state,
the exact production OApp program, named Store admin/operator, a current
metadata-verified LayerZero Labs/Google/Nethermind/Horizen/Deutsche Telekom
3-of-5 policy, disabled entry/send/winner flags, and a simulation. The helper
defaults to a dry run; `--execute` requires
`SOLANA_LOTTERY_OAPP_BOOTSTRAP_APPROVAL_REF` and only performs the named
action.

```bash
# Production-only inputs; no values are inferred from a Devnet route.
export SOLANA_LOTTERY_OAPP_ROUTE=mainnet
export SOLANA_MAINNET_RPC_URL=<paid-mainnet-rpc>
export SOLANA_LOTTERY_OAPP_PROGRAM_ID=<deployed-production-program-id>
export SOLANA_LOTTERY_OAPP_ADMIN_PUBKEY=<Store-admin>
export SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY=<Vultr-provisioner-payer>
export SOLANA_LOTTERY_OAPP_BASE_RECEIVE_GAS=<reviewed-Base-lzReceive-gas>

pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=init-store
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=set-peer
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=set-send-library
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=configure-uln
pnpm -C frontend ops:bootstrap-solana-lottery-mainnet-oapp -- --action=init-nonce
```

Only after the Solana Store and fixed canonical Base peer exist can the Base
destination receive ULN and owner binding be quoted. Configure the Base
LotteryManager receive policy first; the command is dry-run by default,
requires the same current five-DVN metadata set, preserves 32 Solana
confirmations, and needs a separate approval reference for `--execute`:

```bash
pnpm -C frontend ops:configure-lottery-relay-mainnet-uln
```

Then quote the owner binding. It prints exact `setPeer` and
`setAuthorizedRemoteOFT` calldata (so a Safe can execute it), and uses an EOA
only when the supplied private key is the finalized LotteryManager owner. Its
rollback is revoke authorization first, then clear the peer; neither operation
enables any relay flag.

```bash
pnpm -C frontend ops:configure-lottery-relay-mainnet-binding
```

Re-run `pnpm -C frontend ops:preflight-solana-lottery-oapp` after every
boundary. A passing OApp preflight still does not authorize B2 entry ingestion:
the funded same-mint Meteora buy, durable inbox, exactly-once Base delivery,
winner settlement/readback, retry evidence, and all gates in
`docs/operations/solana-b2-production-gates.md` remain mandatory.

## Isolated Solana Devnet test route

The default artifact is production-only: it is fixed to Base mainnet EID
`30184` and the canonical Base LotteryManager. Do not change those constants
to make a test work.

For a full transport rehearsal, build a **separate program ID** with Cargo's
`test-route` feature. That artifact is fixed to Base Sepolia EID `40245`
and accepts only a nonzero left-padded EVM receiver in its Peer PDA. It cannot
use the canonical Base receiver. The test receiver must expose
`authorizedRemoteOFTs(uint32,bytes32)` so the read-only preflight can prove it
authorized the derived Store for Solana Devnet EID `40168`.

The repository's receive-only test implementation is
`LotteryRelayTestReceiver4626`. It is deliberately not a lottery manager: it
uses LayerZero's `OAppReceiver`, accepts only the Solana Devnet peer, checks
the exact V3 payload layout (including zero coverage), and records an
idempotent receipt keyed by source event. It has no send, VRF, payout, or token
function and must never be deployed on Base mainnet.

```bash
# Local build/test only: does not deploy or create Solana accounts.
cd programs/lottery-relay-oapp
cargo test --features test-route

# The program ID must be a fresh test-only keypair held in the operator secret
# store. Never use the canonical production program ID for this artifact.
LOTTERY_RELAY_OAPP_ID=<fresh-test-only-program-id> \
  anchor build --no-idl -p lottery_relay_oapp -- --features test-route
```

After an explicitly approved test deployment and peer configuration, run the
read-only route preflight with only test values:

```bash
SOLANA_LOTTERY_OAPP_ROUTE=testnet \
SOLANA_RPC_URL=<Solana-Devnet-RPC> \
SOLANA_LOTTERY_OAPP_PROGRAM_ID=<test-only-program-id> \
SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY=<test-payer> \
SOLANA_LOTTERY_TEST_RECEIVER=<Base-Sepolia-receiver> \
BASE_SEPOLIA_RPC_URL=<Base-Sepolia-RPC> \
SOLANA_LOTTERY_TEST_DVN_NAMES=<comma-separated-current-testnet-DVN-names> \
SOLANA_LOTTERY_TEST_DVN_THRESHOLD=<verified-threshold> \
  pnpm -C frontend ops:preflight-solana-lottery-oapp
```

Before any test deployment, inspect the source-side default ULN policy. This
command is read-only and must pass with a metadata-verified multi-DVN policy;
it does not treat a single default DVN as sufficient for the rehearsal:

```bash
SOLANA_LOTTERY_TEST_DVN_NAMES=<comma-separated-current-testnet-DVN-names> \
SOLANA_LOTTERY_TEST_DVN_THRESHOLD=<verified-threshold> \
  pnpm -C frontend ops:preflight-solana-lottery-test-route
```

After the OApp program and Base Sepolia receiver are separately deployed, use
the Store initializer in dry-run mode to simulate the single future Devnet
transaction. It creates only the Store PDA and the LayerZero Endpoint OApp
registry; it does not create a Peer PDA, configure DVNs, authorize the Base
receiver, or send a packet. `--execute` is a separate approval boundary.

```bash
SOLANA_LOTTERY_OAPP_ROUTE=testnet \
SOLANA_RPC_URL=<Solana-Devnet-RPC> \
SOLANA_LOTTERY_OAPP_PROGRAM_ID=<test-only-program-id> \
SOLANA_LOTTERY_TEST_STORE_ADMIN=<test-admin> \
SOLANA_LOTTERY_TEST_STORE_OPERATOR=<test-operator> \
  pnpm -C frontend ops:init-solana-lottery-test-oapp-store
```

The test route requires a current metadata-verified testnet ULN configuration.
The DVN names and threshold are explicit inputs precisely so an obsolete
testnet policy cannot be silently reused. If LayerZero metadata cannot confirm
those active shared Base Sepolia and Solana Devnet records, the preflight fails
closed and **no test deployment or send is authorized**. It does not satisfy the production 3-of-5 OApp gate,
does not permit a production send, and does not change any B2 default-off flag.

The Base Sepolia receiver deployment is a separate explicit approval. That
transaction creates immutable EVM code and consumes quoted Base Sepolia ETH;
record the compiler artifact hash, constructor endpoint, receiver owner, and
deployed address. Rollback is an owner transaction that removes the Solana
Devnet peer (`setPeer(40168, bytes32(0))`) and revokes its Store authorization
(`setAuthorizedRemoteOFT(40168, storeBytes32, false)`); deployment itself is
not reversible. Do not request this approval until the source-default and DVN
metadata preflights are both green.

When those gates are green and only after deployment approval, the chain-locked
script is:

```bash
# This is a Base Sepolia deployment transaction. It must be approved directly
# before running and only after its gas estimate has been recorded.
BASE_SEPOLIA_TEST_RECEIVER_DEPLOYER_PRIVATE_KEY=<testnet-only-key> \
LOTTERY_RELAY_TEST_RECEIVER_OWNER=<owner-or-safe> \
forge script script/DeployLotteryRelayTestReceiver4626.s.sol:DeployLotteryRelayTestReceiver4626 \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast -vvvv
```

The script refuses any chain other than Base Sepolia (`84532`) and checks the
local LayerZero endpoint reports EID `40245` before broadcast. It does not set
the peer or authorization mapping; those are independently approved state
changes after a Solana Store exists.

## Mutation boundaries

No command below is covered by a read-only preflight approval:

1. Program deployment creates/upgrades the executable ProgramData account and
   pays program rent. Record the reviewed program keypair, binary hash, quoted
   SOL, upgrade authority, and rollback authority before approval.
2. `init_store` creates the Store and LayerZero OApp registry state. Record the
   admin, operator, Endpoint program, account-rent quote, and derived Store.
3. `set_base_peer` creates/updates the Peer PDA and enforced type-3 options.
   Record the exact Base receiver bytes and options bytes.
4. Base `setAuthorizedRemoteOFT(30168, storeBytes32, true)` is a separate Base
   governance transaction. Rollback is the same call with `false`.
5. A send pays the quoted native LayerZero fee. Rollback is disabling the
   sender/submit flags and Base authorization; already delivered entries remain
   protected by their source-event replay key.

Each step requires explicit approval immediately before execution. Re-run
`pnpm -C frontend ops:preflight-solana-lottery-oapp` after every approved
configuration mutation.
