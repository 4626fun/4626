// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SolanaBridgeStrategy, ISolanaBridgeAdapter} from "../../../contracts/vault/strategies/SolanaBridgeStrategy.sol";

contract MockAsset is ERC20 {
    constructor() ERC20("Creator", "CRT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Adapter that honours the H-06 bool return; consumes tokens and returns true.
contract HappyAdapter is ISolanaBridgeAdapter {
    function bridgeToSolana(address token, uint256 amount, bytes32 /*solanaDestination*/)
        external
        payable
        override
        returns (bool success)
    {
        // Simulate the real flow: pull the approved tokens out so the H-14
        // post-call balance check also passes.
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        return true;
    }
}

/// @notice Adapter that returns `false` without reverting. Exercises H-06 bool check.
contract FalseReturningAdapter is ISolanaBridgeAdapter {
    function bridgeToSolana(address token, uint256 amount, bytes32 /*solanaDestination*/)
        external
        payable
        override
        returns (bool success)
    {
        // Still consume the tokens so the H-14 balance check would pass —
        // this isolates the H-06 bool signal as the only remaining guard.
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        return false;
    }
}

/// @notice Adapter that returns `true` but does not consume tokens. Exercises H-14
/// defense-in-depth: even with H-06 reporting success, the balance check must still
/// catch the no-op.
contract NoopAdapter is ISolanaBridgeAdapter {
    function bridgeToSolana(address /*token*/, uint256 /*amount*/, bytes32 /*solanaDestination*/)
        external
        payable
        override
        returns (bool success)
    {
        return true;
    }
}

contract SolanaBridgeStrategyBridgeReturnTest is Test {
    SolanaBridgeStrategy strategy;
    MockAsset asset;
    address vault;
    address owner;
    bytes32 solanaDest = bytes32(uint256(0xDEADBEEF));

    function setUp() public {
        asset = new MockAsset();
        vault = makeAddr("vault");
        owner = address(this);
    }

    function _deployWithAdapter(address adapter) internal returns (SolanaBridgeStrategy s) {
        s = new SolanaBridgeStrategy(vault, address(asset), adapter, solanaDest, owner);
        asset.mint(address(s), 100e18);
    }

    // ================================
    // FIX: H-06 (4626-438) — bridgeToSolana bool return semantics
    // ================================

    function test_bridgeToSolana_succeeds_whenAdapterReturnsTrueAndConsumesTokens() public {
        HappyAdapter adapter = new HappyAdapter();
        strategy = _deployWithAdapter(address(adapter));

        strategy.bridgeToSolana(10e18);

        assertEq(asset.balanceOf(address(strategy)), 90e18, "strategy should have sent 10e18");
        assertEq(asset.balanceOf(address(adapter)), 10e18, "adapter should hold bridged amount");
    }

    function test_bridgeToSolana_reverts_whenAdapterReturnsFalse() public {
        FalseReturningAdapter adapter = new FalseReturningAdapter();
        strategy = _deployWithAdapter(address(adapter));

        // Adapter consumes the tokens AND returns false — H-14 balance check
        // would accept this, so only the H-06 bool guard catches it.
        vm.expectRevert(SolanaBridgeStrategy.BridgeAdapterReportedFailure.selector);
        strategy.bridgeToSolana(10e18);
    }

    function test_bridgeToSolana_reverts_whenAdapterReturnsTrueButTokensNotConsumed() public {
        // H-14 defense-in-depth: H-06 bool says success, but H-14 balance
        // check must still catch the silent no-op.
        NoopAdapter adapter = new NoopAdapter();
        strategy = _deployWithAdapter(address(adapter));

        vm.expectRevert(
            abi.encodeWithSelector(SolanaBridgeStrategy.BridgeCallNotConsumed.selector, 10e18, 0)
        );
        strategy.bridgeToSolana(10e18);
    }
}
