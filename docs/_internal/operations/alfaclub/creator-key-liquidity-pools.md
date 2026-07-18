# AlfaClub Creator Coin / FriendKey Sudoswap market

## Scope

The supported secondary market is an unmodified, source-pinned Sudoswap v2
ERC-1155/ERC-20 `TRADE` pair. Room FriendKeys are the ERC-1155 asset and the
room's Zora Creator Coin is the ERC-20 asset. The market never calls the
FriendKey primary bonding curve and never mints or burns FriendKeys.

The old `AlfaCreatorKeyLPFactory` / `AlfaCreatorKeyPool` deployment is retired.
Its source and historical deployment record remain for auditability, but no
frontend, paymaster, deployment, or operator command may create or trade through
that custom AMM.

| Component                 | Source / responsibility                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Sudoswap v2               | `sudoswap/lssvm2@1b18945b6c8f3e74052ffae0385bd2640d167e81`                                       |
| Universal Router          | `Uniswap/universal-router@cb222d358a2ea780feedee6990ff8a3c185301bf`                              |
| `AlfaClubSudoswapAdapter` | Authenticates one official pair and stages Permit2/ERC-1155 assets for direct pair calls         |
| `AlfaClubUniversalRouter` | Adds commands `0x41` (buy keys) and `0x42` (sell keys) to the pinned router                      |
| Paymaster policy          | Sponsors only the exact configured router command, pair, sender, deadline, and slippage envelope |

Sudoswap owns the official Base factory. The adapter therefore uses the pair's
direct-call path and does not require privileged factory router allowlisting.

## Room 1659 pilot invariants

| Role                 | Required value                                     |
| -------------------- | -------------------------------------------------- |
| Chain                | Base (`8453`)                                      |
| FriendKey            | `0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F`       |
| FriendKey token ID   | `1659`                                             |
| Creator Coin         | AKITA `0x5b674196812451B7cEC024FE9d22D2c0b172fa75` |
| Pair variant         | ERC-1155/ERC-20 (`3`)                              |
| Pool type            | `TRADE` (`2`)                                      |
| Curve                | the factory-allowlisted `XykCurve`                 |
| Pair fee             | `0.069e18` = 690 bps = 6.9%                        |
| Adapter + pair owner | `ALFACLUB_MARKET_ADMIN_SAFE`                       |
| Production pair      | `0x4a1bD15948A6a61DbE5dfD1e57d5982fD1285766`       |
| Seed inventory       | 3 FriendKeys + 50,000,000 AKITA                   |
| Virtual XYK reserves | 23 keys + 251,783,879.406935024227051578 AKITA     |

The pair contract is the LP position. Official Sudoswap does not issue an ERC-20
LP-share token for this pair. Its actual token inventories and its virtual XYK
reserves (`spotPrice` and `delta`) are distinct and must both be reviewed.

## Validation before any deployment

```sh
forge build
forge build test/fixtures/universal-router/CompilePermit2.sol test/fixtures/universal-router/CompileUniswapV2.sol
forge test --match-path 'test/integrations/alfaclub/SudoswapV2ERC1155ERC20.t.sol'
forge test --match-path 'test/integrations/alfaclub/AlfaClubSudoswapAdapter.t.sol'
forge test --match-path 'test/integrations/alfaclub/AlfaClubUniversalRouter.t.sol'
forge test --match-path 'test/integrations/alfaclub/AlfaClubSudoswapProductionLifecycle.t.sol'
forge test --match-path 'test/integrations/alfaclub/DeploySudoswapV2Base.t.sol'
forge test --match-path 'test/integrations/alfaclub/DeployAlfaClubUniversalRouterBase.t.sol'
forge test --match-path 'test/integrations/alfaclub/CreateRoom1659SudoswapPair.t.sol'
pnpm -C frontend typecheck
pnpm -C frontend validate:wallet
pnpm -C frontend validate:swap
pnpm -C frontend validate:alfaclub
```

Do not interpret a failed command as a pass. Resolve or explicitly record every
baseline failure before proceeding.

Run the read-only live Base dependency preflight immediately before every dry
run. It pins bytecode for Permit2, the Uniswap dependencies, Across SpokePool,
the Manifold registry, FriendKey and AKITA proxy implementations, then verifies
Room 1659 type, tier, creator, supply and primary quotes plus Creator Coin
metadata. The checked snapshot was refreshed from Base on 2026-07-18; any proxy,
implementation or dependency drift requires review and an intentional snapshot
update rather than bypassing the failure.

```sh
pnpm -C frontend ops:alfaclub-base-preflight
```

## Deployment sequence

