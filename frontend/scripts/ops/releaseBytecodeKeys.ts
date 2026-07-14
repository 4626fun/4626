export const FRONTEND_DEPLOY_MANIFEST_KEYS = [
  'OFTBootstrapRegistry',
  'CCALaunchArm',
  'VaultShareBurnStream',
  'CreatorCoinPolicyController',
  'AgentRevenuePolicyController',
  'CharmStrategy4626',
  'AjnaVaultAuth',
  'AjnaERC4626Vault',
  'ERC4626StrategyAdapter',
  'CreatorOVault',
  'CreatorOVaultWrapper',
  'CreatorShareOFT',
  'CreatorGaugeController',
  'CreatorOracle',
  'CreatorPayoutRouter',
  'AgentOVault',
  'AgentOVaultWrapper',
  'AgentShareOFT',
  'AgentGaugeController',
  'AgentOracle',
  'AgentRevenueRouter',
  'ApprovedV4HooksRegistry',
  'OVaultLPManager',
] as const

export const DEPLOYMENT_MODULE_MANIFEST_KEYS = [
  'CreatorOVaultCoreModule',
  'AgentOVaultCoreModule',
  'OVaultStrategiesModule',
  'OVaultAdminModule',
  'DeploymentBatcherPhase1Module',
  'DeploymentBatcherPhase2Module',
  'DeploymentBatcherPhase3Helper',
  'DeploymentBatcherShareMeshHelper',
  'DeploymentBatcherUtilsHelper',
] as const

export const DEPLOY_CONSUMED_MANIFEST_KEYS = [
  ...FRONTEND_DEPLOY_MANIFEST_KEYS,
  ...DEPLOYMENT_MODULE_MANIFEST_KEYS,
] as const

export type DeployConsumedManifestKey = (typeof DEPLOY_CONSUMED_MANIFEST_KEYS)[number]
