#!/usr/bin/env node

import WebSocket from 'ws'

import { makeSessionToken } from '../server/auth/_shared.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

type ChatTokenEnvelope = {
  success: boolean
  data?: {
    activeSource?: string
    tokenFingerprint?: string | null
  }
  error?: string
}

type AlfaHistoryMessage = {
  id?: string
  sender?: string
  text?: string
  date?: number
}

type AlfaHistoryResponse = {
  messages?: AlfaHistoryMessage[]
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx --env-file=.env scripts/alfaclub-chat-smoke.ts \\
    --jwt <privy-jwt> \\
    --admin-address 0x... \\
    --origin https://4626.fun \\
    --room 1043 \\
    --command "/alfa status"

Required:
  --jwt <token>             Fresh AlfaClub Privy bearer JWT
  --admin-address <address> Admin wallet used to mint cv_auth_session (required unless --skip-rotate)

Optional:
  --origin <url>            App/API origin (default APP_ORIGIN or https://4626.fun)
  --room <id>               AlfaClub room id (default 1043)
  --command <text>          Command to send (default "/alfa status")
  --ws-url <url>            WebSocket URL (default wss://ws.alfaclub.app)
  --api-url <url>           AlfaClub API URL (default https://api.alfaclub.app)
  --poll-ms <ms>            Poll interval for reply check (default 3000)
  --timeout-ms <ms>         Total wait for reply (default 30000)
  --skip-rotate             Skip POST /api/v1/alfaclub/chat-token rotation

Env requirements:
  AUTH_SESSION_SECRET       Needed to sign admin session token (required unless --skip-rotate)
`)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function normalizeOrigin(raw: string): string {
  const value = raw.trim()
  if (!value) return 'https://4626.fun'
  try {
    return new URL(value).origin
  } catch {
    throw new Error(`Invalid --origin: ${raw}`)
  }
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function toPositiveInt(value: string, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function isCommandText(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t.startsWith('/alfa')
}

function looksLikePlaceholderToken(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return false
  return (
    v.includes('your_alfaclub_jwt') ||
    v.includes('<your_') ||
    v.startsWith('<') ||
    v.endsWith('>')
  )
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function fetchRoomHistory(params: {
  apiBaseUrl: string
  jwt: string
  roomId: string
  limit: number
}): Promise<AlfaHistoryMessage[]> {
  const url = new URL('/api/websocket/room_history_paginate', params.apiBaseUrl)
  url.searchParams.set('roomId', params.roomId)
  url.searchParams.set('limit', String(params.limit))
  url.searchParams.set('forward', 'false')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${params.jwt}`,
    },
  })
  const body = await readJsonSafe<AlfaHistoryResponse>(res)
  if (!res.ok) {
    throw new Error(`history_failed:${res.status}`)
  }
  return Array.isArray(body?.messages) ? body.messages : []
}

async function sendRoomMessageViaWs(params: {
  wsUrl: string
  jwt: string
  roomId: string
  text: string
}): Promise<void> {
  const url = new URL(params.wsUrl)
  url.searchParams.set('TOKEN', params.jwt)
  url.searchParams.set('_k', '0')

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const ws = new WebSocket(url.toString())
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        ws.close()
      } catch {}
      reject(new Error('ws_timeout'))
    }, 10_000)

    ws.once('open', () => {
      try {
        ws.send(
          JSON.stringify({
            type: 'message',
            value: {
              room: params.roomId,
              text: params.text,
              attachments: [],
            },
          }),
        )
      } catch (err) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
        return
      }
      setTimeout(() => {
        try {
          ws.close()
        } catch {}
      }, 100)
    })

    ws.once('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })

    ws.once('close', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    })
  })
}

