# Vault Auxiliary Deploy Batcher Rotation

This runbook routes auxiliary vault deployments away from direct creator-CSW
calls to `UniversalCreate2DeployerFromStore.deploy(bytes32,bytes32,bytes)`, and
documents the hardened codeId↔vaultKind binding introduced for Creator/Agent
lanes.

## Why

`UniversalCreate2DeployerFromStore` is ACL-gated. Creator smart wallets should
not be individually added to `authorizedDeployers`, because that does not scale
and grants broad stored-bytecode deployment authority. The deploy path should
authorize protocol deployment surfaces instead.

In addition, `VaultAuxiliaryDeployBatcher` must bind supplied auxiliary
`codeIds` to `vaultKind` on-chain. Sponsored paths already enforce lane pairing
in the paymaster; the hardened helper also rejects direct owner calls that pass
cross-lane bytecode.

## Target Invariant

- Creator/Agent wallets call `DeploymentBatcher` for core phases.
- Creator/Agent wallets call `VaultAuxiliaryDeployBatcher` for burn stream,
  revenue router, and revenue-policy-controller deploys.
- `VaultAuxiliaryDeployBatcher` calls `UniversalCreate2DeployerFromStore`.
- `authorizedDeployers(vaultAuxiliaryDeployBatcher) == true`.
- Deploy-session payloads contain no direct calls to
  `UniversalCreate2DeployerFromStore.deploy(...)`.
- For `vaultKind=0` (Creator) / `vaultKind=1` (Agent), auxiliary `codeIds` must
  equal the constructor-pinned lane set and must still be approved on
  `DeploymentBatcher.approvedCodeIds`.

## Hardened constructor inputs

`VaultAuxiliaryDeployBatcher` constructor:

1. `create2Deployer` — active `UniversalCreate2DeployerFromStore`
2. `bytecodeStore` — active `UniversalBytecodeStoreV2`
3. `deploymentBatcher` — active `DeploymentBatcher` (codeId allowlist authority)
4. `protocolTreasury`
5. `swapRouter` — canonical Uniswap V3 router
6. `vaultShareBurnStreamCodeId` — `keccak256(VaultShareBurnStream creationCode)`
7. `creatorRevenueRouterCodeId` — `keccak256(CreatorPayoutRouter creationCode)`
8. `agentRevenueRouterCodeId` — `keccak256(AgentRevenueRouter creationCode)`
9. `creatorRevenuePolicyControllerCodeId` — `keccak256(CreatorCoinPolicyController creationCode)`
10. `agentRevenuePolicyControllerCodeId` — `keccak256(AgentRevenuePolicyController creationCode)`

Pinned codeIds are immutable getters. Calldata for
`deployPhase2Auxiliaries(Params, CodeIds)` is unchanged; the helper reverts
with `CodeIdKindMismatch(expected, actual)` on lane mismatch and consults
`DeploymentBatcher.requireApprovedCodeId` so treasury revocation still works.

Current live default `0xa3986F2F812a80a4Ee4A33646bE5248D9e22eb88` is the
pre-hardening helper and should be treated as stale until replaced.

## Ordered production rotation (do not skip)

Live mutations are intentionally out of scope for the repo prep slice. Execute
only after read-only preflight passes and an operator explicitly approves each
step.

### 0. Read-only preflight

Confirm active infra (v1.18 shared / v1.19.1 bytecode epoch):

```bash
cast call 0x02D7abC547F8B1e7E2D7a919D8D1005918361750 "bytecodeStore()(address)" --rpc-url $BASE_RPC_URL
cast call 0x02D7abC547F8B1e7E2D7a919D8D1005918361750 "create2Deployer()(address)" --rpc-url $BASE_RPC_URL

# AgentRevenuePolicyController seeded?
AGENT_POLICY_CODE_ID=$(cast keccak "$(forge inspect AgentRevenuePolicyController bytecode)")
cast call 0xfa3e3b466635DAff910057f18749B93d56F9DE50 \
  "pointers(bytes32)(address)" $AGENT_POLICY_CODE_ID --rpc-url $BASE_RPC_URL
```

