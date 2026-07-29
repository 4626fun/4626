// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CCALaunchArm} from "@4626/shared/shareoft-mesh/cca/CCALaunchArm.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {TokenPricing} from "liquidity-launcher/src/libraries/TokenPricing.sol";

contract ShareMeshSeedToken is ERC20 {
    constructor() ERC20("Share Mesh", "MESH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ShareMeshSeedOracle {
    bool public v4PoolConfigured;

    function setV4Pool(address, PoolKey calldata, bool) external {
        v4PoolConfigured = true;
    }

    function getAssetPrice() external view returns (int256 price, uint256 timestamp) {
        return (2e18, block.timestamp);
    }

    function getEthPrice() external view returns (int256 price, uint256 timestamp) {
        return (2000e18, block.timestamp);
    }
}

contract ShareMeshSeedAuction {
    uint256 public currencyRaisedAmount = 2 ether;
    uint256 public clearingPriceAmount = 1e18;

    function checkpoint() external {}
    function isGraduated() external pure returns (bool) {
        return true;
    }

    function currencyRaised() external view returns (uint256) {
        return currencyRaisedAmount;
    }

    function clearingPrice() external view returns (uint256) {
        return clearingPriceAmount;
    }

    function sweepCurrency() external payable {}
    function sweepUnsoldTokens() external {}
    function onTokensReceived() external {}
}

contract ShareMeshSeedFactory {
    ShareMeshSeedAuction public lastAuction;

    function initializeDistribution(address, uint256, bytes calldata, bytes32)
        external
        returns (address)
    {
        lastAuction = new ShareMeshSeedAuction();
        return address(lastAuction);
    }
}

contract ShareMeshSeedPoolManager {
    using PoolIdLibrary for PoolKey;

    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));
    mapping(bytes32 => bytes32) internal slots;
    uint160 public lastSqrtPriceX96;
    error AlreadyInitialized();

    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick) {
        PoolId poolId = key.toId();
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
        // Mirror V4: pool can only be initialized once.
        if (slots[stateSlot] != bytes32(0)) revert AlreadyInitialized();
        lastSqrtPriceX96 = sqrtPriceX96;
        slots[stateSlot] = bytes32(uint256(sqrtPriceX96));
        tick = 0;
    }

    function extsload(bytes32 slot) external view returns (bytes32 value) {
        return slots[slot];
    }
}

contract ShareMeshSeedLpManager {
    receive() external payable {}
}

