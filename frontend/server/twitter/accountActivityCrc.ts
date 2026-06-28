import { createHmac } from 'node:crypto'

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
