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
  equal the constructor-pinned lane set.
- When the active `DeploymentBatcher` exposes `requireApprovedCodeId` /
  `approvedCodeIds`, those codeIds must also be treasury-approved. The live
  v1.19.1 batcher (`0xa181…F145`) does **not** include that allowlist surface;
  the hardened aux helper soft-skips missing-selector reverts and still enforces
  constructor-pinned lane binding.

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

Current live default `0xaA9229c1649a7eC6DA85a76097E0910B24F9408e` is the hardened v1.19.1 helper.

## Ordered production rotation (do not skip)

Live mutations are intentionally out of scope for the repo prep slice. Execute
only after read-only preflight passes and an operator explicitly approves each
step.

### 0. Read-only preflight

Confirm active v1.19.1 infra:

```bash
cast call 0xa18169caf37fa0347285B16aAFC2B09eCB43F145 "bytecodeStore()(address)" --rpc-url $BASE_RPC_URL
cast call 0xa18169caf37fa0347285B16aAFC2B09eCB43F145 "create2Deployer()(address)" --rpc-url $BASE_RPC_URL

# AgentRevenuePolicyController seeded?
AGENT_POLICY_CODE_ID=$(cast keccak "$(forge inspect AgentRevenuePolicyController bytecode)")
cast call 0xF9622613682a12E46b914c7498716F42E44c4d36 \
  "pointers(bytes32)(address)" $AGENT_POLICY_CODE_ID --rpc-url $BASE_RPC_URL
```

Expected paired infra:

- Store: `0xF9622613682a12E46b914c7498716F42E44c4d36`
- Create2: `0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2`
- Batcher: `0xa18169caf37fa0347285B16aAFC2B09eCB43F145`

### 1. Seed v1.19.1 bytecode (includes AgentRevenuePolicyController)

```bash
export BASE_RPC_URL=<paid Base RPC>
export PRIVATE_KEY=<bytecode store owner>
export UNIVERSAL_BYTECODE_STORE=0xF9622613682a12E46b914c7498716F42E44c4d36
export DEPLOYMENT_EPOCH_TAG=v1.19.1

forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url $BASE_RPC_URL --broadcast

# Or epoch wrapper:
./script/seed-greenfield-bytecode-store.sh v1.19.1
```

Verify:

```bash
BYTECODE_MANIFEST=deployments/base/v1.19.1-bytecode-manifest.json \
UNIVERSAL_BYTECODE_STORE=0xF9622613682a12E46b914c7498716F42E44c4d36 \
BASE_RPC_URL=$BASE_RPC_URL \
pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
```

### 2. Approve release codeIds on DeploymentBatcher (treasury Safe)

**Preflight gate:** confirm allowlist selectors exist on the active batcher before
submitting a Safe tx:

```bash
cast sig 'requireApprovedCodeId(bytes32)'
cast code 0xa18169caf37fa0347285B16aAFC2B09eCB43F145 --rpc-url $BASE_RPC_URL \
  | tr '[:upper:]' '[:lower:]' | grep -q ccda19ad && echo allowlist=YES || echo allowlist=NO
```

If `allowlist=NO` (current v1.19.1 live batcher): **skip this step**. Do not
rotate `DEPLOYMENT_BATCHER` as part of auxiliary cutover. Re-run Safe approvals
only after a separate DeploymentBatcher rotation that ships the allowlist.

If `allowlist=YES`, approve at least the five auxiliary codeIds (burn stream,
creator/agent routers, creator/agent policy controllers), plus any other
v1.19.1 deploy-consumed keys:

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
    0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2 \
    0xF9622613682a12E46b914c7498716F42E44c4d36 \
    0xa18169caf37fa0347285B16aAFC2B09eCB43F145 \
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
cast send 0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2 \
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
cast call 0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2 \
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

Historical v1.19.0 retirement command (audit only; do not run against the v1.19.1 infra):

```bash
cast send 0x54660E61857a652753d805aD2c7b4f759C138bD5 \
  "setAuthorizedDeployer(address,bool)" 0xa3986F2F812a80a4Ee4A33646bE5248D9e22eb88 false \
  --rpc-url $BASE_RPC_URL \
  --private-key <CREATE2_DEPLOYER_OWNER_KEY>
```
