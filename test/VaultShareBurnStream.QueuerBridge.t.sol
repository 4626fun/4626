// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/utilities/routers/VaultShareBurnStream.sol";

/// @dev Documents the payout-router wiring invariant: only the vault may authorize queuers.
contract VaultShareBurnStreamQueuerBridgeTest is Test {
    address internal vault = makeAddr("vault");
    address internal payoutRouter = makeAddr("payoutRouter");

    VaultShareBurnStream internal stream;

    function setUp() public {
        stream = new VaultShareBurnStream(vault);
    }

    function test_onlyVaultCanAuthorizePayoutRouterQueuer() public {
        vm.prank(vault);
        stream.setAuthorizedQueuer(payoutRouter, true);
        assertTrue(stream.authorizedQueuers(payoutRouter));
    }

    function test_nonVaultCannotAuthorizeQueuer() public {
        vm.expectRevert("Only vault");
        stream.setAuthorizedQueuer(payoutRouter, true);
    }
}
