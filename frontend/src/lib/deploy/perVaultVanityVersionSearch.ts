import { encodePacked, getCreate2Address, keccak256, type Address, type Hex } from 'viem'

import {
  findPerVaultVanityVersionWithWasm,
  isPerVaultVanityWasmConfigured,
} from '@/lib/vanity/perVaultVanityWasm'

const HEX_SUFFIX_RE = /^[0-9a-fA-F]+$/

export function normalizeHexSuffix(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const cleaned = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!cleaned || cleaned.length > 40) return null
  if (!HEX_SUFFIX_RE.test(cleaned)) return null
  return cleaned.toLowerCase()
}

export function deriveDeployBaseSalt(params: {
  creatorToken: Address
  owner: Address
  chainId: number
  version: string
}): Hex {
  const { creatorToken, owner, chainId, version } = params
  return keccak256(
    encodePacked(['address', 'address', 'uint256', 'string'], [
      creatorToken,
      owner,
      BigInt(chainId),
      `4626:deploy:${version}`,
    ]),
  )
}

export function saltForDeployLabel(baseSalt: Hex, label: string): Hex {
  return keccak256(encodePacked(['bytes32', 'string'], [baseSalt, label]))
}

export function deriveShareOftSaltFromVersion(params: {
  owner: Address
  shareSymbol: string
  version: string
}): Hex {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

export function predictCreate2AddressFromInitCode(params: {
  create2Deployer: Address
  salt: Hex
  initCode: Hex
}): Address {
  const bytecodeHash = keccak256(params.initCode)
  return getCreate2Address({ from: params.create2Deployer, salt: params.salt, bytecodeHash })
}

export type PerVaultVanityVersionSearchParams = {
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  chainId: number
  baseVersion: string
  vaultPrefix?: string | null
  shareSuffix?: string | null
  maxTries: number
  startAttempt?: number
  vaultInitCode: Hex
  shareOftInitCode: Hex
  shareSymbol: string
  isAddressDeployed?: (addr: Address) => Promise<boolean>
  yieldEvery?: number
  preferWasm?: boolean
}

function candidateDeploymentVersion(baseVersion: string, attempt: number): string {
  return attempt === 0 ? baseVersion : `${baseVersion}-v${attempt.toString(36)}`
}

export function findDeploymentVersionForVanityTargetsSync(
  params: PerVaultVanityVersionSearchParams,
): string | null {
  const vaultPrefix = normalizeHexSuffix(params.vaultPrefix ?? null)
  const shareSuffix = normalizeHexSuffix(params.shareSuffix ?? null)
  if (!vaultPrefix && !shareSuffix) return null

  const startAttempt = Math.max(0, Math.floor(params.startAttempt ?? 0))
  const maxTries = Math.max(1, Math.floor(params.maxTries))
  const endAttempt = startAttempt + maxTries

  for (let i = startAttempt; i < endAttempt; i += 1) {
    const candidateVersion = candidateDeploymentVersion(params.baseVersion, i)
    const baseSalt = deriveDeployBaseSalt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      version: candidateVersion,
    })

    if (vaultPrefix) {
      const vaultSalt = saltForDeployLabel(baseSalt, 'vault')
      const vaultAddress = predictCreate2AddressFromInitCode({
        create2Deployer: params.create2Deployer,
        salt: vaultSalt,
        initCode: params.vaultInitCode,
      })
      if (vaultAddress.slice(2, 2 + vaultPrefix.length).toLowerCase() !== vaultPrefix) continue
    }

    if (shareSuffix) {
      const shareSalt = deriveShareOftSaltFromVersion({
        owner: params.owner,
        shareSymbol: params.shareSymbol,
        version: candidateVersion,
      })
      const shareAddress = predictCreate2AddressFromInitCode({
        create2Deployer: params.create2Deployer,
        salt: shareSalt,
        initCode: params.shareOftInitCode,
      })
      if (!shareAddress.toLowerCase().endsWith(shareSuffix)) continue
    }

    return candidateVersion
  }

  return null
}

