import { describe, expect, it } from 'vitest'
import { Keypair } from '@solana/web3.js'

import {
  buildTestRouteSendUlnConfig,
  isExactTestRouteSendUlnConfig,
} from '../../../scripts/ops/configure-solana-lottery-test-oapp-uln.js'

describe('test-route ULN configuration', () => {
  it('builds only a sorted 2-of-2 optional-DVN configuration', () => {
    const first = Keypair.generate().publicKey
    const second = Keypair.generate().publicKey
    const config = buildTestRouteSendUlnConfig([second, first])

    expect(config).toMatchObject({
      confirmations: 0,
      requiredDvnCount: 255,
      optionalDvnCount: 2,
      optionalDvnThreshold: 2,
      requiredDvns: [],
    })
    expect(Buffer.compare(config.optionalDvns[0].toBuffer(), config.optionalDvns[1].toBuffer())).toBeLessThan(0)
    expect(isExactTestRouteSendUlnConfig(config, config)).toBe(true)
    expect(isExactTestRouteSendUlnConfig({ ...config, confirmations: { toString: () => '0' } }, config)).toBe(true)
    expect(isExactTestRouteSendUlnConfig({ ...config, optionalDvnThreshold: 1 }, config)).toBe(false)
  })

  it('fails closed on duplicate or incomplete DVN input', () => {
    const dvn = Keypair.generate().publicKey
    expect(() => buildTestRouteSendUlnConfig([dvn])).toThrow('test_route_dvn_count_mismatch')
    expect(() => buildTestRouteSendUlnConfig([dvn, dvn])).toThrow('test_route_dvn_duplicate')
  })
})
