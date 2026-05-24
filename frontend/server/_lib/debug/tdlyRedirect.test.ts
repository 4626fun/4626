import { describe, expect, it } from 'vitest'

import {
  decodeTdlyRedirectQuery,
  extractTdlyRedirectQueryFromUrl,
} from './tdlyRedirect.js'

const SAMPLE_Q =
  'H4sIAAAAAAAA_9SVz6obPQzF3yZr659lLWZxufkC32NYslzKbZOS5HLz-KV0nTLUtNDfbhiOzoysY_mXS7xtXBkN2Q5xOd-vPe4vY1zzdtvKQ04nID2yl9Px9ch2jBcqoa8n0f9EWy9YB2qzw7xevm7lUfYBh0_9tqH8fDqc8_5xub5tjYUO1_5xej_H_fPl_P_52_t9Kw-YfRi32Fn9CbwmXwfW5Pj0DXt2H6VPj8BZmEuMnBAUyjKYZk8tnHPNv9OSHOqaPbQlObuvFIA6Y6V_EHMu-LcQyBX7mrTY_7XTL4Wez-9fAZiJZwzxlUb-Mod7v-RP-XOMUpKaVsQg8THcnMMqBlDlikTNg37PX7l2wbaWwh8szmFhZkMrAU_3wd77sJIyEwC10UwxaueYTFqbKnEQhg4p6aKWKJExECHaBEWrI8fij_xjLMZmPTeLBVb3P0NJEBnovbszAE0yc7JkS5pzdmmmiQYmYeJeqExmE6-WXlSkehOV5FYrDGzCvToNHp6NfGQHnUo6m2jO0sCcBkAQVGy9y8znE7-P7wEAAP__XgPfsO8JAAA='

describe('tdlyRedirect', () => {
  it('decodes gzip query params from q payload', () => {
    const params = decodeTdlyRedirectQuery(SAMPLE_Q)
    expect(params.network).toBe('8453')
    expect(params.block).toBe('46429249')
    expect(params.contractAddress.toLowerCase()).toBe('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')
    expect(params.rawFunctionInput.startsWith('0x1fad948c')).toBe(true)
  })

  it('extracts q from tdly-redirect URL', () => {
    const q = extractTdlyRedirectQueryFromUrl(
      `https://base.github.io/tdly-redirect/?q=${encodeURIComponent(SAMPLE_Q)}`,
    )
    expect(q).toBe(SAMPLE_Q)
  })
})
