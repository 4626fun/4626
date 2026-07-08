import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aggregateReactionsByMessageId,
  filterDisplayChatMessages,
  isLocalXmtpStateInvalidError,
  isOpfsAccessHandleError,
  isTransientXmtpStreamNetworkError,
  isXmtpRateLimitError,
  retryOnOpfsAccessHandleError,
  shouldFallbackToOriginalXmtpRecipient,
} from './xmtpHelpers'
import { resetXmtpSyncCoordinatorForTests } from './xmtpSyncCoordinator'

beforeEach(() => {
  resetXmtpSyncCoordinatorForTests()
})

describe('shouldFallbackToOriginalXmtpRecipient', () => {
  const original = '0xb05cf01231cf2ff99499682e64d3780d57c80fdd' as const
  const canonical = '0x8da9aff7112e7aca19ffda892979197e3a465319' as const

  it('falls back when the canonical recipient is not reachable but the original input address is', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: original,
        peerAddress: canonical,
        peerCanMessage: false,
        originalCanMessage: true,
      }),
    ).toBe(true)
  })

  it('does not fall back when the canonical recipient is reachable', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: original,
        peerAddress: canonical,
        peerCanMessage: true,
        originalCanMessage: true,
      }),
    ).toBe(false)
  })

  it('does not fall back when the original input address is not reachable', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: original,
        peerAddress: canonical,
        peerCanMessage: false,
        originalCanMessage: false,
      }),
    ).toBe(false)
  })

  it('does not fall back without a canonical remap', () => {
    expect(
      shouldFallbackToOriginalXmtpRecipient({
        canonicalizedFromAddress: canonical,
        peerAddress: canonical,
        peerCanMessage: false,
        originalCanMessage: true,
      }),
    ).toBe(false)
  })
})

describe('isLocalXmtpStateInvalidError', () => {
  it('detects inbox validation and partial sync failures', () => {
    expect(
      isLocalXmtpStateInvalidError(
        'InboxValidationFailed("f1cb93da12e9fb6935084c613638d4005e5c5fd91b02e9ef0355add7309ae673")',
      ),
    ).toBe(true)
    expect(isLocalXmtpStateInvalidError('synced 12 messages, 3 failed 9 succeeded')).toBe(true)
    expect(isLocalXmtpStateInvalidError('conversation_not_found')).toBe(false)
  })
})


describe('resolveConversationById', () => {
  it('matches conversation ids case-insensitively', async () => {
    const { conversationIdsEqual, resolveConversationById } = await import('./xmtpHelpers')
    expect(conversationIdsEqual('AbC', 'abc')).toBe(true)

    const convo = { id: 'GroupABC', sync: vi.fn(async () => undefined) }
    const api = {
      sync: vi.fn(async () => undefined),
      getConversationById: vi.fn(async () => null),
      list: vi.fn(async () => [convo]),
    }
    const resolved = await resolveConversationById(api, 'groupabc')
    expect(resolved?.id).toBe('GroupABC')
  })

  it('uses syncAll and listGroups when resolving waitlist group memberships', async () => {
    const { ConsentEntityType, ConsentState } = await import('@xmtp/browser-sdk')
    const { resolveConversationById } = await import('./xmtpHelpers')

    const group = {
      id: 'ed6fbda34f2614536df5cec08dff2266',
      sync: vi.fn(async () => undefined),
      consentState: vi.fn(async () => ConsentState.Unknown),
      updateConsentState: vi.fn(async () => undefined),
    }
    const list = vi.fn(async () => [])
    const listGroups = vi.fn(async () => [group])
    const api = {
      sync: vi.fn(async () => undefined),
      syncAll: vi.fn(async () => undefined),
      getConversationById: vi.fn(async () => null),
      list,
      listGroups,
    }
    const preferencesApi = {
      setConsentStates: vi.fn(async () => undefined),
    }

    const resolved = await resolveConversationById(api, 'ed6fbda34f2614536df5cec08dff2266', {
      preferencesApi,
      forceSync: true,
    })
    expect(resolved?.id).toBe(group.id)
    expect(preferencesApi.setConsentStates).toHaveBeenCalledWith([
      {
        entityType: ConsentEntityType.GroupId,
        entity: group.id,
        state: ConsentState.Allowed,
      },
    ])
    expect(api.syncAll).toHaveBeenCalled()
    expect(list).toHaveBeenCalledWith({ consentStates: [ConsentState.Unknown, ConsentState.Allowed] })
    expect(listGroups).toHaveBeenCalledWith({ consentStates: [ConsentState.Unknown, ConsentState.Allowed] })
    expect(group.updateConsentState).toHaveBeenCalledWith(ConsentState.Allowed)
  })
})

