import { describe, expect, it } from 'vitest'

import { splitZoraProfileHandle } from './zoraProfileIdentifier'

describe('splitZoraProfileHandle', () => {
  it('returns real Zora handles unchanged', () => {
    expect(splitZoraProfileHandle('akita')).toEqual({
      zoraHandle: 'akita',
      basename: null,
    })
  })

  it('splits basenames mislabeled as Zora handles', () => {
    expect(splitZoraProfileHandle('capestate.base.eth')).toEqual({
      zoraHandle: null,
      basename: 'capestate.base.eth',
    })
  })

  it('drops Zora wallet stub handles', () => {
    expect(splitZoraProfileHandle('0x2564...398d')).toEqual({
      zoraHandle: null,
      basename: null,
    })
  })
})
