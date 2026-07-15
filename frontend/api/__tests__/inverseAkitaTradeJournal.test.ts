import { describe, expect, it, vi } from 'vitest'

import {
  INVERSE_AKITA_JOURNAL_ROOM_ID,
  readInverseAkitaTradeJournalFlags,
  regenerateInverseAkitaTradeJournal,
  runInverseAkitaTradeJournal,
  scheduledInverseAkitaJournalWindow,
  type InverseAkitaTradeJournalDependencies,
} from '../../server/_lib/alfaclub/inverseAkitaTradeJournal.js'

function deps(overrides: Partial<InverseAkitaTradeJournalDependencies> = {}): InverseAkitaTradeJournalDependencies {
  return {
    claimDispatch: vi.fn(async () => ({
      won: true,
      dispatch: {
        roomId: '1659',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
        state: 'claimed' as const,
        claimantToken: 'claim-1',
        clientMessageId: 'inverse-akita-journal:stable',
        parentMessageId: null,
        attemptCount: 1,
        analysisRevision: 0,
      },
    })),
    listDecisions: vi.fn(async () => []),
    listLifecycles: vi.fn(async () => []),
    getSource: vi.fn(async () => null),
    listInfluences: vi.fn(async () => []),
    listEvents: vi.fn(async () => []),
    listAnalyses: vi.fn(async () => []),
    analyze: vi.fn(),
    persistAnalysis: vi.fn(),
    prepareDeliveries: vi.fn(async (
      params: Parameters<InverseAkitaTradeJournalDependencies['prepareDeliveries']>[0],
    ) => params.deliveries.map((delivery) => ({
      ...delivery,
      state: 'pending' as const,
      messageId: null,
    }))),
    markDeliverySending: vi.fn(async () => {}),
    listDeliveries: vi.fn(async () => []),
    recordDeliverySent: vi.fn(async () => {}),
    recordDeliveryFailure: vi.fn(async () => {}),
    renewDispatch: vi.fn(async () => {}),
    markSending: vi.fn(async () => {}),
    markSent: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    sendStrict: vi.fn(async () => ({
      lane: 'bot_token_strict_parent' as const,
      messageId: 'parent-1',
    })),
    registerBotText: vi.fn(),
    markRevisionSending: vi.fn(async () => {}),
    recoverRevisionSendUnknown: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('InverseAKITA trade journal publication', () => {
  it('reports the shared default-off capture gate independently from publication', () => {
    const publish = process.env.ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_PUBLISH_ENABLED
    const capture = process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
    try {
      delete process.env.ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_PUBLISH_ENABLED
      delete process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
      expect(readInverseAkitaTradeJournalFlags()).toEqual({
        publishEnabled: false,
        captureEnabled: false,
      })
      process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED = 'on'
      expect(readInverseAkitaTradeJournalFlags()).toEqual({
        publishEnabled: false,
        captureEnabled: true,
      })
    } finally {
      if (publish == null) delete process.env.ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_PUBLISH_ENABLED
      else process.env.ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_PUBLISH_ENABLED = publish
      if (capture == null) delete process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED
      else process.env.ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED = capture
    }
  })

  it('uses the previous 24 hours ending at the stable scheduled run', () => {
    expect(scheduledInverseAkitaJournalWindow(new Date('2026-07-14T12:12:34.000Z'))).toEqual({
      start: '2026-07-13T12:10:00.000Z',
      end: '2026-07-14T12:10:00.000Z',
    })
  })

  it('pins every scheduled journal to room 1659 and sends one no-activity parent', async () => {
    const dependencies = deps()
    const result = await runInverseAkitaTradeJournal({
      now: new Date('2026-07-14T12:12:00.000Z'),
      claimantToken: 'claim-1',
      deps: dependencies,
    })

    expect(INVERSE_AKITA_JOURNAL_ROOM_ID).toBe('1659')
    expect(dependencies.claimDispatch).toHaveBeenCalledWith(expect.objectContaining({ roomId: '1659' }))
    expect(dependencies.sendStrict).toHaveBeenCalledTimes(1)
    expect(dependencies.sendStrict).toHaveBeenCalledWith(expect.objectContaining({
      roomId: '1659',
      clientMessageId: 'inverse-akita-journal:stable',
      text: expect.stringContaining('No qualified opinions or tracked positions'),
    }))
    expect(result).toMatchObject({ sent: true, roomId: '1659', parentMessageId: 'parent-1' })
  })

  it('does not send when another claimant owns the window', async () => {
    const dependencies = deps({
      claimDispatch: vi.fn(async () => ({
        won: false,
        dispatch: {
          roomId: '1659',
          windowStart: '2026-07-13T12:10:00.000Z',
          windowEnd: '2026-07-14T12:10:00.000Z',
          state: 'sending' as const,
          claimantToken: 'other',
          clientMessageId: 'inverse-akita-journal:stable',
          parentMessageId: null,
          attemptCount: 1,
          analysisRevision: 0,
        },
      })),
    })

    const result = await runInverseAkitaTradeJournal({
      now: new Date('2026-07-14T12:12:00.000Z'),
      claimantToken: 'claim-2',
      deps: dependencies,
    })
    expect(result).toMatchObject({ sent: false, skippedDuplicate: true })
    expect(dependencies.sendStrict).not.toHaveBeenCalled()
  })

  it('records confirmed failure as failed and uncertain failure as send_unknown without retrying', async () => {
    for (const [code, state] of [
      ['journal_send_failed', 'failed'],
      ['journal_send_unknown', 'send_unknown'],
    ] as const) {
      const dependencies = deps({
        sendStrict: vi.fn(async () => {
          throw Object.assign(new Error(code), { code })
        }),
      })
      await expect(runInverseAkitaTradeJournal({
        now: new Date('2026-07-14T12:12:00.000Z'),
        claimantToken: 'claim-1',
        deps: dependencies,
      })).rejects.toThrow(code)
      expect(dependencies.recordDeliveryFailure).toHaveBeenCalledWith(
        expect.objectContaining({ state }),
      )
      expect(dependencies.sendStrict).toHaveBeenCalledTimes(1)
    }
  })

  it('treats a successful external send followed by sent-record failure as send_unknown', async () => {
    const dependencies = deps({
      sendStrict: vi.fn(async () => ({
        lane: 'bot_token_strict_parent' as const,
        messageId: 'externally-sent-parent',
      })),
      recordDeliverySent: vi.fn(async () => {
        throw new Error('database write failed')
      }),
    })

    await expect(runInverseAkitaTradeJournal({
      now: new Date('2026-07-14T12:12:00.000Z'),
      claimantToken: 'claim-1',
      deps: dependencies,
    })).rejects.toThrow('database write failed')

    expect(dependencies.recordDeliveryFailure).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'parent',
      ordinal: 0,
      state: 'send_unknown',
      errorCode: 'journal_sent_record_unknown',
    }))
    expect(dependencies.markSent).not.toHaveBeenCalled()
  })

  it('resumes from immutable persisted delivery text without regenerating analysis', async () => {
    const persistedParent = '<!-- inverse-akita-trade-journal:v1 -->\nimmutable parent from first attempt'
    const persistedReply = '<!-- inverse-akita-trade-journal:v1 -->\nimmutable reply from first attempt'
    const dependencies = deps({
      claimDispatch: vi.fn(async () => ({
        won: true,
        dispatch: {
          roomId: '1659',
          windowStart: '2026-07-13T12:10:00.000Z',
          windowEnd: '2026-07-14T12:10:00.000Z',
          state: 'claimed' as const,
          claimantToken: 'reclaimed',
          clientMessageId: 'inverse-akita-journal:stable',
          parentMessageId: 'parent-1',
          attemptCount: 2,
          analysisRevision: 0,
        },
      })),
      listDeliveries: vi.fn(async () => [{
        kind: 'parent' as const,
        ordinal: 0,
        state: 'sent' as const,
        clientMessageId: 'inverse-akita-journal:stable',
        contentHash: 'a'.repeat(64),
        content: persistedParent,
        messageId: 'parent-1',
      }, {
        kind: 'reply' as const,
        ordinal: 0,
        state: 'failed' as const,
        clientMessageId: 'inverse-akita-journal:stable:reply:0',
        contentHash: 'b'.repeat(64),
        content: persistedReply,
        messageId: null,
      }]),
    })

    await expect(runInverseAkitaTradeJournal({
      now: new Date('2026-07-14T12:12:00.000Z'),
      claimantToken: 'reclaimed',
      deps: dependencies,
    })).resolves.toMatchObject({ sent: true, parentMessageId: 'parent-1' })

    expect(dependencies.listLifecycles).not.toHaveBeenCalled()
    expect(dependencies.analyze).not.toHaveBeenCalled()
    expect(dependencies.persistAnalysis).not.toHaveBeenCalled()
    expect(dependencies.prepareDeliveries).not.toHaveBeenCalled()
    expect(dependencies.sendStrict).toHaveBeenCalledOnce()
    expect(dependencies.sendStrict).toHaveBeenCalledWith(expect.objectContaining({
      text: persistedReply,
      replyToMessageId: 'parent-1',
      clientMessageId: 'inverse-akita-journal:stable:reply:0',
    }))
  })

  it('persists the parent immediately and resumes a failed reply without reposting the parent', async () => {
    let parentMessageId: string | null = null
    let replySent = false
    let run = 0
    const hostileRawQuote = '> [private opinion](https://evil.test/messages/77)'
    const lifecycle = {
      lifecycleId: '44444444-4444-4444-8444-444444444444',
      executorWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      normalizedMarket: 'BTC',
      side: 'short' as const,
      openingDecisionId: '11111111-1111-4111-8111-111111111111',
      lifecycleState: 'open' as const,
      attributionQuality: 'complete' as const,
      reconciliationGeneration: 1,
      openedAt: '2026-07-14T08:00:00.000Z',
      closedAt: null,
      lastReconciledAt: '2026-07-14T12:00:00.000Z',
      currentSnapshot: { dataAsOf: '2026-07-14T12:00:00.000Z', unrealizedPnlUsd: 4 },
      realizedResult: {},
      createdAt: '2026-07-14T08:00:00.000Z',
      updatedAt: '2026-07-14T12:00:00.000Z',
    }
    const source = {
      lifecycleId: lifecycle.lifecycleId,
      decisionId: lifecycle.openingDecisionId,
      roomId: '1484',
      sourceMessageId: 'source-1',
      sourceHash: 'a'.repeat(64),
      sourceTimestamp: lifecycle.openedAt,
      sourceSide: 'long' as const,
      inverseSide: 'short' as const,
      normalizedMarket: 'BTC',
      decisionMetadata: {
        sourceExcerpt: hostileRawQuote,
        messageUrl: 'https://evil.test/messages/77',
      },
      publicAuthorLabel: '@creator',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }
    const dependencies = deps({
      claimDispatch: vi.fn(async () => ({
        won: true,
        dispatch: {
          roomId: '1659',
          windowStart: '2026-07-13T12:10:00.000Z',
          windowEnd: '2026-07-14T12:10:00.000Z',
          state: 'claimed' as const,
          claimantToken: `claim-${run}`,
          clientMessageId: 'inverse-akita-journal:stable',
          parentMessageId,
          attemptCount: run + 1,
          analysisRevision: 0,
        },
      })),
      listLifecycles: vi.fn(async () => [lifecycle]),
      getSource: vi.fn(async () => source),
      listInfluences: vi.fn(async () => [{
        decisionId: source.decisionId,
        roomId: source.roomId,
        publicAuthorLabel: source.publicAuthorLabel,
        senderAddress: source.senderAddress,
        sourceSide: source.sourceSide,
        normalizedMarket: source.normalizedMarket,
        action: 'open' as const,
        occurredAt: lifecycle.openedAt,
      }]),
      analyze: vi.fn(async () => ({
        analysisOnly: true as const,
        verdict: 'hold' as const,
        confidence: 0.7,
        evidenceRefs: [],
        interpretation: 'Recorded evidence remains stable.',
        invalidationCondition: 'Evidence changes.',
        watchCondition: 'Watch fresh evidence.',
        closedThesisAssessment: null,
        fallbackReason: null,
        modelProvenance: {
          agentKey: 'inverse-akita-trade-journal-analysis' as const,
          correlationId: 'test',
        },
      })),
      listDeliveries: vi.fn(async () => [
        {
          kind: 'parent' as const,
          ordinal: 0,
          state: parentMessageId ? 'sent' as const : 'pending' as const,
          clientMessageId: 'inverse-akita-journal:stable',
          contentHash: 'a'.repeat(64),
          content: 'persisted parent',
          messageId: parentMessageId,
        },
        {
          kind: 'reply' as const,
          ordinal: 0,
          state: replySent ? 'sent' as const : 'pending' as const,
          clientMessageId: 'inverse-akita-journal:stable:reply:0',
          contentHash: 'b'.repeat(64),
          content: 'persisted reply',
          messageId: replySent ? 'reply-1' : null,
        },
      ]),
      prepareDeliveries: vi.fn(async () => [
        {
          kind: 'parent' as const,
          ordinal: 0,
          state: parentMessageId ? 'sent' as const : 'pending' as const,
          clientMessageId: 'inverse-akita-journal:stable',
          contentHash: 'a'.repeat(64),
          content: 'persisted parent',
          messageId: parentMessageId,
        },
        {
          kind: 'reply' as const,
          ordinal: 0,
          state: replySent ? 'sent' as const : 'pending' as const,
          clientMessageId: 'inverse-akita-journal:stable:reply:0',
          contentHash: 'b'.repeat(64),
          content: 'persisted reply',
          messageId: replySent ? 'reply-1' : null,
        },
      ]),
      recordDeliverySent: vi.fn(async (delivery) => {
        if (delivery.kind === 'parent') parentMessageId = delivery.messageId
        else replySent = true
      }),
      sendStrict: vi.fn(async (send) => {
        if (!send.replyToMessageId) return { lane: 'bot_token_strict_parent' as const, messageId: 'parent-1' }
        if (run === 0) throw Object.assign(new Error('journal_send_failed'), { code: 'journal_send_failed' })
        return { lane: 'bot_token_strict_reply' as const, messageId: 'reply-1' }
      }),
    })

    await expect(runInverseAkitaTradeJournal({
      now: new Date('2026-07-14T12:12:00.000Z'),
      claimantToken: '66666666-6666-4666-8666-666666666666',
      deps: dependencies,
    })).rejects.toThrow('journal_send_failed')
    expect(parentMessageId).toBe('parent-1')
    expect(dependencies.markSent).not.toHaveBeenCalled()

    run = 1
    await expect(runInverseAkitaTradeJournal({
      now: new Date('2026-07-14T12:12:00.000Z'),
      claimantToken: '77777777-7777-4777-8777-777777777777',
      deps: dependencies,
    })).resolves.toMatchObject({ sent: true, parentMessageId: 'parent-1' })
    const sends = vi.mocked(dependencies.sendStrict).mock.calls.map(([send]) => send)
    expect(sends.filter((send) => !send.replyToMessageId)).toHaveLength(1)
    expect(sends.filter((send) => send.replyToMessageId === 'parent-1')).toHaveLength(2)
    expect(JSON.stringify(sends)).not.toContain(hostileRawQuote)
    expect(JSON.stringify(sends)).not.toContain('evil.test/messages/77')
  })

  it('bounds concurrent analysis and falls back for every lifecycle at the overall deadline', async () => {
    const lifecycle = {
      lifecycleId: '44444444-4444-4444-8444-444444444444',
      executorWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      normalizedMarket: 'BTC',
      side: 'short' as const,
      openingDecisionId: '11111111-1111-4111-8111-111111111111',
      lifecycleState: 'open' as const,
      attributionQuality: 'complete' as const,
      reconciliationGeneration: 1,
      openedAt: '2026-07-14T08:00:00.000Z',
      closedAt: null,
      lastReconciledAt: '2026-07-14T12:00:00.000Z',
      currentSnapshot: { dataAsOf: '2026-07-14T12:00:00.000Z' },
      realizedResult: {},
      createdAt: '2026-07-14T08:00:00.000Z',
      updatedAt: '2026-07-14T12:00:00.000Z',
    }
    const lifecycles = Array.from({ length: 7 }, (_, index) => ({
      ...lifecycle,
      lifecycleId: `${index}`.padStart(8, '0') + '-4444-4444-8444-444444444444',
    }))
    let active = 0
    let maxActive = 0
    const dependencies = deps({
      listLifecycles: vi.fn(async () => lifecycles),
      getSource: vi.fn(async (lifecycleId) => ({
        lifecycleId,
        decisionId: lifecycle.openingDecisionId,
        roomId: '1484',
        sourceMessageId: `source-${lifecycleId}`,
        sourceHash: 'a'.repeat(64),
        sourceTimestamp: lifecycle.openedAt,
        sourceSide: 'long' as const,
        inverseSide: 'short' as const,
        normalizedMarket: 'BTC',
        decisionMetadata: {},
        publicAuthorLabel: '@creator',
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })),
      analyze: vi.fn(async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        return new Promise<never>(() => {})
      }),
    })
    const result = await runInverseAkitaTradeJournal({
      now: new Date('2026-07-14T12:12:00.000Z'),
      claimantToken: '66666666-6666-4666-8666-666666666666',
      analysisDeadlineMs: 20,
      deps: dependencies,
    })
    expect(result.sent).toBe(true)
    expect(maxActive).toBeLessThanOrEqual(3)
    expect(dependencies.persistAnalysis).toHaveBeenCalledTimes(7)
    expect(dependencies.renewDispatch).toHaveBeenCalled()
  })

  it('manual regeneration audits first and appends beneath the existing parent', async () => {
    const order: string[] = []
    const dependencies = deps({
      getDispatch: vi.fn(async () => ({
        roomId: '1659',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
        state: 'sent' as const,
        claimantToken: 'claim',
        clientMessageId: 'inverse-akita-journal:stable:parent',
        parentMessageId: 'parent-1',
        attemptCount: 1,
        analysisRevision: 0,
      })),
      beginRevision: vi.fn(async (params) => {
        if (params.publicText == null) {
          order.push('probe')
          return null
        }
        order.push('audit')
        return {
          revision: 1,
          clientMessageId: 'inverse-akita-journal:stable:parent:revision:1',
          publicText: params.publicText,
          claimantToken: '77777777-7777-4777-8777-777777777777',
          recovered: false,
        }
      }),
      completeRevision: vi.fn(async () => {
        order.push('complete')
      }),
      sendStrict: vi.fn(async (params) => {
        order.push('send')
        expect(params.replyToMessageId).toBe('parent-1')
        return { lane: 'bot_token_strict_reply' as const, messageId: 'revision-1' }
      }),
    })
    const result = await regenerateInverseAkitaTradeJournal({
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      window: {
        start: '2026-07-13T12:10:00.000Z',
        end: '2026-07-14T12:10:00.000Z',
      },
      now: new Date('2026-07-14T12:20:00.000Z'),
      deps: dependencies,
    })
    expect(order).toEqual(['probe', 'audit', 'send', 'complete'])
    expect(result).toMatchObject({
      parentMessageId: 'parent-1',
      analysisRevision: 1,
    })
    expect(dependencies.claimDispatch).not.toHaveBeenCalled()
  })

  it('resumes an expired requested revision from immutable text without regenerating analysis', async () => {
    const immutableText = [
      '<!-- inverse-akita-trade-journal:v1 -->',
      '**Analysis revision 2**',
      'Immutable text from the original request.',
    ].join('\n\n')
    const dependencies = deps({
      getDispatch: vi.fn(async () => ({
        roomId: '1659',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
        state: 'sent' as const,
        claimantToken: 'claim',
        clientMessageId: 'inverse-akita-journal:stable:parent',
        parentMessageId: 'parent-1',
        attemptCount: 1,
        analysisRevision: 2,
      })),
      beginRevision: vi.fn(async () => ({
        revision: 2,
        clientMessageId: 'inverse-akita-journal:stable:parent:revision:2',
        publicText: immutableText,
        claimantToken: '77777777-7777-4777-8777-777777777777',
        recovered: true,
      })),
      completeRevision: vi.fn(async () => {}),
      sendStrict: vi.fn(async () => ({
        lane: 'bot_token_strict_reply' as const,
        messageId: 'revision-2',
      })),
    })

    await regenerateInverseAkitaTradeJournal({
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      window: {
        start: '2026-07-13T12:10:00.000Z',
        end: '2026-07-14T12:10:00.000Z',
      },
      now: new Date('2026-07-14T12:20:00.000Z'),
      deps: dependencies,
    })

    expect(dependencies.beginRevision).toHaveBeenCalledWith(expect.objectContaining({
      publicText: null,
    }))
    expect(dependencies.listDecisions).not.toHaveBeenCalled()
    expect(dependencies.listLifecycles).not.toHaveBeenCalled()
    expect(dependencies.analyze).not.toHaveBeenCalled()
    expect(dependencies.sendStrict).toHaveBeenCalledWith(expect.objectContaining({
      text: immutableText,
      clientMessageId: 'inverse-akita-journal:stable:parent:revision:2',
    }))
    expect(dependencies.markRevisionSending).toHaveBeenCalledWith({
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      revision: 2,
      claimantToken: '77777777-7777-4777-8777-777777777777',
    })
    expect(dependencies.completeRevision).toHaveBeenCalledWith(expect.objectContaining({
      revision: 2,
      claimantToken: '77777777-7777-4777-8777-777777777777',
      state: 'sent',
    }))
  })

  it('quarantines a revision when the external send succeeds but sent persistence fails', async () => {
    const sentRecordError = new Error('database write failed after send')
    const dependencies = deps({
      getDispatch: vi.fn(async () => ({
        roomId: '1659',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
        state: 'sent' as const,
        claimantToken: 'claim',
        clientMessageId: 'inverse-akita-journal:stable:parent',
        parentMessageId: 'parent-1',
        attemptCount: 1,
        analysisRevision: 1,
      })),
      beginRevision: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          revision: 2,
          clientMessageId: 'inverse-akita-journal:stable:parent:revision:2',
          publicText: '<!-- inverse-akita-trade-journal:v1 -->\nrevision 2',
          claimantToken: '77777777-7777-4777-8777-777777777777',
          recovered: false,
        })
        .mockRejectedValueOnce(new Error('journal_revision_unresolved')),
      completeRevision: vi.fn(async (params) => {
        if (params.state === 'sent') throw sentRecordError
      }),
      sendStrict: vi.fn(async () => ({
        lane: 'bot_token_strict_reply' as const,
        messageId: 'externally-sent-revision-2',
      })),
    })
    const input = {
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      window: {
        start: '2026-07-13T12:10:00.000Z',
        end: '2026-07-14T12:10:00.000Z',
      },
      now: new Date('2026-07-14T12:20:00.000Z'),
      deps: dependencies,
    }

    await expect(regenerateInverseAkitaTradeJournal(input)).rejects.toThrow(sentRecordError)
    expect(dependencies.markRevisionSending).toHaveBeenCalledOnce()
    expect(dependencies.recoverRevisionSendUnknown).toHaveBeenCalledWith({
      windowStart: input.window.start,
      windowEnd: input.window.end,
      revision: 2,
      claimantToken: '77777777-7777-4777-8777-777777777777',
      replyMessageId: 'externally-sent-revision-2',
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      errorCode: 'journal_revision_sent_record_unknown',
    })
    await expect(regenerateInverseAkitaTradeJournal(input)).rejects.toThrow(
      'journal_revision_unresolved',
    )
    expect(dependencies.sendStrict).toHaveBeenCalledOnce()
  })
})
