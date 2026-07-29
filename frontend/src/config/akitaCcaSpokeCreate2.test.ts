import { describe, expect, it } from 'vitest'

import {
  AKITA_CCA_CREATE2,
  akitaOracleSalt,
  akitaShareOftSalt,
  hubLotteryPeerBytes32,
} from './akitaCcaSpokeCreate2'
import { AKITA_DEFAULTS } from './contracts.defaults'

describe('akitaCcaSpokeCreate2', () => {
  it('derives deterministic ShareOFT and oracle salts from AKITA B2 identity', () => {
    expect(akitaShareOftSalt()).toBe(
      '0x22cbbb4c0c6a5743d8fa09ebd0e84ea9a82da22f419908c681cb1b178d49687e',
    )
    expect(akitaOracleSalt()).toBe(
      '0x1df2ceb3b2cfc4e3e5cbde3b8da254f152b05560171a743e8ca38704ecc5ede6',
    )
  })

  it('pins spoke CREATE2 infra (cca-spoke-v1) + current codeIds', () => {
    expect(AKITA_CCA_CREATE2.create2Deployer).toBe(
      '0x7E3898Eb0Aee0DCAC5C0ccCd88ab94575f48a2D6',
    )
    expect(AKITA_CCA_CREATE2.bytecodeStore).toBe(
      '0x75FA60e7e01CACda736952E9AC8D5c30B61F117E',
    )
    expect(AKITA_CCA_CREATE2.hubShareOft).toBe(AKITA_DEFAULTS.shareOFT)
    expect(AKITA_CCA_CREATE2.hubOracle).toBe(AKITA_DEFAULTS.oracle)
    expect(AKITA_CCA_CREATE2.shareOftCodeId.startsWith('0x9ea810ff')).toBe(true)
    expect(AKITA_CCA_CREATE2.oracleCodeId.startsWith('0x00d8de27')).toBe(true)
    expect(AKITA_CCA_CREATE2.infraEpochTag).toBe('cca-spoke-v1')
  })

  it('encodes hub lottery peer as bytes32', () => {
    expect(hubLotteryPeerBytes32()).toBe(
      '0x0000000000000000000000000fc6f30adfd9e82097895bb166536fdfd8eac97b',
    )
  })
})
