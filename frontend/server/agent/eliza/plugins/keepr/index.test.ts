import { describe, expect, it } from 'vitest'

import { keeprPlugin } from './index.ts'

type AnyAction = {
  name?: string
  validate?: (runtime: unknown, message: any) => Promise<boolean> | boolean
}

function getAction(name: string): AnyAction {
  const action = (keeprPlugin.actions ?? []).find((entry) => entry?.name === name) as AnyAction | undefined
  if (!action?.validate) {
    throw new Error(`Missing action: ${name}`)
  }
  return action
}

describe('keepr plugin command routing', () => {
  it('does not claim conversational ai prefixes', async () => {
    const action = getAction('KEEPR_COMMAND')

    await expect(action.validate?.({}, { content: { text: '/ai hello' } })).resolves.toBe(false)
    await expect(action.validate?.({}, { content: { text: '@keepr hello' } })).resolves.toBe(false)
    await expect(action.validate?.({}, { content: { text: '@bot hello' } })).resolves.toBe(false)
  })

  it('still claims deterministic keepr commands', async () => {
    const action = getAction('KEEPR_COMMAND')

    await expect(action.validate?.({}, { content: { text: '/keepr status' } })).resolves.toBe(true)
    await expect(action.validate?.({}, { content: { text: '/send 1 USDC to 0x1111111111111111111111111111111111111111' } })).resolves.toBe(true)
  })
})
