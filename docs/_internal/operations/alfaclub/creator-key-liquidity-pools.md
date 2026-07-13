# AlfaClub Creator Coin / FriendKey liquidity pools

## Scope

`AlfaCreatorKeyLPFactory` creates secondary-market pools whose priced assets are:

- one ERC-20 Creator Coin
- one ERC-1155 AlfaClub FriendKey token ID

The pools never mint or burn FriendKeys and never write to AlfaClub's primary bonding curve. Swap fees remain in pool reserves and accrue to LP holders.

## Room 1659 production pilot

Verified from Base mainnet on 2026-07-13:

| Role | Address / value |
|---|---|
| FriendKey | `0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F` |
| FriendKey token ID | `1659` |
| Room creator | `0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9` |
| Room classification | Trading (`0`), Club (`1`) |
| Bonding token | Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Creator Coin | AKITA `0x5b674196812451B7cEC024FE9d22D2c0b172fa75` (18 decimals) |
| Creator Coin creator / payout recipient | canonical parent CSW `0xAb6d5C10b03300326CD7fAb7267Ae192842967b5` |
| AlfaCreatorKeyLPFactory | `0x08156CF52BBD983Daf99a26508462d3593c5f6bf` |
| Factory owner | protocol treasury Safe `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| Pilot seeder / canonical ERC-4337 sender | canonical parent CSW `0xAb6d5C10b03300326CD7fAb7267Ae192842967b5` |

The AlfaClub room creator wallet is not the Creator Coin address. The Zora
Creator Coin metadata independently identifies AKITA's creator and payout
recipient as the canonical parent CSW.

Launch remains fail-closed until all of these facts are true:

- the factory address and deployment transaction are recorded below;
- the factory owner has allowlisted the pilot seeder and exact AKITA/1659 pair;
- the seeder holds the approved FriendKeys and seed-sized AKITA balance;
- the live conversion-rate seed report passes the configured reserve and
  one-key-impact thresholds.

At the verification block, the canonical CSW held about 45.26 million AKITA
and zero room-1659 keys; the room creator held neither asset. A 10-key seed at
the observed AKITA price required substantially more AKITA, and acquiring 10
keys from the primary curve cost 1,292.6375 USDC. Do not broadcast seeding
until inventory is funded and the seed calculator is rerun.

Generate the launch calculation with:

```sh
pnpm -C frontend ops:alfaclub-lp-seed --creator-price=<USDC per AKITA> --keys=10
```

## Pre-deployment checks

1. Run `forge test --match-path 'test/integrations/alfaclub/**'`.
2. Confirm the deployment chain is Base mainnet (`8453`).
3. Confirm `BASE_ALFA_CLUB_FRIEND_KEY` still points to the live FriendKey contract.
4. Choose the protocol multisig as `FACTORY_OWNER`. Do not leave factory ownership on the broadcast EOA.
5. Record the intended Creator Coin / token ID pairs and verify each pair represents the intended room. The FriendKey bonding token is not the Creator Coin and must not be used as a pair-equality check.

## Deploy

Use `alfaclub/contracts/script/DeployAlfaCreatorKeyLPFactory.s.sol`.

Production deployment record:

- Factory: `0x08156CF52BBD983Daf99a26508462d3593c5f6bf`
- Transaction:
  `0xcc642be6d2b6ca7322a1574dd7628096bd0b3a767ce727c87a7a261a2d5e733e`
- Seeder/pair allowlist transaction:
  `0x3953ee689ea8b527bc3e78e76f56e17f21894e6ef2adf27665bfe5b8a56cfa86`
- Deployer: `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD`
- Owner from construction: protocol treasury Safe
  `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3`
- Source: verified on Basescan
- Post-deploy reads: canonical FriendKey, 690/3 bps fees, and zero pools

After broadcast:

1. Verify `owner()`, `friendKey()`, `TRADING_FEE_BPS()`, and `SOCIAL_FEE_BPS()`.
2. Verify the contract source on Basescan.
3. Pin the address in:
   - `frontend/src/config/contracts.defaults.ts`
   - Vercel `VITE_ALFA_CREATOR_KEY_LP_FACTORY`
   - Vercel `ALFA_CREATOR_KEY_LP_FACTORY` for the paymaster policy
   - `docs/reference/addresses.md`
4. Redeploy the frontend so both browser and Vercel Function reads use the same address.

## Allowlist policy

Factory ownership controls two independent gates:

- `setPoolCreatorAllowed(account, true)` permits an account to create pools.
- `setPairAllowed(creatorCoin, tokenId, true)` permits one exact pair.

Before approving a pair, verify the Creator Coin address, FriendKey room creator, room type, and token ID through independent onchain reads. Pair allowlisting is the authoritative Creator Coin-to-room policy; `FriendKey.bondingToken()` is unrelated.

The production Safe batch allowlists only canonical parent CSW
`0xAb6d5C10b03300326CD7fAb7267Ae192842967b5` and AKITA token ID `1659`.
Reproduce or verify the fixed calls with:

```sh
pnpm -C frontend ops:alfaclub-lp-allowlist
```

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

Run the read-only monitor from a persistent Railway volume or equivalent cron:

```sh
ALFA_CREATOR_KEY_LP_FACTORY=0x... \
ALFACLUB_LP_CREATOR_PRICE_USDC=0.0000016 \
ALFACLUB_LP_MONITOR_STATE_PATH=/data/alfaclub-lp-monitor.json \
pnpm -C frontend ops:alfaclub-lp-monitor
```

Defaults alert after three consecutive samples at or above 1,000 bps
buy/sell divergence, or when key reserves fall below three. Override with
`ALFACLUB_LP_DIVERGENCE_BPS`,
`ALFACLUB_LP_DIVERGENCE_SUSTAINED_SAMPLES`, and
`ALFACLUB_LP_MIN_KEY_RESERVE`. `ALFACLUB_LP_ALERT_WEBHOOK_URL` is optional.
Single-block divergence does not alert.
