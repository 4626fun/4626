// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LimitOrderStrategy, LimitOrder} from "../contracts/vault/strategies/univ4/LimitOrderStrategy.sol";

contract ERC20MockForLimitOrderBoundary {
    string public name;
    string public symbol;
    uint8 public decimals;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }
}

contract LimitOrderStrategyHarness is LimitOrderStrategy {
    constructor(address creatorCoin, address pairedToken, address owner_)
        LimitOrderStrategy(creatorCoin, pairedToken, address(this), owner_)
    {}

    function pushOrderForTest(int24 tickLower, int24 tickUpper, bool isBuyOrder) external {
        orders.push(
            LimitOrder({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidity: 1,
                tokenId: 0,
                isBuyOrder: isBuyOrder,
                createdAt: block.timestamp,
                isActive: true
            })
        );
    }

    function isOrderFilledForTest(uint256 index, int24 currentTick) external view returns (bool) {
        LimitOrder storage order = orders[index];
        return _isOrderFilled(order, currentTick);
    }
}

contract LimitOrderStrategyTickBoundaryTest is Test {
    LimitOrderStrategyHarness internal strategy;

    function setUp() public {
        ERC20MockForLimitOrderBoundary creator = new ERC20MockForLimitOrderBoundary("Creator", "CRT", 18);
        ERC20MockForLimitOrderBoundary paired = new ERC20MockForLimitOrderBoundary("Paired", "PRD", 18);
        strategy = new LimitOrderStrategyHarness(address(creator), address(paired), address(this));
    }

    function test_buyOrder_notFilled_atTickLowerBoundary() public {
        strategy.pushOrderForTest(100, 160, true);
        assertFalse(strategy.isOrderFilledForTest(0, 100), "buy order should not fill at tickLower");
    }

    function test_buyOrder_filled_belowTickLower() public {
        strategy.pushOrderForTest(100, 160, true);
        assertTrue(strategy.isOrderFilledForTest(0, 99), "buy order should fill below tickLower");
    }

    function test_sellOrder_filled_atTickUpperBoundary() public {
        strategy.pushOrderForTest(100, 160, false);
        assertTrue(strategy.isOrderFilledForTest(0, 160), "sell order should fill at tickUpper");
    }

    function test_sellOrder_notFilled_belowTickUpper() public {
        strategy.pushOrderForTest(100, 160, false);
        assertFalse(strategy.isOrderFilledForTest(0, 159), "sell order should not fill below tickUpper");
    }
}
