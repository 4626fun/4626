import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function isSolanaAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const s = value.trim()
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function parseMintList(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => isSolanaAddress(v))
}

function stringifyMintList(values: string[]): string {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)).join(',')
}

function parseEnabledMints(payload: Record<string, unknown>): string[] {
  const raw = payload.enabledMints
  if (!Array.isArray(raw)) return []
  return raw
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => isSolanaAddress(value))
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, { env: process.env, timeout: 30_000 })
}

async function readEnvFileWithSudo(path: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('sudo', ['cat', path], { env: process.env, timeout: 30_000 })
    return stdout
  } catch {
    return ''
  }
}

function upsertEnvLine(content: string, key: string, value: string): string {
  const lines = content.split(/\r?\n/)
  const prefix = `${key}=`
  let found = false
  const next = lines.map((line) => {
    if (line.startsWith(prefix)) {
      found = true
      return `${prefix}${value}`
    }
    return line
  })
  if (!found) next.push(`${prefix}${value}`)
  return next.join('\n').replace(/\n+$/, '\n')
}

async function writeEnvFileWithSudo(path: string, content: string): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'solana-relay-config-'))
  const tempFile = join(tempDir, 'solana-keeper-orchestrator.env')
  try {
    await writeFile(tempFile, content, 'utf8')
    await runCommand('sudo', ['install', '-m', '600', tempFile, path])
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function executeSolanaSyncRelayConfig(payload: Record<string, unknown>) {
  const enabledMints = parseEnabledMints(payload)
  const nextRelayMints = stringifyMintList(enabledMints)
  const currentRelayMints = stringifyMintList(parseMintList(String(process.env.SOLANA_RELAY_ENABLED_MINTS ?? '')))
  const perMintGatingCurrent = String(process.env.SOLANA_RELAY_PER_MINT_GATING ?? '').trim()
  const perMintGatingNext = '1'

  const changed =
    nextRelayMints !== currentRelayMints || perMintGatingCurrent !== perMintGatingNext

  if (!changed) {
    return {
      updated: false,
      restarted: false,
      enabledMints,
      reason: 'no_changes',
    }
  }

  const envFile = String(
    process.env.SOLANA_ORCHESTRATOR_ENV_FILE_PATH ?? '/etc/4626/solana-keeper-orchestrator.env',
  ).trim()
  if (!envFile) throw new Error('missing_solana_orchestrator_env_file_path')

  const currentEnvFile = await readEnvFileWithSudo(envFile)
  let nextEnvFile = upsertEnvLine(currentEnvFile, 'SOLANA_RELAY_ENABLED_MINTS', nextRelayMints)
  nextEnvFile = upsertEnvLine(nextEnvFile, 'SOLANA_RELAY_PER_MINT_GATING', perMintGatingNext)
  await writeEnvFileWithSudo(envFile, nextEnvFile)
  await runCommand('bash', ['-lc', 'sudo systemctl restart solana-keeper-orchestrator.service'])

  return {
    updated: true,
    restarted: true,
    enabledMints,
    relayEnabledMintCount: enabledMints.length,
  }
}
