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

// Minimal ERC20 mock with mint for testing
contract ERC20Mock {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract MockPermit2 {
    function approve(address, address, uint160, uint48) external {}
}

contract MockHook {}

contract LPStrategiesGuardsTest is Test {
    ERC20Mock internal creator;
    ERC20Mock internal paired;
    address internal positionManager = address(0xBEEF);
    address internal poolManager = address(0xCAFE);
    MockPermit2 internal permit2;
    MockHook internal hook;
    ApprovedV4HooksRegistry internal hookRegistry;

    function setUp() public {
        creator = new ERC20Mock("Creator", "CRT", 18);
        paired = new ERC20Mock("Paired", "PRD", 18);
        permit2 = new MockPermit2();
        hook = new MockHook();
        hookRegistry = new ApprovedV4HooksRegistry(address(this));
        hookRegistry.setHookApproval(address(hook), true);
    }

    function _poolKey() internal view returns (PoolKey memory key) {
        // The contracts validate that the pool key currencies match (in either order).
        return PoolKey({
            currency0: Currency.wrap(address(creator)),
            currency1: Currency.wrap(address(paired)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function testCreatorLPManagerRevertsWhenNotConfigured() public {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));
        vm.expectRevert(CreatorLPManager.PoolNotConfigured.selector);
        strat.rebalance();
    }

    function testCreatorLPManagerRevertsWhenPositionManagerMissing() public {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));
        vm.expectRevert(CreatorLPManager.ZeroAddress.selector);
        strat.configurePool(poolManager, address(0), address(permit2), _poolKey());
    }

    function testCreatorLPManagerRevertsWhenPermit2Missing() public {
        CreatorLPManager strat =
            new CreatorLPManager(address(creator), address(paired), address(this), address(this), address(hookRegistry));
        vm.expectRevert(CreatorLPManager.ZeroAddress.selector);
        strat.configurePool(poolManager, positionManager, address(0), _poolKey());
    }

    function testConcentratedStrategyRequiresConfig() public {
        ConcentratedStrategy strat =
            new ConcentratedStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));
        vm.expectRevert(ConcentratedStrategy.PoolNotConfigured.selector);
        strat.deposit(1 ether, 0);
    }

    function testLimitOrderRequiresConfig() public {
        LimitOrderStrategy strat =
            new LimitOrderStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));
        vm.expectRevert(LimitOrderStrategy.PoolNotConfigured.selector);
        strat.deposit(1 ether, 0);
    }

    function testFullRangeRequiresConfig() public {
        FullRangeStrategy strat =
            new FullRangeStrategy(address(creator), address(paired), address(this), address(this), address(hookRegistry));
        vm.expectRevert(FullRangeStrategy.PoolNotConfigured.selector);
        strat.deposit(1 ether, 0);
    }
}