contract CCALaunchArmShareMeshSeedTest is Test {
    using PoolIdLibrary for PoolKey;
    using TokenPricing for uint256;

    ShareMeshSeedToken internal token;
    CCALaunchArm internal launchArm;
    ShareMeshSeedFactory internal factory;
    ShareMeshSeedOracle internal meshOracle;
    ShareMeshSeedPoolManager internal poolManager;
    address internal taxHook;
    ShareMeshSeedLpManager internal lpManager;

    function setUp() public {
        token = new ShareMeshSeedToken();
        launchArm = new CCALaunchArm(address(token), address(0), address(this), address(this), address(this));
        factory = new ShareMeshSeedFactory();
        meshOracle = new ShareMeshSeedOracle();
        poolManager = new ShareMeshSeedPoolManager();
        taxHook = makeAddr("taxHook");
        lpManager = new ShareMeshSeedLpManager();

        launchArm.setCcaFactory(address(factory));
        launchArm.setOracleConfig(address(meshOracle), address(poolManager), taxHook, address(this));
        launchArm.setMigrationDelayBlocks(1);

        token.mint(address(this), 1_000_000 ether);
        token.transfer(address(launchArm), 10_000 ether);
        token.approve(address(launchArm), type(uint256).max);
    }

    function _launchWithReserve() internal returns (ShareMeshSeedAuction auction) {
        vm.roll(block.number + 100);
        vm.warp(block.timestamp + 4 days + 13 hours);
        launchArm.launchAuctionWithReserve(100_000 ether, 10_000 ether, 1e15, 1 ether, hex"");
        auction = factory.lastAuction();
        CCALaunchArm.LifecycleStatus memory lifecycle = launchArm.getLifecycleStatus();
        vm.roll(lifecycle.migrationBlock);
    }

    function _fundAndSweep(ShareMeshSeedAuction auction) internal {
        vm.deal(address(launchArm), auction.currencyRaisedAmount());
        launchArm.sweepCurrency();
    }

    function test_poolManager_slot0MatchesMigratePricing() public {
        ShareMeshSeedAuction auction = _launchWithReserve();
        _fundAndSweep(auction);

        PoolKey memory key = launchArm.getPoolKey();
        bool currencyIsToken0 = address(0) < address(token);
        uint256 priceX192 = auction.clearingPrice().convertToPriceX192(currencyIsToken0);
        uint160 sqrtPriceX96 = priceX192.convertToSqrtPriceX96();

        poolManager.initialize(key, sqrtPriceX96);
        (uint160 actual,,,) = StateLibrary.getSlot0(IPoolManager(address(poolManager)), key.toId());
        assertEq(actual, sqrtPriceX96);
    }

    function test_migrate_allowsZeroTaxHook() public {
        launchArm.setOracleConfig(address(meshOracle), address(poolManager), address(0), address(this));
        ShareMeshSeedAuction auction = _launchWithReserve();
        _fundAndSweep(auction);
        launchArm.migrate();
        assertTrue(launchArm.getLifecycleStatus().migrated);
    }

    function test_migrate_retainsReserveAndCurrencyWithoutLpMint() public {
        ShareMeshSeedAuction auction = _launchWithReserve();
        _fundAndSweep(auction);

        uint256 reserveBefore = token.balanceOf(address(launchArm));
        uint256 ethBefore = address(launchArm).balance;

        launchArm.migrate();

        assertTrue(launchArm.getLifecycleStatus().migrated);
        assertTrue(meshOracle.v4PoolConfigured());
        assertGt(poolManager.lastSqrtPriceX96(), 0);
        assertEq(token.balanceOf(address(launchArm)), reserveBefore, "reserve stays on launch arm");
        assertEq(address(launchArm).balance, ethBefore, "currency stays on launch arm");
    }

    function test_seedLpManager_revertsBeforeMigrate() public {
        launchArm.setLpManager(address(lpManager));
        vm.expectRevert(CCALaunchArm.MigrationConfigMissing.selector);
        launchArm.seedLpManager();
    }

    function test_seedLpManager_revertsWithoutLpManager() public {
        ShareMeshSeedAuction auction = _launchWithReserve();
        _fundAndSweep(auction);
        launchArm.migrate();

        vm.expectRevert(CCALaunchArm.LpManagerNotSet.selector);
        launchArm.seedLpManager();
    }

    function test_seedLpManager_transfersReserveAndCurrency() public {
        ShareMeshSeedAuction auction = _launchWithReserve();
        _fundAndSweep(auction);
        launchArm.migrate();
        launchArm.setLpManager(address(lpManager));

        uint256 reserve = launchArm.getLifecycleStatus().lpReserveAmount;
        uint256 ethBefore = address(launchArm).balance;

        launchArm.seedLpManager();

        assertEq(token.balanceOf(address(lpManager)), reserve);
        assertEq(address(lpManager).balance, ethBefore);
        assertEq(token.balanceOf(address(launchArm)), 0);
        assertEq(address(launchArm).balance, 0);
    }

    function test_setLpManager_revertsForUnauthorizedCaller() public {
        vm.prank(makeAddr("rando"));
        vm.expectRevert();
        launchArm.setLpManager(address(lpManager));
    }

    /// AUDIT-2026-07-08-H04: hostile initialize of primary pool key must not brick migrate.
    function test_migrate_recoversFromHostilePrimaryPoolInit() public {
        ShareMeshSeedAuction auction = _launchWithReserve();
        _fundAndSweep(auction);

        PoolKey memory primary = launchArm.getPoolKey();
        // Grief primary key at a wrong sqrt price (permissionless V4 initialize).
        poolManager.initialize(primary, uint160(1));

        uint24 feeBefore = launchArm.poolFeeTier();
        launchArm.migrate();

        assertTrue(launchArm.getLifecycleStatus().migrated);
        // Must have rotated off the griefed primary key.
        assertTrue(
            launchArm.poolFeeTier() != feeBefore || launchArm.poolTickSpacing() != primary.tickSpacing,
            "expected fee or tick rotation after primary grief"
        );
        PoolKey memory live = launchArm.getPoolKey();
        (uint160 actual,,,) = StateLibrary.getSlot0(IPoolManager(address(poolManager)), live.toId());
        assertGt(actual, 1, "live pool must be at clearing price, not grief price");
    }
}
