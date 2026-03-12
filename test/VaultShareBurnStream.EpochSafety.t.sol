// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/utilities/routers/VaultShareBurnStream.sol";

contract MockVaultSharesForBurnStream is ERC20 {
    // Simple, static asset base so PPS rises when shares burn.
    uint256 public totalAssets = 1e18;

    constructor() ERC20("Mock Vault Shares", "mSHARE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burnSharesForPriceIncrease(uint256 shares) external {
        _burn(msg.sender, shares);
    }

    function pricePerShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (totalAssets * 1e18) / supply;
    }
}

contract VaultShareBurnStreamEpochSafetyTest is Test {
    MockVaultSharesForBurnStream internal vault;
    VaultShareBurnStream internal stream;

    function setUp() public {
        vault = new MockVaultSharesForBurnStream();
        stream = new VaultShareBurnStream(address(vault));
    }

    function test_syncUnaccounted_doesNotRevert_andQueuesAllUnaccounted() external {
        vm.warp(1_000_000);

        uint256 amount = 123;
        vault.mint(address(stream), amount);

        stream.syncUnaccounted();

        assertEq(stream.pendingShares(), amount);
        assertEq(stream.pendingEpochStart(), stream.nextEpochStart(block.timestamp));
    }

    function test_queueShares_afterEpochRollover_doesNotBatchIntoEarlierEpoch() external {
        uint256 epoch = stream.EPOCH_DURATION();
        uint256 n = 10;

        uint256 t0 = (n + 1) * epoch - 1;
        vm.warp(t0);

        vault.mint(address(stream), 1);
        stream.queueShares(1);

        assertEq(stream.pendingShares(), 1);
        assertEq(stream.pendingEpochStart(), (n + 1) * epoch);

        uint256 t1 = (n + 1) * epoch + 1;
        vm.warp(t1);

        uint256 x = 1_000;
        vault.mint(address(stream), x);
        stream.queueShares(x);

        // The later deposit is scheduled for the NEXT epoch from t1 (not mixed into the now-due pending bucket).
        assertEq(stream.activeShares(), 1);
        assertEq(stream.activeEpochStart(), (n + 1) * epoch);
        assertEq(stream.pendingShares(), x);
        assertEq(stream.pendingEpochStart(), (n + 2) * epoch);
    }

    function test_checkpoint_afterEpochRollover_schedulesUnaccountedForCorrectNextEpoch() external {
        uint256 epoch = stream.EPOCH_DURATION();
        uint256 n = 20;

        uint256 t0 = (n + 1) * epoch - 1;
        vm.warp(t0);

        vault.mint(address(stream), 1);
        stream.queueShares(1);

        uint256 t1 = (n + 1) * epoch + 1;
        vm.warp(t1);

        uint256 x = 777;
        vault.mint(address(stream), x);

        stream.checkpoint();

        assertEq(stream.activeShares(), 1);
        assertEq(stream.activeEpochStart(), (n + 1) * epoch);
        assertEq(stream.pendingShares(), x);
        assertEq(stream.pendingEpochStart(), (n + 2) * epoch);
    }
}

