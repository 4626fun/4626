export type CheckStatus = 'pass' | 'fail' | 'warn' | 'info'

export type Check = {
  id: string
  label: string
  status: CheckStatus
  details?: string
  href?: string
}

export type CheckSection = {
  id: string
  title: string
  description?: string
  checks: Check[]
}

export type ProtocolReportResponse = {
  chainId: number
  generatedAt: string
  sections: CheckSection[]
}

export type VaultReportResponse = {
  chainId: number
  generatedAt: string
  sections: CheckSection[]
  context?: Record<string, unknown>
}

export type VaultFixContext = {
  vault?: string
  vaultOwner?: string
  owner?: string
  creatorToken?: string
  shareOFTAddress?: string
  shareOftOwner?: string | null
  shareVault?: string | null
  shareGaugeController?: string | null
  shareMinterOk?: boolean | null
  wrapperAddress?: string
  wrapperOwner?: string | null
  wrapperWhitelisted?: boolean | null
  gaugeAddress?: string
  oracleAddress?: string | null
  oracleOwner?: string | null
  oracleV3PoolConfigured?: boolean | null
  oracleV3Pool?: string | null
  v3PoolAddress?: string | null
  v3ObservationCardinalityNext?: string | null
  ajnaAdapterAddress?: string | null
  ajnaAdapterOwner?: string | null
  ajnaInnerVaultAddress?: string | null
  ajnaAuthAddress?: string | null
  ajnaAuthAdmin?: string | null
  ajnaBufferRatioBps?: string | null
  ajnaMinBucketIndex?: string | null
  ajnaPaused?: boolean | null
  ajnaSuggestedBucketIndex?: string | null
}

export type ResolvedStatusFixContext = {
  vaultAddress: string | null
  vaultOwner: string | null
  creatorToken: string | null
  shareOFT: string | null
  shareOwner: string | null
  shareVault: string | null
  shareGauge: string | null
  shareMinterOk: boolean | null
  wrapper: string | null
  wrapperWhitelisted: boolean | null
  gauge: string | null
  oracle: string | null
  oracleOwner: string | null
  oracleV3PoolConfigured: boolean | null
  oracleV3Pool: string | null
  v3Pool: string | null
  v3ObsNext: number | null
  ajnaInnerVault: string | null
  ajnaAuth: string | null
  ajnaAuthAdmin: string | null
  ajnaBufferRatioBps: bigint | null
  ajnaMinBucket: bigint | null
  ajnaPaused: boolean | null
  ajnaSuggestedBucket: bigint | null
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function summarize(sections: CheckSection[]) {
  let pass = 0
  let fail = 0
  let warn = 0
  let info = 0
  for (const s of sections) {
    for (const c of s.checks) {
      if (c.status === 'pass') pass++
      else if (c.status === 'fail') fail++
      else if (c.status === 'warn') warn++
      else info++
    }
  }
  return { pass, fail, warn, info }
}

export function basescanAddressHref(addr: string) {
  return `https://basescan.org/address/${addr}`
}

function asAddress(value: unknown): string | null {
  return typeof value === 'string' && isAddressLike(value) ? value : null
}

function asNumberString(value: unknown): string | null {
  return typeof value === 'string' && /^\d+$/.test(value) ? value : null
}

export function resolveStatusFixContext(
  rawContext: Record<string, unknown> | null | undefined,
  vaultParamAddress: string | null,
): ResolvedStatusFixContext {
  const ctx = (rawContext ?? {}) as VaultFixContext
  return {
    vaultAddress: asAddress(ctx.vault) ?? vaultParamAddress,
    vaultOwner: asAddress(ctx.vaultOwner) ?? asAddress(ctx.owner),
    creatorToken: asAddress(ctx.creatorToken),
    shareOFT: asAddress(ctx.shareOFTAddress),
    shareOwner: asAddress(ctx.shareOftOwner),
    shareVault: asAddress(ctx.shareVault),
    shareGauge: asAddress(ctx.shareGaugeController),
    shareMinterOk: typeof ctx.shareMinterOk === 'boolean' ? ctx.shareMinterOk : null,
    wrapper: asAddress(ctx.wrapperAddress),
    wrapperWhitelisted: typeof ctx.wrapperWhitelisted === 'boolean' ? ctx.wrapperWhitelisted : null,
    gauge: asAddress(ctx.gaugeAddress),
    oracle: asAddress(ctx.oracleAddress),
    oracleOwner: asAddress(ctx.oracleOwner),
    oracleV3PoolConfigured: typeof ctx.oracleV3PoolConfigured === 'boolean' ? ctx.oracleV3PoolConfigured : null,
    oracleV3Pool: asAddress(ctx.oracleV3Pool),
    v3Pool: asAddress(ctx.v3PoolAddress),
    v3ObsNext: (() => {
      const value = asNumberString(ctx.v3ObservationCardinalityNext)
      return value ? Number(value) : null
    })(),
    ajnaInnerVault: asAddress(ctx.ajnaInnerVaultAddress),
    ajnaAuth: asAddress(ctx.ajnaAuthAddress),
    ajnaAuthAdmin: asAddress(ctx.ajnaAuthAdmin),
    ajnaBufferRatioBps: (() => {
      const value = asNumberString(ctx.ajnaBufferRatioBps)
      return value ? BigInt(value) : null
    })(),
    ajnaMinBucket: (() => {
      const value = asNumberString(ctx.ajnaMinBucketIndex)
      return value ? BigInt(value) : null
    })(),
    ajnaPaused: typeof ctx.ajnaPaused === 'boolean' ? ctx.ajnaPaused : null,
    ajnaSuggestedBucket: (() => {
      const value = asNumberString(ctx.ajnaSuggestedBucketIndex)
      return value ? BigInt(value) : null
    })(),
  }
}

export function countPotentialVaultFixes(context: ResolvedStatusFixContext): number {
  let count = 0

  if (context.shareOFT && context.vaultAddress && (!context.shareVault || context.shareVault.toLowerCase() !== context.vaultAddress.toLowerCase())) {
    count += 1
  }

  if (context.shareOFT && context.gauge && (!context.shareGauge || context.shareGauge.toLowerCase() !== context.gauge.toLowerCase())) {
    count += 1
  }

  if (context.shareOFT && context.wrapper && context.shareMinterOk === false) {
    count += 1
  }

  if (context.vaultAddress && context.wrapper && context.wrapperWhitelisted !== true) {
    count += 1
  }

  if (
    context.oracle &&
    context.v3Pool &&
    context.creatorToken &&
    (context.oracleV3PoolConfigured !== true ||
      !context.oracleV3Pool ||
      context.oracleV3Pool.toLowerCase() !== context.v3Pool.toLowerCase())
  ) {
    count += 1
  }

  if (
    context.ajnaAuth &&
    context.ajnaSuggestedBucket !== null &&
    context.ajnaSuggestedBucket !== undefined &&
    (context.ajnaMinBucket === null ||
      context.ajnaMinBucket === undefined ||
      context.ajnaMinBucket !== context.ajnaSuggestedBucket)
  ) {
    count += 1
  }

  if (context.v3Pool && (context.v3ObsNext == null || context.v3ObsNext < 64)) {
    count += 1
  }

  return count
}