Every Forge command below is simulation-only unless `--broadcast` is explicitly
added. Record the dry-run output and deployed bytecode before broadcasting.

### 1. Reuse the official Sudoswap Base deployment

Do not deploy another Sudoswap stack. Pin and verify:

- factory: `0x605145D263482684590f630E9e581B21E4938eb8`;
- XYK curve: `0xd0A2f4ae5E816ec09374c67F6532063B60dE037B`;
- VeryFastRouter: `0xa07eBD56b361Fe79AF706A2bF6d8097091225548`.

The source-pinned `DeploySudoswapV2Base` script is retained only as an isolated
lifecycle harness and refuses production execution when the official factory
is present. Verify factory provenance, all four pair templates, curve allowlist,
protocol fee configuration, and the official router-to-factory binding.

### 2. Deploy the adapter and custom Universal Router

The deployer must submit two consecutive CREATE transactions. Pin the exact
current EOA nonce in `EXPECTED_DEPLOYER_NONCE`; the script rejects nonce drift
and occupied predicted addresses.

Run the focused Solidity tests first. They compile the adapter and router with
their pinned Solidity 0.8.26 size profile; the production entry point then
loads those exact creation artifacts and verifies all deployed immutables.

```sh
forge script script/DeployAlfaClubUniversalRouterBaseEntry.s.sol \
  --rpc-url "$BASE_RPC_URL" -vvvv
```

Verify both circular immutables, all pinned Base Universal Router dependencies,
Permit2, FriendKey, factory, curve, and Safe ownership. Record the outputs as
`ALFACLUB_SUDOSWAP_ADAPTER` and `ALFACLUB_UNIVERSAL_ROUTER`.

Current verified Base deployment:

- adapter: `0x961b113FF5E3547e8198758900b8f4Fa552A3Fe5`
- Universal Router: `0x14c0e8840A3B7caE49EbdA899C7101A827598e9f`
- adapter tx: `0xd6fc25bdbbc68eb5fdf8d279666b6bfa54758b7857a07d04299d31ce6ccfbef6`
- router tx: `0x85437706b75f5678f2ad2a163daec1053c43c8044499a640c0969ecad5724397`
- production pair: `0x4a1bD15948A6a61DbE5dfD1e57d5982fD1285766`
- pair creation tx: `0x754c26903d801679161b6d501ac282099d65ee70ddf6959c9104c5e283dbc59b`
- pair ownership-transfer tx: `0x9ea8c32c977770ac806d9c040ea1767d2f316b669f8e02e2fd8077e0f666855d`

### 3. Create and seed the Room 1659 pair from the canonical CSW

Before simulation, independently review:

- actual FriendKey and AKITA balances held by the seeder;
- initial actual inventories;
- virtual key and Creator Coin reserves;
- one-key buy and sell quotes at the intended virtual reserves;
- `PAIR_FEE=69000000000000000` exactly;
- `PAIR_OWNER` and its ability to administer the pair.

The Room 1659 assets are held by the operator canonical Coinbase Smart Wallet,
`0xAb6d5C10b03300326CD7fAb7267Ae192842967b5`. The production seeder must keep
that CSW as the asset holder and `msg.sender`; a raw `PRIVATE_KEY` cannot stand
in for the smart wallet.

First generate the read-only live snapshot and exact call plan:

```sh
pnpm -C frontend ops:alfaclub-sudoswap-seed-csw --dry-run
```

The command refuses zero or drifting dependencies, a non-allowlisted XYK curve,
pre-existing factory approvals,
insufficient balances, a seed that would leave the canonical CSW with no Room
1659 key, an invalid one-key quote, or any fee other than exactly 6.9%.

After independently reviewing the available balances, actual inventories,
virtual reserves, one-key buy/sell quotes, five-call batch, owner slot, and CDP
paymaster policy, explicitly apply it:

```sh
pnpm -C frontend ops:alfaclub-sudoswap-seed-csw --apply
```

The first canonical-CSW UserOperation atomically grants the factory the exact
temporary ERC-1155/ERC-20 approvals, creates one authenticated `TRADE` pair,
and revokes both approvals. The command then reads the factory event and
validates the pair's provenance, assets, token ID, fee, actual inventories,
virtual reserves, owner, and revoked approvals. Only then does a second
canonical-CSW UserOperation transfer the pair/LP position to `PAIR_OWNER`.

If execution stops after pair creation, use the printed pair address to retry
only the authenticated ownership-transfer phase (the command revalidates every
pair invariant first):

```sh
pnpm -C frontend ops:alfaclub-sudoswap-seed-csw --finalize-pair 0xPAIR
```

