// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {VaultShareBurnStream} from "@4626/shared/distribution/VaultShareBurnStream.sol";

contract MockVaultForBurnStream is ERC20 {
    bool public failBurn;

    constructor() ERC20("Mock Creator OVault", "mOVLT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailBurn(bool shouldFail) external {
        failBurn = shouldFail;
    }

    function burnSharesForPriceIncrease(uint256 shares) external {
        if (failBurn) revert("burn-failed");
        _burn(msg.sender, shares);
    }

    function pricePerShare() external pure returns (uint256) {
        return 1e18;
    }

    function setAuthorizedQueuerOnStream(address stream, address queuer, bool authorized) external {
        VaultShareBurnStream(stream).setAuthorizedQueuer(queuer, authorized);
    }

    function recoverFailedBurnsOnStream(address stream, uint256 amount) external {
        VaultShareBurnStream(stream).recoverFailedBurns(amount);
    }
}

contract VaultShareBurnStreamIntegrationTest is Test {
    MockVaultForBurnStream internal vault;
    VaultShareBurnStream internal stream;
    address internal router = makeAddr("router");

    function setUp() public {
        vault = new MockVaultForBurnStream();
        stream = new VaultShareBurnStream(address(vault));
    }

    function test_queueSharesRequiresVaultBridgedAuthorization() public {
        uint256 shares = 1_000e18;
        vault.mint(address(stream), shares);

        vm.prank(router);
        vm.expectRevert(VaultShareBurnStream.UnauthorizedQueuer.selector);
        stream.queueShares(shares);

        vault.setAuthorizedQueuerOnStream(address(stream), router, true);

        vm.prank(router);
        stream.queueShares(shares);

        assertEq(stream.pendingShares(), shares);
    }

    function test_recoverFailedBurnsOnlyVaultAndFailedSharesAreNotRequeued() public {
        uint256 shares = 1_000e18;
        vault.mint(address(stream), shares);
        vault.setAuthorizedQueuerOnStream(address(stream), router, true);

        vm.prank(router);
        stream.queueShares(shares);

        uint256 epochStart = stream.nextEpochStart(block.timestamp);
        vm.warp(epochStart);
        stream.start();

        vault.setFailBurn(true);
        vm.warp(epochStart + 3 days);
        stream.drip();

        uint256 failed = stream.failedBurnAccumulator();
        assertGt(failed, 0, "failed burn accumulator should grow");
        assertEq(stream.pendingShares(), 0, "failed shares must not auto-requeue");

        vm.expectRevert(VaultShareBurnStream.OnlyVault.selector);
        stream.recoverFailedBurns(0);

        uint256 streamBalanceBeforeRecovery = vault.balanceOf(address(stream));
        vault.setFailBurn(false);
        vault.recoverFailedBurnsOnStream(address(stream), 0);

        assertEq(stream.failedBurnAccumulator(), 0, "recovery should clear accumulator");
        assertEq(vault.balanceOf(address(stream)), streamBalanceBeforeRecovery - failed, "recovery should burn shares");

        // Permissionless sync/checkpoint should not re-queue recovered failed shares.
        vm.expectRevert(VaultShareBurnStream.NoNewShares.selector);
        stream.syncUnaccounted();
        assertEq(stream.pendingShares(), 0);
    }
}
