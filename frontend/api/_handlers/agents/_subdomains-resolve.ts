import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import {
  deriveLabelFromHost,
  ensureAgentSubdomainsSchema,
  getAgentSubdomainByLabel,
  getDefaultParentId,
  getSubdomainWebApexes,
  normalizeSubdomainLabel,
  readHostFromRequest,
  type AgentSubdomainRecord,
} from '../../../server/_lib/agentSubdomains.js'
import { getDb } from '../../../server/_lib/postgres.js'

type SubdomainResolveResponse = {
  label: string
  host: string
  source: 'label' | 'host'
  record: AgentSubdomainRecord | null
}

function readQueryString(req: VercelRequest, key: string): string {
  const value = req.query?.[key]
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim()
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureAgentSubdomainsSchema(db as any)

  const parentId = readQueryString(req, 'parentId') || getDefaultParentId()
  const includeInactive = readQueryString(req, 'includeInactive').toLowerCase() === 'true'
  const explicitLabel = normalizeSubdomainLabel(readQueryString(req, 'label'))

  let label = explicitLabel
  let source: 'label' | 'host' = 'label'

  const hostQuery = readQueryString(req, 'host')
  const host = hostQuery || readHostFromRequest(req)

  if (!label) {
    label = deriveLabelFromHost(host, getSubdomainWebApexes()) ?? ''
    source = 'host'
  }

  if (!label) {
    return res.status(200).json({
      success: true,
      data: {
        label: '',
        host,
        source,
        record: null,
      } satisfies SubdomainResolveResponse,
    } satisfies ApiEnvelope<SubdomainResolveResponse>)
  }

  const record = await getAgentSubdomainByLabel(db as any, { label, parentId, includeInactive })
  return res.status(200).json({
    success: true,
    data: {
      label,
      host,
      source,
      record,
    } satisfies SubdomainResolveResponse,
  } satisfies ApiEnvelope<SubdomainResolveResponse>)
}