Expected paired infra:

- Store: `0xfa3e3b466635DAff910057f18749B93d56F9DE50`
- Create2: `0x54660E61857a652753d805aD2c7b4f759C138bD5`
- Batcher: `0x02D7abC547F8B1e7E2D7a919D8D1005918361750`

### 1. Seed v1.19.1 bytecode (includes AgentRevenuePolicyController)

```bash
export BASE_RPC_URL=<paid Base RPC>
export PRIVATE_KEY=<bytecode store owner>
export UNIVERSAL_BYTECODE_STORE=0xfa3e3b466635DAff910057f18749B93d56F9DE50
export DEPLOYMENT_EPOCH_TAG=v1.19.1

forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url $BASE_RPC_URL --broadcast

# Or epoch wrapper:
./script/seed-greenfield-bytecode-store.sh v1.19.1
```

Verify:

```bash
BYTECODE_MANIFEST=deployments/base/v1.19.1-bytecode-manifest.json \
UNIVERSAL_BYTECODE_STORE=0xfa3e3b466635DAff910057f18749B93d56F9DE50 \
BASE_RPC_URL=$BASE_RPC_URL \
pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
```

### 2. Approve release codeIds on DeploymentBatcher (treasury Safe)

Approve at least the five auxiliary codeIds (burn stream, creator/agent routers,
creator/agent policy controllers), plus any other v1.19.1 deploy-consumed keys:

```bash
pnpm -C frontend exec tsx scripts/ops/execute-approve-release-codeids-safe.ts \
  --release v1.19.1
```

### 3. Deploy hardened `VaultAuxiliaryDeployBatcher`

```bash
BURN=$(cast keccak "$(forge inspect VaultShareBurnStream bytecode)")
CREATOR_ROUTER=$(cast keccak "$(forge inspect CreatorPayoutRouter bytecode)")
AGENT_ROUTER=$(cast keccak "$(forge inspect AgentRevenueRouter bytecode)")
CREATOR_POLICY=$(cast keccak "$(forge inspect CreatorCoinPolicyController bytecode)")
AGENT_POLICY=$(cast keccak "$(forge inspect AgentRevenuePolicyController bytecode)")

forge create contracts/shared/deploy/batchers/VaultAuxiliaryDeployBatcher.sol:VaultAuxiliaryDeployBatcher \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast \
  --constructor-args \
    0x54660E61857a652753d805aD2c7b4f759C138bD5 \
    0xfa3e3b466635DAff910057f18749B93d56F9DE50 \
    0x02D7abC547F8B1e7E2D7a919D8D1005918361750 \
    0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3 \
    0x2626664c2603336E57B271c5C0b26F421741e481 \
    $BURN \
    $CREATOR_ROUTER \
    $AGENT_ROUTER \
    $CREATOR_POLICY \
    $AGENT_POLICY
```

Record the deployed address as `<NEW_AUX_BATCHER>`.

### 4. Authorize on create2 deployer

Only the create2 deployer owner may call this. Without it,
`deployPhase2Auxiliaries` reverts with `NotAuthorizedDeployer`.

```bash
cast send 0x54660E61857a652753d805aD2c7b4f759C138bD5 \
  "setAuthorizedDeployer(address,bool)" <NEW_AUX_BATCHER> true \
  --rpc-url $BASE_RPC_URL \
  --private-key <CREATE2_DEPLOYER_OWNER_KEY>
```

Security invariant: never add individual creator CSWs to `authorizedDeployers`.

### 5. Env / config cutover

| Surface | Env var | Consumer |
|---------|---------|----------|
| Frontend SPA | `VITE_VAULT_AUXILIARY_DEPLOY_BATCHER` | `frontend/src/config/contracts.ts` |
| Vercel API / paymaster | `VAULT_AUXILIARY_DEPLOY_BATCHER` | `frontend/server/_lib/onchain/contracts.ts` |
| Repo default (after verify) | — | `frontend/src/config/contracts.defaults.ts` |

