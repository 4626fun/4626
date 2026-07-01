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

/// @dev Simulates ShareOFT buy-side transfer fee (pool gross out > recipient net).
contract MockFeeOnTransferToken is MockToken {
    uint256 public transferFeeBps;

    constructor(string memory n, string memory s, uint256 _transferFeeBps) MockToken(n, s) {
        transferFeeBps = _transferFeeBps;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * transferFeeBps) / 10_000;
        return super.transfer(to, amount - fee);
    }
}

contract MockVault is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable creatorCoin;

    constructor(address _creatorCoin) ERC20("VaultShares", "VSH") {
        creatorCoin = IERC20(_creatorCoin);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        creatorCoin.safeTransferFrom(msg.sender, address(this), assets);
        shares = assets;
        _mint(receiver, shares);
    }
}

contract MockWrapper {
    using SafeERC20 for IERC20;

    IERC20 public immutable shareOFT;
    MockVault public immutable vault;
    uint256 public constant FACTOR = 1_000;

    constructor(address _shareOft, address _vault) {
        shareOFT = IERC20(_shareOft);
        vault = MockVault(_vault);
    }

    function unwrap(uint256 amount) external returns (uint256 amountOut) {
        shareOFT.safeTransferFrom(msg.sender, address(this), amount);
        amountOut = amount * FACTOR;
        vault.mint(msg.sender, amountOut);
    }
}

contract MockBurnStream {
    uint256 public queuedShares;

    function queueShares(uint256 shares) external {
        queuedShares += shares;
    }
}

