export type MessagingConnectStatus =
  | 'idle'
  | 'signing'
  | 'connecting'
  | 'connected'
  | 'error'

export function shouldAutoConnectMessaging(
  status: MessagingConnectStatus,
  options?: { localStateResetRequired?: boolean },
): boolean {
  if (status === 'idle') return true
  if (status === 'error' && !options?.localStateResetRequired) return true
  return false
}
