[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/cswOwnerAbi

# src/lib/wallet/cswOwnerAbi

## Variables

### ADD\_OWNER\_ADDRESS\_SELECTOR

> `const` **ADD\_OWNER\_ADDRESS\_SELECTOR**: `"0x0f0f3f24"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L118)

***

### CSW\_EXECUTE\_BATCH\_SELECTOR

> `const` **CSW\_EXECUTE\_BATCH\_SELECTOR**: `"0x34fcd5be"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L26)

Coinbase Smart Wallet `executeBatch` selector — Base App wraps Part 1
`wallet_sendCalls` into EntryPoint → CSW.executeBatch([Depository deposit]).

***

### CSW\_OWNER\_ABI

> `const` **CSW\_OWNER\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"ownerCount"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"nextOwnerIndex"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"index"`; `type`: `"uint256"`; \}\]; `name`: `"ownerAtIndex"`; `outputs`: readonly \[\{ `type`: `"bytes"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"addOwnerAddress"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"index"`; `type`: `"uint256"`; \}, \{ `name`: `"owner"`; `type`: `"bytes"`; \}\]; `name`: `"removeOwnerAtIndex"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"index"`; `type`: `"uint256"`; \}, \{ `name`: `"owner"`; `type`: `"bytes"`; \}\]; `name`: `"removeLastOwner"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/lib/wallet/cswOwnerAbi.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L102)

Full Coinbase Smart Wallet owner surface used by add/remove-owner flows.

***

### CSW\_OWNER\_INSTALL\_ABI

> `const` **CSW\_OWNER\_INSTALL\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"addOwnerAddress"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/lib/wallet/cswOwnerAbi.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L96)

addOwnerAddress + isOwnerAddress — admin install / ownership checks.

***

### CSW\_OWNER\_MUTATION\_ABI

> `const` **CSW\_OWNER\_MUTATION\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"addOwnerAddress"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"index"`; `type`: `"uint256"`; \}, \{ `name`: `"owner"`; `type`: `"bytes"`; \}\]; `name`: `"removeOwnerAtIndex"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"index"`; `type`: `"uint256"`; \}, \{ `name`: `"owner"`; `type`: `"bytes"`; \}\]; `name`: `"removeLastOwner"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/lib/wallet/cswOwnerAbi.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L65)

***

### CSW\_OWNER\_READ\_ABI

> `const` **CSW\_OWNER\_READ\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"ownerCount"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"nextOwnerIndex"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"index"`; `type`: `"uint256"`; \}\]; `name`: `"ownerAtIndex"`; `outputs`: readonly \[\{ `type`: `"bytes"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/lib/wallet/cswOwnerAbi.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L34)

***

### ENTRY\_POINT\_V06\_BASE

> `const` **ENTRY\_POINT\_V06\_BASE**: `"0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L32)

EntryPoint v0.6 — deterministic on Base and all EVM chains.

***

### EXECUTE\_WITHOUT\_CHAIN\_ID\_SELECTOR

> `const` **EXECUTE\_WITHOUT\_CHAIN\_ID\_SELECTOR**: `"0x2c2abd1e"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:120](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L120)

***

### GOLDEN\_RELAY\_PART1\_DEPOSIT\_WEI

> `const` **GOLDEN\_RELAY\_PART1\_DEPOSIT\_WEI**: `18871666861048n` = `18_871_666_861_048n`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L6)

May 5 golden Part 1 deposit — regression fixture only (tx 0xa6b54357…, block 45600637).

***

### GOLDEN\_RELAY\_PART1\_ENTRYPOINT\_PREFUND\_WEI

> `const` **GOLDEN\_RELAY\_PART1\_ENTRYPOINT\_PREFUND\_WEI**: `85989948096n` = `85_989_948_096n`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L29)

May 5 golden Part 1 EntryPoint prefund — RPC-failure fallback only; live paths use `relayPart1GasReserve`.

***

### GOLDEN\_RELAY\_PART1\_ORDER\_ID

> `const` **GOLDEN\_RELAY\_PART1\_ORDER\_ID**: `"0x8cc58ae3d8f127fbe4c8327958cf9c638f4d3b25547ddcbb190c8ce8e853797a"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L15)

May 5 2026 golden Part 1 order id (probe CSW 0x4bea…).

***

### GOLDEN\_RELAY\_PART1\_PROBE\_CSW

> `const` **GOLDEN\_RELAY\_PART1\_PROBE\_CSW**: `"0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L19)

Probe / reference parent CSW from the May 5 golden add-owner trace.

***

### MAX\_OWNER\_MUTATION\_RELAY\_DEPOSIT\_SEED\_WEI

> `const` **MAX\_OWNER\_MUTATION\_RELAY\_DEPOSIT\_SEED\_WEI**: `100000000000000n` = `100_000_000_000_000n`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L12)

Cap on Relay re-quote seed wei — golden Part 1 ≈19e12; blocks runaway deposit seeds.

***

### MIN\_OWNER\_MUTATION\_RELAY\_DEPOSIT\_WEI

> `const` **MIN\_OWNER\_MUTATION\_RELAY\_DEPOSIT\_WEI**: `8000000000000n` = `8_000_000_000_000n`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L9)

Broken Part 1 (~2.88e12 wei, tx 0xdfec2946…) never triggered Part 2 solver fill.

***

### NATIVE\_CURRENCY\_ADDRESS

> `const` **NATIVE\_CURRENCY\_ADDRESS**: `"0x0000000000000000000000000000000000000000"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L121)

***

### RELAY\_DEPOSITORY\_ABI

> `const` **RELAY\_DEPOSITORY\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"depositor"`; `type`: `"address"`; \}, \{ `name`: `"id"`; `type`: `"bytes32"`; \}\]; `name`: `"depositNative"`; `outputs`: readonly \[\]; `stateMutability`: `"payable"`; `type`: `"function"`; \}\]

Defined in: [src/lib/wallet/cswOwnerAbi.ts:104](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L104)

***

### RELAY\_DEPOSITORY\_BASE

> `const` **RELAY\_DEPOSITORY\_BASE**: `"0x4cd00e387622c35bddb9b4c962c136462338bc31"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L2)

Relay Protocol native depository on Base mainnet.

***

### RELAY\_DEPOSITORY\_NATIVE\_DEPOSIT\_SELECTOR

> `const` **RELAY\_DEPOSITORY\_NATIVE\_DEPOSIT\_SELECTOR**: `"0x49290c1c"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L3)

***

### RELAY\_MULTICALL\_SELECTOR

> `const` **RELAY\_MULTICALL\_SELECTOR**: `"0xcd6e13f7"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:119](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L119)

***

### REMOVE\_OWNER\_AT\_INDEX\_SELECTOR

> `const` **REMOVE\_OWNER\_AT\_INDEX\_SELECTOR**: `"0x89625b57"`

Defined in: [src/lib/wallet/cswOwnerAbi.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerAbi.ts#L117)
