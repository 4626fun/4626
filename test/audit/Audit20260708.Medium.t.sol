// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CreatorShareOFT} from "@4626/creator/vault/CreatorShareOFT.sol";
import {CreatorOVault} from "@4626/creator/vault/CreatorOVault.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";
import {OVaultImpairmentClaims} from "@4626/shared/vault/recovery/OVaultImpairmentClaims.sol";
import {OVaultRecoveryEscrow} from "@4626/shared/vault/recovery/OVaultRecoveryEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategy} from "@4626/shared/interfaces/strategies/IStrategy.sol";
import {IStrategyValuation} from "@4626/shared/interfaces/strategies/IStrategyValuation.sol";

// ---------------------------------------------------------------------------
// M-03 — ShareOFT convertToAssets uses 1000× vault-share normalization
// ---------------------------------------------------------------------------

contract MockVaultForConvert is ERC20 {
    constructor() ERC20("vShare", "vSH") {}

    /// @dev 1:1 vault shares → assets for easy assertions.
    function convertToAssets(uint256 vaultShares) external pure returns (uint256) {
        return vaultShares;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockRegistryMedium {
    function getLayerZeroEndpoint(uint256) external pure returns (address) {
        return address(0x1a44076050125825900e736c501f859c50fE728c);
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30184;
    }

    function getLotteryManager(uint256) external pure returns (address) {
        return address(0);
    }
}

contract Audit20260708_M03_ConvertToAssets is Test {
    CreatorShareOFT internal shareOFT;
    MockVaultForConvert internal vaultToken;
    address constant LZ = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));
        vaultToken = new MockVaultForConvert();
        shareOFT = new CreatorShareOFT("Share", "sTEST", address(new MockRegistryMedium()), address(this));
        shareOFT.setVault(address(vaultToken));
        shareOFT.setMinter(address(this), true);
        shareOFT.mint(address(this), 2 ether);
    }

    function test_convertToAssets_multipliesByNormalization() public view {
        // 2 ■ → 2000 vault shares → 2000 assets at 1:1 PPS
        assertEq(shareOFT.convertToAssets(2 ether), 2 ether * 1000);
        assertEq(shareOFT.convertToAssets(1), 1000);
        assertEq(shareOFT.convertToAssets(0), 0);
    }
}

// ---------------------------------------------------------------------------
// M-01 — impairment root challenge is public
// ---------------------------------------------------------------------------

contract MockCoinM01 is ERC20 {
    constructor() ERC20("C", "C") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract StratM01 is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setTrackedAssets(uint256 v) external {
        trackedAssets = v;
    }

    function isValuationReady() external pure returns (bool) {
        return true;
    }

    function isActive() external pure returns (bool) {
        return true;
    }

    function asset() external view returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external returns (uint256) {
        TOKEN.transferFrom(msg.sender, address(this), amount);
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 amount) external returns (uint256) {
        uint256 w = amount > trackedAssets ? trackedAssets : amount;
        trackedAssets -= w;
        TOKEN.transfer(msg.sender, w);
        return w;
    }

    function emergencyWithdraw() external returns (uint256 w) {
        w = trackedAssets;
        trackedAssets = 0;
        if (w > 0) TOKEN.transfer(msg.sender, w);
    }

    function harvest() external pure returns (uint256) {
        return 0;
    }

    function rebalance() external {}
}

contract Audit20260708_M01_PublicChallenge is Test {
    CreatorOVault internal vault;
    MockCoinM01 internal coin;
    StratM01 internal strat;
    address internal challenger = address(0xC11A);

    function setUp() public {
        coin = new MockCoinM01();
        vault = new CreatorOVault(address(coin), address(this), "V", "v");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new OVaultStrategiesModule()),
            address(new OVaultAdminModule())
        );
        OVaultImpairmentClaims claims = new OVaultImpairmentClaims(address(this));
        OVaultRecoveryEscrow escrow = new OVaultRecoveryEscrow(address(this));
        claims.setVault(address(vault));
        escrow.setVault(address(vault));
        vault.setImpairmentClaims(address(claims));
        vault.setImpairmentRecoveryEscrow(address(escrow));
        vault.setImpairmentChallengeWindow(1 hours);
        vault.setFlashLoanProtection(0, 1e18, 2);
        strat = new StratM01(address(coin));
        uint256 dep = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(address(this), dep + 1000e18);
        coin.approve(address(vault), type(uint256).max);
        vault.deposit(dep, address(this));
        vault.addStrategy(address(strat), 5000, true);
        vault.setRiskConfigDelay(0);
        vault.setStrategyMaxAssets(address(strat), type(uint256).max);
        vault.deployToStrategies();
    }

    function test_anyoneCanChallengeImpairmentRoot() public {
        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, address(this), vault.balanceOf(address(this))));
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(address(this)), address(coin));

        // Challenger is not owner / emergency — must still succeed (M-01).
        vm.prank(challenger);
        vault.challengeImpairmentRoot(epochId, "public-challenge");
        assertTrue(vault.impairmentRootChallenged(epochId));
    }
}

// ---------------------------------------------------------------------------
// M-02 — unset strategyMaxAssets does not accept free profit from misreport
// ---------------------------------------------------------------------------

contract Audit20260708_M02_UnsetCap is Test {
    CreatorOVault internal vault;
    MockCoinM01 internal coin;
    StratM01 internal strat;

    function setUp() public {
        coin = new MockCoinM01();
        vault = new CreatorOVault(address(coin), address(this), "V", "v");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new OVaultStrategiesModule()),
            address(new OVaultAdminModule())
        );
        strat = new StratM01(address(coin));
        vault.setFlashLoanProtection(0, type(uint256).max, 1);
        vault.setRiskConfigDelay(0);
        uint256 dep = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(address(this), dep + 1000e18);
        coin.approve(address(vault), type(uint256).max);
        vault.deposit(dep, address(this));
        vault.addStrategy(address(strat), 10_000, true);
        // Leave strategyMaxAssets at 0 (unset).
        vault.forceDeployToStrategies();
    }

    function test_unsetCap_ignoresStrategyProfitAboveDebt() public {
        uint256 debt = vault.strategyDebt(address(strat));
        assertGt(debt, 0, "expected debt after deploy");

        // Strategy lies: reports debt + 1e24 "profit".
        strat.setTrackedAssets(debt + 1e24);

        uint256 idle = vault.coinBalance();
        assertEq(vault.totalAssets(), idle + debt, "unset cap must not credit free misreport profit");
    }
}
