// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorLPManager} from "../contracts/vault/strategies/univ4/CreatorLPManager.sol";
import {ConcentratedStrategy} from "../contracts/vault/strategies/univ4/ConcentratedStrategy.sol";
import {LimitOrderStrategy} from "../contracts/vault/strategies/univ4/LimitOrderStrategy.sol";
import {FullRangeStrategy} from "../contracts/vault/strategies/univ4/FullRangeStrategy.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract ERC20ApprovalMock {
    string public name;
    string public symbol;
    uint8 public decimals;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract StatefulPermit2Mock {
    struct PermitAllowance {
        uint160 amount;
        uint48 expiration;
    }

    mapping(address => mapping(address => PermitAllowance)) internal _allowances;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        _allowances[token][spender] = PermitAllowance({amount: amount, expiration: expiration});
    }

    function allowanceOf(address token, address spender) external view returns (uint160 amount, uint48 expiration) {
        PermitAllowance memory a = _allowances[token][spender];
        return (a.amount, a.expiration);
    }
}

contract LPStrategiesReconfigureApprovalsTest is Test {
    uint160 internal constant MAX_PERMIT2_AMOUNT = type(uint160).max;
    uint48 internal constant MAX_PERMIT2_EXPIRATION = type(uint48).max;

    ERC20ApprovalMock internal creator;
    ERC20ApprovalMock internal paired;
    StatefulPermit2Mock internal oldPermit2;
    StatefulPermit2Mock internal newPermit2;
    address internal poolManager = address(0xCAFE);
    address internal oldPositionManager = address(0xBEEF);
    address internal newPositionManager = address(0xD00D);

    function setUp() public {
        creator = new ERC20ApprovalMock("Creator", "CRT", 18);
        paired = new ERC20ApprovalMock("Paired", "PRD", 18);
        oldPermit2 = new StatefulPermit2Mock();
        newPermit2 = new StatefulPermit2Mock();
    }

    function _poolKey() internal view returns (PoolKey memory key) {
        return PoolKey({
            currency0: Currency.wrap(address(creator)),
            currency1: Currency.wrap(address(paired)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function _assertConfigured(address strategy, address permit2Addr, StatefulPermit2Mock permit2, address positionManager)
        internal
        view
    {
        assertEq(creator.allowance(strategy, permit2Addr), type(uint256).max);
        assertEq(paired.allowance(strategy, permit2Addr), type(uint256).max);

        (uint160 creatorAmount, uint48 creatorExpiry) = permit2.allowanceOf(address(creator), positionManager);
        (uint160 pairedAmount, uint48 pairedExpiry) = permit2.allowanceOf(address(paired), positionManager);
        assertEq(creatorAmount, MAX_PERMIT2_AMOUNT);
        assertEq(creatorExpiry, MAX_PERMIT2_EXPIRATION);
        assertEq(pairedAmount, MAX_PERMIT2_AMOUNT);
        assertEq(pairedExpiry, MAX_PERMIT2_EXPIRATION);
    }

    function _assertRevoked(address strategy, address permit2Addr, StatefulPermit2Mock permit2, address positionManager)
        internal
        view
    {
        assertEq(creator.allowance(strategy, permit2Addr), 0);
        assertEq(paired.allowance(strategy, permit2Addr), 0);

        (uint160 creatorAmount, uint48 creatorExpiry) = permit2.allowanceOf(address(creator), positionManager);
        (uint160 pairedAmount, uint48 pairedExpiry) = permit2.allowanceOf(address(paired), positionManager);
        assertEq(creatorAmount, 0);
        assertEq(creatorExpiry, 0);
        assertEq(pairedAmount, 0);
        assertEq(pairedExpiry, 0);
    }

    function test_FullRange_ReconfigureRevokesPreviousApprovals() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this));

        strat.configurePool(poolManager, oldPositionManager, address(oldPermit2), _poolKey());
        _assertConfigured(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);

        strat.configurePool(poolManager, newPositionManager, address(newPermit2), _poolKey());
        _assertRevoked(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);
        _assertConfigured(address(strat), address(newPermit2), newPermit2, newPositionManager);
    }

    function test_Concentrated_ReconfigureRevokesPreviousApprovals() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this));

        strat.configurePool(poolManager, oldPositionManager, address(oldPermit2), _poolKey());
        _assertConfigured(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);

        strat.configurePool(poolManager, newPositionManager, address(newPermit2), _poolKey());
        _assertRevoked(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);
        _assertConfigured(address(strat), address(newPermit2), newPermit2, newPositionManager);
    }

    function test_LimitOrder_ReconfigureRevokesPreviousApprovals() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this));

        strat.configurePool(poolManager, oldPositionManager, address(oldPermit2), _poolKey());
        _assertConfigured(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);

        strat.configurePool(poolManager, newPositionManager, address(newPermit2), _poolKey());
        _assertRevoked(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);
        _assertConfigured(address(strat), address(newPermit2), newPermit2, newPositionManager);
    }

    function test_CreatorLPManager_ReconfigureRevokesPreviousApprovals() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this));

        strat.configurePool(poolManager, oldPositionManager, address(oldPermit2), _poolKey());
        _assertConfigured(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);

        strat.configurePool(poolManager, newPositionManager, address(newPermit2), _poolKey());
        _assertRevoked(address(strat), address(oldPermit2), oldPermit2, oldPositionManager);
        _assertConfigured(address(strat), address(newPermit2), newPermit2, newPositionManager);
    }
}
