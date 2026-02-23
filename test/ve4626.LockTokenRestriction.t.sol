// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ve4626 as Ve4626} from "../contracts/governance/ve4626.sol";

contract MockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract Ve4626LockTokenRestrictionTest is Test {
    Ve4626 internal ve;
    MockToken internal wrapped;
    MockToken internal other;

    address internal owner;
    address internal alice;

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");

        wrapped = new MockToken("Wrapped ShareOFT", "wsOFT");
        other = new MockToken("Other Token", "OTHER");

        // ve4626 should only ever allow locking the wrapped ShareOFT token.
        ve = new Ve4626("Vote-Escrowed wsOFT", "vewsOFT", address(wrapped), owner);

        wrapped.mint(alice, 1_000 ether);
        other.mint(alice, 1_000 ether);
    }

    function testAdminCannotWhitelistAlternativeLockToken() public {
        // The design requirement: even the owner must not be able to add alternative lock tokens.
        //
        // Once implemented, these admin functions should not exist (or otherwise be impossible to use).
        (bool ok,) = address(ve).call(abi.encodeWithSignature("setAcceptedToken(address,bool)", address(other), true));
        assertFalse(ok, "setAcceptedToken must not be callable");
    }

    function testCannotLockNonWrappedTokenEvenIfAdminAttemptsToEnableIt() public {
        // Attempt to enable "other" as an accepted token (should fail once hardened).
        (bool ok,) = address(ve).call(abi.encodeWithSignature("setAcceptedToken(address,bool)", address(other), true));
        ok; // silence unused variable (we assert behavior via `lock` revert)

        vm.startPrank(alice);
        other.approve(address(ve), type(uint256).max);

        // Must always revert: only `wrappedShareOFT` is lockable.
        vm.expectRevert(bytes4(keccak256("InvalidToken()")));
        ve.lock(address(other), 100 ether, 7 days);
        vm.stopPrank();
    }
}

