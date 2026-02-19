import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

type ConwayConfig = {
  enabled: boolean
  web4Url: string
  docsUrl: string
  cloudUrl: string
  openx402Url: string
  npmPackageUrl: string
  mcpInstallCommand: string
}

declare const process: { env: Record<string, string | undefined> }

function readConwayConfig(): ConwayConfig {
  const enabledRaw = String(process.env.WEB4_CONWAY_ENABLED ?? '').trim().toLowerCase()
  const enabled = enabledRaw === '1' || enabledRaw === 'true' || enabledRaw === 'yes' || enabledRaw === 'on'
  return {
    enabled,
    web4Url: String(process.env.WEB4_URL ?? 'https://web4.ai/').trim(),
    docsUrl: String(process.env.WEB4_CONWAY_DOCS_URL ?? 'https://docs.conway.tech/').trim(),
    cloudUrl: String(process.env.WEB4_CONWAY_CLOUD_URL ?? 'https://app.conway.tech/').trim(),
    openx402Url: String(process.env.WEB4_OPENX402_URL ?? 'https://openx402.ai/').trim(),
    npmPackageUrl: String(process.env.WEB4_CONWAY_NPM_URL ?? 'https://www.npmjs.com/package/conway-terminal').trim(),
    mcpInstallCommand: String(process.env.WEB4_CONWAY_MCP_INSTALL_CMD ?? 'npx conway-terminal').trim(),
  }
}

function formatStatus(config: ConwayConfig): string {
  const lines = ['Web4 / Conway integration status']
  lines.push(`- Enabled: ${config.enabled ? 'yes' : 'no (set WEB4_CONWAY_ENABLED=true to enable)'}`)
  lines.push(`- Web4: ${config.web4Url}`)
  lines.push(`- Conway docs: ${config.docsUrl}`)
  lines.push(`- Conway Cloud: ${config.cloudUrl}`)
  lines.push(`- openx402: ${config.openx402Url}`)
  lines.push(`- MCP install: \`${config.mcpInstallCommand}\``)
  return lines.join('\n')
}

const web4CommandAction: Action = {
  name: 'WEB4_CONWAY_COMMAND',
  similes: ['web4', 'conway', 'x402', 'openx402'],
  description: 'Explain or report Web4/Conway integration status for the current agent stack.',
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = String(message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/web4') || text.startsWith('web4 ') || text.startsWith('/conway') || text.startsWith('conway ')
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback?: HandlerCallback,
  ) => {
    const text = String(message.content?.text ?? '').trim()
    const command = text.replace(/^\/?(web4|conway)\s*/i, '').trim().toLowerCase()
    const config = readConwayConfig()

    if (!command || command === 'help') {
      await callback?.({
        text:
          'Web4 / Conway commands:\n' +
          '- `/web4 status` show integration status\n' +
          '- `/web4 docs` show docs and service links\n' +
          '- `/web4 install` show MCP install command',
      } as Content)
      return
    }

    if (command.startsWith('status')) {
      await callback?.({ text: formatStatus(config) } as Content)
      return
    }

    if (command.startsWith('install')) {
      await callback?.({
        text:
          'Conway terminal install command:\n' +
          `\`${config.mcpInstallCommand}\`\n\n` +
          `Package: ${config.npmPackageUrl}`,
      } as Content)
      return
    }

    if (command.startsWith('docs') || command.startsWith('links')) {
      await callback?.({
        text:
          'Web4 / Conway references:\n' +
          `- Web4: ${config.web4Url}\n` +
          `- Conway docs: ${config.docsUrl}\n` +
          `- Conway Cloud: ${config.cloudUrl}\n` +
          `- openx402: ${config.openx402Url}`,
      } as Content)
      return
    }

    await callback?.({
      text: 'Unknown `/web4` command. Try `/web4 help`.',
    } as Content)
  },
}

export const web4Plugin: Plugin = {
  name: '@creatorvault/plugin-web4',
  description: 'Web4/Conway integration status and setup helper commands.',
  actions: [web4CommandAction],
}

export default web4Plugin
