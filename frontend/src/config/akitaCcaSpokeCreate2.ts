/**
 * CREATE2 / bytecode infra pins for ■AKITA CCA spoke fan-out.
 *
 * Derived from live Base AKITA B2 phase-1 plan
 * (`frontend/artifacts/akita-phase1-plan-20260727.json`) + current
 * `deployments/base/v1.20.0-bytecode-manifest.json` codeIds.
 *
 * Hub ShareOFT address parity and Base infra address parity are **not** available: phase-1 used ShareOFT
 * codeId `0x8c9de580…` which is no longer in the live bytecode store. Spokes
 * deploy current CreatorShareOFT (`SHARE_OFT_CODE_ID`) with
 * `ENFORCE_ADDRESS_PARITY=0`, then wire hub↔spoke peers.
 *
 * Oracle codeId matches the phase-1/2 plan — Base-salt oracle parity is optional
 * via `ENFORCE_ADDRESS_PARITY=1` on `DeployRemoteCreatorOracle`.
 */
import {
  deriveDeployBaseSalt,
  deriveShareOftSaltFromVersion,
  saltForDeployLabel,
} from '../lib/deploy/perVaultVanityVersionSearch'
import { AKITA_DEFAULTS } from './contracts.defaults'

export const AKITA_CCA_CREATE2 = {
  creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75' as const,
  /** Phase-1 owner / CSW (constructor owner for ShareOFT was the batcher). */
  owner: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5' as const,
  /** Batcher that executed AKITA phase-1 (`deployPhase1CoreWithSalt`). */
  shareOftConstructorOwner: '0xa18169caf37fa0347285B16aAFC2B09eCB43F145' as const,
  phase1Version: 'v1.19.4-akita-b2-20260727-v11gl' as const,
  /** Phase-2 vanity version used for gauge/cca/oracle salts. */
  phase2Version: 'v1.19.4-akita-b2-20260727-v11gl-v3ln5' as const,
  shareName: 'Akita Share Token' as const,
  shareSymbol: '■AKITA' as const,
  assetSymbol: 'akita' as const,
  /**
   * Spoke CREATE2 infra (epoch `cca-spoke-v1`, current UniversalBytecodeStoreV2 /
   * UniversalCreate2DeployerFromStore artifacts). Not Base `0x8599`/`0xdffB`
   * (those use unreproducible older bytecode).
   */
  create2Deployer: '0x7E3898Eb0Aee0DCAC5C0ccCd88ab94575f48a2D6' as const,
  /** Fixed CREATE2 deployer owner (baked into deployer initcode). */
  create2FromStoreOwner: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD' as const,
  bytecodeStore: '0x75FA60e7e01CACda736952E9AC8D5c30B61F117E' as const,
  registry: '0xF60a1490C4129f2b6ae540734D3C2C8C6111824e' as const,
  hubShareOft: AKITA_DEFAULTS.shareOFT,
  hubOracle: AKITA_DEFAULTS.oracle,
  hubGaugeReceiver: AKITA_DEFAULTS.gaugeController,
  /** Hub lottery manager — encode as bytes32 peer for `setHubLotteryPeer`. */
  hubLotteryManager: '0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b' as const,
  /**
   * Current CreatorShareOFT codeId (v1.20.0 manifest). Differs from AKITA
   * phase-1 codeId `0x8c9de580…` (purged from store).
   */
  shareOftCodeId:
    '0x9ea810ff0a9f8cc3c7ccdee002b2172cdc1030cd7e155ae7d0ca9332bcc09339' as const,
  oracleCodeId:
    '0x00d8de27c2775fb6f315b1f2f67948a39db99a8d5e1b8364808de0577717526d' as const,
  oftBootstrapCodeId:
    '0xb4e332b02f3bacec4db7d40990c9a1667116dfafb521acbd96ba623e19005546' as const,
  /** Infra CREATE2 epoch for store/deployer address parity with Base. */
  infraEpochTag: 'cca-spoke-v1' as const,
} as const

export function hubLotteryPeerBytes32(): `0x${string}` {
  const addr = AKITA_CCA_CREATE2.hubLotteryManager.toLowerCase().replace(/^0x/, '')
  return `0x${addr.padStart(64, '0')}` as `0x${string}`
}

/** ShareOFT salt from phase-1 identity (creator + owner + ■akita + version). */
export function akitaShareOftSalt(): `0x${string}` {
  return deriveShareOftSaltFromVersion({
    creatorToken: AKITA_CCA_CREATE2.creatorToken,
    owner: AKITA_CCA_CREATE2.owner,
    shareSymbol: AKITA_CCA_CREATE2.shareSymbol,
    version: AKITA_CCA_CREATE2.phase1Version,
  })
}

/**
 * Oracle salt = `saltFor(deriveBaseSalt(…, chainId=8453, phase2Version), "oracle")`.
 * Reuse Base chainId in the salt so optional CREATE2 parity can target hub oracle.
 */
export function akitaOracleSalt(): `0x${string}` {
  const baseSalt = deriveDeployBaseSalt({
    creatorToken: AKITA_CCA_CREATE2.creatorToken,
    owner: AKITA_CCA_CREATE2.owner,
    chainId: 8453,
    version: AKITA_CCA_CREATE2.phase2Version,
  })
  return saltForDeployLabel(baseSalt, 'oracle')
}

/** Env block for forge spoke OFT/oracle CREATE2 (salts filled). */
export function akitaCcaCreate2EnvBlock(): string {
  const lines = [
    `CREATE2_DEPLOYER=${AKITA_CCA_CREATE2.create2Deployer}`,
    `BYTECODE_STORE=${AKITA_CCA_CREATE2.bytecodeStore}`,
    `REGISTRY=${AKITA_CCA_CREATE2.registry}`,
    `SHARE_OFT_SALT=${akitaShareOftSalt()}`,
    `SHARE_OFT_CODE_ID=${AKITA_CCA_CREATE2.shareOftCodeId}`,
    `SHARE_NAME=${JSON.stringify(AKITA_CCA_CREATE2.shareName)}`,
    `SHARE_SYMBOL=${AKITA_CCA_CREATE2.shareSymbol}`,
    `SHARE_OFT_CONSTRUCTOR_OWNER=${AKITA_CCA_CREATE2.shareOftConstructorOwner}`,
    `HUB_SHARE_OFT=${AKITA_CCA_CREATE2.hubShareOft}`,
    `HUB_GAUGE_RECEIVER=${AKITA_CCA_CREATE2.hubGaugeReceiver}`,
    `HUB_LOTTERY_PEER=${hubLotteryPeerBytes32()}`,
    `ENFORCE_ADDRESS_PARITY=0`,
    `ORACLE_SALT=${akitaOracleSalt()}`,
    `ORACLE_CODE_ID=${AKITA_CCA_CREATE2.oracleCodeId}`,
    `ASSET_SYMBOL=${AKITA_CCA_CREATE2.assetSymbol}`,
    `HUB_ORACLE=${AKITA_CCA_CREATE2.hubOracle}`,
    `DEPLOYMENT_EPOCH_TAG=${AKITA_CCA_CREATE2.infraEpochTag}`,
    `CREATE2_FROM_STORE_OWNER=${AKITA_CCA_CREATE2.create2FromStoreOwner}`,
  ]
  return lines.join(' \\\n')
}
