import type { Plugin, IAgentRuntime, Memory, State } from '@elizaos/core'

declare const process: { env: Record<string, string | undefined> }

export const twitterPlugin: Plugin = {
  name: '@4626/plugin-twitter',
  description: 'Feature-flagged X/Twitter channel context plugin (ingress handled out-of-band).',
  providers: [
    {
      name: 'twitter-channel',
      description: 'Adds Twitter channel state to runtime context when enabled.',
      async get(_runtime: IAgentRuntime, _message: Memory, _state: State) {
        const enabled = String(process.env.ELIZA_CHANNEL_TWITTER_ENABLED ?? '').trim().toLowerCase()
        const tokenConfigured = Boolean(String(process.env.TWITTER_BEARER_TOKEN ?? '').trim())
        return {
          text: enabled === 'true' || enabled === '1'
            ? `Twitter channel integration is enabled (${tokenConfigured ? 'token configured' : 'token missing'}).`
            : '',
          values: {
            twitterEnabled: enabled === 'true' || enabled === '1',
            twitterTokenConfigured: tokenConfigured,
          },
        }
      },
    },
  ],
}

export default twitterPlugin
