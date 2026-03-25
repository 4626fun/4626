import type { Address } from 'viem'

export type KeeprRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type KeeprCommandResult =
  | { ok: true; response: string; action?: any }
  | { ok: false; response: string; action?: any }

export type ExecuteCommandRoleOverrides = {
  twitter?: KeeprRole
  coin?: KeeprRole
  send?: KeeprRole
}

export type ExecuteCommandParams = {
  groupId: string
  senderWallet: Address
  text: string
  chatId?: string
  userId?: string
  roleOverrides?: ExecuteCommandRoleOverrides
}
