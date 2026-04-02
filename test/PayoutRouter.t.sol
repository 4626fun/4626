// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {PayoutRouter, ISwapRouterV3} from "../contracts/utilities/routers/PayoutRouter.sol";

contract MockToken is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockVaultDeposit {
    using SafeERC20 for IERC20;

    IERC20 public immutable creatorCoin;
    uint256 public totalDeposited;
    mapping(address => uint256) public sharesByReceiver;

    constructor(address _creatorCoin) {
        creatorCoin = IERC20(_creatorCoin);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        creatorCoin.safeTransferFrom(msg.sender, address(this), assets);
        shares = assets;
        totalDeposited += assets;
        sharesByReceiver[receiver] += shares;
    }
}

contract MockBurnStream {
    uint256 public queuedShares;

    function queueShares(uint256 shares) external {
        queuedShares += shares;
    }
}

contract MockSwapRouterV3 {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public rateWad;

    function setRate(address tokenIn, address tokenOut, uint256 _rateWad) external {
        rateWad[tokenIn][tokenOut] = _rateWad;
    }

    function exactInput(ISwapRouterV3.ExactInputParams calldata params) external returns (uint256 amountOut) {
        address tokenIn = _readAddress(params.path, 0);
        address tokenOut = _readAddress(params.path, params.path.length - 20);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        uint256 r = rateWad[tokenIn][tokenOut];
        require(r > 0, "rate_not_set");

        amountOut = (params.amountIn * r) / 1e18;
        require(amountOut >= params.amountOutMinimum, "min_out");
        IERC20(tokenOut).safeTransfer(params.recipient, amountOut);
    }

    function _readAddress(bytes calldata data, uint256 offset) internal pure returns (address addr) {
        assembly {
            addr := shr(96, calldataload(add(data.offset, offset)))
        }
    }
}

contract MockExternalSwapTarget {
    using SafeERC20 for IERC20;

    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address recipient)
        external
    {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }

    function overspendAll(address tokenIn, address tokenOut, uint256 amountOut, address recipient) external {
        uint256 allIn = IERC20(tokenIn).balanceOf(msg.sender);
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), allIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}

