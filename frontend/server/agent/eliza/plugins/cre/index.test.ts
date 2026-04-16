import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getKeeprVaultByGroupIdMock } = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
}))

vi.mock('../../../../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
}))

import { crePlugin } from './index.ts'

type AnyAction = {
  name?: string
  validate?: (runtime: unknown, message: any) => Promise<boolean> | boolean
  handler?: (
    runtime: unknown,
    message: any,
    state?: unknown,
    options?: Record<string, unknown>,
    callback?: (content: any) => Promise<any[]>,
  ) => Promise<void>
}

const ENV_KEYS = [
  'DRY_RUN',
  'ELIZA_CRE_DRY_RUN',
  'KEEPR_PRIVATE_KEY',
  'SOLANA_RPC_URL',
  'KEEPR_API_KEY',
] as const

const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])) as Record<string, string | undefined>

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

function getAction(name: string): AnyAction {
  const action = (crePlugin.actions ?? []).find((entry) => entry?.name === name) as AnyAction | undefined
  if (!action?.validate || !action?.handler) {
    throw new Error(`Missing action: ${name}`)
  }
  return action
}

async function runActionText(
  action: AnyAction,
  text: string,
  metadata: Record<string, unknown> = {
    conversationId: 'group-1',
    senderAddress: '0x1111111111111111111111111111111111111111',
  },
): Promise<string> {
  const message = { content: { text, metadata } }
  const valid = await action.validate?.({}, message)
  expect(valid).toBe(true)
  const outputs: string[] = []
  await action.handler?.({}, message, undefined, undefined, async (content: any) => {
    outputs.push(String(content?.text ?? ''))
    return []
  })
  return outputs.join('\n---\n')
}

describe('cre plugin dry-run gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getKeeprVaultByGroupIdMock.mockResolvedValue({
      canonicalOwnerAddress: '0x1111111111111111111111111111111111111111',
      config: { roles: { admins: ['0x2222222222222222222222222222222222222222'] } },
    })
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, originalEnv[key])
    }
  })

  it('blocks mutating trigger commands when DRY_RUN is enabled', async () => {
    setEnv('DRY_RUN', 'true')
    setEnv('ELIZA_CRE_DRY_RUN', undefined)
    setEnv('KEEPR_PRIVATE_KEY', undefined)
    setEnv('KEEPR_API_KEY', undefined)
    setEnv('SOLANA_RPC_URL', undefined)

    const trigger = getAction('CRE_TRIGGER')
    const text = await runActionText(trigger, '/cre tend 0x1111111111111111111111111111111111111111')

    expect(text).toContain('DRY_RUN is enabled')
    expect(text).toContain('Skipping mutating CRE command')
    expect(text).toContain('/cre tend')
    expect(text).not.toContain('Keeper wallet not configured')
  })

  it('supports ELIZA_CRE_DRY_RUN override gate', async () => {
    setEnv('DRY_RUN', '0')
    setEnv('ELIZA_CRE_DRY_RUN', '1')
    setEnv('KEEPR_API_KEY', undefined)

    const trigger = getAction('CRE_TRIGGER')
    const text = await runActionText(trigger, '/cre queue')

    expect(text).toContain('DRY_RUN is enabled')
    expect(text).toContain('/cre queue')
  })

  it('keeps existing trigger behavior when dry run is disabled', async () => {
    setEnv('DRY_RUN', '0')
    setEnv('ELIZA_CRE_DRY_RUN', '0')
    setEnv('KEEPR_API_KEY', undefined)

    const trigger = getAction('CRE_TRIGGER')
    const text = await runActionText(trigger, '/cre queue')

    expect(text).toContain('Keepr API not configured')
  })

  it('shows dry-run status in help output', async () => {
    setEnv('DRY_RUN', 'true')
    setEnv('ELIZA_CRE_DRY_RUN', undefined)

    const help = getAction('CRE_HELP')
    const text = await runActionText(help, '/cre help')

    expect(text).toContain('Dry run: yes')
  })

  it('denies trigger commands for MEMBER role', async () => {
    setEnv('DRY_RUN', '0')
    setEnv('ELIZA_CRE_DRY_RUN', '0')
    getKeeprVaultByGroupIdMock.mockResolvedValue({
      canonicalOwnerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      config: { roles: { admins: [] } },
    })

    const trigger = getAction('CRE_TRIGGER')
    const text = await runActionText(trigger, '/cre queue', {
      conversationId: 'group-1',
      senderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })

    expect(text).toContain('Denied: ADMIN or OWNER only.')
  })

  it('allows trigger commands for ADMIN role', async () => {
    setEnv('DRY_RUN', '0')
    setEnv('ELIZA_CRE_DRY_RUN', '0')
    setEnv('KEEPR_API_KEY', undefined)
    getKeeprVaultByGroupIdMock.mockResolvedValue({
      canonicalOwnerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      config: { roles: { admins: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'] } },
    })

    const trigger = getAction('CRE_TRIGGER')
    const text = await runActionText(trigger, '/cre queue', {
      conversationId: 'group-1',
      senderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })

    expect(text).toContain('Keepr API not configured')
  })
})
