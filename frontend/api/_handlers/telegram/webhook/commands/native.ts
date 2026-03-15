import { getCommandHead, isTelegramNativeCommand } from '../parsers/command.js'

export function isNativeTelegramCommand(text: string): boolean {
  return isTelegramNativeCommand(text)
}

export function resolveNativeCommandHead(text: string): string {
  return getCommandHead(text)
}
