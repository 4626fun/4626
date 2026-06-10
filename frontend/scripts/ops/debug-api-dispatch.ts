#!/usr/bin/env tsx
import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from '../../api/_lib/dispatchCatchAll.js'
import { getApiHandler } from '../../api/_handlers/_routes.js'

async function probe(subpath: string): Promise<void> {
  const req = {
    method: 'GET',
    url: `/api/${subpath}`,
    headers: {},
    query: { path: subpath },
  } as VercelRequest

  let status = 0
  let body: unknown = null

  const res = {
    setHeader() {},
    status(code: number) {
      status = code
      return res
    },
    json(payload: unknown) {
      body = payload
      return res
    },
    end() {
      return res
    },
  } as unknown as VercelResponse

  await dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/'],
    resolveHandler: getApiHandler,
    routeLabel: 'api',
  })

  console.log(`${subpath} -> HTTP ${status}`, JSON.stringify(body).slice(0, 240))
}

async function main(): Promise<void> {
  for (const subpath of [
    'waitlist/stats',
    'v1/alfaclub/chat-auth-health',
    'v1/alfaclub/chat-bridge-run',
    'v1/alfaclub/daily-brief',
    'telegram/hermit-webhook',
  ]) {
    try {
      await probe(subpath)
    } catch (error) {
      console.error(`${subpath} threw`, error)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
