import { asTrimmed } from '../utils.js'

export type ParsedTelegramVaultDeployIntent =
  | { kind: 'menu' }
  | { kind: 'usage'; text: string }
  | { kind: 'request'; token: 'akita'; version: string }

const DEFAULT_VERSION = 'v1.9.2'
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/i

export function formatVaultDeployUsageText(reason?: string): string {
  const lines = [
    'Vault Deploy',
    '',
    reason ? `- ${reason}` : '- usage:',
    '- `/vaultdeploy`',
    '- `/vaultdeploy akita`',
    '- `/vaultdeploy akita v1.9.2`',
    '',
    'Notes:',
    '- currently scoped to the AKITA vault deployment template',
    '- deploy runs through deploy-session with confirm/decline flow',
  ]
  return lines.join('\n')
}

export function parseTelegramVaultDeployIntent(rawText: string): ParsedTelegramVaultDeployIntent | null {
  const text = asTrimmed(rawText)
  if (!text) return null
  const tokenized = text.split(/\s+/g).filter(Boolean)
  const head = asTrimmed(tokenized[0] ?? '')
    .replace(/^\//, '')
    .toLowerCase()
  if (head !== 'vaultdeploy') return null
  if (tokenized.length === 1) return { kind: 'menu' }

  const tokenRaw = asTrimmed(tokenized[1] ?? '').toLowerCase()
  if (!tokenRaw) return { kind: 'menu' }
  if (tokenRaw !== 'akita') {
    return { kind: 'usage', text: formatVaultDeployUsageText(`Unsupported token "${tokenRaw}". Only "akita" is available right now.`) }
  }

  const versionRaw = asTrimmed(tokenized[2] ?? '')
  if (!versionRaw) {
    return { kind: 'request', token: 'akita', version: DEFAULT_VERSION }
  }
  if (!VERSION_PATTERN.test(versionRaw)) {
    return { kind: 'usage', text: formatVaultDeployUsageText('Version must look like v1.9.2') }
  }
  return {
    kind: 'request',
    token: 'akita',
    version: versionRaw,
  }
}

export function parseVaultDeployCallbackData(rawData: string):
  | { kind: 'confirm' | 'decline'; token: string }
  | { kind: 'status'; token: string }
  | null {
  const data = asTrimmed(rawData)
  const statusMatch = data.match(/^vaultdeploy:status:([a-zA-Z0-9._-]+)$/)
  if (statusMatch) {
    const token = asTrimmed(statusMatch[1])
    if (!token) return null
    return {
      kind: 'status',
      token,
    }
  }
  const actionMatch = data.match(/^vaultdeploy:(confirm|decline):([a-zA-Z0-9._-]+)$/)
  if (!actionMatch) return null
  const action = asTrimmed(actionMatch[1]).toLowerCase()
  const token = asTrimmed(actionMatch[2])
  if (!token) return null
  return {
    kind: action === 'confirm' ? 'confirm' : 'decline',
    token,
  }
}
