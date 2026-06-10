// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IRandomnessSource} from "contracts/utilities/lottery/randomness/IRandomnessSource.sol";
import {RandomnessRouter} from "contracts/utilities/lottery/randomness/RandomnessRouter.sol";

/// @notice Mock REQUEST-mode source that mints sequential request ids.
contract MockRequestSource is IRandomnessSource {
    uint256 public next;
    mapping(uint256 => uint256) public words;

    function mode() external pure returns (SourceMode) { return SourceMode.REQUEST; }
    function isReady(uint256 key) external view returns (bool) { return words[key] != 0; }
    function randomWord(uint256 key) external view returns (uint256) {
        require(words[key] != 0, "not ready");
        return words[key];
    }
    function request() external returns (uint256 requestId) {
        requestId = ++next;
        words[requestId] = uint256(keccak256(abi.encode(requestId)));
    }
}

/// @notice Mock PULL-mode source — caller sets a precomputed value for `key`.
contract MockPullSource is IRandomnessSource {
    mapping(uint256 => uint256) public words;
    function mode() external pure returns (SourceMode) { return SourceMode.PULL; }
    function isReady(uint256 key) external view returns (bool) { return words[key] != 0; }
    function randomWord(uint256 key) external view returns (uint256) {
        require(words[key] != 0, "not ready");
        return words[key];
    }
    function set(uint256 key, uint256 word) external { words[key] = word; }
}

contract RandomnessRouterTest is Test {
    RandomnessRouter router;
    MockRequestSource req;
    MockPullSource pull;

    address owner = address(0xA1);
    address coinA = address(0xA1A1);
    address coinB = address(0xB2B2);

    function setUp() public {
        req = new MockRequestSource();
        pull = new MockPullSource();
        router = new RandomnessRouter(owner, req);
    }

    function test_resolve_default() public view {
        assertEq(address(router.resolve(coinA)), address(req));
    }

    function test_setSourceFor_overrides() public {
        vm.prank(owner);
        router.setSourceFor(coinA, pull);
        assertEq(address(router.resolve(coinA)), address(pull));
        // Other coin still gets the default
        assertEq(address(router.resolve(coinB)), address(req));
    }

    function test_clearSourceFor_revertsToDefault() public {
        vm.prank(owner);
        router.setSourceFor(coinA, pull);
        vm.prank(owner);
        router.clearSourceFor(coinA);
        assertEq(address(router.resolve(coinA)), address(req));
    }

    function test_acquireRequest_returnsKey() public {
        (address src, IRandomnessSource.SourceMode m, uint256 key) = router.acquireRequest(coinA);
        assertEq(src, address(req));
        assertEq(uint256(m), uint256(IRandomnessSource.SourceMode.REQUEST));
        assertEq(key, 1);
        assertTrue(req.isReady(key));
    }

    function test_acquireRequest_rejectsPullSource() public {
        vm.prank(owner);
        router.setSourceFor(coinA, pull);
        vm.expectRevert(RandomnessRouter.UnsupportedMode.selector);
        router.acquireRequest(coinA);
    }

    function test_readPull_returnsWord() public {
        vm.prank(owner);
        router.setSourceFor(coinA, pull);
        pull.set(42, 0xDEADBEEF);
        assertEq(router.readPull(coinA, 42), 0xDEADBEEF);
    }

    function test_readPull_rejectsRequestSource() public {
        vm.expectRevert(RandomnessRouter.UnsupportedMode.selector);
        router.readPull(coinA, 1);
    }

    function test_readPull_revertsIfNotReady() public {
        vm.prank(owner);
        router.setSourceFor(coinA, pull);
        vm.expectRevert(RandomnessRouter.NotReady.selector);
        router.readPull(coinA, 999);
    }

    function test_resolve_revertsWhenNoSource() public {
        // Build a router with no default.
        RandomnessRouter empty = new RandomnessRouter(owner, IRandomnessSource(address(0)));
        vm.expectRevert(RandomnessRouter.NoSource.selector);
        empty.resolve(coinA);
    }

    function test_setSourceFor_onlyOwner() public {
        vm.expectRevert(RandomnessRouter.NotOwner.selector);
        router.setSourceFor(coinA, pull);
    }

    // ---------------------------------------------------------------------
    // Reentrancy hardening (audit §4.1).
    //
    // We install a malicious source that re-enters the router from inside
    // its own `request()`. Without `nonReentrant` the inner call would
    // observe a partially-applied state; with `nonReentrant` it must
    // revert with OpenZeppelin's standard "ReentrancyGuard: reentrant
    // call" message.
    // ---------------------------------------------------------------------
}

contract ReentrantSource is IRandomnessSource {
    RandomnessRouter public router;
    address public coin;
    bool public attempted;
    bool public reentryBlocked;

    constructor(RandomnessRouter _router, address _coin) {
        router = _router;
        coin = _coin;
    }

    function mode() external pure returns (SourceMode) { return SourceMode.REQUEST; }
    function isReady(uint256) external pure returns (bool) { return false; }
    function randomWord(uint256) external pure returns (uint256) { return 0; }

    function request() external returns (uint256) {
        if (!attempted) {
            attempted = true;
            // Attempt to re-enter `acquireRequest`. Must revert via the
            // ReentrancyGuard inherited from OpenZeppelin.
            try router.acquireRequest(coin) {
                revert("reentry unexpectedly succeeded");
            } catch {
                reentryBlocked = true;
            }
        }
        return 1;
    }
}

contract RandomnessRouterReentrancyTest is Test {
    RandomnessRouter router;
    ReentrantSource bad;
    address owner = address(0xAA);
    address coinA = address(0xC1);

    function setUp() public {
        router = new RandomnessRouter(owner, IRandomnessSource(address(0)));
        bad = new ReentrantSource(router, coinA);
        vm.prank(owner);
        router.setSourceFor(coinA, IRandomnessSource(address(bad)));
    }

    function test_acquireRequest_blocksReentry() public {
        // The bad source's request() recurses into router.acquireRequest.
        // The source catches the inner ReentrancyGuard revert so the outer
        // request can complete, letting the test assert the path was exercised.
        (address src, IRandomnessSource.SourceMode mode, uint256 key) = router.acquireRequest(coinA);
        assertEq(src, address(bad));
        assertEq(uint256(mode), uint256(IRandomnessSource.SourceMode.REQUEST));
        assertEq(key, 1);
        assertTrue(bad.attempted(), "reentrant call was never attempted");
        assertTrue(bad.reentryBlocked(), "reentrant call was not blocked");
    }
}
