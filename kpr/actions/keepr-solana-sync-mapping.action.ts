import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type SolanaSyncMappingInput = {
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  sourceSessionId?: string | null
}

type ParsedMapping = {
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  sourceSessionId: string | null
}

function isHexAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function isSolanaAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const s = value.trim()
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function parseInput(input: Record<string, unknown>): ParsedMapping {
  const creatorToken = typeof input.creatorToken === 'string' ? input.creatorToken.trim().toLowerCase() : ''
  const shareOft = typeof input.shareOft === 'string' ? input.shareOft.trim().toLowerCase() : ''
  const shareMeshMint = typeof input.shareMeshMint === 'string' ? input.shareMeshMint.trim() : ''
  const sourceSessionId = typeof input.sourceSessionId === 'string' ? input.sourceSessionId.trim() : ''
  if (!isHexAddress(creatorToken)) throw new Error('invalid_creator_token')
  if (!isHexAddress(shareOft)) throw new Error('invalid_share_oft')
  if (!isSolanaAddress(shareMeshMint)) throw new Error('invalid_share_mesh_mint')
  return {
    creatorToken,
    shareOft,
    shareMeshMint,
    sourceSessionId: sourceSessionId || null,
  }
}

function parseMappingEnv(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== 'string' || typeof v !== 'string') continue
      if (!isSolanaAddress(k) || !isHexAddress(v)) continue
      out[k] = v.toLowerCase()
    }
    return out
  } catch {
    return {}
  }
}

function stringifyMapping(mapping: Record<string, string>): string {
  const sorted = Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(Object.fromEntries(sorted))
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
  const tempDir = await mkdtemp(join(tmpdir(), 'solana-mapping-'))
  const tempFile = join(tempDir, 'solana-keeper-orchestrator.env')
  try {
    await writeFile(tempFile, content, 'utf8')
    await runCommand('sudo', ['install', '-m', '600', tempFile, path])
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function executeSolanaSyncMapping(payload: Record<string, unknown>) {
  const parsed = parseInput(payload)
  const currentMapping = parseMappingEnv(String(process.env.SOLANA_SHARE_OFT_MAPPING ?? '{}'))
  const currentMints = parseMintList(String(process.env.SOLANA_CREATOR_MINTS ?? ''))

  const nextMapping = { ...currentMapping, [parsed.shareMeshMint]: parsed.shareOft }
  const nextMints = stringifyMintList([...currentMints, parsed.shareMeshMint])
  const nextMappingJson = stringifyMapping(nextMapping)

  const changed =
    nextMappingJson !== stringifyMapping(currentMapping) ||
    nextMints !== stringifyMintList(currentMints)

  if (!changed) {
    return {
      updated: false,
      restarted: false,
      creatorToken: parsed.creatorToken,
      shareOft: parsed.shareOft,
      shareMeshMint: parsed.shareMeshMint,
      sourceSessionId: parsed.sourceSessionId,
      reason: 'no_changes',
    }
  }

  const envFile = String(
    process.env.SOLANA_ORCHESTRATOR_ENV_FILE_PATH ?? '/etc/4626/solana-keeper-orchestrator.env',
  ).trim()
  if (!envFile) throw new Error('missing_solana_orchestrator_env_file_path')
  const currentEnvFile = await readEnvFileWithSudo(envFile)
  let nextEnvFile = upsertEnvLine(currentEnvFile, 'SOLANA_SHARE_OFT_MAPPING', `'${nextMappingJson}'`)
  nextEnvFile = upsertEnvLine(nextEnvFile, 'SOLANA_CREATOR_MINTS', nextMints)
  await writeEnvFileWithSudo(envFile, nextEnvFile)
  await runCommand('bash', ['-lc', 'sudo systemctl restart solana-keeper-orchestrator.service'])

  return {
    updated: true,
    restarted: true,
    creatorToken: parsed.creatorToken,
    shareOft: parsed.shareOft,
    shareMeshMint: parsed.shareMeshMint,
    sourceSessionId: parsed.sourceSessionId,
    mappingSize: Object.keys(nextMapping).length,
  }
}
