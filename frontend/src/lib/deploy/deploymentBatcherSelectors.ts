/**
 * Canonical v1.19.1 DeploymentBatcher selectors.
 *
 * Keep client capability detection and deploy-session validation on one source
 * of truth. The Phase1 tuple gained `vaultKind` in v1.19.1, which changed all
 * Phase1 selectors even though the function names stayed the same.
 */
export const CURRENT_DEPLOYMENT_BATCHER_SELECTORS = {
  deployPhase1: '0x1c3e4d75',
  deployPhase1WithSalt: '0x74b4884e',
  deployPhase1Core: '0x37ce9666',
  deployPhase1CoreWithSalt: '0x8287b529',
  finalizePhase1: '0xe93fc211',
  finalizePhase1WithSalt: '0xaf399b2b',
  finalizePhase2WithPermit2: '0x8e782ae1',
} as const

