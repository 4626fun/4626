import { describe, expect, it } from 'vitest'

import {
  mapSubAccountOwnerInstallError,
  SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE,
  SUB_ACCOUNT_TESTNET_MESSAGE,
  SUB_ACCOUNT_WRONG_BROWSER_MESSAGE,
} from './subAccountOwnerInstallMessages'

describe('mapSubAccountOwnerInstallError', () => {
  it('maps unauthorized errors to the wrong-browser copy outside Base App', () => {
    expect(
      mapSubAccountOwnerInstallError('requested method and/or account has not been authorized by the user', {
        inBaseApp: false,
      }),
    ).toBe(SUB_ACCOUNT_WRONG_BROWSER_MESSAGE)
  })

  it('maps unauthorized errors to the in-app retry copy inside Base App', () => {
    expect(
      mapSubAccountOwnerInstallError('requested method and/or account has not been authorized by the user', {
        inBaseApp: true,
      }),
    ).toBe(SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE)
  })

  it('maps testnet mismatch errors to the mainnet guidance copy', () => {
    expect(
      mapSubAccountOwnerInstallError("Mainnet wallet can't be used on testnet", { inBaseApp: true }),
    ).toBe(SUB_ACCOUNT_TESTNET_MESSAGE)
  })
})
