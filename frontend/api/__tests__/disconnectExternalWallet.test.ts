import { describe, expect, it } from 'vitest'

import {
  disconnectExternalWalletFromProfile,
  resolveProfilesPrimaryWalletColumn,
} from '../../server/_lib/wallet/disconnectExternalWallet.ts'

describe('resolveProfilesPrimaryWalletColumn', () => {
  it('prefers embedded EOA over external active owner when canonical CSW exists', () => {
    expect(
      resolveProfilesPrimaryWalletColumn({
        embedded: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
        canonical: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        activeOwner: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
        classificationPrimary: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      }),
    ).toBe('0xceca13f2686ed061c57620ecdf67e1b8c0f285e9')
  })

  it('falls back to external owner when no canonical CSW is linked', () => {
    expect(
      resolveProfilesPrimaryWalletColumn({
        embedded: null,
        canonical: null,
        activeOwner: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
        classificationPrimary: null,
      }),
    ).toBe('0xb05cf01231cf2ff99499682e64d3780d57c80fdd')
  })
})

describe('disconnectExternalWalletFromProfile', () => {
  it('clears stale external primary_wallet and re-points to embedded signer', async () => {
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
                primary_wallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
                primary_embedded_eoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
                embedded_wallet: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
                csw_address: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
                primary_smart_wallet: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
              },
            ],
          }
        }
        if (text.includes('update profiles')) {
          expect(values).toContain('0xceca13f2686ed061c57620ecdf67e1b8c0f285e9')
          return { rows: [], rowCount: 1 }
        }
        if (text.includes('update profile_wallets')) return { rows: [], rowCount: 1 }
        return { rows: [], rowCount: 0 }
      },
    }

    const result = await disconnectExternalWalletFromProfile({
      db: db as any,
      profileId: 1,
      externalAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
    })

    expect(result.clearedPrimaryWallet).toBe(true)
    expect(result.nextPrimaryWallet).toBe('0xceca13f2686ed061c57620ecdf67e1b8c0f285e9')
    expect(calls.some((call) => call.includes('update profiles'))).toBe(true)
  })

  it('refuses to disconnect embedded signer lane', async () => {
    const db = {
      sql: async () => ({
        rows: [
          {
            id: 1,
            primary_wallet: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
            primary_embedded_eoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
            embedded_wallet: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
            csw_address: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
            primary_smart_wallet: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
          },
        ],
      }),
    }

    await expect(
      disconnectExternalWalletFromProfile({
        db: db as any,
        profileId: 1,
        externalAddress: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
      }),
    ).rejects.toThrow('cannot_disconnect_embedded_signer')
  })
})