contract MockGatingWrapper {
    using SafeERC20 for IERC20;

    IERC20 public immutable shareOFT;
    MockVault public immutable vault;
    uint256 public constant FACTOR = 1_000;

    mapping(address => bool) public isWhitelisted;

    error RouterNotWhitelisted(address router);

    constructor(address _shareOft, address _vault) {
        shareOFT = IERC20(_shareOft);
        vault = MockVault(_vault);
    }

    function setWhitelist(address user, bool status) external {
        isWhitelisted[user] = status;
    }

    function unwrap(uint256 amount) external returns (uint256 amountOut) {
        if (!isWhitelisted[msg.sender]) revert RouterNotWhitelisted(msg.sender);
        shareOFT.safeTransferFrom(msg.sender, address(this), amount);
        amountOut = amount * FACTOR;
        vault.mint(msg.sender, amountOut);
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

contract MockProtocolRewards {
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function withdraw(address, uint256) external pure {}
}

contract PayoutRouterTest is Test {
    MockToken internal creatorCoin;
    MockToken internal shareOft;
    MockToken internal usdc;
    MockToken internal weth;
    MockVault internal vault;
    MockWrapper internal wrapper;
    MockBurnStream internal burnStream;
    MockSwapRouterV3 internal swapRouter;
    MockExternalSwapTarget internal externalTarget;

    PayoutRouter internal router;
    MockProtocolRewards internal protocolRewards;

    function setUp() public {
        creatorCoin = new MockToken("Creator", "CR8R");
        shareOft = new MockToken("ShareOFT", "SHR");
        usdc = new MockToken("USDC", "USDC");
        weth = new MockToken("WETH", "WETH");

        vault = new MockVault(address(creatorCoin));
        wrapper = new MockWrapper(address(shareOft), address(vault));
        burnStream = new MockBurnStream();
        swapRouter = new MockSwapRouterV3();
        externalTarget = new MockExternalSwapTarget();
        protocolRewards = new MockProtocolRewards();

        router = new PayoutRouter(
            address(creatorCoin),
            address(vault),
            address(burnStream),
            address(shareOft),
            address(wrapper),
            address(this),
            address(swapRouter),
            address(weth),
            address(protocolRewards)
        );
    }

    function test_convertAndQueue_creatorCoinDirectDeposit() public {
        creatorCoin.mint(address(router), 30e18);

        (uint256 tokenOut, uint256 sharesQueued) = router.convertAndQueue(address(creatorCoin), 30e18, 0);
        assertEq(tokenOut, 30e18);
        assertEq(sharesQueued, 30e18);
        assertEq(vault.balanceOf(address(burnStream)), 30e18);
        assertEq(burnStream.queuedShares(), 30e18);
    }

    function test_convertAndQueue_sharePathViaSwapAndUnwrap() public {
        bytes memory path = _encodePath(address(usdc), 3000, address(shareOft));
        router.setSwapPath(address(usdc), path);
        swapRouter.setRate(address(usdc), address(shareOft), 2e18);
        shareOft.mint(address(swapRouter), 100e18);

        usdc.mint(address(router), 10e18);

        (uint256 tokenOut, uint256 sharesQueued) = router.convertAndQueue(address(usdc), 10e18, 15e18);
        assertEq(tokenOut, 20e18);
        assertEq(sharesQueued, 20_000e18);
        assertEq(vault.balanceOf(address(burnStream)), 20_000e18);
        assertEq(burnStream.queuedShares(), 20_000e18);
    }

    function test_convertAndQueue_sharePathUsesNetShareOftBalanceAfterBuyFee() public {
        MockFeeOnTransferToken feeShareOft = new MockFeeOnTransferToken("FeeShare", "FSHR", 690);
        MockWrapper feeWrapper = new MockWrapper(address(feeShareOft), address(vault));
        PayoutRouter feeRouter = new PayoutRouter(
            address(creatorCoin),
            address(vault),
            address(burnStream),
            address(feeShareOft),
            address(feeWrapper),
            address(this),
            address(swapRouter),
            address(weth),
            address(protocolRewards)
        );

        bytes memory path = _encodePath(address(usdc), 3000, address(feeShareOft));
        feeRouter.setSwapPath(address(usdc), path);
        swapRouter.setRate(address(usdc), address(feeShareOft), 2e18);
        feeShareOft.mint(address(swapRouter), 100e18);

        usdc.mint(address(feeRouter), 10e18);

        uint256 expectedGross = 20e18;
        uint256 expectedNet = (expectedGross * 9_310) / 10_000;

        (uint256 tokenOut, uint256 sharesQueued) = feeRouter.convertAndQueue(address(usdc), 10e18, expectedNet);
        assertEq(tokenOut, expectedNet);
        assertEq(sharesQueued, expectedNet * feeWrapper.FACTOR());
    }

    function test_convertViaExternalAndQueue_revertsWhenTargetNotApproved() public {
        usdc.mint(address(router), 10e18);
        shareOft.mint(address(externalTarget), 100e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.swapExactIn.selector,
            address(usdc),
            address(shareOft),
            10e18,
            11e18,
            address(router)
        );
        PayoutRouter.ExternalSwapParams memory params = PayoutRouter.ExternalSwapParams({
            tokenIn: address(usdc),
            amountIn: 10e18,
            minOut: 10e18,
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
        shareOft.mint(address(externalTarget), 500e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.swapExactIn.selector,
            address(usdc),
            address(shareOft),
            50e18,
            62e18,
            address(router)
        );
        PayoutRouter.ExternalSwapParams memory params = PayoutRouter.ExternalSwapParams({
            tokenIn: address(usdc),
            amountIn: 50e18,
            minOut: 60e18,
            spender: address(externalTarget),
            swapTarget: address(externalTarget),
            swapCallData: callData
        });

        (uint256 tokenOut, uint256 sharesQueued) = router.convertViaExternalAndQueue(params);
        assertEq(tokenOut, 62e18);
        assertEq(sharesQueued, 62_000e18);
        assertEq(burnStream.queuedShares(), 62_000e18);
        assertEq(usdc.allowance(address(router), address(externalTarget)), 0);
    }

    function test_convertViaExternalAndQueue_revertsWhenExternalCallTriesToExceedAllowance() public {
        router.setExternalSwapTargetApproval(address(externalTarget), true);
        router.setExternalSwapSpenderApproval(address(externalTarget), true);

        usdc.mint(address(router), 100e18);
        shareOft.mint(address(externalTarget), 500e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.overspendAll.selector, address(usdc), address(shareOft), 20e18, address(router)
        );
        PayoutRouter.ExternalSwapParams memory params = PayoutRouter.ExternalSwapParams({
            tokenIn: address(usdc),
            amountIn: 40e18,
            minOut: 20e18,
            spender: address(externalTarget),
            swapTarget: address(externalTarget),
            swapCallData: callData
        });

        vm.expectRevert();
        router.convertViaExternalAndQueue(params);
    }

    function test_convertAndQueue_sharePathRevertsWhenRouterNotWhitelistedOnWrapper() public {
        MockGatingWrapper gatingWrapper = new MockGatingWrapper(address(shareOft), address(vault));
        PayoutRouter gatedRouter = new PayoutRouter(
            address(creatorCoin),
            address(vault),
            address(burnStream),
            address(shareOft),
            address(gatingWrapper),
            address(this),
            address(swapRouter),
            address(weth),
            address(protocolRewards)
        );

        bytes memory path = _encodePath(address(usdc), 3000, address(shareOft));
        gatedRouter.setSwapPath(address(usdc), path);
        swapRouter.setRate(address(usdc), address(shareOft), 2e18);
        shareOft.mint(address(swapRouter), 100e18);
        usdc.mint(address(gatedRouter), 10e18);

        vm.expectRevert(abi.encodeWithSelector(MockGatingWrapper.RouterNotWhitelisted.selector, address(gatedRouter)));
        gatedRouter.convertAndQueue(address(usdc), 10e18, 15e18);
    }

    function test_convertAndQueue_sharePathSucceedsWhenRouterWhitelistedOnWrapper() public {
        MockGatingWrapper gatingWrapper = new MockGatingWrapper(address(shareOft), address(vault));
        PayoutRouter gatedRouter = new PayoutRouter(
            address(creatorCoin),
            address(vault),
            address(burnStream),
            address(shareOft),
            address(gatingWrapper),
            address(this),
            address(swapRouter),
            address(weth),
            address(protocolRewards)
        );
        gatingWrapper.setWhitelist(address(gatedRouter), true);

        bytes memory path = _encodePath(address(usdc), 3000, address(shareOft));
        gatedRouter.setSwapPath(address(usdc), path);
        swapRouter.setRate(address(usdc), address(shareOft), 2e18);
        shareOft.mint(address(swapRouter), 100e18);
        usdc.mint(address(gatedRouter), 10e18);

        (uint256 tokenOut, uint256 sharesQueued) = gatedRouter.convertAndQueue(address(usdc), 10e18, 15e18);
        assertEq(tokenOut, 20e18);
        assertEq(sharesQueued, 20_000e18);
    }

    function test_processBatch_supportsExternalAndDirectQueue() public {
        router.setExternalSwapTargetApproval(address(externalTarget), true);
        router.setExternalSwapSpenderApproval(address(externalTarget), true);

        usdc.mint(address(router), 25e18);
        creatorCoin.mint(address(router), 30e18);
        shareOft.mint(address(externalTarget), 500e18);

        bytes memory callData = abi.encodeWithSelector(
            MockExternalSwapTarget.swapExactIn.selector,
            address(usdc),
            address(shareOft),
            25e18,
            31e18,
            address(router)
        );

        PayoutRouter.BatchAction[] memory actions = new PayoutRouter.BatchAction[](2);
        actions[0] = PayoutRouter.BatchAction({
            kind: 1,
            tokenIn: address(usdc),
            amountIn: 25e18,
            minOut: 30e18,
            spender: address(externalTarget),
            swapTarget: address(externalTarget),
            swapCallData: callData
        });
        actions[1] = PayoutRouter.BatchAction({
            kind: 0,
            tokenIn: address(creatorCoin),
            amountIn: 30e18,
            minOut: 0,
            spender: address(0),
            swapTarget: address(0),
            swapCallData: bytes("")
        });

        (uint256 totalTokenOut, uint256 totalSharesQueued) = router.processBatch(actions);
        assertEq(totalTokenOut, 61e18);
        assertEq(totalSharesQueued, 31_000e18 + 30e18);
        assertEq(vault.balanceOf(address(burnStream)), 31_000e18 + 30e18);
        assertEq(burnStream.queuedShares(), 31_000e18 + 30e18);
    }

    function _encodePath(address tokenIn, uint24 fee, address tokenOut) internal pure returns (bytes memory) {
        return abi.encodePacked(tokenIn, fee, tokenOut);
    }

    function test_M04_constructorRevertsWhenProtocolRewardsHasNoCode() public {
        address eoa = address(0xDEAD);
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.ProtocolRewardsHasNoCode.selector, eoa));
        new PayoutRouter(
            address(creatorCoin),
            address(vault),
            address(burnStream),
            address(shareOft),
            address(wrapper),
            address(this),
            address(swapRouter),
            address(weth),
            eoa
        );
    }

    function test_M04_constructorAcceptsAddressZeroAsDefaultSelector() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                PayoutRouter.ProtocolRewardsHasNoCode.selector, router.DEFAULT_PROTOCOL_REWARDS()
            )
        );
        new PayoutRouter(
            address(creatorCoin),
            address(vault),
            address(burnStream),
            address(shareOft),
            address(wrapper),
            address(this),
            address(swapRouter),
            address(weth),
            address(0)
        );
    }
}
