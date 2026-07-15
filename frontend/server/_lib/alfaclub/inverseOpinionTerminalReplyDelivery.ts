import { logger } from '../infra/logger.js'
import {
  registerInverseAkitaBotOutboundText,
} from './inverseAkitaBotAuthoredText.js'
import {
  readAlfaClubBotSenderReadiness,
  sendAlfaClubBotTextStrict,
} from './inverseAkitaTradeJournalSender.js'
import { buildTerminalReplyPayloads } from './inverseOpinionTerminalReplyFormatter.js'
import {
  claimTerminalReplyDeliveries,
  ensureTerminalReplyDeliveries,
  listTerminalDecisionsMissingReplyDelivery,
  markTerminalReplyDeliveryFailed,
  markTerminalReplyDeliverySent,
  markTerminalReplyDeliveryUnknown,
  readTerminalReplyDeliveryBacklog,
  type ClaimedTerminalReplyDelivery,
  type TerminalReplyDeliveryBacklog,
} from './inverseOpinionTradeStore.js'

export type TerminalReplyDeliveryRun = {
  created: number
  claimed: number
  sent: number
  failed: number
  sendUnknown: number
  errors: number
  degraded: boolean
  errorCode: string | null
  backlog: TerminalReplyDeliveryBacklog
}

function errorCode(error: unknown): string {
  const raw = (error as { code?: unknown } | null)?.code
  return typeof raw === 'string' && raw.trim()
    ? raw.trim().slice(0, 128)
    : 'bot_send_failed'
}

async function ensureMissing(decisionId?: string): Promise<number> {
  const missing = await listTerminalDecisionsMissingReplyDelivery({
    ...(decisionId ? { decisionId } : {}),
    limit: decisionId ? 1 : 100,
  })
  let created = 0
  for (const decision of missing) {
    const deliveries = buildTerminalReplyPayloads(decision)
    await ensureTerminalReplyDeliveries({
      decisionId: decision.decisionId,
      deliveries,
    })
    created += deliveries.length
  }
  return created
}

async function deliverClaim(
  delivery: ClaimedTerminalReplyDelivery,
): Promise<'sent' | 'failed' | 'send_unknown'> {
  let sentMessageId: string
  try {
    // Mark outbound text before send so history/WS echoes are always
    // suppressed as bot-authored, even when metadata comes back incomplete.
    registerInverseAkitaBotOutboundText(delivery.publicText)
    const sent = await sendAlfaClubBotTextStrict({
      roomId: delivery.roomId,
      text: delivery.publicText,
      replyToMessageId: delivery.sourceMessageId,
      clientMessageId: delivery.clientMessageId,
    })
    sentMessageId = sent.messageId
  } catch (error) {
    const code = errorCode(error)
    if (code === 'bot_send_unknown') {
      await markTerminalReplyDeliveryUnknown({
        decisionId: delivery.decisionId,
        deliveryKind: delivery.deliveryKind,
        claimantToken: delivery.claimantToken,
        errorCode: code,
      })
      return 'send_unknown'
    }
    await markTerminalReplyDeliveryFailed({
      decisionId: delivery.decisionId,
      deliveryKind: delivery.deliveryKind,
      claimantToken: delivery.claimantToken,
      errorCode: code,
    })
    return 'failed'
  }

  try {
    await markTerminalReplyDeliverySent({
      decisionId: delivery.decisionId,
      deliveryKind: delivery.deliveryKind,
      claimantToken: delivery.claimantToken,
      messageId: sentMessageId,
    })
    return 'sent'
  } catch {
    // The external write succeeded but durable acknowledgement did not. This
    // must become operator-resolved send_unknown, never an automatic resend.
    await markTerminalReplyDeliveryUnknown({
      decisionId: delivery.decisionId,
      deliveryKind: delivery.deliveryKind,
      claimantToken: delivery.claimantToken,
      errorCode: 'sent_state_persist_failed',
    })
    return 'send_unknown'
  }
}

async function runDelivery(decisionId?: string): Promise<TerminalReplyDeliveryRun> {
  const run: Omit<TerminalReplyDeliveryRun, 'backlog' | 'degraded'> = {
    created: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    sendUnknown: 0,
    errors: 0,
    errorCode: null,
  }
  const readiness = readAlfaClubBotSenderReadiness()
  if (!readiness.ready) {
    run.errors = 1
    run.errorCode = readiness.errorCode
    logger.error('inverse_opinion_terminal_reply.sender_not_ready', {
      errorCode: readiness.errorCode,
    })
  } else {
    try {
      run.created = await ensureMissing(decisionId)
      while (true) {
        const claimed = await claimTerminalReplyDeliveries({
          ...(decisionId ? { decisionId } : {}),
          limit: decisionId ? 2 : 20,
          leaseSeconds: 90,
          states: ['pending', 'failed', 'expired_sending'],
        })
        if (claimed.length === 0) break
        run.claimed += claimed.length
        for (const delivery of claimed) {
          try {
            const state = await deliverClaim(delivery)
            if (state === 'sent') run.sent += 1
            else if (state === 'failed') run.failed += 1
            else run.sendUnknown += 1
          } catch (error) {
            run.errors += 1
            logger.error('inverse_opinion_terminal_reply.delivery_state_failure', {
              decisionId: delivery.decisionId,
              deliveryKind: delivery.deliveryKind,
              errorCode: errorCode(error),
            })
          }
        }
      }
    } catch (error) {
      run.errors += 1
      run.errorCode ??= errorCode(error)
      logger.error('inverse_opinion_terminal_reply.sweep_failure', {
        decisionId: decisionId ?? null,
        errorCode: errorCode(error),
      })
    }
  }
  let backlog: TerminalReplyDeliveryBacklog = {
    pending: 0,
    sending: 0,
    failed: 0,
    sendUnknown: 0,
    lastSuccessAt: null,
  }
  try {
    backlog = await readTerminalReplyDeliveryBacklog()
  } catch {
    run.errors += 1
    run.errorCode ??= 'reply_delivery_backlog_read_failed'
  }
  return {
    ...run,
    degraded: run.errors > 0 || backlog.failed > 0 || backlog.sendUnknown > 0,
    backlog,
  }
}

/** Immediate best-effort latency path; the durable outbox remains authoritative. */
export async function deliverInverseOpinionTerminalReply(
  decisionId: string,
): Promise<TerminalReplyDeliveryRun> {
  return runDelivery(decisionId)
}

/** Independent recovery path; it never reads bridge history or invokes Arena. */
export async function sweepInverseOpinionTerminalReplyDeliveries(): Promise<TerminalReplyDeliveryRun> {
  return runDelivery()
}