function summarizeMessage(message: AlfaHistoryMessage): string {
  const id = String(message.id ?? 'unknown')
  const sender = String(message.sender ?? 'unknown')
  const text = String(message.text ?? '').replace(/\s+/g, ' ').slice(0, 200)
  return `id=${id} sender=${sender} text=${JSON.stringify(text)}`
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const jwt = getArg('--jwt', '')
  const adminAddress = getArg('--admin-address', '')
  const appOrigin = normalizeOrigin(
    getArg('--origin', String(process.env.APP_ORIGIN ?? '').trim() || 'https://4626.fun'),
  )
  const roomId = getArg('--room', '1043')
  const command = getArg('--command', '/alfa status') || '/alfa status'
  const wsUrl = getArg('--ws-url', 'wss://ws.alfaclub.app')
  const apiUrl = getArg('--api-url', 'https://api.alfaclub.app')
  const pollMs = toPositiveInt(getArg('--poll-ms', '3000'), 3000)
  const timeoutMs = toPositiveInt(getArg('--timeout-ms', '30000'), 30000)
  const skipRotate = hasFlag('--skip-rotate')

  if (!jwt) throw new Error('Missing --jwt')
  if (looksLikePlaceholderToken(jwt)) {
    throw new Error(
      'JWT looks like a placeholder. Replace --jwt "<YOUR_ALFACLUB_JWT>" with a real Privy bearer token from your logged-in AlfaClub session.',
    )
  }
  if (!/^\d+$/.test(roomId)) throw new Error(`Invalid --room: ${roomId}`)
  if (!command.trim().startsWith('/')) {
    throw new Error('Command must start with "/" (e.g. /alfa status)')
  }
  process.stdout.write(`[alfaclub-smoke] origin=${appOrigin} room=${roomId} command=${JSON.stringify(command)}\n`)

  if (!skipRotate) {
    if (!isAddressLike(adminAddress)) {
      throw new Error('Missing/invalid --admin-address (required unless --skip-rotate)')
    }
    if (!process.env.AUTH_SESSION_SECRET || process.env.AUTH_SESSION_SECRET.trim().length < 32) {
      throw new Error('AUTH_SESSION_SECRET env is required to mint admin session token (unless --skip-rotate)')
    }
    const adminToken = makeSessionToken({ address: adminAddress as `0x${string}` })
    process.stdout.write('[alfaclub-smoke] rotating chat token...\n')
    const rotateRes = await fetch(`${appOrigin}/api/v1/alfaclub/chat-token`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ jwt }),
    })
    const rotateJson = await readJsonSafe<ChatTokenEnvelope>(rotateRes)
    if (!rotateRes.ok || !rotateJson?.success) {
      throw new Error(
        `chat-token rotate failed: status=${rotateRes.status} error=${rotateJson?.error ?? 'unknown'}`,
      )
    }
    process.stdout.write(
      `[alfaclub-smoke] token source=${rotateJson.data?.activeSource ?? 'unknown'} fingerprint=${rotateJson.data?.tokenFingerprint ?? 'n/a'}\n`,
    )
  } else {
    process.stdout.write('[alfaclub-smoke] skip-rotate enabled.\n')
  }

  process.stdout.write('[alfaclub-smoke] fetching baseline room history...\n')
  const baseline = await fetchRoomHistory({
    apiBaseUrl: apiUrl,
    jwt,
    roomId,
    limit: 30,
  })
  const knownIds = new Set(
    baseline
      .map((m) => String(m.id ?? '').trim())
      .filter(Boolean),
  )
  process.stdout.write(`[alfaclub-smoke] baseline messages=${baseline.length}\n`)

  process.stdout.write('[alfaclub-smoke] sending command via websocket...\n')
  await sendRoomMessageViaWs({
    wsUrl,
    jwt,
    roomId,
    text: command,
  })
  process.stdout.write('[alfaclub-smoke] command sent, waiting for bridge reply...\n')

  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollMs))
    const messages = await fetchRoomHistory({
      apiBaseUrl: apiUrl,
      jwt,
      roomId,
      limit: 40,
    })

    const fresh = messages.filter((m) => {
      const id = String(m.id ?? '').trim()
      return id && !knownIds.has(id)
    })
    for (const msg of fresh) {
      const id = String(msg.id ?? '').trim()
      if (id) knownIds.add(id)
    }
    if (fresh.length === 0) continue

    const nonCommandFresh = fresh.filter((m) => !isCommandText(String(m.text ?? '')))
    if (nonCommandFresh.length > 0) {
      process.stdout.write('[alfaclub-smoke] ✅ reply detected\n')
      process.stdout.write(
        `${nonCommandFresh
          .slice(0, 3)
          .map((m) => `  - ${summarizeMessage(m)}`)
          .join('\n')}\n`,
      )
      return
    }
  }

  throw new Error(
    `No non-command reply observed within ${timeoutMs}ms. Check Railway logs for [alfaclub-chat] tick errors.`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
  process.stderr.write(`[alfaclub-smoke] failed: ${message}\n`)
  process.exit(1)
})