export async function findDeploymentVersionForVanityTargets(
  params: PerVaultVanityVersionSearchParams,
): Promise<string | null> {
  const vaultPrefix = normalizeHexSuffix(params.vaultPrefix ?? null)
  const shareSuffix = normalizeHexSuffix(params.shareSuffix ?? null)
  if (!vaultPrefix && !shareSuffix) return null

  const startAttempt = Math.max(0, Math.floor(params.startAttempt ?? 0))
  const maxTries = Math.max(1, Math.floor(params.maxTries))
  const preferWasm = params.preferWasm !== false

  if (
    preferWasm &&
    isPerVaultVanityWasmConfigured() &&
    typeof WebAssembly !== 'undefined' &&
    typeof fetch === 'function'
  ) {
    let attemptCursor = startAttempt
    const endAttempt = startAttempt + maxTries
    try {
      while (attemptCursor < endAttempt) {
        const chunkAttempts = endAttempt - attemptCursor
        const result = await findPerVaultVanityVersionWithWasm({
          create2Deployer: params.create2Deployer,
          creatorToken: params.creatorToken,
          owner: params.owner,
          chainId: params.chainId,
          baseVersion: params.baseVersion,
          vaultPrefix,
          shareSuffix,
          startAttempt: attemptCursor,
          maxAttempts: chunkAttempts,
          vaultInitCodeHash: vaultPrefix ? keccak256(params.vaultInitCode) : null,
          shareOftInitCodeHash: shareSuffix ? keccak256(params.shareOftInitCode) : null,
          shareSymbol: shareSuffix ? params.shareSymbol : null,
        })
        const toCheck: Address[] = []
        for (const value of [result.vaultAddress, result.shareOftAddress]) {
          if (value && /^0x[a-fA-F0-9]{40}$/.test(value)) toCheck.push(value as Address)
        }
        if (params.isAddressDeployed && toCheck.length > 0) {
          const deployedStates = await Promise.all(toCheck.map((addr) => params.isAddressDeployed!(addr)))
          if (deployedStates.some(Boolean)) {
            attemptCursor = result.attempt + 1
            continue
          }
        }
        return result.version
      }
      return null
    } catch {
      // Fall through to TypeScript mirror.
    }
  }

  return findDeploymentVersionForVanityTargetsAsyncTypescript(params)
}

async function findDeploymentVersionForVanityTargetsAsyncTypescript(
  params: PerVaultVanityVersionSearchParams,
): Promise<string | null> {
  const vaultPrefix = normalizeHexSuffix(params.vaultPrefix ?? null)
  const shareSuffix = normalizeHexSuffix(params.shareSuffix ?? null)
  if (!vaultPrefix && !shareSuffix) return null

  const startAttempt = Math.max(0, Math.floor(params.startAttempt ?? 0))
  const maxTries = Math.max(1, Math.floor(params.maxTries))
  const yieldEvery = Math.max(256, Math.floor(params.yieldEvery ?? 4096))
  const endAttempt = startAttempt + maxTries

  for (let i = startAttempt; i < endAttempt; i += 1) {
    if (i > startAttempt && (i - startAttempt) % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    const candidateVersion = candidateDeploymentVersion(params.baseVersion, i)
    const baseSalt = deriveDeployBaseSalt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      version: candidateVersion,
    })

    let vaultAddress: Address | null = null
    if (vaultPrefix) {
      const vaultSalt = saltForDeployLabel(baseSalt, 'vault')
      vaultAddress = predictCreate2AddressFromInitCode({
        create2Deployer: params.create2Deployer,
        salt: vaultSalt,
        initCode: params.vaultInitCode,
      })
      if (vaultAddress.slice(2, 2 + vaultPrefix.length).toLowerCase() !== vaultPrefix) continue
    }

    let shareAddress: Address | null = null
    if (shareSuffix) {
      const shareSalt = deriveShareOftSaltFromVersion({
        owner: params.owner,
        shareSymbol: params.shareSymbol,
        version: candidateVersion,
      })
      shareAddress = predictCreate2AddressFromInitCode({
        create2Deployer: params.create2Deployer,
        salt: shareSalt,
        initCode: params.shareOftInitCode,
      })
      if (!shareAddress.toLowerCase().endsWith(shareSuffix)) continue
    }

    if (params.isAddressDeployed) {
      const toCheck = [vaultAddress, shareAddress].filter((v): v is Address => Boolean(v))
      if (toCheck.length > 0) {
        try {
          const deployedStates = await Promise.all(toCheck.map((addr) => params.isAddressDeployed!(addr)))
          if (deployedStates.some(Boolean)) continue
        } catch {
          // ignore deployed-check failures; allow candidate version
        }
      }
    }
    return candidateVersion
  }
  return null
}
