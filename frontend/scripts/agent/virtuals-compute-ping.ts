import { pingVirtualsCompute } from '../../server/agents/eliza/plugins/virtuals/computePing.js'

async function main(): Promise<void> {
  const apiKey = String(process.env.VIRTUALS_API_KEY ?? '').trim()
  const result = await pingVirtualsCompute({ apiKey })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.ok ? 0 : 1
}

void main().catch((error) => {
  console.error('[virtuals-compute-ping] fatal:', error)
  process.exit(1)
})