Do **not** change `DEPLOYMENT_BATCHER` / `VITE_DEPLOYMENT_BATCHER` during
auxiliary rotation.

Set env in local `.env` / `frontend/.env` and Vercel scopes
(`production`, `preview`, `development`), then **redeploy Vercel** — bundled
`VITE_*` values are build-time.

Update `frontend/src/config/contracts.defaults.ts` only after onchain wiring
reads confirm the new helper.

### 6. Verification

```bash
cast call <NEW_AUX_BATCHER> "deploymentBatcher()(address)" --rpc-url $BASE_RPC_URL
cast call <NEW_AUX_BATCHER> "bytecodeStore()(address)" --rpc-url $BASE_RPC_URL
cast call <NEW_AUX_BATCHER> "create2Deployer()(address)" --rpc-url $BASE_RPC_URL
cast call <NEW_AUX_BATCHER> "vaultShareBurnStreamCodeId()(bytes32)" --rpc-url $BASE_RPC_URL
cast call <NEW_AUX_BATCHER> "creatorRevenueRouterCodeId()(bytes32)" --rpc-url $BASE_RPC_URL
cast call <NEW_AUX_BATCHER> "agentRevenueRouterCodeId()(bytes32)" --rpc-url $BASE_RPC_URL
cast call <NEW_AUX_BATCHER> "creatorRevenuePolicyControllerCodeId()(bytes32)" --rpc-url $BASE_RPC_URL
cast call <NEW_AUX_BATCHER> "agentRevenuePolicyControllerCodeId()(bytes32)" --rpc-url $BASE_RPC_URL
cast call 0x54660E61857a652753d805aD2c7b4f759C138bD5 \
  "authorizedDeployers(address)(bool)" <NEW_AUX_BATCHER> --rpc-url $BASE_RPC_URL
```

Local: `pnpm -C frontend dev:deploy-dry-run`, then deploy-page dry-run.
Production canary: one Creator deploy and one Agent deploy via `/deploy`.
Confirm no `auxiliary_batcher_selector_not_allowed`,
`batcher_aux_codeids_mismatch`, `CodeIdKindMismatch`, `InvalidCodeId`, or
`CODE_NOT_FOUND`.

## Expected Payload Shape

Allowed:

- `DeploymentBatcher.deployPhase1Core(...)`
- `DeploymentBatcher.finalizePhase1(...)`
- `DeploymentBatcher.deployPhase2Core(...)`
- `DeploymentBatcher.finalizePhase2(...)`
- `VaultAuxiliaryDeployBatcher.deployPhase2Auxiliaries(...)`
- `DeploymentBatcher.deployPhase3Strategies(...)`
- `DeploymentBatcher.launchDeferredAuction(...)`

Blocked:

- Direct creator-wallet calls to
  `UniversalCreate2DeployerFromStore.deploy(bytes32,bytes32,bytes)`.
- Auxiliary calls with cross-lane `codeIds` for the claimed `vaultKind`.

## Rollback

If the auxiliary helper fails preflight:

1. Clear / restore `VAULT_AUXILIARY_DEPLOY_BATCHER` /
   `VITE_VAULT_AUXILIARY_DEPLOY_BATCHER` to the previous known-good address (or
   empty to fail closed).
2. Restore `frontend/src/config/contracts.defaults.ts` if it was updated.
3. Redeploy Vercel.
4. Leave the active `DEPLOYMENT_BATCHER` unchanged.
5. Optionally deauthorize the failed helper:
   `setAuthorizedDeployer(<NEW_OR_FAILED_AUX>, false)`.

Retiring the old pre-hardening helper after cutover:

```bash
cast send 0x54660E61857a652753d805aD2c7b4f759C138bD5 \
  "setAuthorizedDeployer(address,bool)" 0xa3986F2F812a80a4Ee4A33646bE5248D9e22eb88 false \
  --rpc-url $BASE_RPC_URL \
  --private-key <CREATE2_DEPLOYER_OWNER_KEY>
```
