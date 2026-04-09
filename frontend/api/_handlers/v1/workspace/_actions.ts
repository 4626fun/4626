import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  guardAgentApiRequest,
  getDb,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'


import { enqueueKeeprAction } from '../../../../server/_lib/keeprRegistry.js'

import { ensureTelegramTradingSchema, upsertHolderRoomPolicy } from '../../../../server/_lib/telegramTrading.js'
import { createTelegramSummaryTransport } from '../../../../server/_lib/workspace/telegramTransport.js'
import { publishWorkspaceXmtpMessage, type WorkspaceXmtpMessageType } from '../../../../server/_lib/workspace/xmtpPublisher.js'
import {
  appendAuditLog,
  createApprovalRequest,
  createTaskItem,
  getApprovalRequestById,
  getTaskItemById,
  updateApprovalDecision,
  updateTaskItem,
  upsertNotificationPreference,
  upsertStrategyTarget,
} from '../../../../server/_lib/workspace/repository.js'
import { appendWorkspaceActionActivity } from '../../../../server/_lib/workspace/service.js'
import { roleCan } from '../../../../server/_lib/workspace/auth.js'
import { normalizeVaultAddressFromQuery, requireWorkspaceAccess } from './_shared.js'

type AnyObject = Record<string, unknown>

type WorkspaceActionRequestBody = {
  action?: string
  payload?: Record<string, unknown>
}

type WorkspaceRequiredPermission =
  | 'strategy_manage'
  | 'tasks_manage'
  | 'settings_manage'
  | 'rooms_manage'
  | 'action_execute_low_risk'
  | 'action_execute_high_risk'

type WorkspaceTaskAction = 'task.approve' | 'task.reject' | 'task.snooze' | 'task.assign'

function asObject(value: unknown): AnyObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as AnyObject
}

function toAuditState(value: unknown): AnyObject {
  return asObject(value)
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asDateIso(value: unknown): string | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const normalized = asTrimmed(value).toLowerCase()
  return isAddressLike(normalized) ? (normalized as `0x${string}`) : null
}

function isHighRiskActionType(actionType: string): boolean {
  const lowered = actionType.toLowerCase()
  return (
    lowered.includes('pause') ||
    lowered.includes('resume') ||
    lowered.includes('unwind') ||
    lowered.includes('allocation') ||
    lowered.includes('owner') ||
    lowered.includes('delegate')
  )
}

function isLowRiskActionType(actionType: string): boolean {
  return actionType === 'strategy.charm.rebalance' || actionType === 'strategy.ajna.rebucket'
}

function isWorkspaceXmtpMessageType(value: string): value is WorkspaceXmtpMessageType {
  return (
    value === 'approval_request' ||
    value === 'approval_decision' ||
    value === 'rebalance_suggestion' ||
    value === 'risk_alert' ||
    value === 'settlement_update' ||
    value === 'status_summary' ||
    value === 'task_update'
  )
}

function resolveRequiredPermission(action: string, payload: AnyObject): WorkspaceRequiredPermission {
  if (action === 'strategy.execute') {
    const actionType = asTrimmed(payload.actionType)
    return actionType && isHighRiskActionType(actionType)
      ? 'action_execute_high_risk'
      : 'action_execute_low_risk'
  }
  if (action === 'strategy.setTarget') return 'strategy_manage'
  if (action.startsWith('task.')) return 'tasks_manage'
  if (action.startsWith('approval.')) return 'tasks_manage'
  if (action.startsWith('settings.')) return 'settings_manage'
  if (action.startsWith('rooms.telegram')) return 'rooms_manage'
  if (action.startsWith('rooms.xmtp')) return 'action_execute_low_risk'
  return 'tasks_manage'
}

function isWorkspaceTaskAction(action: string): action is WorkspaceTaskAction {
  return (
    action === 'task.approve' ||
    action === 'task.reject' ||
    action === 'task.snooze' ||
    action === 'task.assign'
  )
}

