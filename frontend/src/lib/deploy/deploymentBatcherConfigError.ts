import {
  LEGACY_DEPLOYMENT_BATCHER,
  MODULE_MISMATCH_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
} from '../../config/contracts.defaults'

export function deploymentBatcherNotConfiguredMessage(receivedBatcher?: string | null): string {
  const received =
    typeof receivedBatcher === 'string' && receivedBatcher.trim().length > 0
      ? ` Received ${receivedBatcher}.`
      : ''
  return (
    'deployment batcher is not configured: missing/invalid VITE_CREATOR_VAULT_BATCHER / CONTRACTS.creatorVaultBatcher ' +
    '(server: CREATOR_VAULT_BATCHER / CREATOR_VAULT_BATCHER_AUTO_HANDOFF). ' +
    `Deprecated aliases are blocked (${LEGACY_DEPLOYMENT_BATCHER}, ${MODULE_MISMATCH_DEPLOYMENT_BATCHER}); ` +
    `use canonical ${SPLIT_PHASE1_DEPLOYMENT_BATCHER}.${received}`
  )
}
