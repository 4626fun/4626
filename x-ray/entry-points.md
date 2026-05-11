# Entry Point Map

> 4626 | 16 entry points | 6 permissionless | 6 role-gated | 4 admin-only

---

## Protocol Flow Paths

### Setup (Creator/Owner)

`DeploymentBatcher.deployPhase1*()` → `DeploymentBatcher.finalizePhase1*()` → `DeploymentBatcher.deployPhase2*()` → `DeploymentBatcher.finalizePhase2*()` → `DeploymentBatcher.deployPhase3Strategies()`

### User Vault Flow

`[setup above]` → `CreatorOVault.deposit()` / `mint()` ◄── vault not paused + whitelist checks  
`[deposit above]` ├─→ `CreatorOVault.withdraw()` / `redeem()`  
`[deposit above]` └─→ `CreatorOVault.deployToStrategies()` ◄── keeper/management path

### Fee + Distribution Flow

`CreatorShareOFT._transferWithFees()` → `CreatorGaugeController.receiveFees()` → `CreatorGaugeController.distribute()`  
`[distribution above]` ├─→ `VaultShareBurnStream` path  
`[distribution above]` └─→ `CreatorLotteryManager` jackpot path

### Lottery Flow

`Authorized swap path` → `CreatorLotteryManager.processSwapLottery()` → `ChainlinkVRFIntegrator` / callback handler ◄── sponsorship policy + epoch constraints

### Solana Strategy Flow

`SolanaBridgeAdapter.bridgeToSolana*()` → remote settlement → `SolanaStrategy.updateRemoteNav()` ◄── keeper + replay guard

---

## Permissionless

### `CreatorOVault.deposit()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external` |
| Caller | User |
| Parameters | `assets (user-controlled)`, `receiver (user-controlled)` |
| Call chain | `→ CreatorOVaultCoreModule.deposit()` |
| State modified | share balances, total supply, asset accounting |
| Value flow | Tokens: user → vault |
| Reentrancy guard | yes |

### `CreatorOVault.withdraw()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external` |
| Caller | User |
| Parameters | `assets (user-controlled)`, `receiver (user-controlled)`, `owner (user-controlled)` |
| Call chain | `→ CreatorOVaultCoreModule.withdraw()` |
| State modified | share balances, total supply, strategy debt reconciliation |
| Value flow | Tokens: vault → receiver |
| Reentrancy guard | yes |

### `CreatorGaugeController.receiveFees()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external` |
| Caller | Share token / fee source |
| Parameters | `creatorCoin (protocol-derived)`, `amount (protocol-derived)` |
| Call chain | `→ _distributeFees()` |
| State modified | fee accounting, jackpot/burn/protocol split accumulators |
| Value flow | Tokens: fee source → gauge |
| Reentrancy guard | yes |

### `CreatorLotteryManager.processSwapLottery()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external` |
| Caller | Swap contracts / relayer |
| Parameters | `creatorCoin (user-controlled via swap context)`, `buyer (protocol-derived)`, lottery inputs |
| Call chain | `→ request randomness / process entry` |
| State modified | epoch entries, winner/payout state, sponsorship accounting |
| Value flow | None (control path), later payout outflow |
| Reentrancy guard | yes |

### `AlfaCreatorKeyLPFactory.createPool()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external` |
| Caller | User |
| Parameters | token/pool params (user-controlled) |
| Call chain | `→ deploy pool` |
| State modified | factory registry of created pools |
| Value flow | Initial liquidity in path |
| Reentrancy guard | no |

### `LotteryAmoeRouter.submitEntry*()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external` |
| Caller | User / relayer |
| Parameters | proof fields (user-controlled), nonce/deadline (user-signed) |
| Call chain | `→ verify proof → manager record` |
| State modified | nonce usage, routed entry state |
| Value flow | None |
| Reentrancy guard | yes |

---

## Role-Gated

### `KEEPER / MANAGEMENT`

#### `CreatorOVault.report()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external`, `onlyKeepers` |
| Caller | Keeper bot |
| Parameters | strategy report payload (keeper-provided) |
| Call chain | `→ strategy valuation + accounting` |
| State modified | strategy debt/profit/loss state |
| Value flow | None |
| Reentrancy guard | yes |

#### `CreatorOVault.tend()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external`, `onlyKeepers` |
| Caller | Keeper bot |
| Parameters | strategy list / amounts (keeper-provided) |
| Call chain | `→ strategy tend hooks` |
| State modified | strategy pending state |
| Value flow | Possible vault ↔ strategy movement |
| Reentrancy guard | yes |

#### `SolanaStrategy.updateRemoteNav()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external`, keeper-gated |
| Caller | Solana keeper |
| Parameters | `reportId (keeper-provided)`, nav payload |
| Call chain | `→ apply NAV update` |
| State modified | nav windows, replay guard mapping |
| Value flow | None |
| Reentrancy guard | yes |

### `AUTHORIZED DEPLOYER`

#### `UniversalCreate2DeployerFromStore.deploy()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external`, owner/authorized-deployer gated |
| Caller | DeploymentBatcher / protocol deployer |
| Parameters | code id, salt, init calldata |
| Call chain | `→ CREATE2` |
| State modified | deployed-address tracking |
| Value flow | None |
| Reentrancy guard | no |

### `ORACLE UPDATER`

#### `CreatorOracle.updatePrice*()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external`, updater-gated |
| Caller | Authorized updater |
| Parameters | price payload (keeper-provided/protocol-derived) |
| Call chain | `→ set price state → optional relay` |
| State modified | creator price snapshots / metadata |
| Value flow | None |
| Reentrancy guard | yes |

### `LOTTERY AUTHORIZED CALLER`

#### `CreatorLotteryManager.setAuthorizedSwapContract()`

| Aspect | Detail |
|--------|--------|
| Visibility | `external`, owner/authorized control |
| Caller | Lottery owner |
| Parameters | contract address + enable flag |
| Call chain | `→ update allowlist` |
| State modified | swap caller authorization set |
| Value flow | None |
| Reentrancy guard | no |

---

## Admin-Only

| Contract | Function | Parameters | State Modified |
|----------|----------|------------|----------------|
| `CreatorOVault` | `setFlashLoanProtection()` | delay/threshold params | withdraw delay guards + anti-flash config |
| `CreatorOVault` | `setProtocolRescue()` | protocol rescue address, toggles | rescue authority + emergency config |
| `CreatorShareOFT` | `setFeeConfig*()` | fee bps / collector config | transfer fee configuration |
| `CreatorGaugeController` | `setFeeSplit()` | split bps + destinations | burn/lottery/protocol/creator split lanes |