function resolveTaskStatusForAction(action: WorkspaceTaskAction, currentStatus: string): string {
  if (action === 'task.approve') return 'completed'
  if (action === 'task.reject') return 'rejected'
  if (action === 'task.snooze') return 'snoozed'
  return currentStatus
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const g = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'v1/workspace/actions',
    kind: 'write',
  })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-workspace-actions', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const vaultAddress = normalizeVaultAddressFromQuery(req)
  if (!vaultAddress) {
    return res.status(400).json({ success: false, error: 'vault is required' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody(req, { maxBytes: 65_536 })) ?? {}
  const action = asTrimmed(body.action)
  const payload = asObject(body.payload)
  if (!action) {
    return res.status(400).json({ success: false, error: 'action is required' } satisfies ApiEnvelope<never>)
  }

  const access = await requireWorkspaceAccess({
    req,
    vaultAddress,
    permission: resolveRequiredPermission(action, payload),
  })
  if (!access.ok) {
    return res.status(access.status).json({ success: false, error: access.error } satisfies ApiEnvelope<never>)
  }

  try {
    const actor = access.context.principalAddress
    const actorRole = access.context.role
    const source = 'workspace.actions'

    if (action === 'strategy.setTarget') {
      const strategyAddress = normalizeAddress(payload.strategyAddress)
      const targetWeightBps = asNumber(payload.targetWeightBps)
      if (!strategyAddress || targetWeightBps === null) {
        return res.status(400).json({
          success: false,
          error: 'strategyAddress and targetWeightBps are required',
        } satisfies ApiEnvelope<never>)
      }

      const updated = await upsertStrategyTarget({
        vaultAddress,
        strategyAddress,
        targetWeightBps,
        status: asTrimmed(payload.status) || 'active',
        updatedBy: actor,
        updatedSource: source,
        notes: asTrimmed(payload.notes) || null,
      })

      await appendWorkspaceActionActivity({
        vaultAddress,
        eventType: 'strategy.target.updated',
        source,
        actorAddress: actor,
        title: 'Strategy target updated',
        description: `Set ${strategyAddress} target to ${updated.targetWeightBps} bps`,
        payload: { strategyAddress, targetWeightBps: updated.targetWeightBps, status: updated.status },
      })
      await appendAuditLog({
        vaultAddress,
        actorAddress: actor,
        actorRole,
        source,
        action: 'strategy.setTarget',
        targetType: 'strategy_target',
        targetId: strategyAddress,
        after: toAuditState(updated),
        details: {
          input: payload,
        },
      })

      return res.status(200).json({
        success: true,
        data: {
          action,
          updated,
        },
      } satisfies ApiEnvelope<{ action: string; updated: unknown }>)
    }

    if (action === 'strategy.execute') {
      const actionType = asTrimmed(payload.actionType)
      const strategyAddress = normalizeAddress(payload.strategyAddress)
      if (!actionType) {
        return res.status(400).json({ success: false, error: 'payload.actionType is required' } satisfies ApiEnvelope<never>)
      }
      const runtimePayload = asObject(payload.params)

      if (isLowRiskActionType(actionType)) {
        const queued = await enqueueKeeprAction({
          vaultAddress,
          groupId: access.context.vault.groupId,
          actionType,
          action: {
            action: actionType,
            params: {
              ...runtimePayload,
              ...(strategyAddress ? { strategyAddress } : {}),
            },
          },
          dedupeKey: asTrimmed(payload.dedupeKey) || null,
        })

        await appendWorkspaceActionActivity({
          vaultAddress,
          eventType: 'strategy.action.queued',
          source,
          actorAddress: actor,
          title: `Queued action: ${actionType}`,
          payload: {
            actionId: queued.id,
            strategyAddress,
            params: runtimePayload,
          },
        })
        await appendAuditLog({
          vaultAddress,
          actorAddress: actor,
          actorRole,
          source,
          action: 'strategy.execute',
          targetType: 'keepr_action',
          targetId: String(queued.id),
          details: { actionType, strategyAddress, params: runtimePayload, mode: 'queued_immediate' },
        })
        return res.status(200).json({
          success: true,
          data: {
            action,
            queued: true,
            actionId: queued.id,
          },
        } satisfies ApiEnvelope<{ action: string; queued: boolean; actionId: number }>)
      }

      // Unsafe action path: create approval + task and optionally ping XMTP.
      const task = await createTaskItem({
        vaultAddress,
        title: `Approval required: ${actionType}`,
        description: strategyAddress
          ? `Review and approve ${actionType} for ${strategyAddress}`
          : `Review and approve ${actionType}`,
        source,
        severity: 'warn',
        status: 'pending',
        actionType,
        actionPayload: {
          actionType,
          strategyAddress,
          params: runtimePayload,
        },
        createdBy: actor,
      })
      const approval = await createApprovalRequest({
        vaultAddress,
        actionType,
        payload: {
          actionType,
          strategyAddress,
          params: runtimePayload,
        },
        source,
        severity: 'high',
        status: 'pending',
        requestedBy: actor,
        linkedTaskId: task.id,
      })
      await updateTaskItem({ id: task.id, description: `${task.description} (approval #${approval.id})`, updatedBy: actor })

      await appendWorkspaceActionActivity({
        vaultAddress,
        eventType: 'strategy.action.approval_requested',
        source,
        actorAddress: actor,
        title: `Approval requested: ${actionType}`,
        severity: 'warn',
        relatedTaskId: task.id,
        relatedApprovalId: approval.id,
        payload: { actionType, strategyAddress, approvalId: approval.id, taskId: task.id },
      })
      await appendAuditLog({
        vaultAddress,
        actorAddress: actor,
        actorRole,
        source,
        action: 'strategy.execute',
        targetType: 'approval_request',
        targetId: String(approval.id),
        details: { actionType, strategyAddress, params: runtimePayload, mode: 'approval_required' },
      })
      await publishWorkspaceXmtpMessage({
        vaultAddress,
        messageType: 'approval_request',
        title: `Approval requested: ${actionType}`,
        body: `Task #${task.id} and approval #${approval.id} created.`,
        payload: { taskId: task.id, approvalId: approval.id, strategyAddress },
        dedupeKey: `workspace-approval-request-${approval.id}`,
      })

      return res.status(200).json({
        success: true,
        data: {
          action,
          queued: false,
          approval,
          task,
        },
      } satisfies ApiEnvelope<{ action: string; queued: boolean; approval: unknown; task: unknown }>)
    }

    if (isWorkspaceTaskAction(action)) {
      const taskId = asNumber(payload.taskId)
      if (!taskId) {
        return res.status(400).json({ success: false, error: 'payload.taskId is required' } satisfies ApiEnvelope<never>)
      }
      const before = await getTaskItemById(taskId)
      if (!before || before.vaultAddress !== vaultAddress) {
        return res.status(404).json({ success: false, error: 'Task not found' } satisfies ApiEnvelope<never>)
      }

      const nextStatus = resolveTaskStatusForAction(action, before.status)

      const updated = await updateTaskItem({
        id: taskId,
        status: nextStatus,
        updatedBy: actor,
        assigneeWallet: action === 'task.assign' ? normalizeAddress(payload.assigneeWallet) : undefined,
        snoozedUntil: action === 'task.snooze' ? asDateIso(payload.snoozedUntil) : undefined,
        description: action === 'task.reject' ? asTrimmed(payload.reason) || before.description : undefined,
      })
      if (!updated) {
        return res.status(500).json({ success: false, error: 'Failed to update task' } satisfies ApiEnvelope<never>)
      }

      await appendWorkspaceActionActivity({
        vaultAddress,
        eventType: 'task.updated',
        source,
        actorAddress: actor,
        title: `Task ${action.replace('task.', '')}`,
        relatedTaskId: updated.id,
        payload: { action, taskId: updated.id, status: updated.status, assigneeWallet: updated.assigneeWallet },
      })
      await appendAuditLog({
        vaultAddress,
        actorAddress: actor,
        actorRole,
        source,
        action,
        targetType: 'task',
        targetId: String(updated.id),
        before: toAuditState(before),
        after: toAuditState(updated),
        details: { payload },
      })

      return res.status(200).json({
        success: true,
        data: {
          action,
          task: updated,
        },
      } satisfies ApiEnvelope<{ action: string; task: unknown }>)
    }

    if (action === 'approval.approve' || action === 'approval.reject') {
      const approvalId = asNumber(payload.approvalId)
      if (!approvalId) {
        return res.status(400).json({ success: false, error: 'payload.approvalId is required' } satisfies ApiEnvelope<never>)
      }
      const before = await getApprovalRequestById(approvalId)
      if (!before || before.vaultAddress !== vaultAddress) {
        return res.status(404).json({ success: false, error: 'Approval request not found' } satisfies ApiEnvelope<never>)
      }
      if (action === 'approval.approve') {
        const beforePayload = asObject(before.payload)
        const beforeActionType = asTrimmed(before.actionType || beforePayload.actionType)
        if (beforeActionType && isHighRiskActionType(beforeActionType)) {
          const canExecuteHighRisk = roleCan({
            role: access.context.role,
            permission: 'action_execute_high_risk',
          })
          if (!canExecuteHighRisk) {
            return res.status(403).json({
              success: false,
              error: 'Only OWNER/ADMIN can approve high-risk actions',
            } satisfies ApiEnvelope<never>)
          }
        }
      }

      const status = action === 'approval.approve' ? 'approved' : 'rejected'
      const reason = asTrimmed(payload.reason) || null
      const updated = await updateApprovalDecision({
        id: approvalId,
        status,
        decidedBy: actor,
        decisionReason: reason,
      })
      if (!updated) {
        return res.status(500).json({ success: false, error: 'Failed to update approval request' } satisfies ApiEnvelope<never>)
      }

      let executionActionId: number | null = null
      const actionPayload = asObject(updated.payload)
      const actionType = asTrimmed(actionPayload.actionType || updated.actionType)
      if (status === 'approved' && actionType) {
        const actionParams = asObject(actionPayload.params)
        const queued = await enqueueKeeprAction({
          vaultAddress,
          groupId: access.context.vault.groupId,
          actionType,
          action: {
            action: actionType,
            params: actionParams,
          },
          dedupeKey: asTrimmed(actionPayload.dedupeKey) || `approval-${updated.id}-${Date.now().toString(36)}`,
        }).catch(() => null)
        executionActionId = queued?.id ?? null
        if (executionActionId) {
          await updateApprovalDecision({
            id: updated.id,
            status: 'executed',
            decidedBy: actor,
            decisionReason: reason ?? 'approved_and_queued',
          })
        }
      }

      if (updated.linkedTaskId) {
        await updateTaskItem({
          id: updated.linkedTaskId,
          status: status === 'approved' ? 'in_progress' : 'rejected',
          updatedBy: actor,
        })
      }

      await appendWorkspaceActionActivity({
        vaultAddress,
        eventType: 'approval.updated',
        source,
        actorAddress: actor,
        title: `Approval ${status}`,
        severity: status === 'approved' ? 'info' : 'warn',
        relatedApprovalId: updated.id,
        relatedTaskId: updated.linkedTaskId,
        payload: {
          approvalId: updated.id,
          status,
          queuedActionId: executionActionId,
        },
      })
      await appendAuditLog({
        vaultAddress,
        actorAddress: actor,
        actorRole,
        source,
        action,
        targetType: 'approval_request',
        targetId: String(updated.id),
        before: toAuditState(before),
        after: toAuditState(updated),
        details: {
          reason,
          queuedActionId: executionActionId,
        },
      })

      await publishWorkspaceXmtpMessage({
        vaultAddress,
        messageType: 'approval_decision',
        title: `Approval ${status}`,
        body: `Approval #${updated.id} was ${status}${executionActionId ? ` and queued as action #${executionActionId}` : ''}.`,
        payload: {
          approvalId: updated.id,
          status,
          executionActionId,
        },
        dedupeKey: `workspace-approval-decision-${updated.id}-${status}`,
      })

      return res.status(200).json({
        success: true,
        data: {
          action,
          approval: updated,
          queuedActionId: executionActionId,
        },
      } satisfies ApiEnvelope<{ action: string; approval: unknown; queuedActionId: number | null }>)
    }

    if (action === 'settings.notifications.upsert') {
      const principalAddress = normalizeAddress(payload.principalAddress) ?? actor
      const updated = await upsertNotificationPreference({
        vaultAddress,
        principalAddress,
        telegramEnabled: typeof payload.telegramEnabled === 'boolean' ? payload.telegramEnabled : undefined,
        xmtpEnabled: typeof payload.xmtpEnabled === 'boolean' ? payload.xmtpEnabled : undefined,
        emailEnabled: typeof payload.emailEnabled === 'boolean' ? payload.emailEnabled : undefined,
        minSeverity: asTrimmed(payload.minSeverity) || undefined,
        channels: asObject(payload.channels),
      })
      await appendWorkspaceActionActivity({
        vaultAddress,
        eventType: 'settings.notifications.updated',
        source,
        actorAddress: actor,
        title: 'Notification settings updated',
        payload: { principalAddress: updated.principalAddress },
      })
      await appendAuditLog({
        vaultAddress,
        actorAddress: actor,
        actorRole,
        source,
        action,
        targetType: 'notification_preference',
        targetId: updated.principalAddress,
        after: toAuditState(updated),
        details: { payload },
      })
      return res.status(200).json({
        success: true,
        data: {
          action,
          preference: updated,
        },
      } satisfies ApiEnvelope<{ action: string; preference: unknown }>)
    }

    if (action === 'rooms.telegram.link' || action === 'rooms.telegram.unlink') {
      const chatId = asTrimmed(payload.chatId)
      const roomChatId = asTrimmed(payload.roomChatId)
      const minSharesRaw = asTrimmed(payload.minSharesRaw || '1')
      const graceHours = asNumber(payload.graceHours) ?? 24
      if (!chatId || !roomChatId) {
        return res.status(400).json({
          success: false,
          error: 'payload.chatId and payload.roomChatId are required',
        } satisfies ApiEnvelope<never>)
      }
      const db = await getDb()
      if (!db) {
        return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
      }
      await ensureTelegramTradingSchema(db)
      const policy = await upsertHolderRoomPolicy({
        db,
        chatId,
        vaultAddress,
        roomChatId,
        minSharesRaw,
        graceHours,
        enabled: action === 'rooms.telegram.link',
      })
      if (!policy) {
        return res.status(500).json({
          success: false,
          error: 'Unable to update Telegram room policy',
        } satisfies ApiEnvelope<never>)
      }

      await appendWorkspaceActionActivity({
        vaultAddress,
        eventType: action === 'rooms.telegram.link' ? 'rooms.telegram.linked' : 'rooms.telegram.unlinked',
        source,
        actorAddress: actor,
        title: action === 'rooms.telegram.link' ? 'Telegram room linked' : 'Telegram room unlinked',
        payload: { chatId, roomChatId, enabled: policy.enabled },
      })
      await appendAuditLog({
        vaultAddress,
        actorAddress: actor,
        actorRole,
        source,
        action,
        targetType: 'telegram_room_policy',
        targetId: `${chatId}:${vaultAddress}`,
        after: toAuditState(policy),
      })

      if (action === 'rooms.telegram.link' && policy.enabled) {
        const transport = createTelegramSummaryTransport()
        await transport.sendSummary({
          vaultAddress,
          title: '4626 Workspace linked',
          lines: [
            'This room is now linked to your creator workspace.',
            'You will receive status summaries and approval notices here.',
          ],
          chatId: roomChatId,
        })
      }

      return res.status(200).json({
        success: true,
        data: { action, policy },
      } satisfies ApiEnvelope<{ action: string; policy: unknown }>)
    }

    if (action === 'rooms.xmtp.publish') {
      const messageType = asTrimmed(payload.messageType)
      const title = asTrimmed(payload.title)
      const bodyText = asTrimmed(payload.body)
      if (!messageType || !title || !bodyText) {
        return res.status(400).json({
          success: false,
          error: 'payload.messageType, payload.title, and payload.body are required',
        } satisfies ApiEnvelope<never>)
      }
      if (!isWorkspaceXmtpMessageType(messageType)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported XMTP message type: ${messageType}`,
        } satisfies ApiEnvelope<never>)
      }
      const publish = await publishWorkspaceXmtpMessage({
        vaultAddress,
        messageType,
        title,
        body: bodyText,
        payload: asObject(payload.payload),
        dedupeKey: asTrimmed(payload.dedupeKey) || null,
      })
      await appendWorkspaceActionActivity({
        vaultAddress,
        eventType: 'rooms.xmtp.publish',
        source,
        actorAddress: actor,
        title: `XMTP message ${publish.queued ? 'queued' : 'failed'}`,
        severity: publish.queued ? 'info' : 'warn',
        payload: {
          messageType,
          publish,
        },
      })
      await appendAuditLog({
        vaultAddress,
        actorAddress: actor,
        actorRole,
        source,
        action,
        targetType: 'xmtp_message',
        targetId: publish.queued ? String(publish.actionId) : null,
        details: { messageType, title, publish },
      })
      return res.status(200).json({
        success: true,
        data: { action, publish },
      } satisfies ApiEnvelope<{ action: string; publish: unknown }>)
    }

    return res.status(400).json({
      success: false,
      error: `Unsupported action: ${action}`,
    } satisfies ApiEnvelope<never>)
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error && error.message ? error.message : 'Workspace action failed',
    } satisfies ApiEnvelope<never>)
  }
}
