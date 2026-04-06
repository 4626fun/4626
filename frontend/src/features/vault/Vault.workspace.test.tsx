import { describe, expect, it } from 'vitest'

import { parseVaultWorkspaceQuery, updateVaultWorkspaceQuery } from '@/features/vault/vaultWorkspaceQuery'

describe('vault workspace query helpers', () => {
  it('parses default query state', () => {
    const parsed = parseVaultWorkspaceQuery(new URLSearchParams(''))
    expect(parsed).toEqual({
      panel: 'manage',
      tab: 'overview',
      taskId: null,
    })
  })

  it('parses workspace tab and task id from query', () => {
    const parsed = parseVaultWorkspaceQuery(new URLSearchParams('panel=workspace&tab=tasks&task=42'))
    expect(parsed).toEqual({
      panel: 'workspace',
      tab: 'tasks',
      taskId: 42,
    })
  })

  it('writes workspace query params', () => {
    const next = updateVaultWorkspaceQuery({
      current: new URLSearchParams('foo=bar'),
      panel: 'workspace',
      tab: 'monitoring',
      taskId: 8,
    })
    expect(next.get('foo')).toBe('bar')
    expect(next.get('panel')).toBe('workspace')
    expect(next.get('tab')).toBe('monitoring')
    expect(next.get('task')).toBe('8')
  })

  it('clears workspace params when switching back to manage panel', () => {
    const next = updateVaultWorkspaceQuery({
      current: new URLSearchParams('panel=workspace&tab=tasks&task=77'),
      panel: 'manage',
    })
    expect(next.get('panel')).toBeNull()
    expect(next.get('tab')).toBeNull()
    expect(next.get('task')).toBeNull()
  })
})
