import { executeCommand } from '../commands/execute.js'
import type { ExecuteCommandParams, KeeprCommandResult, KeeprRole } from '../commands/types.js'

export type { KeeprCommandResult, KeeprRole }

export async function handleKeeprCommand(params: ExecuteCommandParams): Promise<KeeprCommandResult> {
  return executeCommand(params)
}
