import { isNativeTelegramCommand } from './native.js'

export type TelegramCommandRoute = 'native' | 'external'

export function routeTelegramCommand(text: string): TelegramCommandRoute {
  return isNativeTelegramCommand(text) ? 'native' : 'external'
}
