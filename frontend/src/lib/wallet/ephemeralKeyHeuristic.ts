// Detects when a recovered "owner-key candidate" address has zero on-chain
// presence (no contract code AND zero transactions). That pattern is highly
// consistent with a Base App sub-account session key — an ephemeral key derived
// per session by the Coinbase Wallet SDK, which is never an on-chain owner of
// the CSW. When this fires alongside a red verdict in the probe, no client-side
// signing tweak will fix it; the only path forward is the EOA-owner submission
// lane.

// We accept any client that exposes the two methods we use, instead of viem's
// generic `PublicClient<transport, chain>` whose chain-parameterized type is
// not assignable across wagmi's hook-derived chain. Both methods are part of
// PublicActions, so passing a real viem PublicClient still satisfies this.
export type EphemeralKeyClient = {
  getCode: (args: { address: `0x${string}` }) => Promise<`0x${string}` | undefined>
  getTransactionCount: (args: { address: `0x${string}` }) => Promise<number | bigint>
}

export type EphemeralKeySignal = {
  address: `0x${string}`
  code: `0x${string}` | null
  txCount: number | null
  isEphemeralCandidate: boolean
}

export async function checkEphemeralKey(
  client: EphemeralKeyClient,
  address: `0x${string}`,
): Promise<EphemeralKeySignal> {
  const [codeResult, txCountResult] = await Promise.allSettled([
    client.getCode({ address }),
    client.getTransactionCount({ address }),
  ])

  const code =
    codeResult.status === 'fulfilled'
      ? ((codeResult.value ?? '0x') as `0x${string}`)
      : null
  const txCount =
    txCountResult.status === 'fulfilled' ? Number(txCountResult.value) : null

  const isEphemeralCandidate = code === '0x' && txCount === 0

  return { address, code, txCount, isEphemeralCandidate }
}
