#!/usr/bin/env node
/**
 * Export current forge `out/` ABIs into `deployments/base/contracts/**` as a **V1 greenfield**
 * interface registry: ABIs match source; deploy addresses are cleared (null) until first broadcast.
 *
 * Usage:
 *   forge build --skip test
 *   node scripts/export-v1-deployment-abis.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(ROOT, 'out')
const DEST_ROOT = join(ROOT, 'deployments/base/contracts')

const V1_NOTE =
  'V1 greenfield interface snapshot: ABI matches current contracts/ source. address is null until first Base broadcast of this bytecode epoch.'

/** [deployment relative path, forge out relative path, contractName] */
const EXPORTS = [
  ['core/Registry4626.json', 'Registry4626.sol/Registry4626.json', 'Registry4626'],
  ['services/lottery/LotteryManager4626.json', 'LotteryManager4626.sol/LotteryManager4626.json', 'LotteryManager4626'],
  ['services/lottery/vrf/VRFConsumer4626.json', 'VRFConsumer4626.sol/VRFConsumer4626.json', 'VRFConsumer4626'],
  ['services/bridge/SolanaBridgeAdapter.json', 'SolanaBridgeAdapter.sol/SolanaBridgeAdapter.json', 'SolanaBridgeAdapter'],
  ['factories/OVaultFactory4626.json', 'OVaultFactory4626.sol/OVaultFactory4626.json', 'OVaultFactory4626'],
  // Legacy filename retained so older tooling path still resolves; contractName is OVaultFactory4626.
  ['factories/CreatorOVaultFactory.json', 'OVaultFactory4626.sol/OVaultFactory4626.json', 'OVaultFactory4626'],
  ['factories/lanes/CreatorOvaultLane.json', 'CreatorOvaultLane.sol/CreatorOvaultLane.json', 'CreatorOvaultLane'],
  ['factories/lanes/AgentOvaultLane.json', 'AgentOvaultLane.sol/AgentOvaultLane.json', 'AgentOvaultLane'],
  [
    'factories/UniversalCreate2DeployerFromStore.json',
    'UniversalCreate2DeployerFromStore.sol/UniversalCreate2DeployerFromStore.json',
    'UniversalCreate2DeployerFromStore',
  ],
  ['helpers/batchers/DeploymentBatcher.json', 'DeploymentBatcher.sol/DeploymentBatcher.json', 'DeploymentBatcher'],
  [
    'helpers/batchers/DeploymentBatcherPhase3Helper.json',
    'DeploymentBatcher.sol/DeploymentBatcherPhase3Helper.json',
    'DeploymentBatcherPhase3Helper',
  ],
  [
    'helpers/batchers/VaultActivationBatcher.json',
    'VaultActivationBatcher.sol/VaultActivationBatcher.json',
    'VaultActivationBatcher',
  ],
  [
    'helpers/infra/UniversalBytecodeStore.json',
    'UniversalBytecodeStoreV2.sol/UniversalBytecodeStoreV2.json',
    'UniversalBytecodeStoreV2',
  ],
  // ── Creator lane (per-vault stack; addresses filled per creator deploy) ──
  ['creator/CreatorOVault.json', 'CreatorOVault.sol/CreatorOVault.json', 'CreatorOVault'],
  ['creator/CreatorOVaultWrapper.json', 'CreatorOVaultWrapper.sol/CreatorOVaultWrapper.json', 'CreatorOVaultWrapper'],
  ['creator/CreatorShareOFT.json', 'CreatorShareOFT.sol/CreatorShareOFT.json', 'CreatorShareOFT'],
  [
    'creator/CreatorOVaultCoreModule.json',
    'CreatorOVaultCoreModule.sol/CreatorOVaultCoreModule.json',
    'CreatorOVaultCoreModule',
  ],
  ['creator/CreatorOracle.json', 'CreatorOracle.sol/CreatorOracle.json', 'CreatorOracle'],
  [
    'creator/CreatorGaugeController.json',
    'CreatorGaugeController.sol/CreatorGaugeController.json',
    'CreatorGaugeController',
  ],
  ['creator/CreatorPayoutRouter.json', 'CreatorPayoutRouter.sol/CreatorPayoutRouter.json', 'CreatorPayoutRouter'],
  [
    'creator/CreatorCoinPolicyController.json',
    'CreatorCoinPolicyController.sol/CreatorCoinPolicyController.json',
    'CreatorCoinPolicyController',
  ],

  // ── Agent lane (AgentTokenV4 vault product; not XMTP/Keepr) ──
  ['agent/AgentOVault.json', 'AgentOVault.sol/AgentOVault.json', 'AgentOVault'],
  ['agent/AgentOVaultWrapper.json', 'AgentOVaultWrapper.sol/AgentOVaultWrapper.json', 'AgentOVaultWrapper'],
  ['agent/AgentShareOFT.json', 'AgentShareOFT.sol/AgentShareOFT.json', 'AgentShareOFT'],
  [
    'agent/AgentOVaultCoreModule.json',
    'AgentOVaultCoreModule.sol/AgentOVaultCoreModule.json',
    'AgentOVaultCoreModule',
  ],
  ['agent/AgentOracle.json', 'AgentOracle.sol/AgentOracle.json', 'AgentOracle'],
  ['agent/AgentGaugeController.json', 'AgentGaugeController.sol/AgentGaugeController.json', 'AgentGaugeController'],
  ['agent/AgentRevenueRouter.json', 'AgentRevenueRouter.sol/AgentRevenueRouter.json', 'AgentRevenueRouter'],
  [
    'agent/AgentRevenuePolicyController.json',
    'AgentRevenuePolicyController.sol/AgentRevenuePolicyController.json',
    'AgentRevenuePolicyController',
  ],
  [
    'agent/AgentOVaultTaxAdapter.json',
    'AgentOVaultTaxAdapter.sol/AgentOVaultTaxAdapter.json',
    'AgentOVaultTaxAdapter',
  ],

  // ── Shared governance / incentives ──
  ['governance/ve4626.json', 've4626.sol/ve4626.json', 've4626'],
  ['governance/ve4626GaugeVoting.json', 've4626GaugeVoting.sol/ve4626GaugeVoting.json', 've4626GaugeVoting'],
  ['governance/ve4626BoostManager.json', 've4626BoostManager.sol/ve4626BoostManager.json', 've4626BoostManager'],
  [
    'governance/ve4626VoterRewardsDistributor.json',
    've4626VoterRewardsDistributor.sol/ve4626VoterRewardsDistributor.json',
    've4626VoterRewardsDistributor',
  ],
  ['governance/BribeDepot4626.json', 'BribeDepot4626.sol/BribeDepot4626.json', 'BribeDepot4626'],
  ['governance/BribesFactory4626.json', 'BribesFactory4626.sol/BribesFactory4626.json', 'BribesFactory4626'],
  ['governance/RewardStream4626.json', 'RewardStream4626.sol/RewardStream4626.json', 'RewardStream4626'],
  [
    'governance/RewardStreamFactory4626.json',
    'RewardStreamFactory4626.sol/RewardStreamFactory4626.json',
    'RewardStreamFactory4626',
  ],
  [
    'governance/GaugeSurfaceRegistry4626.json',
    'GaugeSurfaceRegistry4626.sol/GaugeSurfaceRegistry4626.json',
    'GaugeSurfaceRegistry4626',
  ],
]

