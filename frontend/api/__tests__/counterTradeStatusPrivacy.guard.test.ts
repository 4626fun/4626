import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('counter-trade status privacy guard', () => {
  it('does not resolve or return room/default bot-wallet harvest telemetry', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'api/_handlers/v1/alfaclub/_counter-trade-status.ts'),
      'utf8',
    )
    expect(source).not.toContain('resolveArenaIdentityForContext')
    expect(source).not.toContain('identity.agentWalletAddress')
    expect(source).toContain('botWallet: null')
  })
})
