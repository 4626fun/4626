// Shared XMTP interactive content helpers (Actions, Intents, follow-ups).
// Imported by the web client and the Eliza XMTP agent service.

export type XmtpActionButton = {
  id: string
  label: string
  style?: 'primary' | 'secondary' | 'danger'
}

export type XmtpActionsPayload = {
  id: string
  description: string
  actions: XmtpActionButton[]
}

export type XmtpInteractiveFollowUp = 'welcome-actions' | 'keepr-status-followup'

export type XmtpAgentReply = {
  text: string
  followUp?: XmtpInteractiveFollowUp
  /** Agent adds ✅ on the inbound message (e.g. after /keepr status). */
  reactToInbound?: boolean
}

export type NormalizedXmtpAgentReply = XmtpAgentReply

export const XMTP_ACTION_IDS = {
  WELCOME_HELP: 'welcome:help',
  WELCOME_KEEPR_STATUS: 'welcome:keepr-status',
  WELCOME_KEEPR_HEALTH: 'welcome:keepr-health',
  WELCOME_WALLET: 'welcome:wallet',
  WELCOME_AI: 'welcome:ai',
  KEEPR_REFRESH: 'keepr:refresh',
  KEEPR_HEALTH: 'keepr:health',
  KEEPR_BACK: 'keepr:back',
} as const

const ACTION_COMMAND_MAP: Record<string, string> = {
  [XMTP_ACTION_IDS.WELCOME_HELP]: '/help',
  [XMTP_ACTION_IDS.WELCOME_KEEPR_STATUS]: '/keepr status',
  [XMTP_ACTION_IDS.WELCOME_KEEPR_HEALTH]: '/keepr health',
  [XMTP_ACTION_IDS.WELCOME_WALLET]: '/wallet',
  [XMTP_ACTION_IDS.WELCOME_AI]: '/ai',
  [XMTP_ACTION_IDS.KEEPR_REFRESH]: '/keepr status',
  [XMTP_ACTION_IDS.KEEPR_HEALTH]: '/keepr health',
  [XMTP_ACTION_IDS.KEEPR_BACK]: '/help',
}

export function resolveIntentActionId(actionId: string): string | null {
  const key = String(actionId ?? '').trim()
  if (!key) return null
  return ACTION_COMMAND_MAP[key] ?? null
}

export function buildWelcomeActions(): XmtpActionsPayload {
  return {
    id: `welcome-actions-${Date.now()}`,
    description: 'Quick start',
    actions: [
      { id: XMTP_ACTION_IDS.WELCOME_HELP, label: 'Help', style: 'secondary' },
      { id: XMTP_ACTION_IDS.WELCOME_KEEPR_STATUS, label: 'Vault status', style: 'primary' },
      { id: XMTP_ACTION_IDS.WELCOME_KEEPR_HEALTH, label: 'Keeper health', style: 'secondary' },
      { id: XMTP_ACTION_IDS.WELCOME_WALLET, label: 'Wallet', style: 'secondary' },
      { id: XMTP_ACTION_IDS.WELCOME_AI, label: 'Ask AI', style: 'secondary' },
    ],
  }
}

export function buildKeeprStatusFollowUpActions(): XmtpActionsPayload {
  return {
    id: `keepr-status-followup-${Date.now()}`,
    description: 'What next?',
    actions: [
      { id: XMTP_ACTION_IDS.KEEPR_REFRESH, label: 'Refresh', style: 'primary' },
      { id: XMTP_ACTION_IDS.KEEPR_HEALTH, label: 'Health', style: 'secondary' },
      { id: XMTP_ACTION_IDS.KEEPR_BACK, label: 'Back', style: 'secondary' },
    ],
  }
}

export function isWelcomeMessageText(text: string): boolean {
  return String(text ?? '').trim().startsWith("o henlo! I'm Keepr")
}

export function normalizeAgentReply(reply: string | XmtpAgentReply | null | undefined): NormalizedXmtpAgentReply | null {
  if (reply == null) return null
  if (typeof reply === 'string') {
    const text = reply.trim()
    if (!text) return null
    const normalized: NormalizedXmtpAgentReply = { text }
    if (isWelcomeMessageText(text)) {
      normalized.followUp = 'welcome-actions'
    }
    return normalized
  }
  const text = String(reply.text ?? '').trim()
  if (!text) return null
  return {
    text,
    followUp: reply.followUp,
    reactToInbound: reply.reactToInbound === true,
  }
}

/** Wallet send calls are intentionally out of scope here — see docs/operations/xmtp-interactive-roadmap.md */
export type XmtpWalletSendCallsScaffold = {
  note: 'Use conversation.sendWalletSendCalls() for in-chat swap/approval confirmation.'
}
