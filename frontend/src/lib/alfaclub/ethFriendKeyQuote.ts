/**
 * Composite ETH → Creator Coin → FriendKey (ERC-1155) quote helpers.
 *
 * Sudoswap prices keys in Creator Coin. ETH funding buys that coin via Zora first,
 * so the UI must not treat ETH amount and key quantity as a direct exchange rate.
 */

export function estimateEthWeiForRequiredAkita(params: {
  requiredAkita: bigint
  probeEthWei: bigint
  probeAkitaOut: bigint
  /** Extra ETH buffer on top of the linear scale (default 1%). */
  bufferBps?: bigint
}): bigint {
  const requiredAkita = params.requiredAkita
  const probeEthWei = params.probeEthWei
  const probeAkitaOut = params.probeAkitaOut
  if (requiredAkita <= 0n) throw new Error('required_akita_invalid')
  if (probeEthWei <= 0n) throw new Error('probe_eth_invalid')
  if (probeAkitaOut <= 0n) throw new Error('probe_akita_invalid')

  const bufferBps = params.bufferBps ?? 100n
  if (bufferBps < 0n || bufferBps > 5_000n) throw new Error('buffer_bps_invalid')

  const raw =
    (requiredAkita * probeEthWei + probeAkitaOut - 1n) / probeAkitaOut
  return (raw * (10_000n + bufferBps) + 9_999n) / 10_000n
}

export function formatEthWeiForInput(wei: bigint): string {
  if (wei <= 0n) return ''
  const whole = wei / 10n ** 18n
  const frac = wei % 10n ** 18n
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '')
  return `${whole.toString()}.${fracStr}`
}

export function fundingCoversSudoswapBuy(params: {
  fundingAkitaOut: bigint
  requiredAkita: bigint
}): boolean {
  return params.fundingAkitaOut > 0n && params.fundingAkitaOut >= params.requiredAkita
}
