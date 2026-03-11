// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/governance/CreatorGaugeController.sol";

contract MockToken is IERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

    contract MockVault is MockToken {
        IERC20 public immutable creatorAsset;

        constructor(address _creatorAsset) MockToken("Mock Vault Share", "mVS") {
            creatorAsset = IERC20(_creatorAsset);
        }

        function burnSharesForPriceIncrease(uint256 shares) external {
            balanceOf[msg.sender] -= shares;
            totalSupply -= shares;
            emit Transfer(msg.sender, address(0), shares);
        }

        function pricePerShare() external pure returns (uint256) {
            return 1e18;
        }

        function totalAssets() external view returns (uint256) {
            return creatorAsset.balanceOf(address(this));
        }

        function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
            creatorAsset.transferFrom(msg.sender, address(this), assets);
            shares = assets;
            totalSupply += shares;
            balanceOf[receiver] += shares;
            emit Transfer(address(0), receiver, shares);
        }

        function asset() external view returns (address) {
            return address(creatorAsset);
        }
    }

    contract MockCreatorOracle is ICreatorOracle {
        bool public shouldRevert;
        uint256 public creatorPerEth;
        bool public priceFresh = true;

        function setShouldRevert(bool _shouldRevert) external {
            shouldRevert = _shouldRevert;
        }

        function setCreatorPerEth(uint256 _creatorPerEth) external {
            creatorPerEth = _creatorPerEth;
        }

        function setPriceFresh(bool _fresh) external {
            priceFresh = _fresh;
        }

        function getCreatorPrice() external view returns (int256, uint256) {
            return (1e8, block.timestamp);
        }

        function getEthPrice() external view returns (int256, uint256) {
            return (3000e8, block.timestamp);
        }

        function getCreatorEthTWAP(uint32) external view returns (uint256) {
            if (shouldRevert) revert("oracle unavailable");
            return creatorPerEth;
        }

        function isPriceFresh() external view returns (bool) {
            return priceFresh;
        }
    }

    contract MockSwapRouter is ISwapRouter {
        bool public shouldRevert;
        uint256 public amountOut;
        uint256 public lastAmountOutMinimum;
        uint256 public lastAmountIn;
        uint160 public lastSqrtPriceLimitX96;

        function setShouldRevert(bool _shouldRevert) external {
            shouldRevert = _shouldRevert;
        }

        function setAmountOut(uint256 _amountOut) external {
            amountOut = _amountOut;
        }

        function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 out) {
            if (shouldRevert) revert("router reverted");

            lastAmountOutMinimum = params.amountOutMinimum;
            lastAmountIn = params.amountIn;
            lastSqrtPriceLimitX96 = params.sqrtPriceLimitX96;
            if (amountOut < params.amountOutMinimum) revert("insufficient output");

            IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
            IERC20(params.tokenOut).transfer(params.recipient, amountOut);
            return amountOut;
        }
    }

    contract CreatorGaugeControllerTest is Test {
        address internal constant WETH_ADDR = 0x4200000000000000000000000000000000000006;
        address internal constant SWAP_ROUTER_ADDR = 0x2626664c2603336E57B271c5C0b26F421741e481;

        CreatorGaugeController internal gauge;
        MockToken internal weth;
        MockToken internal creatorCoin;
        MockToken internal shareOFT;
        MockVault internal vault;
        MockCreatorOracle internal oracle;
        MockSwapRouter internal router;

        address internal alice = makeAddr("alice");
        address internal creatorTreasury = makeAddr("creatorTreasury");
        address internal protocolTreasury = makeAddr("protocolTreasury");

        function setUp() public {
            MockToken wethImpl = new MockToken("Wrapped Ether", "WETH");
            vm.etch(WETH_ADDR, address(wethImpl).code);
            weth = MockToken(WETH_ADDR);

            MockSwapRouter routerImpl = new MockSwapRouter();
            vm.etch(SWAP_ROUTER_ADDR, address(routerImpl).code);
            router = MockSwapRouter(SWAP_ROUTER_ADDR);

            creatorCoin = new MockToken("Creator Coin", "CREATOR");
            shareOFT = new MockToken("Share OFT", "SHARE");
            vault = new MockVault(address(creatorCoin));
            oracle = new MockCreatorOracle();

            gauge = new CreatorGaugeController(address(shareOFT), creatorTreasury, protocolTreasury, address(this));
            gauge.setVault(address(vault));
            gauge.setCreatorCoin(address(creatorCoin));
        }

        function test_processWETHFees_reverts_whenOracleUnset() public {
            uint256 amount = 5 ether;
            _depositPendingWeth(amount);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFees();

            assertEq(gauge.pendingWETHFees(), amount);
        }

        function test_processWETHFees_reverts_whenOracleCallFails() public {
            uint256 amount = 5 ether;
            _depositPendingWeth(amount);

            gauge.setOracle(address(oracle));
            oracle.setShouldRevert(true);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFees();

            assertEq(gauge.pendingWETHFees(), amount);
        }

        function test_processWETHFees_reverts_whenOracleReturnsZero() public {
            uint256 amount = 5 ether;
            _depositPendingWeth(amount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(0);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFees();

            assertEq(gauge.pendingWETHFees(), amount);
        }

        function test_receiveWETHFees_skipsAutoProcess_whenOracleUnavailable() public {
            uint256 amount = 20 ether; // >= distributionThreshold / 10
            vm.warp(gauge.distributionInterval() + 1);

            weth.mint(alice, amount);
            vm.startPrank(alice);
            weth.approve(address(gauge), amount);
            gauge.receiveWETHFees(amount);
            vm.stopPrank();

            assertEq(gauge.pendingWETHFees(), amount);
            assertEq(weth.balanceOf(address(gauge)), amount);
        }

        function test_processWETHFees_usesNonZeroMinOut_andProcesses() public {
            uint256 wethAmount = 5 ether;
            uint256 creatorPerEth = 2e18;
            uint256 creatorOut = 10 ether;

            _depositPendingWeth(wethAmount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(creatorPerEth);

            creatorCoin.mint(SWAP_ROUTER_ADDR, creatorOut);
            router.setAmountOut(creatorOut);

            uint256 expectedOut = (wethAmount * creatorPerEth) / 1e18;
            uint256 expectedMinOut = (expectedOut * (10000 - gauge.swapSlippageBps())) / 10000;

            gauge.processWETHFees();

            assertGt(expectedMinOut, 0);
            assertEq(router.lastAmountOutMinimum(), expectedMinOut);
            assertEq(gauge.pendingWETHFees(), 0);
            assertGt(gauge.jackpotReserve(), 0);
        }

        function test_processWETHFees_permissionless_reverts_whenCapZero() public {
            uint256 wethAmount = 5 ether;
            uint256 creatorPerEth = 2e18;
            uint256 creatorOut = 10 ether;

            _depositPendingWeth(wethAmount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(creatorPerEth);

            creatorCoin.mint(SWAP_ROUTER_ADDR, creatorOut);
            router.setAmountOut(creatorOut);

            vm.startPrank(alice);
            vm.expectRevert(CreatorGaugeController.NotAuthorized.selector);
            gauge.processWETHFees();
            vm.stopPrank();

            // State should be unchanged on revert
            assertEq(gauge.pendingWETHFees(), wethAmount);
            assertEq(weth.balanceOf(address(gauge)), wethAmount);
        }

        function test_processWETHFees_permissionless_processesUpToCap_whenEnabled() public {
            uint256 totalWeth = 20 ether;
            uint256 cap = 5 ether;
            uint256 creatorPerEth = 2e18;

            _depositPendingWeth(totalWeth);

            // Enable permissionless processing cap (new config).
            gauge.setWethProcessingConfig(cap, false);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(creatorPerEth);

            // Configure router output for the capped amount only.
            uint256 creatorOut = cap * creatorPerEth / 1e18;
            creatorCoin.mint(SWAP_ROUTER_ADDR, creatorOut);
            router.setAmountOut(creatorOut);

            vm.prank(alice);
            gauge.processWETHFees();

            assertEq(router.lastAmountIn(), cap);
            assertEq(gauge.pendingWETHFees(), totalWeth - cap);
        }

        function test_processWETHFees_reverts_whenOracleStale() public {
            uint256 wethAmount = 5 ether;
            uint256 creatorPerEth = 2e18;
            uint256 creatorOut = 10 ether;

            _depositPendingWeth(wethAmount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(creatorPerEth);
            oracle.setPriceFresh(false);

            creatorCoin.mint(SWAP_ROUTER_ADDR, creatorOut);
            router.setAmountOut(creatorOut);

            vm.expectRevert(CreatorGaugeController.MinOutputUnavailable.selector);
            gauge.processWETHFees();

            assertEq(gauge.pendingWETHFees(), wethAmount);
        }

        function test_processWETHFees_passesNonZeroSqrtPriceLimit() public {
            uint256 wethAmount = 5 ether;
            uint256 creatorPerEth = 2e18;
            uint256 creatorOut = 10 ether;

            _depositPendingWeth(wethAmount);

            gauge.setOracle(address(oracle));
            oracle.setCreatorPerEth(creatorPerEth);

            creatorCoin.mint(SWAP_ROUTER_ADDR, creatorOut);
            router.setAmountOut(creatorOut);

            gauge.processWETHFees();

            assertGt(router.lastSqrtPriceLimitX96(), 0);
        }

        function _depositPendingWeth(uint256 amount) internal {
            weth.mint(alice, amount);
            vm.startPrank(alice);
            weth.approve(address(gauge), amount);
            gauge.receiveWETHFees(amount);
            vm.stopPrank();
        }
    }
