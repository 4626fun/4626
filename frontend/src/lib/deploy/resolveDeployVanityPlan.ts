import {
  concatHex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'

import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import type { CreatorVaultBatcherInfra } from '@/lib/deploy/creatorVaultBatcherInfra'
import { probeGreenfieldPhase1Deploy } from '@/lib/deploy/deployVaultGreenfieldProbe'
import { fetchServerCombinedVanityVersion } from '@/lib/deploy/fetchServerCombinedVanityVersion'
import { fetchServerShareOftVanitySalt } from '@/lib/deploy/fetchServerShareOftVanitySalt'
import {
  isShareSuffixSatisfiedByDeploymentVersion,
  lookupPreseededShareOftSalt,
  lookupPreseededVanityVersionPlan,
} from '@/lib/deploy/perVaultVanityPreseed'
import {
  deriveShareOftSaltFromVersion,
  deriveDeployBaseSalt,
  findDeploymentVersionForVanityTargets,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from '@/lib/deploy/perVaultVanityVersionSearch'
import { logger } from '@/lib/observability/logger'
import {
  buildSaltDisabledShareSuffixInfoNotice,
  buildShareOftVanityUserWarning,
  DEFAULT_SHARE_OFT_VANITY_SUFFIX,
  DEFAULT_VAULT_VANITY_PREFIX,
  deriveShareOftVanityStartAt,
  findCreate2SaltForSuffix,
  normalizeHexSuffix,
  needsCombinedSaltDisabledVanitySearch,
  resolveDeploymentVersionSearchMaxTries,
  resolveDeploymentVersionSearchTargets,
  shouldParallelizeShareSaltWithVersionSearch,
  type DeploymentVanityVersionSearchOutcome,
} from '@/pages/deploy/deployVaultHelpers'
import {
  buildShareOftVanityCacheKey,
  buildVanityVersionCacheKey,
  readPersistedShareOftVanitySalt,
  readPersistedVanityVersionPlan,
  writePersistedShareOftVanitySalt,
  writePersistedVanityVersionPlan,
} from '@/pages/deploy/deployVaultVanityPersistence'
import {
  buildShareVanitySkipLogKey,
  shouldEmitShareVanitySkipLog,
} from '@/pages/deploy/deployVaultSignals'

type PublicClientLike = {
  getBytecode: (args: { address: Address }) => Promise<Hex | null | undefined>
}

export type DeployVanityCacheState = {
  vaultVanityVersion: {
    key: string
    version: string
    outcome?: DeploymentVanityVersionSearchOutcome
  } | null
  shareOftVanity: { key: string; salt: Hex } | null
  shareOftVanitySkipLogKey: string | null
}

export type DeployVanityPlan = {
  deploymentVersionUsed: string
  shareOftSaltOverrideUsed: Hex | null
  vanityVersionSearchOutcome: DeploymentVanityVersionSearchOutcome
  shareOftVanityWarning: string | null
  shareOftVanityInfo: string | null
  vaultInitCode: Hex
  shareOftInitCode: Hex
  shareSymbolLower: string
  vaultAddress: Address
  cacheState: DeployVanityCacheState
}

export type ResolveDeployVanityPlanParams = {
  publicClient: PublicClientLike
  batcherAddress: Address
  batcherInfra: CreatorVaultBatcherInfra
  creatorToken: Address
  owner: Address
  chainId: number
  deploymentVersion: string
  shareOftSaltOverride: Hex | null
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbol: string
  vaultVanityPrefix: string | null
  shareOftVanitySuffix: string | null
  vaultVanityMaxTries: number
  shareOftVanityMaxTries: number
  shareVanityIsCustom: boolean
  cacheState: DeployVanityCacheState
  shortAddress: (value: string) => string
}

function deriveOftBootstrapSalt(): Hex {
  return keccak256(encodePacked(['string'], ['4626:OFTBootstrapRegistry:v1']))
}

export async function resolveDeployVanityPlan(
  params: ResolveDeployVanityPlanParams,
): Promise<DeployVanityPlan> {
  const create2Deployer = params.batcherInfra.create2Deployer
  const tempOwner = params.batcherAddress
  const { supportsPhase1WithSalt } = params.batcherInfra.capabilities
  const shareSymbolLower = params.shareSymbol.toLowerCase()
  const shareSymbolUpper = params.shareSymbol.toUpperCase()

  const oftBootstrapRegistry = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: deriveOftBootstrapSalt(),
    initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
  })
  const shareOftArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
    params.shareName,
    shareSymbolUpper,
    oftBootstrapRegistry,
    tempOwner,
  ])
  const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftArgs])
  const vaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
    params.creatorToken,
    tempOwner,
    params.vaultName,
    params.vaultSymbol,
  ])
  const vaultInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultArgs])

  const isGreenfieldVanityDeploy = await probeGreenfieldPhase1Deploy({
    publicClient: params.publicClient,
    create2Deployer,
    batcherAddress: params.batcherAddress,
    creatorToken: params.creatorToken,
    owner: params.owner,
    chainId: params.chainId,
    deploymentVersion: params.deploymentVersion,
    vaultInitCode,
    shareOftInitCode,
    shareSymbol: params.shareSymbol,
    wrapperBytecode: DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex,
  })
  const vanityAddressDeployedCheck = isGreenfieldVanityDeploy
    ? undefined
    : async (addr: Address) => {
        const bc = await params.publicClient.getBytecode({ address: addr })
        return !!bc && bc !== '0x'
      }

  let deploymentVersionUsed = params.deploymentVersion
  let vanityVersionSearchWarning: string | null = null
  let vanityVersionSearchOutcome: DeploymentVanityVersionSearchOutcome = 'not_applicable'
  const { vaultPrefix: versionSearchVaultPrefix, shareSuffix: versionSearchShareSuffix } =
    resolveDeploymentVersionSearchTargets({
      vaultVanityPrefix: params.vaultVanityPrefix,
      shareOftVanitySuffix: params.shareOftVanitySuffix,
      supportsPhase1WithSalt,
    })
  const usingDefaultVaultVanityTarget = versionSearchVaultPrefix === DEFAULT_VAULT_VANITY_PREFIX
  const usingDefaultShareVanityTarget =
    !versionSearchShareSuffix || versionSearchShareSuffix === DEFAULT_SHARE_OFT_VANITY_SUFFIX
  let provisionalParallelShareSalt: Hex | null = null
  const cacheState = { ...params.cacheState }
  let effectiveVersionSearchMaxTries = params.vaultVanityMaxTries
  const versionSatisfiesSearchTargets = (candidateVersion: string): boolean => {
    const candidateBaseSalt = deriveDeployBaseSalt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      version: candidateVersion,
    })
    if (versionSearchVaultPrefix) {
      const candidateVaultSalt = saltForDeployLabel(candidateBaseSalt, 'vault')
      const candidateVaultAddress = predictCreate2AddressFromInitCode({
        create2Deployer,
        salt: candidateVaultSalt,
        initCode: vaultInitCode,
      })
      if (!candidateVaultAddress.toLowerCase().startsWith(`0x${versionSearchVaultPrefix.toLowerCase()}`)) {
        return false
      }
    }
    if (versionSearchShareSuffix) {
      const candidateShareSalt = deriveShareOftSaltFromVersion({
        owner: params.owner,
        shareSymbol: params.shareSymbol,
        version: candidateVersion,
      })
      const candidateShareAddress = predictCreate2AddressFromInitCode({
        create2Deployer,
        salt: candidateShareSalt,
        initCode: shareOftInitCode,
      })
      if (!candidateShareAddress.toLowerCase().endsWith(versionSearchShareSuffix.toLowerCase())) {
        return false
      }
    }
    return true
  }

  if (versionSearchVaultPrefix || versionSearchShareSuffix) {
    const vanityTargetsKey = buildVanityVersionCacheKey({
      create2Deployer,
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      vaultName: params.vaultName,
      vaultSymbol: params.vaultSymbol,
      shareName: params.shareName,
      shareSymbol: params.shareSymbol,
      baseVersion: params.deploymentVersion,
      vaultPrefix: versionSearchVaultPrefix,
      shareSuffix: versionSearchShareSuffix,
      vaultVanityMaxTries: params.vaultVanityMaxTries,
      shareOftVanityMaxTries: params.shareOftVanityMaxTries,
      supportsPhase1WithSalt,
    })
    let cached = cacheState.vaultVanityVersion
    if (cached?.key !== vanityTargetsKey) {
      const persisted = readPersistedVanityVersionPlan(vanityTargetsKey)
      if (persisted) {
        cached = {
          key: vanityTargetsKey,
          version: persisted.version,
          outcome: persisted.outcome,
        }
        cacheState.vaultVanityVersion = cached
      }
    }
    if (cached?.key === vanityTargetsKey) {
      if (versionSatisfiesSearchTargets(cached.version)) {
        deploymentVersionUsed = cached.version
        vanityVersionSearchOutcome = cached.outcome ?? 'not_applicable'
      } else {
        cacheState.vaultVanityVersion = null
      }
    } else {
      const preseededVersion = lookupPreseededVanityVersionPlan({
        create2Deployer,
        creatorToken: params.creatorToken,
        owner: params.owner,
        batcherAddress: params.batcherAddress,
        chainId: params.chainId,
        vaultName: params.vaultName,
        vaultSymbol: params.vaultSymbol,
        shareName: params.shareName,
        shareSymbol: params.shareSymbol,
        baseVersion: params.deploymentVersion,
        vaultPrefix: versionSearchVaultPrefix,
        shareSuffix: supportsPhase1WithSalt ? params.shareOftVanitySuffix : versionSearchShareSuffix,
        supportsPhase1WithSalt,
      })
      if (preseededVersion) {
        if (versionSatisfiesSearchTargets(preseededVersion.deploymentVersion)) {
          deploymentVersionUsed = preseededVersion.deploymentVersion
          vanityVersionSearchOutcome = preseededVersion.outcome
          cacheState.vaultVanityVersion = {
            key: vanityTargetsKey,
            version: preseededVersion.deploymentVersion,
            outcome: preseededVersion.outcome,
          }
          writePersistedVanityVersionPlan(vanityTargetsKey, {
            version: preseededVersion.deploymentVersion,
            outcome: preseededVersion.outcome,
          })
          logger.info('[DeployVault] vanity_version_preseed_hit', {
            planId: preseededVersion.planId,
            deploymentVersion: preseededVersion.deploymentVersion,
            outcome: preseededVersion.outcome,
          })
        } else {
          logger.warn('[DeployVault] vanity_version_preseed_stale', {
            planId: preseededVersion.planId,
            deploymentVersion: preseededVersion.deploymentVersion,
            requiredVaultPrefix: versionSearchVaultPrefix,
          })
        }
      } else {
      const versionSearchMaxTries = resolveDeploymentVersionSearchMaxTries({
        hasVaultPrefix: Boolean(versionSearchVaultPrefix),
        hasShareSuffix: Boolean(versionSearchShareSuffix),
        supportsPhase1WithSalt,
        vaultVanityMaxTries: params.vaultVanityMaxTries,
        shareOftVanityMaxTries: params.shareOftVanityMaxTries,
      })
      effectiveVersionSearchMaxTries = versionSearchMaxTries
      const combinedSaltDisabledSearch = needsCombinedSaltDisabledVanitySearch({
        supportsPhase1WithSalt,
        vaultPrefix: versionSearchVaultPrefix,
        shareSuffix: versionSearchShareSuffix,
      })
      const runVersionVanitySearch = () =>
        findDeploymentVersionForVanityTargets({
          create2Deployer,
          creatorToken: params.creatorToken,
          owner: params.owner,
          chainId: params.chainId,
          baseVersion: params.deploymentVersion,
          vaultPrefix: versionSearchVaultPrefix,
          shareSuffix: versionSearchShareSuffix,
          maxTries: versionSearchMaxTries,
          vaultInitCode,
          shareOftInitCode,
          shareSymbol: params.shareSymbol,
          isAddressDeployed: vanityAddressDeployedCheck,
        })
      const runProvisionalShareSaltSearch = () => {
        if (
          !shouldParallelizeShareSaltWithVersionSearch({
            supportsPhase1WithSalt,
            hasVaultPrefixTarget: Boolean(versionSearchVaultPrefix),
            hasShareSuffixTarget: Boolean(params.shareOftVanitySuffix),
            shareOftVanityUnsupportedByBatcher: !supportsPhase1WithSalt && Boolean(params.shareOftVanitySuffix),
            hasManualShareOftSaltOverride: Boolean(params.shareOftSaltOverride),
          }) ||
          !params.shareOftVanitySuffix
        ) {
          return Promise.resolve(null)
        }
        return findCreate2SaltForSuffix({
          create2Deployer,
          initCode: shareOftInitCode,
          suffix: params.shareOftVanitySuffix,
          maxTries: params.shareOftVanityMaxTries,
          startAt: deriveShareOftVanityStartAt({
            creatorToken: params.creatorToken,
            owner: params.owner,
            deploymentVersion: params.deploymentVersion,
          }),
          isAddressDeployed: vanityAddressDeployedCheck,
        })
      }
      const parallelShareSaltWithVersion = shouldParallelizeShareSaltWithVersionSearch({
        supportsPhase1WithSalt,
        hasVaultPrefixTarget: Boolean(versionSearchVaultPrefix),
        hasShareSuffixTarget: Boolean(params.shareOftVanitySuffix),
        shareOftVanityUnsupportedByBatcher: !supportsPhase1WithSalt && Boolean(params.shareOftVanitySuffix),
        hasManualShareOftSaltOverride: Boolean(params.shareOftSaltOverride),
      })
      const serverCombinedVersionPromise =
        combinedSaltDisabledSearch && versionSearchVaultPrefix && versionSearchShareSuffix
          ? (async () => {
              try {
                logger.info('[DeployVault] combined_vanity_server_search_start', {
                  vaultPrefix: versionSearchVaultPrefix,
                  shareSuffix: versionSearchShareSuffix,
                  clientAttempts: versionSearchMaxTries,
                })
                return await fetchServerCombinedVanityVersion({
                  create2Deployer,
                  creatorToken: params.creatorToken,
                  owner: params.owner,
                  chainId: params.chainId,
                  baseVersion: params.deploymentVersion,
                  vaultPrefix: versionSearchVaultPrefix,
                  shareSuffix: versionSearchShareSuffix,
                  startAttempt: versionSearchMaxTries,
                  vaultInitCode,
                  shareOftInitCode,
                  shareSymbol: params.shareSymbol,
                })
              } catch (serverSearchError) {
                logger.warn('[DeployVault] combined_vanity_server_search_failed', {
                  error:
                    serverSearchError instanceof Error
                      ? serverSearchError.message
                      : String(serverSearchError ?? ''),
                })
                return null
              }
            })()
          : Promise.resolve(null)
      let foundVersion: string | null
      if (parallelShareSaltWithVersion) {
        const [versionResult, provisionalSalt, serverVersion] = await Promise.all([
          runVersionVanitySearch(),
          runProvisionalShareSaltSearch(),
          serverCombinedVersionPromise,
        ])
        foundVersion = versionResult ?? serverVersion
        if (foundVersion && !versionSatisfiesSearchTargets(foundVersion)) {
          logger.warn('[DeployVault] vanity_version_candidate_rejected', {
            source: versionResult ? 'client' : 'server',
            deploymentVersion: foundVersion,
            requiredVaultPrefix: versionSearchVaultPrefix,
            requiredShareSuffix: versionSearchShareSuffix,
          })
          foundVersion = null
        }
        provisionalParallelShareSalt = provisionalSalt
      } else {
        const [versionResult, serverVersion] = await Promise.all([
          runVersionVanitySearch(),
          serverCombinedVersionPromise,
        ])
        foundVersion = versionResult ?? serverVersion
        if (foundVersion && !versionSatisfiesSearchTargets(foundVersion)) {
          logger.warn('[DeployVault] vanity_version_candidate_rejected', {
            source: versionResult ? 'client' : 'server',
            deploymentVersion: foundVersion,
            requiredVaultPrefix: versionSearchVaultPrefix,
            requiredShareSuffix: versionSearchShareSuffix,
          })
          foundVersion = null
        }
      }
      if (foundVersion) {
        if (versionSearchVaultPrefix && versionSearchShareSuffix) {
          vanityVersionSearchOutcome = 'combined_match'
        } else if (versionSearchVaultPrefix) {
          vanityVersionSearchOutcome = 'vault_only_match'
        } else if (versionSearchShareSuffix) {
          vanityVersionSearchOutcome = 'share_only_match'
        } else {
          vanityVersionSearchOutcome = 'combined_match'
        }
      }
      if (!foundVersion) {
        if (versionSearchVaultPrefix && versionSearchShareSuffix) {
          vanityVersionSearchOutcome =
            usingDefaultVaultVanityTarget && usingDefaultShareVanityTarget
              ? 'missed_defaults'
              : 'missed_custom'
          throw new Error(
            `Unable to find a deployment version matching vault prefix "0x${versionSearchVaultPrefix}" and share suffix "${versionSearchShareSuffix}" ` +
              `in ${versionSearchMaxTries.toLocaleString()} tries (share-only fallback also failed after ${params.shareOftVanityMaxTries.toLocaleString()} tries).`,
          )
        } else if (versionSearchShareSuffix) {
          vanityVersionSearchOutcome = usingDefaultShareVanityTarget ? 'missed_defaults' : 'missed_custom'
          throw new Error(
            `Unable to find ShareOFT vanity suffix "${versionSearchShareSuffix}" in ${params.shareOftVanityMaxTries.toLocaleString()} deployment-version tries.`,
          )
        } else if (versionSearchVaultPrefix) {
          vanityVersionSearchOutcome = usingDefaultVaultVanityTarget ? 'missed_defaults' : 'missed_custom'
          throw new Error(
            `Unable to find vault vanity prefix "0x${versionSearchVaultPrefix}" in ${params.vaultVanityMaxTries.toLocaleString()} deployment-version tries. ` +
              'Increase VITE_VAULT_VANITY_MAX_TRIES and retry.',
          )
        }
      }
      if (foundVersion) {
        deploymentVersionUsed = foundVersion
        cacheState.vaultVanityVersion = {
          key: vanityTargetsKey,
          version: foundVersion,
          outcome: vanityVersionSearchOutcome,
        }
        writePersistedVanityVersionPlan(vanityTargetsKey, {
          version: foundVersion,
          outcome: vanityVersionSearchOutcome,
        })
      }
      }
    }
  }

  const deriveVaultAddressForVersion = (candidateVersion: string): Address => {
    const candidateBaseSalt = deriveDeployBaseSalt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      version: candidateVersion,
    })
    const candidateVaultSalt = saltForDeployLabel(candidateBaseSalt, 'vault')
    return predictCreate2AddressFromInitCode({
      create2Deployer,
      salt: candidateVaultSalt,
      initCode: vaultInitCode,
    })
  }

  let vaultAddress = deriveVaultAddressForVersion(deploymentVersionUsed)

  const shareOftVanityUnsupportedByBatcher = !supportsPhase1WithSalt && Boolean(params.shareOftVanitySuffix)
  const batcherDisplay = params.shortAddress(params.batcherAddress)
  let shareOftVanityWarning: string | null = buildShareOftVanityUserWarning({
    shareOftVanitySuffix: params.shareOftVanitySuffix,
    vaultVanityPrefix: versionSearchVaultPrefix,
    saltOverrideDisabled: shareOftVanityUnsupportedByBatcher,
    versionSearchOutcome: vanityVersionSearchOutcome,
  })
  if (shareOftVanityUnsupportedByBatcher && params.shareVanityIsCustom) {
    throw new Error(
      `Active batcher ${batcherDisplay} does not support Phase-1 salt overrides. ` +
        `Custom share token vanity suffix "${params.shareOftVanitySuffix}" is blocked for this deploy.`,
    )
  }
  if (
    shareOftVanityUnsupportedByBatcher &&
    !params.shareVanityIsCustom &&
    vanityVersionSearchOutcome === 'not_applicable'
  ) {
    const skipLogKey = buildShareVanitySkipLogKey({
      batcher: params.batcherAddress,
      suffix: params.shareOftVanitySuffix,
      reason: 'phase1_salt_overrides_not_supported',
    })
    if (shouldEmitShareVanitySkipLog({ lastKey: cacheState.shareOftVanitySkipLogKey, nextKey: skipLogKey })) {
      cacheState.shareOftVanitySkipLogKey = skipLogKey
      logger.debug('[DeployVault] share_oft_vanity_suffix_skipped_default', {
        batcher: params.batcherAddress,
        suffix: params.shareOftVanitySuffix,
        reason: 'phase1_salt_overrides_not_supported',
      })
    }
  }
  if (vanityVersionSearchWarning && !shareOftVanityWarning) {
    shareOftVanityWarning = vanityVersionSearchWarning
  }
  const shareOftVanityInfo = buildSaltDisabledShareSuffixInfoNotice({
    versionSearchOutcome: vanityVersionSearchOutcome,
    vaultVanityPrefix: versionSearchVaultPrefix,
    shareOftVanitySuffix: params.shareOftVanitySuffix,
    saltOverrideDisabled: shareOftVanityUnsupportedByBatcher,
    deploymentVersionUsed,
  })

  let shareOftSaltOverrideUsed = params.shareOftSaltOverride
  if (shareOftSaltOverrideUsed && shareOftVanityUnsupportedByBatcher) {
    shareOftSaltOverrideUsed = null
    const overrideWarning =
      `Ignoring ShareOFT salt override because active batcher ${batcherDisplay} does not support Phase-1 salt overrides.`
    shareOftVanityWarning = shareOftVanityWarning
      ? `${shareOftVanityWarning} ${overrideWarning}`
      : overrideWarning
  }

  if (
    !shareOftSaltOverrideUsed &&
    params.shareOftVanitySuffix &&
    !shareOftVanityUnsupportedByBatcher &&
    isShareSuffixSatisfiedByDeploymentVersion({
      create2Deployer,
      owner: params.owner,
      shareSymbol: params.shareSymbol,
      deploymentVersion: deploymentVersionUsed,
      shareOftInitCode,
      shareSuffix: params.shareOftVanitySuffix,
    })
  ) {
    logger.debug('[DeployVault] share_oft_vanity_suffix_satisfied_by_version', {
      deploymentVersion: deploymentVersionUsed,
      suffix: params.shareOftVanitySuffix,
    })
  } else if (!shareOftSaltOverrideUsed && params.shareOftVanitySuffix && !shareOftVanityUnsupportedByBatcher) {
    const initCodeHash = keccak256(shareOftInitCode)
    const vanityKey = buildShareOftVanityCacheKey({
      create2Deployer,
      initCodeHash,
      shareOftVanitySuffix: params.shareOftVanitySuffix,
      shareOftVanityMaxTries: params.shareOftVanityMaxTries,
      deploymentVersion: deploymentVersionUsed,
      creatorToken: params.creatorToken,
      owner: params.owner,
    })
    let cached = cacheState.shareOftVanity
    if (cached?.key !== vanityKey) {
      const persisted = readPersistedShareOftVanitySalt(vanityKey)
      if (persisted) {
        cached = { key: vanityKey, salt: persisted }
        cacheState.shareOftVanity = cached
      }
    }
    if (cached?.key === vanityKey) {
      shareOftSaltOverrideUsed = cached.salt
    } else {
      const preseededSalt = lookupPreseededShareOftSalt({
        create2Deployer,
        creatorToken: params.creatorToken,
        owner: params.owner,
        batcherAddress: params.batcherAddress,
        chainId: params.chainId,
        vaultName: params.vaultName,
        vaultSymbol: params.vaultSymbol,
        shareName: params.shareName,
        shareSymbol: params.shareSymbol,
        baseVersion: params.deploymentVersion,
        shareOftVanitySuffix: params.shareOftVanitySuffix,
        deploymentVersion: deploymentVersionUsed,
        supportsPhase1WithSalt,
      })
      if (preseededSalt) {
        shareOftSaltOverrideUsed = preseededSalt
        cacheState.shareOftVanity = { key: vanityKey, salt: preseededSalt }
        writePersistedShareOftVanitySalt(vanityKey, preseededSalt)
        logger.info('[DeployVault] share_oft_vanity_preseed_hit', {
          deploymentVersion: deploymentVersionUsed,
          suffix: params.shareOftVanitySuffix,
        })
      } else if (provisionalParallelShareSalt && deploymentVersionUsed === params.deploymentVersion) {
        shareOftSaltOverrideUsed = provisionalParallelShareSalt
        cacheState.shareOftVanity = { key: vanityKey, salt: provisionalParallelShareSalt }
        writePersistedShareOftVanitySalt(vanityKey, provisionalParallelShareSalt)
      } else {
      const saltStartAt = deriveShareOftVanityStartAt({
        creatorToken: params.creatorToken,
        owner: params.owner,
        deploymentVersion: deploymentVersionUsed,
      })
      const skipSaltDeployedCheck =
        deploymentVersionUsed === params.deploymentVersion
          ? isGreenfieldVanityDeploy
          : await probeGreenfieldPhase1Deploy({
              publicClient: params.publicClient,
              create2Deployer,
              batcherAddress: params.batcherAddress,
              creatorToken: params.creatorToken,
              owner: params.owner,
              chainId: params.chainId,
              deploymentVersion: deploymentVersionUsed,
              vaultInitCode,
              shareOftInitCode,
              shareSymbol: params.shareSymbol,
              wrapperBytecode: DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex,
            })
      const saltDeployedCheck = skipSaltDeployedCheck ? undefined : vanityAddressDeployedCheck
      let found = await findCreate2SaltForSuffix({
        create2Deployer,
        initCode: shareOftInitCode,
        suffix: params.shareOftVanitySuffix,
        maxTries: params.shareOftVanityMaxTries,
        startAt: saltStartAt,
        isAddressDeployed: saltDeployedCheck,
      })
      if (!found) {
        try {
          logger.info('[DeployVault] share_oft_vanity_server_search_start', {
            suffix: params.shareOftVanitySuffix,
            clientAttempts: params.shareOftVanityMaxTries,
            deploymentVersion: deploymentVersionUsed,
          })
          found = await fetchServerShareOftVanitySalt({
            create2Deployer,
            initCode: shareOftInitCode,
            startAt: saltStartAt,
            suffix: params.shareOftVanitySuffix,
            maxAttempts: params.shareOftVanityMaxTries,
          })
        } catch (serverSearchError) {
          logger.warn('[DeployVault] share_oft_vanity_server_search_failed', {
            error:
              serverSearchError instanceof Error ? serverSearchError.message : String(serverSearchError ?? ''),
          })
        }
      }
      if (!found) {
        throw new Error(
          `Unable to find ShareOFT vanity suffix "${params.shareOftVanitySuffix}" in ${params.shareOftVanityMaxTries.toLocaleString()} tries. ` +
            'Increase VITE_SHARE_OFT_VANITY_MAX_TRIES and retry.',
        )
      }
      shareOftSaltOverrideUsed = found
      cacheState.shareOftVanity = { key: vanityKey, salt: found }
      writePersistedShareOftVanitySalt(vanityKey, found)
      }
    }
  }

  const requestedVaultPrefix = normalizeHexSuffix(params.vaultVanityPrefix)
  if (requestedVaultPrefix && !vaultAddress.toLowerCase().startsWith(`0x${requestedVaultPrefix}`)) {
    if (versionSearchVaultPrefix) {
      const deterministicVersion = await findDeploymentVersionForVanityTargets({
        create2Deployer,
        creatorToken: params.creatorToken,
        owner: params.owner,
        chainId: params.chainId,
        baseVersion: params.deploymentVersion,
        vaultPrefix: versionSearchVaultPrefix,
        shareSuffix: versionSearchShareSuffix,
        maxTries: effectiveVersionSearchMaxTries,
        vaultInitCode,
        shareOftInitCode,
        shareSymbol: params.shareSymbol,
        isAddressDeployed: vanityAddressDeployedCheck,
        preferWasm: false,
      })
      if (deterministicVersion && deterministicVersion !== deploymentVersionUsed) {
        deploymentVersionUsed = deterministicVersion
        vaultAddress = deriveVaultAddressForVersion(deploymentVersionUsed)
        cacheState.vaultVanityVersion = {
          key: buildVanityVersionCacheKey({
            create2Deployer,
            creatorToken: params.creatorToken,
            owner: params.owner,
            chainId: params.chainId,
            vaultName: params.vaultName,
            vaultSymbol: params.vaultSymbol,
            shareName: params.shareName,
            shareSymbol: params.shareSymbol,
            baseVersion: params.deploymentVersion,
            vaultPrefix: versionSearchVaultPrefix,
            shareSuffix: versionSearchShareSuffix,
            vaultVanityMaxTries: params.vaultVanityMaxTries,
            shareOftVanityMaxTries: params.shareOftVanityMaxTries,
            supportsPhase1WithSalt,
          }),
          version: deterministicVersion,
          outcome: vanityVersionSearchOutcome,
        }
      }
    }
  }
  if (requestedVaultPrefix && !vaultAddress.toLowerCase().startsWith(`0x${requestedVaultPrefix}`)) {
    throw new Error(
      `Resolved vault address ${vaultAddress} does not satisfy required vanity prefix 0x${requestedVaultPrefix}. ` +
        'Retry with a higher search budget or run the offline vanity grinder.',
    )
  }

  const requestedShareSuffix = normalizeHexSuffix(params.shareOftVanitySuffix)
  if (requestedShareSuffix) {
    const shareSuffixSatisfied = shareOftSaltOverrideUsed
      ? predictCreate2AddressFromInitCode({
          create2Deployer,
          salt: shareOftSaltOverrideUsed,
          initCode: shareOftInitCode,
        })
          .toLowerCase()
          .endsWith(requestedShareSuffix)
      : isShareSuffixSatisfiedByDeploymentVersion({
          create2Deployer,
          owner: params.owner,
          shareSymbol: params.shareSymbol,
          deploymentVersion: deploymentVersionUsed,
          shareOftInitCode,
          shareSuffix: requestedShareSuffix,
        })
    if (!shareSuffixSatisfied) {
      throw new Error(
        `Resolved ShareOFT vanity does not satisfy required suffix ${requestedShareSuffix}. ` +
          'Retry with a higher search budget or run the offline vanity grinder.',
      )
    }
  }

  return {
    deploymentVersionUsed,
    shareOftSaltOverrideUsed,
    vanityVersionSearchOutcome,
    shareOftVanityWarning,
    shareOftVanityInfo,
    vaultInitCode,
    shareOftInitCode,
    shareSymbolLower,
    vaultAddress,
    cacheState,
  }
}