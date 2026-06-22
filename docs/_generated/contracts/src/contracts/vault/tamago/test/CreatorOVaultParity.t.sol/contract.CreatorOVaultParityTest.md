# CreatorOVaultParityTest
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/tamago/test/CreatorOVaultParity.t.sol)

**Inherits:**
Test

**Title:**
CreatorOVaultParityTest

Spec-parity checks between CreatorOVault (OpenZeppelin ERC-4626) and
the formally-verified Tamago ERC-4626 deployer on the read-only ERC-4626
surface.
CreatorOVault's deposit/mint/redeem/withdraw delegate to a core module
that is not wired in this test — so write paths are not exercised here.
What IS exercised:
- convertToShares / convertToAssets at zero state
- totalAssets accounting after a direct asset transfer (donation)
- preview*() never overstates the user's favor (the ERC-4626 spec
invariant Tamago proves)
- maxDeposit / maxMint defaults
Any divergence here is a hint — not a defect — that CreatorOVault
differs in policy from the spec-minimal Tamago vault (e.g. virtual
shares offset, whitelist gating, pause/shutdown). Comments below
call out the known intentional differences.


## State Variables
### asset_

```solidity
MockCreatorCoin internal asset_
```


### cv

```solidity
CreatorOVault internal cv
```


### tv

```solidity
ERC4626Iface internal tv
```


### tvAsset

```solidity
ERC20Iface internal tvAsset
```


### owner_

```solidity
address internal owner_ = address(0xA11CE)
```


## Functions
### setUp


```solidity
function setUp() public;
```

### test_asset_wiring


```solidity
function test_asset_wiring() public view;
```

### test_convertToShares_zeroState_isIdentity_onTamago


```solidity
function test_convertToShares_zeroState_isIdentity_onTamago() public view;
```

### test_convertToShares_zeroState_creatorOVault_appliesVirtualOffset


```solidity
function test_convertToShares_zeroState_creatorOVault_appliesVirtualOffset() public view;
```

### test_totalAssets_reflectsDonation_creatorOVault


```solidity
function test_totalAssets_reflectsDonation_creatorOVault() public;
```

### test_totalAssets_reflectsDonation_tamago


```solidity
function test_totalAssets_reflectsDonation_tamago() public;
```

### testFuzz_tamago_previewRoundingInvariants


```solidity
function testFuzz_tamago_previewRoundingInvariants(uint96 rawAssets, uint96 rawShares) public;
```

### test_maxDeposit_default


```solidity
function test_maxDeposit_default() public view;
```

### test_maxMint_default


```solidity
function test_maxMint_default() public view;
```

### test_maxWithdraw_zero_shares_isZero


```solidity
function test_maxWithdraw_zero_shares_isZero() public view;
```

### test_maxRedeem_zero_shares_isZero


```solidity
function test_maxRedeem_zero_shares_isZero() public view;
```

