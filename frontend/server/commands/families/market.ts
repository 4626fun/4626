import type { KeeprCommandResult } from '../types.js'
import { handleMarketCommand, isMarketCommand } from './keepr.js'

export function matchesMarketCommand(text: string): boolean {
  return isMarketCommand(String(text ?? '').trim().toLowerCase())
}

export async function executeMarketCommandFamily(params: {
  text: string
}): Promise<KeeprCommandResult> {
  return handleMarketCommand(params.text)
}