function loadAbi(outPath) {
  const data = JSON.parse(readFileSync(outPath, 'utf8'))
  if (!data.abi) throw new Error(`no abi in ${outPath}`)
  let text = JSON.stringify(data.abi)
  for (const [a, b] of [
    ['ICreatorRegistry', 'IRegistry4626'],
    ['IVe4626', 'Ive4626'],
    ['IVaultGaugeVoting', 'Ive4626GaugeVoting'],
  ]) {
    text = text.split(a).join(b)
  }
  return JSON.parse(text)
}

function writeSnapshot(depRel, outRel, contractName) {
  const outPath = join(OUT, outRel)
  if (!existsSync(outPath)) {
    console.warn(`SKIP missing forge artifact: ${outRel}`)
    return false
  }
  const abi = loadAbi(outPath)
  const dest = join(DEST_ROOT, depRel)
  mkdirSync(dirname(dest), { recursive: true })

  const meta = {
    contractName,
    network: 'Base',
    chainId: 8453,
    release: 'v1-greenfield',
    address: null,
    deployedBy: null,
    deployedAt: null,
    deploymentTx: null,
    abi,
    notes: [V1_NOTE],
  }
  writeFileSync(dest, JSON.stringify(meta, null, 2) + '\n')
  console.log(`OK  ${depRel}  (${abi.length} items)  ← ${outRel}`)
  return true
}

let ok = 0
let skip = 0
for (const [dep, out, name] of EXPORTS) {
  if (writeSnapshot(dep, out, name)) ok++
  else skip++
}
console.log(`\nV1 export complete: ${ok} written, ${skip} skipped`)
console.log('Addresses nulled for first-broadcast bookkeeping. Set address/deployedAt after deploy.')