contract PayoutRouterTest is Test {
    MockToken internal creatorCoin;
    MockToken internal usdc;
    MockToken internal weth;

    MockVaultDeposit internal vault;
    MockBurnStream internal burnStream;
    MockSwapRouterV3 internal swapRouter;
    MockExternalSwapTarget internal externalTarget;

    PayoutRouter internal router;

    function setUp() public {
        creatorCoin = new MockToken("Creator", "CR8R");
        usdc = new MockToken("USDC", "USDC");
        weth = new MockToken("WETH", "WETH");

        vault = new MockVaultDeposit(address(creatorCoin));
        burnStream = new MockBurnStream();
        swapRouter = new MockSwapRouterV3();
        externalTarget = new MockExternalSwapTarget();

        router = new PayoutRouter(
            address(creatorCoin), address(vault), address(burnStream), address(this), address(swapRouter), address(weth)
        );
    }

    function test_convertAndQueue_v3PathStillWorks() public {
        bytes memory path = _encodePath(address(usdc), 3000, address(creatorCoin));
        router.setSwapPath(address(usdc), path);
        swapRouter.setRate(address(usdc), address(creatorCoin), 2e18); // 1 in => 2 out

        usdc.mint(address(router), 10e18);
        creatorCoin.mint(address(swapRouter), 100e18);

        (uint256 creatorOut, uint256 sharesQueued) = router.convertAndQueue(address(usdc), 10e18, 15e18);
        assertEq(creatorOut, 20e18);
        assertEq(sharesQueued, 20e18);
        assertEq(vault.totalDeposited(), 20e18);
        assertEq(burnStream.queuedShares(), 20e18);
    }

    function test_convertViaExternalAndQueue_revertsWhenTargetNotApproved() public {
        usdc.mint(address(router), 10e18);
        creatorCoin.mint(address(externalTarget), 100e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.swapExactIn.selector,
            address(usdc),
            address(creatorCoin),
            10e18,
            11e18,
            address(router)
        );
        PayoutRouter.ExternalSwapParams memory params = PayoutRouter.ExternalSwapParams({
            tokenIn: address(usdc),
            amountIn: 10e18,
            minCreatorOut: 10e18,
            spender: address(externalTarget),
            swapTarget: address(externalTarget),
            swapCallData: callData
        });

        vm.expectRevert(
            abi.encodeWithSelector(PayoutRouter.ExternalSwapTargetNotApproved.selector, address(externalTarget))
        );
        router.convertViaExternalAndQueue(params);
    }

    function test_convertViaExternalAndQueue_succeedsAndQueues() public {
        router.setExternalSwapTargetApproval(address(externalTarget), true);
        router.setExternalSwapSpenderApproval(address(externalTarget), true);

        usdc.mint(address(router), 50e18);
        creatorCoin.mint(address(externalTarget), 500e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.swapExactIn.selector,
            address(usdc),
            address(creatorCoin),
            50e18,
            62e18,
            address(router)
        );
        PayoutRouter.ExternalSwapParams memory params = PayoutRouter.ExternalSwapParams({
            tokenIn: address(usdc),
            amountIn: 50e18,
            minCreatorOut: 60e18,
            spender: address(externalTarget),
            swapTarget: address(externalTarget),
            swapCallData: callData
        });

        (uint256 creatorOut, uint256 sharesQueued) = router.convertViaExternalAndQueue(params);
        assertEq(creatorOut, 62e18);
        assertEq(sharesQueued, 62e18);
        assertEq(vault.totalDeposited(), 62e18);
        assertEq(burnStream.queuedShares(), 62e18);
        assertEq(usdc.allowance(address(router), address(externalTarget)), 0);
    }

    function test_convertViaExternalAndQueue_revertsWhenExternalCallTriesToExceedAllowance() public {
        router.setExternalSwapTargetApproval(address(externalTarget), true);
        router.setExternalSwapSpenderApproval(address(externalTarget), true);

        usdc.mint(address(router), 100e18);
        creatorCoin.mint(address(externalTarget), 500e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.overspendAll.selector, address(usdc), address(creatorCoin), 20e18, address(router)
        );
        PayoutRouter.ExternalSwapParams memory params = PayoutRouter.ExternalSwapParams({
            tokenIn: address(usdc),
            amountIn: 40e18,
            minCreatorOut: 20e18,
            spender: address(externalTarget),
            swapTarget: address(externalTarget),
            swapCallData: callData
        });

        vm.expectRevert();
        router.convertViaExternalAndQueue(params);
    }

    function test_processBatch_supportsExternalAndDirectQueue() public {
        router.setExternalSwapTargetApproval(address(externalTarget), true);
        router.setExternalSwapSpenderApproval(address(externalTarget), true);

        usdc.mint(address(router), 25e18);
        creatorCoin.mint(address(router), 30e18);
        creatorCoin.mint(address(externalTarget), 500e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.swapExactIn.selector,
            address(usdc),
            address(creatorCoin),
            25e18,
            31e18,
            address(router)
        );

        PayoutRouter.BatchAction[] memory actions = new PayoutRouter.BatchAction[](2);
        actions[0] = PayoutRouter.BatchAction({
            kind: 1,
            tokenIn: address(usdc),
            amountIn: 25e18,
            minCreatorOut: 30e18,
            spender: address(externalTarget),
            swapTarget: address(externalTarget),
            swapCallData: callData
        });
        actions[1] = PayoutRouter.BatchAction({
            kind: 0,
            tokenIn: address(creatorCoin),
            amountIn: 30e18,
            minCreatorOut: 0,
            spender: address(0),
            swapTarget: address(0),
            swapCallData: bytes("")
        });

        (uint256 totalCreatorOut, uint256 totalSharesQueued) = router.processBatch(actions);
        assertEq(totalCreatorOut, 61e18);
        assertEq(totalSharesQueued, 61e18);
        assertEq(vault.totalDeposited(), 61e18);
        assertEq(burnStream.queuedShares(), 61e18);
    }

    function _encodePath(address tokenIn, uint24 fee, address tokenOut) internal pure returns (bytes memory) {
        return abi.encodePacked(tokenIn, fee, tokenOut);
    }
}

