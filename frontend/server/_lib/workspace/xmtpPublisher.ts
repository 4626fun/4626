import { enqueueKeeprAction, getKeeprVaultByVaultAddress } from '../keepr/keeprRegistry.js'

export type WorkspaceXmtpMessageType =
  | 'approval_request'
  | 'approval_decision'
  | 'rebalance_suggestion'
  | 'risk_alert'
  | 'settlement_update'
  | 'status_summary'
  | 'task_update'

export type WorkspaceXmtpPublishParams = {
  vaultAddress: `0x${string}`
  messageType: WorkspaceXmtpMessageType
  title: string
  body: string
  payload?: Record<string, unknown>
  dedupeKey?: string | null
}

export type WorkspaceXmtpPublishResult =
  | { queued: true; actionId: number; groupId: string }
  | { queued: false; reason: string }

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function formatStructuredMessage(params: WorkspaceXmtpPublishParams): string {
  const lines = [
    `[${params.messageType}] ${params.title}`,
    params.body,
  ]
  if (params.payload && Object.keys(params.payload).length > 0) {
    lines.push(`payload: ${JSON.stringify(params.payload)}`)
  }
  return lines.filter(Boolean).join('\n')
}

export async function publishWorkspaceXmtpMessage(
  params: WorkspaceXmtpPublishParams,
): Promise<WorkspaceXmtpPublishResult> {
  const vault = await getKeeprVaultByVaultAddress(params.vaultAddress)
  if (!vault?.groupId) {
    return {
      queued: false,
      reason: 'vault_group_not_found',
    }
  }
  const message = formatStructuredMessage(params)
  const action = await enqueueKeeprAction({
    vaultAddress: params.vaultAddress,
    groupId: vault.groupId,
    actionType: 'xmtp.group.send_message',
    action: {
      action: 'xmtp.group.send_message',
      params: {
        groupId: vault.groupId,
        message,
      },
    },
    dedupeKey:
      asTrimmed(params.dedupeKey) ||
      `workspace:${params.vaultAddress}:${params.messageType}:${Date.now().toString(36)}`,
  }).catch(() => null)

  if (!action?.id) {
    return {
      queued: false,
      reason: 'xmtp_enqueue_failed',
    }
  }
  return {
    queued: true,
    actionId: action.id,
    groupId: vault.groupId,
  }
}
