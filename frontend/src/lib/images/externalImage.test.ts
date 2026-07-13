import { describe, expect, it } from 'vitest'

import { proxiedExternalImageUrl } from './externalImage'

describe('proxiedExternalImageUrl', () => {
  it('routes remote room images through the same-origin image proxy', () => {
    const source =
      'https://project.storage.supabase.co/storage/v1/object/public/content/images/room-image'

    expect(proxiedExternalImageUrl(source)).toBe(
      `/api/image/external?url=${encodeURIComponent(source)}`,
    )
  })

  it('keeps safe local sources and rejects invalid protocols', () => {
    expect(proxiedExternalImageUrl('/assets/room.png')).toBe('/assets/room.png')
    expect(proxiedExternalImageUrl('data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc',
    )
    expect(proxiedExternalImageUrl('javascript:alert(1)')).toBeNull()
    expect(proxiedExternalImageUrl(null)).toBeNull()
  })
})
