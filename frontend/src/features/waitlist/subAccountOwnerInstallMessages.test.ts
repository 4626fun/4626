import { describe, expect, it } from 'vitest'

import {
  mapSubAccountOwnerInstallError,
  SUB_ACCOUNT_AA23_SIGNATURE_VALIDATION_MESSAGE,
  SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE,
  SUB_ACCOUNT_BASE_APP_SIGNING_ENDPOINT_FAILED_MESSAGE,
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

  it('strips setup wrapper text before classifying unauthorized errors', () => {
    expect(
      mapSubAccountOwnerInstallError(
        'Failed to enable 4626 signing on your app wallet: requested method and/or account has not been authorized by the user',
        { inBaseApp: true },
      ),
    ).toBe(SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE)
  })

  it('maps aa23 errors to explicit signature guidance', () => {
    expect(
      mapSubAccountOwnerInstallError('AA23 reverted (or OOG)', { inBaseApp: true }),
    ).toBe(SUB_ACCOUNT_AA23_SIGNATURE_VALIDATION_MESSAGE)
  })

  it('maps legacy combined copy to the current in-app guidance', () => {
    expect(
      mapSubAccountOwnerInstallError(
        'Base App did not approve this signing request for your 4626 app wallet. Open 4626 inside Base App (not Safari/Chrome/extensions), tap Enable 4626 signing again, and approve the wallet prompt.',
        { inBaseApp: true },
      ),
    ).toBe(SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE)
  })

  it('maps Base App signing endpoint failures to in-app retry guidance', () => {
    expect(
      mapSubAccountOwnerInstallError('An internal error was received. Details: Failed to fetch RPC request', {
        inBaseApp: true,
      }),
    ).toBe(SUB_ACCOUNT_BASE_APP_SIGNING_ENDPOINT_FAILED_MESSAGE)
  })
})
