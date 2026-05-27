[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/subAccountOwnerInstallMessages

# src/features/waitlist/subAccountOwnerInstallMessages

## Variables

### SUB\_ACCOUNT\_BASE\_APP\_APPROVAL\_FAILED\_MESSAGE

> `const` **SUB\_ACCOUNT\_BASE\_APP\_APPROVAL\_FAILED\_MESSAGE**: `"Base App blocked or dismissed the signing prompt. Confirm Base Mainnet is selected, tap Enable 4626 signing again, and approve the wallet transaction when Base App asks."` = `'Base App blocked or dismissed the signing prompt. Confirm Base Mainnet is selected, tap Enable 4626 signing again, and approve the wallet transaction when Base App asks.'`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L4)

***

### SUB\_ACCOUNT\_IN\_BASE\_APP\_HINT

> `const` **SUB\_ACCOUNT\_IN\_BASE\_APP\_HINT**: `"Approve one transaction in Base App when prompted. Your main Base wallet stays unchanged."` = `'Approve one transaction in Base App when prompted. Your main Base wallet stays unchanged.'`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L13)

***

### SUB\_ACCOUNT\_SIGNER\_LINKED\_ONCHAIN\_OWNER\_OPTIONAL\_MESSAGE

> `const` **SUB\_ACCOUNT\_SIGNER\_LINKED\_ONCHAIN\_OWNER\_OPTIONAL\_MESSAGE**: `"4626 signer is linked to your app wallet. Optional on-chain owner approval did not finish — swaps should still work; you can retry owner approval later if needed."` = `'4626 signer is linked to your app wallet. Optional on-chain owner approval did not finish — swaps should still work; you can retry owner approval later if needed.'`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L16)

***

### SUB\_ACCOUNT\_TESTNET\_MESSAGE

> `const` **SUB\_ACCOUNT\_TESTNET\_MESSAGE**: `"Base App is currently in testnet mode. 4626 signing setup requires Base Mainnet. Switch Base App to mainnet, reopen 4626, and run Enable 4626 signing again."` = `'Base App is currently in testnet mode. 4626 signing setup requires Base Mainnet. Switch Base App to mainnet, reopen 4626, and run Enable 4626 signing again.'`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L10)

***

### SUB\_ACCOUNT\_USER\_REJECTED\_MESSAGE

> `const` **SUB\_ACCOUNT\_USER\_REJECTED\_MESSAGE**: `"Signing was canceled in Base App. Tap Enable 4626 signing again and approve the transaction."` = `'Signing was canceled in Base App. Tap Enable 4626 signing again and approve the transaction.'`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L7)

***

### SUB\_ACCOUNT\_WRONG\_BROWSER\_MESSAGE

> `const` **SUB\_ACCOUNT\_WRONG\_BROWSER\_MESSAGE**: `"4626 app-wallet signing only works inside Base App. Open 4626 in Base App (not Safari, Chrome, or wallet extensions), then tap Enable 4626 signing."` = `'4626 app-wallet signing only works inside Base App. Open 4626 in Base App (not Safari, Chrome, or wallet extensions), then tap Enable 4626 signing.'`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L1)

## Functions

### mapSubAccountOwnerInstallError()

> **mapSubAccountOwnerInstallError**(`message`, `options`): `string`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L30)

#### Parameters

##### message

`string`

##### options

###### inBaseApp

`boolean`

#### Returns

`string`

***

### normalizeSubAccountOwnerInstallErrorSource()

> **normalizeSubAccountOwnerInstallErrorSource**(`message`): `string`

Defined in: [src/features/waitlist/subAccountOwnerInstallMessages.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/subAccountOwnerInstallMessages.ts#L20)

Strip nested setup wrapper text before classifying provider errors.

#### Parameters

##### message

`string`

#### Returns

`string`