describe('isTransientXmtpStreamNetworkError', () => {
  it('matches welcome-stream network blips from the browser worker', () => {
    expect(
      isTransientXmtpStreamNetworkError(
        "api client at endpoint \"/xmtp.mls.api.v1.MlsApi/SubscribeWelcomeMessages\" has error status: 'Unknown error', self: \"js api error: TypeError: network error\"",
      ),
    ).toBe(true)
  })

  it('ignores unrelated validation failures', () => {
    expect(isTransientXmtpStreamNetworkError('InboxValidationFailed: inbox mismatch')).toBe(false)
  })
})

describe('isXmtpRateLimitError', () => {
  it('matches QueryWelcomeMessages exhaustion errors', () => {
    expect(
      isXmtpRateLimitError(
        "api client at endpoint \"/xmtp.mls.api.v1.MlsApi/QueryWelcomeMessages\" has error status: 'Some resource has been exhausted'",
      ),
    ).toBe(true)
  })
})

describe('isOpfsAccessHandleError', () => {
  it('matches the "another active XMTP clients or Opfs instances" failure', () => {
    expect(
      isOpfsAccessHandleError(
        'Failed to initialize OPFS, ensure that there are no other active XMTP clients or Opfs instances',
      ),
    ).toBe(true)
  })

  it('matches createSyncAccessHandle NoModificationAllowedError', () => {
    expect(
      isOpfsAccessHandleError(
        "NoModificationAllowedError: Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file.",
      ),
    ).toBe(true)
  })

  it('does not match unrelated errors', () => {
    expect(isOpfsAccessHandleError('Network error')).toBe(false)
    expect(isOpfsAccessHandleError('')).toBe(false)
  })
})

describe('retryOnOpfsAccessHandleError', () => {
  it('returns the result immediately when the operation succeeds on the first try', async () => {
    const operation = vi.fn(async () => 'ok')
    await expect(retryOnOpfsAccessHandleError(operation, [0, 0])).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('retries on a transient OPFS access-handle lock and succeeds once it clears', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new Error('Failed to initialize OPFS, ensure that there are no other active XMTP clients or Opfs instances'),
      )
      .mockResolvedValueOnce('recovered')

    await expect(retryOnOpfsAccessHandleError(operation, [0, 0])).resolves.toBe('recovered')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('rethrows immediately for a non-OPFS-lock error without retrying', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Some unrelated failure')
    })

    await expect(retryOnOpfsAccessHandleError(operation, [0, 0, 0])).rejects.toThrow('Some unrelated failure')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('rethrows the OPFS-lock error once the retry budget is exhausted', async () => {
    const operation = vi.fn(async () => {
      throw new Error('NoModificationAllowedError: createSyncAccessHandle')
    })

    await expect(retryOnOpfsAccessHandleError(operation, [0, 0])).rejects.toThrow('createSyncAccessHandle')
    expect(operation).toHaveBeenCalledTimes(2)
  })
})

describe('filterDisplayChatMessages', () => {
  it('removes reaction-only rows from the visible transcript', () => {
    const visible = filterDisplayChatMessages([
      { id: 'm1', kind: 'message' as const },
      { id: 'r1', kind: 'reaction' as const },
    ])
    expect(visible.map((entry) => entry.id)).toEqual(['m1'])
  })
})

describe('aggregateReactionsByMessageId', () => {
  it('groups reactions under their target message and keeps the latest reaction per sender', () => {
    const grouped = aggregateReactionsByMessageId([
      {
        kind: 'reaction',
        replyToId: 'm1',
        reactionEmoji: '👍',
        senderInboxId: 'alice',
      },
      {
        kind: 'reaction',
        replyToId: 'm1',
        reactionEmoji: '👀',
        senderInboxId: 'alice',
      },
      {
        kind: 'reaction',
        replyToId: 'm1',
        reactionEmoji: '🔥',
        senderInboxId: 'bob',
      },
      {
        kind: 'message',
        replyToId: null,
        reactionEmoji: null,
        senderInboxId: 'alice',
      },
    ])

    expect(grouped.get('m1')).toEqual([
      { emoji: '👀', count: 1 },
      { emoji: '🔥', count: 1 },
    ])
  })
})
