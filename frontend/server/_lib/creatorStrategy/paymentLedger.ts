import crypto from 'node:crypto'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[] }>
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const child = record[key]
        if (child !== undefined) acc[key] = canonicalize(child)
        return acc
      }, {})
  }
  return value
}

function hashPayload(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex')
}

export async function recordPaymentEvent(params: {
  db: Db
  provider: 'stripe' | 'x402' | 'manual'
  providerEventId: string
  orderId: string
  eventType: string
  amountAtomic?: bigint | null
  currency?: string | null
  payload?: Record<string, unknown> | null
}): Promise<void> {
  const payload = params.payload ?? {}
  await params.db.sql`
    INSERT INTO public.payment_events (
      provider,
      provider_event_id,
      order_id,
      event_type,
      amount,
      currency,
      payload_hash,
      payload_json,
      received_at,
      processed_at
    ) VALUES (
      ${params.provider},
      ${params.providerEventId},
      ${params.orderId},
      ${params.eventType},
      ${params.amountAtomic ? params.amountAtomic.toString() : null},
      ${params.currency ?? null},
      ${hashPayload(payload)},
      ${JSON.stringify(payload)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, provider_event_id)
    DO NOTHING;
  `
}

