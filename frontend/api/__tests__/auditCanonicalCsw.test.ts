import { describe, expect, it, vi } from 'vitest'

import { auditProfileCswRow } from '../../server/_lib/wallet/auditCanonicalCsw.ts'
import { CANONICAL_CSW_ADDRESS } from '../../src/wallet/canonicalWalletPolicy.ts'

describe('auditProfileCswRow', () => {
  it('flags Zora Privy owner EOAs stored as CSW', async () => {
    const hasDeployedBytecode = vi.fn(async (address: string | null | undefined) => {
      if (!address) return false
      return address.toLowerCase() === CANONICAL_CSW_ADDRESS
    })

    const audit = await auditProfileCswRow({
      row: {
        id: 1,
        email: 'you@example.com',
        privy_user_id: 'did:privy:test',
        csw_address: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        primary_smart_wallet: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        primary_embedded_eoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
        primary_wallet: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
      },
      hasDeployedBytecode,
      zoraCanonicalCsw: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
    })

    expect(audit?.expectedCsw).toBe(CANONICAL_CSW_ADDRESS)
    expect(audit?.reasons).toContain('csw_is_allowed_owner_eoa')
    expect(audit?.reasons).toContain('csw_has_no_bytecode')
    expect(audit?.reasons).toContain('policy_resolved_csw_differs')
  })

  it('passes legitimate Base CSW profiles', async () => {
    const baseCsw = CANONICAL_CSW_ADDRESS
    const hasDeployedBytecode = vi.fn(async (address: string | null | undefined) => {
      return address?.toLowerCase() === baseCsw
    })

    const audit = await auditProfileCswRow({
      row: {
        id: 710,
        email: '4626dotfun@gmail.com',
        csw_address: baseCsw,
        primary_smart_wallet: baseCsw,
        primary_embedded_eoa: '0xb2aad65a5402714bf428a66731ae62ba5c45cac0',
        primary_wallet: '0xb2aad65a5402714bf428a66731ae62ba5c45cac0',
      },
      hasDeployedBytecode,
    })

    expect(audit).toBeNull()
  })
})
