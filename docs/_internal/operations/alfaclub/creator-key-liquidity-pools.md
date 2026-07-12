# AlfaClub Creator Coin / FriendKey liquidity pools

## Scope

`AlfaCreatorKeyLPFactory` creates secondary-market pools whose priced assets are:

- one ERC-20 Creator Coin
- one ERC-1155 AlfaClub FriendKey token ID

The pools never mint or burn FriendKeys and never write to AlfaClub's primary bonding curve. Swap fees remain in pool reserves and accrue to LP holders.

## Pre-deployment checks

1. Run `forge test --match-path 'test/integrations/alfaclub/**'`.
2. Confirm the deployment chain is Base mainnet (`8453`).
3. Confirm `BASE_ALFA_CLUB_FRIEND_KEY` still points to the live FriendKey contract.
4. Choose the protocol multisig as `FACTORY_OWNER`. Do not leave factory ownership on the broadcast EOA.
5. Record the intended Creator Coin / token ID pairs and verify each pair represents the intended room. The FriendKey bonding token is not the Creator Coin and must not be used as a pair-equality check.

## Deploy

Use `alfaclub/contracts/script/DeployAlfaCreatorKeyLPFactory.s.sol`.

After broadcast:

1. Verify `owner()`, `friendKey()`, `TRADING_FEE_BPS()`, and `SOCIAL_FEE_BPS()`.
2. Verify the contract source on Basescan.
3. Pin the address in:
   - `frontend/src/config/contracts.defaults.ts`
   - Vercel `VITE_ALFA_CREATOR_KEY_LP_FACTORY`
   - `docs/reference/addresses.md`
4. Redeploy the frontend so both browser and Vercel Function reads use the same address.

## Allowlist policy

Factory ownership controls two independent gates:

- `setPoolCreatorAllowed(account, true)` permits an account to create pools.
- `setPairAllowed(creatorCoin, tokenId, true)` permits one exact pair.

Before approving a pair, verify the Creator Coin address, FriendKey room creator, room type, and token ID through independent onchain reads. Pair allowlisting is the authoritative Creator Coin-to-room policy; `FriendKey.bondingToken()` is unrelated.

## Seed a pool

The allowlisted creator calls `createPoolWithInitialLiquidity` from `/alfaclub/liquidity-pools`.

Before submission:

1. Confirm the LP recipient.
2. Confirm the creator owns enough ERC-20 Creator Coin and ERC-1155 keys.
3. Confirm the initial ratio is intentional; it establishes the secondary-market price.
4. Approve only the canonical factory.

After submission, verify:

- `getPool(creatorCoin, tokenId)` equals the emitted pool address.
- Pool `creatorCoin()`, `keyTokenId()`, `feeBps()`, and `getReserves()` match the approved pair.
- LP shares reached the intended recipient.
- `MINIMUM_LIQUIDITY` shares are locked at `0x000000000000000000000000000000000000dEaD`.

## Operating rules

- Do not transfer Creator Coins, FriendKeys, or akLP directly to a pool. Direct donations are intentionally excluded from stored reserves and are not credited to an LP.
- Trading-room pools use 690 bps; Social-room pools use 3 bps. The fee is immutable for a pool.
- Existing pools are permissionless for add, remove, buy, and sell. Only pool creation is allowlisted.
- Monitor `PoolCreated`, `LiquidityAdded`, `LiquidityRemoved`, `KeysBought`, `KeysSold`, and `Sync`.
- Treat the factory address, owner, allowlists, and initial seed transaction as the launch record for every pool.

## Rollback posture

Pools are immutable and have no pause or upgrade control. To stop new pools, revoke creator/pair allowlists. Existing pool users retain permissionless withdrawal and trading behavior. A faulty pool cannot be edited; deploy a corrected factory or pool implementation and migrate liquidity explicitly.
