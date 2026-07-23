import { describe, expect, it } from 'vitest'

import {
  assertMainnetBindingFlagsDisabled,
  assertReviewedProductionBindingIdentity,
} from '../../../scripts/ops/configure-lottery-relay-mainnet-binding.js'

describe('Base mainnet lottery relay binding guards', () => {
  it('accepts only the reviewed production OApp and canonical Base Endpoint V2', () => {
    expect(() => assertReviewedProductionBindingIdentity(
      'GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB',
      '0x1a44076050125825900e736c501f859c50fE728c',
    )).not.toThrow()

    expect(() => assertReviewedProductionBindingIdentity(
      '5gWfMtYb9zPQyNJMvmPRBgpqTnH8JrzbVRB99pQ5jqKA',
      '0x1a44076050125825900e736c501f859c50fE728c',
    )).toThrow('production_oapp_program_required')

    expect(() => assertReviewedProductionBindingIdentity(
      'GgsdTRxKozPwYAiBhhsaVWGC76CMpSu5rtdwFhHMX2WB',
      '0x0000000000000000000000000000000000000001',
    )).toThrow('base_mainnet_endpoint_identity_mismatch')
  })

  it('requires relay entries, OApp sending, and winner settlement to remain disabled', () => {
    expect(() => assertMainnetBindingFlagsDisabled({})).not.toThrow()
    expect(() => assertMainnetBindingFlagsDisabled({ SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED: '1' }))
      .toThrow('solana_orchestrator_relay_entries_enabled_must_remain_disabled')
    expect(() => assertMainnetBindingFlagsDisabled({ SOLANA_LOTTERY_OAPP_SEND_ENABLED: 'true' }))
      .toThrow('solana_lottery_oapp_send_enabled_must_remain_disabled')
    expect(() => assertMainnetBindingFlagsDisabled({ SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED: 'yes' }))
      .toThrow('solana_lottery_winner_settlement_enabled_must_remain_disabled')
  })
})
