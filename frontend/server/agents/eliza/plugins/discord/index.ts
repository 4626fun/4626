import type { Plugin, IAgentRuntime, Memory, State } from '@elizaos/core'

declare const process: { env: Record<string, string | undefined> }

export const discordPlugin: Plugin = {
  name: '@4626/plugin-discord',
  description: 'Feature-flagged Discord channel context plugin (ingress handled out-of-band).',
  providers: [
    {
      name: 'discord-channel',
      description: 'Adds Discord channel state to runtime context when enabled.',
      async get(_runtime: IAgentRuntime, _message: Memory, _state: State) {
        const enabled = String(process.env.ELIZA_CHANNEL_DISCORD_ENABLED ?? '').trim().toLowerCase()
        const tokenConfigured = Boolean(String(process.env.DISCORD_BOT_TOKEN ?? '').trim())
        return {
          text: enabled === 'true' || enabled === '1'
            ? `Discord channel integration is enabled (${tokenConfigured ? 'token configured' : 'token missing'}).`
            : '',
          values: {
            discordEnabled: enabled === 'true' || enabled === '1',
            discordTokenConfigured: tokenConfigured,
          },
        }
      },
    },
  ],
}

export default discordPlugin
