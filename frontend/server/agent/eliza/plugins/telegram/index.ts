import type { Plugin, IAgentRuntime, Memory, State } from '@elizaos/core'

declare const process: { env: Record<string, string | undefined> }

export const telegramPlugin: Plugin = {
  name: '@4626/plugin-telegram',
  description: 'Feature-flagged Telegram channel context plugin (ingress handled out-of-band).',
  providers: [
    {
      name: 'telegram-channel',
      description: 'Adds Telegram channel state to runtime context when enabled.',
      async get(_runtime: IAgentRuntime, _message: Memory, _state: State) {
        const enabled = String(process.env.ELIZA_CHANNEL_TELEGRAM_ENABLED ?? '').trim().toLowerCase()
        const tokenConfigured = Boolean(String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim())
        return {
          text: enabled === 'true' || enabled === '1'
            ? `Telegram channel integration is enabled (${tokenConfigured ? 'token configured' : 'token missing'}).`
            : '',
          values: {
            telegramEnabled: enabled === 'true' || enabled === '1',
            telegramTokenConfigured: tokenConfigured,
          },
        }
      },
    },
  ],
}

export default telegramPlugin
