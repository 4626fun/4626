import { describe, expect, it } from 'vitest'

import { repointCanonicalCswOnProfile } from '../../server/_lib/wallet/repointCanonicalCsw.ts'
import { CANONICAL_CSW_ADDRESS } from '../../src/wallet/canonicalWalletPolicy.ts'

describe('repointCanonicalCswOnProfile', () => {
  it('replaces a stale CSW and embedded signer on the profile row', async () => {
    const calls: string[] = []
    const db = {
      sql: async (strings: TemplateStringsArray, ...values: any[]) => {
        const text = strings.join('?').toLowerCase()
        calls.push(text)
        if (text.includes('from profiles') && text.includes('limit')) {
          return {
            rows: [
              {
                id: 1,
                csw_address: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
                primary_smart_wallet: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
                primary_embedded_eoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
                embedded_wallet: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
                base_sub_account: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
              },
            ],
          }
        }
        return { rows: [], rowCount: 1 }
      },
    }

    const result = await repointCanonicalCswOnProfile({
      db: db as any,
      profileId: 1,
      canonicalCswAddress: CANONICAL_CSW_ADDRESS,
      embeddedEoaAddress: '0xb2aad65a5402714bf428a66731ae62ba5c45cac0',
      clearBaseSubAccount: true,
    })

    expect(result.previousCswAddress).toBe('0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3')
    expect(result.canonicalCswAddress).toBe(CANONICAL_CSW_ADDRESS)
    expect(result.nextEmbeddedEoa).toBe('0xb2aad65a5402714bf428a66731ae62ba5c45cac0')
    expect(result.clearedBaseSubAccount).toBe('0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3')
    expect(calls.some((call) => call.includes('update profiles'))).toBe(true)
  })
})
