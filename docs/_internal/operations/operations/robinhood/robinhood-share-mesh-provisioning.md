# Robinhood Chain Remote ShareOFT Provisioning

Robinhood Chain (chainId `4663`, EID `30416`) is a **remote ShareOFT-only** expansion lane. Base remains the canonical hub for vault accounting, gauge, lottery, and strategy settlement.

## Prerequisites

- Base hub ShareOFT already deployed and wired for the creator (`isHub=true` on Base).
- `CreatorRegistry` on Base seeded with Robinhood chain config (`script/SeedCreatorRegistry.s.sol`).
- Robinhood RPC: `ROBINHOOD_RPC_URL` (default `https://rpc.mainnet.chain.robinhood.com`).
- LayerZero EndpointV2 on Robinhood: `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`.

## DVN policy (Base ↔ Robinhood)

Do **not** reuse Base ↔ Solana 6-of-9.

Shared DVNs (verify before wire):

| DVN |
|-----|
| LayerZero Labs |
| Nethermind |
| Horizen |
| BitGo |
| Canary |

Use **3-of-5 optional, 0 required** in `layerzero.config.ts`. Template: [`layerzero-robinhood-share-mesh.config.ts`](../../templates/layerzero-robinhood-share-mesh.config.ts).

```bash
curl -sS 'https://metadata.layerzero-api.com/v1/metadata/dvns?version=v2&stage=mainnet&chains=base,robinhood'
```

## Step 1 — Seed registry (Base)

```bash
forge script script/SeedCreatorRegistry.s.sol:SeedCreatorRegistry \
  --rpc-url base \
  --broadcast \
  -vvvv
```

Confirms `4663 <-> 30416` and Robinhood endpoint on Base `CreatorRegistry`.

## Step 2 — Seed bytecode infra (Robinhood)

Deploy the same universal bytecode store + CREATE2 deployer used on Base:

```bash
forge script script/DeployUniversalBytecodeInfra.s.sol:DeployUniversalBytecodeInfra \
  --rpc-url robinhood \
  --broadcast \
  -vvvv
```

Authorize the protocol treasury or ops EOA on `UniversalCreate2DeployerFromStore` before ShareOFT deploy.

## Step 3 — Deploy remote ShareOFT (Robinhood, **address parity**)

Robinhood ShareOFT must use the **same CREATE2 inputs as Base hub phase-1 finalize**:

| Input | Source |
|-------|--------|
| `CREATE2_DEPLOYER` | Same `UniversalCreate2DeployerFromStore` address as Base |
| `SHARE_OFT_SALT` | `deriveShareOftSalt(creatorCSW, shareSymbolLower, deploymentVersion)` |
| `SHARE_OFT_CODE_ID` | `keccak256(CreatorShareOFT.creationCode)` from the **same bytecode epoch** as Base |
| Bytecode epoch | **Existing Base ShareOFT:** seed Robinhood store with `deployments/base/v1.15.0-bytecode-manifest.json` code ids. **New greenfield after remote-wire change:** use `v1.15.1-bytecode-manifest.json`. |
| Constructor owner | Base `DeploymentBatcher` (`0x17163e…`) — not creator CSW |
| Bootstrap registry | Hub `OFTBootstrapRegistry` address at v1 salt, or `HUB_OFT_BOOTSTRAP_REGISTRY` |

Predict before broadcast (frontend helper):

```typescript
import { predictRemoteShareOftAddress } from '@/lib/deploy/robinhoodShareBridgeWiring'
// predicted must equal HUB_SHARE_OFT
```

```bash
export CREATE2_DEPLOYER=0xYourUniversalCreate2Deployer
export SHARE_OFT_SALT=0x...        # from hub deploy / vanity plan
export SHARE_OFT_CODE_ID=0x...     # from DeployUniversalBytecodeInfra logs
export SHARE_NAME="AKITA Shares"
export SHARE_SYMBOL="■AKITA"
export SHARE_OFT_CONSTRUCTOR_OWNER=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33
export HUB_OFT_BOOTSTRAP_REGISTRY=0xHubBootstrapAddress   # optional
export HUB_GAUGE_RECEIVER=0xBaseGaugeController
export HUB_SHARE_OFT=0xBaseShareOFT                         # must match predicted address
export HUB_LOTTERY_PEER=0x000000000000000000000000<BaseShareOFT without 0x prefix padded to bytes32>

# PRIVATE_KEY = protocol treasury Safe signer on Robinhood (remote wire authority)

forge script script/DeployRemoteShareOft.s.sol:DeployRemoteShareOft \
  --rpc-url robinhood \
  --broadcast \
  -vvvv
```

The script **reverts unless** predicted CREATE2 address equals `HUB_SHARE_OFT` (disable with `ENFORCE_ADDRESS_PARITY=0` only for debugging).

Remote deploy sets:

- `isHub=false`
- `hubEid=30184`
- `hubGaugeReceiver=<Base gauge>`
- `setPeer(30184, hubShareOFT)`

Protocol treasury (`0x7d429e…`) may call remote wire functions because the CREATE2 constructor owner is the Base batcher address (no contract on Robinhood).

## Step 4 — LayerZero wire (Hardhat toolbox)

Copy [`layerzero-robinhood-share-mesh.config.ts`](../../templates/layerzero-robinhood-share-mesh.config.ts) into your per-creator LZ scaffold, then:

```bash
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts
```

Verify ULN config on LayerZero Scan before enabling user-facing bridge flows.

## Step 5 — Hub peer + registry index (Base)

```bash
export WIRE_SIDE=hub
export BASE_SHARE_OFT=0x...
export ROBINHOOD_SHARE_OFT=0x...
export REGISTRY=0x...
export CREATOR_TOKEN=0x...

forge script script/WireShareOftRobinhoodPeers.s.sol:WireShareOftRobinhoodPeers \
  --rpc-url base \
  --broadcast \
  -vvvv
```

Or registry-only:

```bash
forge script script/SeedCreatorRegistryRobinhoodPeer.s.sol:SeedCreatorRegistryRobinhoodPeer \
  --rpc-url base \
  --broadcast \
  -vvvv
```

## Step 6 — Read-only verification

```bash
pnpm -C frontend ops:verify-robinhood-mesh \
  --creator 0xCreatorToken \
  --base-share-oft 0xBaseShareOFT \
  --robinhood-share-oft 0xRobinhoodShareOFT \
  --hub-gauge 0xBaseGauge
```

Exit `0` = peers aligned and fee quotes succeed both directions.

## Out of scope (V1)

- CreatorOVault, wrapper, gauge, lottery manager, or strategies on Robinhood
- Robinhood vault deposits or local strategy activation in product UI
- Reusing Base ↔ Solana DVN set

## Frontend

Robinhood appears as **Remote ShareOFT beta** — bridge shares only; fees and lottery settle on Base.
