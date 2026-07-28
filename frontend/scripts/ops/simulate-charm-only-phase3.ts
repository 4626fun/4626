#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPublicClient, http, type Hex } from 'viem'
import { base } from 'viem/chains'

async function main(): Promise<void> {
  const planPath = resolve(
    process.cwd(),
    process.argv[2] || 'artifacts/akita-charm-only-phase3-20260728.json',
  )
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as {
    phase3Calls: Array<{ to: string; data: string }>
    smartWallet?: string
  }
  const call = plan.phase3Calls[0]
  if (!call) throw new Error('No phase3Calls[0]')
  const rpc = String(process.env.BASE_RPC_URL ?? '')
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
    .replace('/ws/', '/rpc/')
  const client = createPublicClient({ chain: base, transport: http(rpc) })
  const from = (plan.smartWallet || '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5') as Hex
  try {
    const res = await client.call({
      account: from,
      to: call.to as Hex,
      data: call.data as Hex,
      gas: 16_000_000n,
    })
    process.stdout.write(`${JSON.stringify({ ok: true, data: res.data?.slice(0, 130) }, null, 2)}\n`)
  } catch (error) {
    const err = error as {
      shortMessage?: string
      message?: string
      details?: string
      metaMessages?: string[]
      cause?: { data?: string; reason?: string }
    }
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          shortMessage: err.shortMessage,
          message: err.message,
          details: err.details,
          metaMessages: err.metaMessages,
          causeData: err.cause?.data,
          causeReason: err.cause?.reason,
        },
        null,
        2,
      )}\n`,
    )
    process.exit(1)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