The approved production plan has now been applied. Record the verified pair as
`ALFACLUB_ROOM_1659_SUDOSWAP_PAIR`. The Forge
`CreateRoom1659SudoswapPair` script remains an EOA rehearsal/fallback path and
must not be used to impersonate the canonical CSW.

### 4. Review the Safe actions

This command is read-only by default. It validates the complete live dependency
graph and prints the Safe call:

1. `AlfaClubSudoswapAdapter.setMarket(pair, AKITA, 1659, true)`

```sh
pnpm -C frontend ops:alfaclub-sudoswap-configure
```

Only use `--execute` after the calldata and current Safe ownership are reviewed.
The helper refuses automatic execution for a Safe threshold other than one.

### 5. Execute the approval-clean live canary

After the Safe enables the exact pair, generate the read-only canary plan:

```sh
pnpm -C frontend ops:alfaclub-sudoswap-canary --dry-run
```

The command authenticates the complete pair/adapter/router graph, snapshots the
canonical CSW's ERC-20, Permit2, and FriendKey approvals, reads fresh buy and
sell quotes, and prints one atomic UserOperation. The batch grants only missing
permissions, executes Universal Router command `0x41`, sells the same key
through command `0x42`, and restores the starting ERC-20, Permit2 amount, and
ERC-1155 approval state. Permit2 normalizes a zero expiration to the cleanup
block timestamp. It refuses more than 500 bps of canary slippage; the production default
is 100 bps.

Only after reviewing the quotes, limits, balances, deadline, and all eight calls:

```sh
pnpm -C frontend ops:alfaclub-sudoswap-canary --apply
```

The complete UserOperation is simulated by the bundler before acceptance. The
script then requires exactly one adapter `KeysBought` and `KeysSold` event,
checks the canonical payer and recipient, proves the CSW and pair key balances
and both virtual reserves returned to their starting values, accounts for the
exact AKITA round-trip cost, checks the adapter retained no assets, and confirms
the complete pre-canary approval state was restored.

### 6. Pin application configuration

Set identical verified values in browser and server environments:

- `VITE_ALFACLUB_UNIVERSAL_ROUTER` / `ALFACLUB_UNIVERSAL_ROUTER`
- `VITE_ALFACLUB_SUDOSWAP_ADAPTER` / `ALFACLUB_SUDOSWAP_ADAPTER`
- `VITE_SUDOSWAP_PAIR_FACTORY` / `SUDOSWAP_PAIR_FACTORY`
- `VITE_SUDOSWAP_XYK_CURVE` / `SUDOSWAP_XYK_CURVE`
- `VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR` / `ALFACLUB_ROOM_1659_SUDOSWAP_PAIR`
- `ALFACLUB_MARKET_ADMIN_SAFE`

The official factory, XYK curve, router, adapter, and Room 1659 pair are pinned
to the verified Base deployments above. A partially configured market must
still render as unavailable and must not be sponsored.

## User execution path

The canonical sender remains the user's parent CSW. The embedded owner signs
the ERC-4337 operation. The buy path atomically includes any required ERC-20
approval to Permit2, the exact Permit2 allowance to the adapter, and router
execution. The sell path atomically includes any required FriendKey operator
approval and router execution.

Canonical accounts require canonical sponsorship. There is no unsponsored
fallback. The AlfaClub paymaster lane rejects generic Universal Router opcode
aliasing, allow-revert (`0x80`) on the AlfaClub command, noncanonical inputs,
alternate recipients, excess key quantities, stale deadlines, loose approvals,
and live pair or adapter invariant drift.

## Monitoring

Run the Base dependency preflight first, then the read-only market monitor from
persistent storage. This makes proxy implementation or pinned dependency drift
fail before the market-level checks:

```sh
pnpm -C frontend ops:alfaclub-base-preflight
pnpm -C frontend ops:alfaclub-sudoswap-monitor
```

It revalidates factory provenance, variant, pool type, assets, token ID, curve,
adapter and router immutables, the adapter market, the exact 690 bps fee, executable
one-key quotes, and actual inventories. Set `ALFACLUB_LP_CREATOR_PRICE_USDC` to
also compare Sudoswap quotes with the FriendKey primary curve. Persistent alert
state uses `ALFACLUB_LP_MONITOR_STATE_PATH`; divergence and inventory thresholds
use the existing `ALFACLUB_LP_*` monitor variables.

## Rollback posture

There is no alternate trading lane. To stop new routed swaps, the Safe disables
the adapter market, then the application pins are cleared. Existing pair ownership and inventories
must be handled by an explicit, separately reviewed Safe action. Never direct
users to the retired custom AMM as a fallback.
