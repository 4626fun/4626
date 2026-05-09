# Vault Auxiliary Deploy Batcher Rotation

This runbook routes auxiliary vault deployments away from direct creator-CSW
calls to `UniversalCreate2DeployerFromStore.deploy(bytes32,bytes32,bytes)`.

## Why

`UniversalCreate2DeployerFromStore` is ACL-gated. Creator smart wallets should
not be individually added to `authorizedDeployers`, because that does not scale
and grants broad stored-bytecode deployment authority. The deploy path should
authorize protocol deployment surfaces instead.

## Target Invariant

- Creator wallets call `DeploymentBatcher` for core phases.
- Creator wallets call `VaultAuxiliaryDeployBatcher` for burn stream,
  payout router, and policy-controller deploys.
- `VaultAuxiliaryDeployBatcher` calls `UniversalCreate2DeployerFromStore`.
- `authorizedDeployers(vaultAuxiliaryDeployBatcher) == true`.
- Deploy-session payloads contain no direct calls to
  `UniversalCreate2DeployerFromStore.deploy(...)`.

## Rotation Steps

1. Deploy `VaultAuxiliaryDeployBatcher`.
   - Constructor args:
     - active `UniversalCreate2DeployerFromStore`
     - active `UniversalBytecodeStoreV2`
     - active `DeploymentBatcher`
     - protocol treasury
     - canonical Uniswap V3 router

2. Authorize the auxiliary helper on the create2 deployer.
   - Caller must be the create2 deployer owner.
   - Call:
     `setAuthorizedDeployer(vaultAuxiliaryDeployBatcher, true)`.

3. Update runtime config.
   - Keep `CREATOR_VAULT_BATCHER` / `VITE_CREATOR_VAULT_BATCHER` pointed at the
     active `DeploymentBatcher`.
   - Set `VAULT_AUXILIARY_DEPLOY_BATCHER` /
     `VITE_VAULT_AUXILIARY_DEPLOY_BATCHER` to the helper.
   - Update `frontend/src/config/contracts.defaults.ts` only after the onchain
     helper deploy + authorization is verified.

4. Verify onchain reads before retrying deploy.
   - `DeploymentBatcher.bytecodeStore()` equals the active bytecode store.
   - `DeploymentBatcher.create2Deployer()` equals the active create2 deployer.
   - `VaultAuxiliaryDeployBatcher.deploymentBatcher()` equals the active batcher.
   - `VaultAuxiliaryDeployBatcher.bytecodeStore()` equals the active bytecode store.
   - `VaultAuxiliaryDeployBatcher.create2Deployer()` equals the active create2 deployer.
   - `UniversalCreate2DeployerFromStore.authorizedDeployers(vaultAuxiliaryDeployBatcher)`
     returns `true`.
   - The active bytecode store has frontend deploy code IDs for all creator stack
     contracts.

5. Run local and production preflight.
   - Local: `pnpm -C frontend dev:deploy-dry-run`, then the deploy-page dry-run.
   - Production: deploy-page preflight should show deployment bytecode ready and
     should not report direct create2 authorization blockers for creator CSWs.

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

## Rollback

If the auxiliary helper fails preflight, clear
`VAULT_AUXILIARY_DEPLOY_BATCHER` / `VITE_VAULT_AUXILIARY_DEPLOY_BATCHER` and
leave the active `CREATOR_VAULT_BATCHER` unchanged. If the helper should be
retired, the create2 deployer owner should call
`setAuthorizedDeployer(vaultAuxiliaryDeployBatcher, false)`.
