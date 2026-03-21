export type MessagingConnectStatus =
  | 'idle'
  | 'signing'
  | 'connecting'
  | 'connected'
  | 'error'

export function shouldAutoConnectMessaging(status: MessagingConnectStatus): boolean {
  return status === 'idle'
}
