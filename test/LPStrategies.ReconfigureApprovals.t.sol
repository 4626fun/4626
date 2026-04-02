// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorLPManager} from "../contracts/vault/strategies/univ4/CreatorLPManager.sol";
import {ConcentratedStrategy} from "../contracts/vault/strategies/univ4/ConcentratedStrategy.sol";
import {LimitOrderStrategy} from "../contracts/vault/strategies/univ4/LimitOrderStrategy.sol";
import {FullRangeStrategy} from "../contracts/vault/strategies/univ4/FullRangeStrategy.sol";
import {ApprovedV4HooksRegistry} from "../contracts/vault/strategies/univ4/ApprovedV4HooksRegistry.sol";
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

contract MockHook {}

contract LPStrategiesReconfigureApprovalsTest is Test {
    uint160 internal constant MAX_PERMIT2_AMOUNT = type(uint160).max;
    uint48 internal constant MAX_PERMIT2_EXPIRATION = type(uint48).max;

    ERC20ApprovalMock internal creator;
    ERC20ApprovalMock internal paired;
    StatefulPermit2Mock internal permit2;
    StatefulPermit2Mock internal permit2Alt;
    ApprovedV4HooksRegistry internal hookRegistry;
    MockHook internal approvedHook;
    MockHook internal unapprovedHook;
    address internal poolManager = address(0xCAFE);
    address internal positionManager = address(0xBEEF);
    address internal positionManagerAlt = address(0xD00D);

    function setUp() public {
        creator = new ERC20ApprovalMock("Creator", "CRT", 18);
        paired = new ERC20ApprovalMock("Paired", "PRD", 18);
        permit2 = new StatefulPermit2Mock();
        permit2Alt = new StatefulPermit2Mock();
        hookRegistry = new ApprovedV4HooksRegistry(address(this));
        approvedHook = new MockHook();
        unapprovedHook = new MockHook();
        hookRegistry.setHookApproval(address(approvedHook), true);
    }

    function _poolKey() internal view returns (PoolKey memory key) {
        return _poolKeyWithHook(address(approvedHook));
    }

    function _poolKeyWithHook(address hook) internal view returns (PoolKey memory key) {
        return PoolKey({
            currency0: Currency.wrap(address(creator)),
            currency1: Currency.wrap(address(paired)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
    }

    function _assertConfigured(address strategy, address permit2Addr, StatefulPermit2Mock permit2Mock, address posm)
        internal
        view
    {
        assertEq(creator.allowance(strategy, permit2Addr), type(uint256).max);
        assertEq(paired.allowance(strategy, permit2Addr), type(uint256).max);

        (uint160 creatorAmount, uint48 creatorExpiry) = permit2Mock.allowanceOf(address(creator), posm);
        (uint160 pairedAmount, uint48 pairedExpiry) = permit2Mock.allowanceOf(address(paired), posm);
        assertEq(creatorAmount, MAX_PERMIT2_AMOUNT);
        assertEq(creatorExpiry, MAX_PERMIT2_EXPIRATION);
        assertEq(pairedAmount, MAX_PERMIT2_AMOUNT);
        assertEq(pairedExpiry, MAX_PERMIT2_EXPIRATION);
    }

    function _assertRevoked(address strategy, address permit2Addr, StatefulPermit2Mock permit2Mock, address posm)
        internal
        view
    {
        assertEq(creator.allowance(strategy, permit2Addr), 0);
        assertEq(paired.allowance(strategy, permit2Addr), 0);

        (uint160 creatorAmount, uint48 creatorExpiry) = permit2Mock.allowanceOf(address(creator), posm);
        (uint160 pairedAmount, uint48 pairedExpiry) = permit2Mock.allowanceOf(address(paired), posm);
        assertEq(creatorAmount, 0);
        assertEq(creatorExpiry, 0);
        assertEq(pairedAmount, 0);
        assertEq(pairedExpiry, 0);
    }

    function test_FullRange_ConfigurePool_IsOneTimeOnly() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        vm.expectRevert(FullRangeStrategy.PoolAlreadyConfigured.selector);
        strat.configurePool(poolManager, positionManagerAlt, address(permit2Alt), _poolKey());
    }

    function test_FullRange_ReconfigureApprovals_RotatesTargetsAndRevokesOld() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));

        _assertRevoked(address(strat), address(permit2), permit2, positionManager);
        _assertConfigured(address(strat), address(permit2Alt), permit2Alt, positionManagerAlt);
        assertEq(strat.positionManager(), positionManagerAlt);
        assertEq(strat.permit2(), address(permit2Alt));
    }

    function test_FullRange_ReconfigureApprovals_RevertsForNonOwner() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.prank(address(0xA11CE));
        vm.expectRevert();
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_FullRange_ReconfigureApprovals_RevertsWhenPoolNotConfigured() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(FullRangeStrategy.PoolNotConfigured.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_FullRange_ReconfigureApprovals_RevertsOnZeroPositionManager() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(FullRangeStrategy.ZeroAddress.selector);
        strat.reconfigureApprovals(address(0), address(permit2Alt));
    }

    function test_FullRange_ReconfigureApprovals_RevertsOnZeroPermit2() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(FullRangeStrategy.ZeroAddress.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(0));
    }

    function test_Concentrated_ConfigurePool_IsOneTimeOnly() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        vm.expectRevert(ConcentratedStrategy.PoolAlreadyConfigured.selector);
        strat.configurePool(poolManager, positionManagerAlt, address(permit2Alt), _poolKey());
    }

    function test_Concentrated_ReconfigureApprovals_RotatesTargetsAndRevokesOld() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));

        _assertRevoked(address(strat), address(permit2), permit2, positionManager);
        _assertConfigured(address(strat), address(permit2Alt), permit2Alt, positionManagerAlt);
        assertEq(strat.positionManager(), positionManagerAlt);
        assertEq(strat.permit2(), address(permit2Alt));
    }

    function test_Concentrated_ReconfigureApprovals_RevertsForNonOwner() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.prank(address(0xA11CE));
        vm.expectRevert();
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_Concentrated_ReconfigureApprovals_RevertsWhenPoolNotConfigured() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(ConcentratedStrategy.PoolNotConfigured.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_Concentrated_ReconfigureApprovals_RevertsOnZeroPositionManager() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(ConcentratedStrategy.ZeroAddress.selector);
        strat.reconfigureApprovals(address(0), address(permit2Alt));
    }

    function test_Concentrated_ReconfigureApprovals_RevertsOnZeroPermit2() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(ConcentratedStrategy.ZeroAddress.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(0));
    }

    function test_LimitOrder_ConfigurePool_IsOneTimeOnly() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        vm.expectRevert(LimitOrderStrategy.PoolAlreadyConfigured.selector);
        strat.configurePool(poolManager, positionManagerAlt, address(permit2Alt), _poolKey());
    }

    function test_LimitOrder_ReconfigureApprovals_RotatesTargetsAndRevokesOld() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));

        _assertRevoked(address(strat), address(permit2), permit2, positionManager);
        _assertConfigured(address(strat), address(permit2Alt), permit2Alt, positionManagerAlt);
        assertEq(strat.positionManager(), positionManagerAlt);
        assertEq(strat.permit2(), address(permit2Alt));
    }

    function test_LimitOrder_ReconfigureApprovals_RevertsForNonOwner() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.prank(address(0xA11CE));
        vm.expectRevert();
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_LimitOrder_ReconfigureApprovals_RevertsWhenPoolNotConfigured() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(LimitOrderStrategy.PoolNotConfigured.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_LimitOrder_ReconfigureApprovals_RevertsOnZeroPositionManager() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(LimitOrderStrategy.ZeroAddress.selector);
        strat.reconfigureApprovals(address(0), address(permit2Alt));
    }

    function test_LimitOrder_ReconfigureApprovals_RevertsOnZeroPermit2() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(LimitOrderStrategy.ZeroAddress.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(0));
    }

    function test_CreatorLPManager_ConfigurePool_IsOneTimeOnly() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        vm.expectRevert(CreatorLPManager.PoolAlreadyConfigured.selector);
        strat.configurePool(poolManager, positionManagerAlt, address(permit2Alt), _poolKey());
    }

    function test_CreatorLPManager_ReconfigureApprovals_RotatesTargetsAndRevokesOld() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());
        _assertConfigured(address(strat), address(permit2), permit2, positionManager);

        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));

        _assertRevoked(address(strat), address(permit2), permit2, positionManager);
        _assertConfigured(address(strat), address(permit2Alt), permit2Alt, positionManagerAlt);
        assertEq(strat.positionManager(), positionManagerAlt);
        assertEq(strat.permit2(), address(permit2Alt));
    }

    function test_CreatorLPManager_ReconfigureApprovals_RevertsForNonOwner() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.prank(address(0xA11CE));
        vm.expectRevert();
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_CreatorLPManager_ReconfigureApprovals_RevertsWhenPoolNotConfigured() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(CreatorLPManager.PoolNotConfigured.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(permit2Alt));
    }

    function test_CreatorLPManager_ReconfigureApprovals_RevertsOnZeroPositionManager() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(CreatorLPManager.ZeroAddress.selector);
        strat.reconfigureApprovals(address(0), address(permit2Alt));
    }

    function test_CreatorLPManager_ReconfigureApprovals_RevertsOnZeroPermit2() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        strat.configurePool(poolManager, positionManager, address(permit2), _poolKey());

        vm.expectRevert(CreatorLPManager.ZeroAddress.selector);
        strat.reconfigureApprovals(positionManagerAlt, address(0));
    }

    function test_FullRange_RevertsWhenHookNotApproved() external {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(abi.encodeWithSelector(FullRangeStrategy.HookNotApproved.selector, address(unapprovedHook)));
        strat.configurePool(poolManager, positionManager, address(permit2), _poolKeyWithHook(address(unapprovedHook)));
    }

    function test_Concentrated_RevertsWhenHookNotApproved() external {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(
            abi.encodeWithSelector(ConcentratedStrategy.HookNotApproved.selector, address(unapprovedHook))
        );
        strat.configurePool(poolManager, positionManager, address(permit2), _poolKeyWithHook(address(unapprovedHook)));
    }

    function test_LimitOrder_RevertsWhenHookNotApproved() external {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(abi.encodeWithSelector(LimitOrderStrategy.HookNotApproved.selector, address(unapprovedHook)));
        strat.configurePool(poolManager, positionManager, address(permit2), _poolKeyWithHook(address(unapprovedHook)));
    }

    function test_CreatorLPManager_RevertsWhenHookNotApproved() external {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));

        vm.expectRevert(abi.encodeWithSelector(CreatorLPManager.HookNotApproved.selector, address(unapprovedHook)));
        strat.configurePool(poolManager, positionManager, address(permit2), _poolKeyWithHook(address(unapprovedHook)));
    }
}
