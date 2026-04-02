import { describe, expect, it } from 'vitest'

import { __testables } from '../_handlers/image/_auto-assets.ts'

describe('image auto-assets source hardening', () => {
  it('normalizes decentralized URIs to HTTPS gateways', () => {
    expect(__testables.normalizeAutoAssetSourceUrl('ipfs://bafybeigdyrzt2q/example.png')).toMatch(
      /^https:\/\/.+\/ipfs\/bafybeigdyrzt2q\/example\.png$/,
    )
    expect(__testables.normalizeAutoAssetSourceUrl('ar://abc123')).toBe('https://arweave.net/abc123')
  })

  it('rejects insecure or malformed source URLs', () => {
    expect(__testables.normalizeAutoAssetSourceUrl('http://media.zora.co/image.png')).toBeNull()
    expect(__testables.normalizeAutoAssetSourceUrl('javascript:alert(1)')).toBeNull()
    expect(__testables.isAllowedAutoAssetSourceUrl('https://untrusted.example/image.png')).toBe(false)
  })

  it('allows trusted hosts and zora domains', () => {
    expect(__testables.isAllowedAutoAssetSourceUrl('https://media.zora.co/image.png')).toBe(true)
    expect(__testables.isAllowedAutoAssetSourceUrl('https://arweave.net/abc123')).toBe(true)
  })

  it('picks the first allowed zora media URL candidate', () => {
    const coinData = {
      mediaContent: {
        previewImage: {
          medium: 'https://untrusted.example/medium.png',
          small: 'https://media.zora.co/small.png',
        },
        originalUri: 'https://arweave.net/fallback',
      },
    }
    expect(__testables.pickSafeZoraSubjectUrl(coinData)).toBe('https://media.zora.co/small.png')
  })

  it('returns null when all zora media URLs are disallowed', () => {
    const coinData = {
      mediaContent: {
        previewImage: {
          medium: 'https://untrusted.example/medium.png',
          small: 'https://another-bad.example/small.png',
        },
        originalUri: 'http://unsafe.example/original.png',
      },
    }
    expect(__testables.pickSafeZoraSubjectUrl(coinData)).toBeNull()
  })
})
