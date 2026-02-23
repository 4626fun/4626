import { describe, expect, it } from 'vitest'

import { classifyPreprovisionResponse } from './preprovisionStatus'

describe('classifyPreprovisionResponse', () => {
  it('returns idle for 401', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 401, json: null })).toBe('idle')
    expect(classifyPreprovisionResponse({ httpStatus: 401, json: {} })).toBe('idle')
  })

  it('returns idle for 403', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 403, json: null })).toBe('idle')
    expect(classifyPreprovisionResponse({ httpStatus: 403, json: { success: false } })).toBe('idle')
  })

  it('returns idle for 404', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 404, json: null })).toBe('idle')
    expect(classifyPreprovisionResponse({ httpStatus: 404, json: undefined })).toBe('idle')
  })

  it('returns error for 500', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 500, json: null })).toBe('error')
    expect(classifyPreprovisionResponse({ httpStatus: 500, json: { success: false } })).toBe('error')
  })

  it('returns done for 200 with success and data', () => {
    const data = { serverWalletAddress: '0x123', coinAddress: null, coinSymbol: null, farcasterUsername: null, zoraHandle: null }
    expect(classifyPreprovisionResponse({ httpStatus: 200, json: { success: true, data } })).toBe('done')
  })

  it('returns error for 200 without success or data', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 200, json: { success: false } })).toBe('error')
    expect(classifyPreprovisionResponse({ httpStatus: 200, json: { success: true } })).toBe('error')
    expect(classifyPreprovisionResponse({ httpStatus: 200, json: { success: true, data: null } })).toBe('error')
  })
})
