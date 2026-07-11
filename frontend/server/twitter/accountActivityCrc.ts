import { createHmac, timingSafeEqual } from 'node:crypto'

/** X Account Activity API CRC response token for webhook registration. */
export function buildAccountActivityCrcResponseToken(crcToken: string, consumerSecret: string): string {
  const token = String(crcToken ?? '').trim()
  const secret = String(consumerSecret ?? '').trim()
  if (!token || !secret) {
    throw new Error('account_activity_crc_inputs_missing')
  }
  const digest = createHmac('sha256', secret).update(token).digest('base64')
  return `sha256=${digest}`
}

export function verifyAccountActivityWebhookSignature(params: {
  rawBody: Buffer
  signature: string
  consumerSecret: string
}): boolean {
  const signature = String(params.signature ?? '').trim()
  const secret = String(params.consumerSecret ?? '').trim()
  if (!signature || !secret) return false

  const expected = `sha256=${createHmac('sha256', secret).update(params.rawBody).digest('base64')}`
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}
