/**
 * Diagnose Zora CSW swap simulation for agent wallet.
 * Usage: pnpm -C frontend exec tsx scripts/debug-zora-csw-swap.ts
 */
import { createPublicClient, getAddress, http, isAddress, type Hex } from 'viem'
import { base } from 'viem/chains'
import { permit2ABI, permit2Address } from '@zoralabs/protocol-deployments'

const CSW = getAddress('0xab6d5c10b03300326cd7fab7267ae192842967b5')
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const AKITA = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const ROUTER = getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43')

async function fetchZoraQuote(amountIn: string, slippage: number) {
  const key = (process.env.ZORA_SERVER_API_KEY ?? '').trim()
  const body = {
    tokenIn: { type: 'erc20', address: USDC },
    tokenOut: { type: 'erc20', address: AKITA },
    amountIn,
    slippage,
    chainId: 8453,
    sender: CSW,
    recipient: CSW,
  }
  const res = await fetch('https://api-sdk.zora.engineering/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'x-api-key': key } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Zora ${res.status}: ${text.slice(0, 500)}`)
  return JSON.parse(text) as {
    success?: boolean
    call?: { target: string; data: string; value: string }
    permits?: Array<{
      signature: string
      permit: { details: { amount: string; nonce: number }; spender: string }
    }>
    quote?: { amountOut?: string; slippage?: number }
  }
}

async function main() {
  const rpc = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const client = createPublicClient({ chain: base, transport: http(rpc) })

  const bal = await client.readContract({
    address: USDC,
    abi: [
      {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'balanceOf',
    args: [CSW],
  })
  console.log('CSW USDC balance:', bal.toString())

  const [, , chainNonce] = (await client.readContract({
    abi: permit2ABI,
    address: permit2Address[base.id],
    functionName: 'allowance',
    args: [CSW, USDC, ROUTER],
  })) as [bigint, bigint, number]
  console.log('Permit2 allowance nonce (chain):', chainNonce)

  const cases: Array<[string, string, number]> = [
    ['1 USDC @ 5%', '1000000', 0.05],
    ['50 USDC @ 5%', '50000000', 0.05],
    ['100 USDC @ 5%', '100000000', 0.05],
    ['887 USDC @ 0.5%', '887174848', 0.005],
    ['887 USDC @ 5%', '887174848', 0.05],
    ['887 USDC @ 15%', '887174848', 0.15],
  ]

  for (const [label, amountIn, slippage] of cases) {
    try {
      const q = await fetchZoraQuote(amountIn, slippage)
      const permit = q.permits?.[0]
      console.log(`\n=== ${label} ===`)
      console.log({
        hasCall: Boolean(q.call?.data),
        callTarget: q.call?.target,
        callDataLen: q.call?.data?.length,
        permitQuotedNonce: permit?.permit?.details?.nonce,
        permitAmount: permit?.permit?.details?.amount,
        permitSpender: permit?.permit?.spender,
        amountOut: q.quote?.amountOut,
        apiSlippage: q.quote?.slippage,
        nonceDrift: permit ? permit.permit.details.nonce !== chainNonce : null,
      })

      if (q.call?.target && q.call?.data && isAddress(q.call.target)) {
        try {
          await client.call({
            to: getAddress(q.call.target),
            data: q.call.data as Hex,
            value: BigInt(q.call.value ?? '0'),
            account: CSW,
          })
          console.log('eth_call: OK (unexpected without signed permit)')
        } catch (e: unknown) {
          const err = e as { shortMessage?: string; cause?: { data?: string } }
          const data =
            (err.cause as { data?: string } | undefined)?.data ??
            (e as { data?: string }).data
          console.log('eth_call: REVERT', err.shortMessage ?? String(e))
          if (typeof data === 'string') console.log('  revertData:', data.slice(0, 66), '…')
        }
      }
    } catch (e) {
      console.log(`\n=== ${label} === ERR`, e instanceof Error ? e.message : e)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
