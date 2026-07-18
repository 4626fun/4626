// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {RouterParameters} from "universal-router/types/RouterParameters.sol";
import {IAllowanceTransfer} from "lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";

import {RoyaltyRegistry} from "lib/sudoswap-lssvm2/lib/royalty-registry-solidity/contracts/RoyaltyRegistry.sol";
import {IERC1155} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {ERC20} from "lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";

import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {VeryFastRouter} from "sudoswap/VeryFastRouter.sol";
import {RoyaltyEngine} from "sudoswap/RoyaltyEngine.sol";
import {XykCurve} from "sudoswap/bonding-curves/XykCurve.sol";
import {CurveErrorCodes} from "sudoswap/bonding-curves/CurveErrorCodes.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";
import {Test1155} from "sudoswap/mocks/Test1155.sol";
import {Test20} from "sudoswap/mocks/Test20.sol";

import {AlfaClubCommands} from "contracts/other/alfaclub/universal-router/AlfaClubCommands.sol";
import {AlfaClubSudoswapAdapter} from "contracts/other/alfaclub/universal-router/AlfaClubSudoswapAdapter.sol";
import {AlfaClubUniversalRouter} from "contracts/other/alfaclub/universal-router/AlfaClubUniversalRouter.sol";

import {DeploySudoswapV2Base} from "alfaclub/contracts/script/DeploySudoswapV2Base.s.sol";
import {DeployAlfaClubUniversalRouterBase} from "alfaclub/contracts/script/DeployAlfaClubUniversalRouterBase.s.sol";
import {CreateRoom1659SudoswapPair} from "alfaclub/contracts/script/CreateRoom1659SudoswapPair.s.sol";

interface ILifecycleUniswapV2Pair {
    function initialize(address token0, address token1) external;

    function sync() external;
}

contract LifecycleCanonicalV2Pair {
    error AlreadyInitialized();
    error InvalidSwap();
    error InvariantViolation();

    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    function initialize(address token0_, address token1_) external {
        if (token0 != address(0) || token1 != address(0)) revert AlreadyInitialized();
        token0 = token0_;
        token1 = token1_;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function sync() external {
        _update();
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata) external {
        if ((amount0Out == 0 && amount1Out == 0) || amount0Out >= reserve0 || amount1Out >= reserve1) {
            revert InvalidSwap();
        }
        if (amount0Out != 0 && !ERC20(token0).transfer(to, amount0Out)) revert InvalidSwap();
        if (amount1Out != 0 && !ERC20(token1).transfer(to, amount1Out)) revert InvalidSwap();

        uint256 balance0 = ERC20(token0).balanceOf(address(this));
        uint256 balance1 = ERC20(token1).balanceOf(address(this));
        uint256 amount0In = balance0 > uint256(reserve0) - amount0Out ? balance0 - (uint256(reserve0) - amount0Out) : 0;
        uint256 amount1In = balance1 > uint256(reserve1) - amount1Out ? balance1 - (uint256(reserve1) - amount1Out) : 0;
        if (amount0In == 0 && amount1In == 0) revert InvalidSwap();

        uint256 balance0Adjusted = balance0 * 1_000 - amount0In * 3;
        uint256 balance1Adjusted = balance1 * 1_000 - amount1In * 3;
        if (balance0Adjusted * balance1Adjusted < uint256(reserve0) * uint256(reserve1) * 1_000_000) {
            revert InvariantViolation();
        }
        _update();
    }

    function _update() private {
        uint256 balance0 = ERC20(token0).balanceOf(address(this));
        uint256 balance1 = ERC20(token1).balanceOf(address(this));
        if (balance0 > type(uint112).max || balance1 > type(uint112).max) revert InvariantViolation();
        // Bounds checked above.
        // forge-lint: disable-next-line(unsafe-typecast)
        reserve0 = uint112(balance0);
        // forge-lint: disable-next-line(unsafe-typecast)
        reserve1 = uint112(balance1);
        // Timestamp truncation is the canonical Uniswap v2 reserve layout and
        // is not used by the router path under test.
        // forge-lint: disable-next-line(unsafe-typecast)
        blockTimestampLast = uint32(block.timestamp);
    }
}

contract LifecycleSafe {
    error SafeCallFailed(bytes reason);

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        (bool success, bytes memory output) = target.call(data);
        if (!success) revert SafeCallFailed(output);
        return output;
    }
}

contract LifecycleSudoswapDeployHarness is DeploySudoswapV2Base {
    function runWithConfig(DeployConfig calldata config)
        external
        returns (
            RoyaltyEngine royaltyEngine,
            LSSVMPairFactory factory,
            XykCurve xykCurve,
            VeryFastRouter veryFastRouter
        )
    {
        return _run(config);
    }
}

contract LifecycleRouterDeployHarness is DeployAlfaClubUniversalRouterBase {
    function runWithConfig(DeployConfig calldata config) external returns (Deployment memory deployment) {
        deployment = _run(config);
    }
}

contract LifecyclePairCreateHarness is CreateRoom1659SudoswapPair {
    function runWithConfig(PairConfig calldata config) external returns (LSSVMPairERC1155ERC20 pair) {
        pair = _run(config);
    }
}

/**
 * @notice Rehearses the production lifecycle as one flow: deploy the pinned
 * Sudoswap stack, deploy the adapter/router at predicted EOA CREATE addresses,
 * seed Room 1659, apply the two Safe-owned configuration calls, and execute
 * atomic Uniswap v2 -> Sudoswap and Sudoswap -> Uniswap v2 routes.
 */
contract AlfaClubSudoswapProductionLifecycleTest is Test {
    uint256 private constant SUDOSWAP_DEPLOYER_KEY = 0xA11CE;
    uint256 private constant ROUTER_DEPLOYER_KEY = 0xB0B;
    uint256 private constant SEEDER_KEY = 0xC0FFEE;
    uint256 private constant ROOM_TOKEN_ID = 1659;
    uint256 private constant PAIR_FEE = 0.069e18;
    address private constant PAYER = address(0xBEEF);
    address private constant SINK = address(0xCAFE);

    LifecycleSafe private safe;
    LifecycleSudoswapDeployHarness private sudoswapScript;
    LifecycleRouterDeployHarness private routerScript;
    LifecyclePairCreateHarness private pairScript;

    LSSVMPairFactory private factory;
    XykCurve private xykCurve;
    AlfaClubSudoswapAdapter private adapter;
    AlfaClubUniversalRouter private router;
    LSSVMPairERC1155ERC20 private pair;
    Test1155 private friendKey;
    Test20 private creatorCoin;
    Test20 private inputToken;
    IAllowanceTransfer private permit2;
    ILifecycleUniswapV2Pair private uniswapV2Pair;

    function setUp() public {
        vm.chainId(8453);
        safe = new LifecycleSafe();
        sudoswapScript = new LifecycleSudoswapDeployHarness();
        routerScript = new LifecycleRouterDeployHarness();
        pairScript = new LifecyclePairCreateHarness();

        _etchProductionAddressDependencies();
        _fundDeploymentAccounts();
        _deployProductionContracts();
        _seedRoom1659Pair();
        _executeSafeConfiguration();
        _seedUniswapV2Liquidity();
        _approvePayerAssets();
    }

    function testProductionLifecycleExecutesBothAtomicRoutedDirections() public {
        assertEq(factory.owner(), address(safe), "Safe owns factory");
        assertEq(adapter.owner(), address(safe), "Safe owns adapter");
        assertEq(adapter.universalRouter(), address(router), "adapter router immutable");
        assertEq(address(router.SUDOSWAP_ADAPTER()), address(adapter), "router adapter immutable");
        assertEq(pair.owner(), address(safe), "Safe owns pair");
        assertEq(pair.fee(), PAIR_FEE, "Room 1659 fee");
        assertTrue(factory.isValidPair(address(pair)), "official pair");
        (bool adapterAllowed,) = factory.routerStatus(LSSVMRouter(payable(address(adapter))));
        assertFalse(adapterAllowed, "direct path requires no factory router privilege");
        (address marketCoin, uint256 marketTokenId, bool marketAllowed) = adapter.markets(address(pair));
        assertEq(marketCoin, address(creatorCoin), "market Creator Coin");
        assertEq(marketTokenId, ROOM_TOKEN_ID, "market token ID");
        assertTrue(marketAllowed, "market enabled");

        uint256 inputAmount = 20 ether;
        uint256 payerInputBefore = inputToken.balanceOf(PAYER);
        address[] memory buyPath = new address[](2);
        buyPath[0] = address(inputToken);
        buyPath[1] = address(creatorCoin);
        uint256[] memory noHopPriceLimits = new uint256[](0);

        bytes memory buyCommands = abi.encodePacked(
            bytes1(uint8(AlfaClubCommands.V2_SWAP_EXACT_IN)), bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY))
        );
        bytes[] memory buyInputs = new bytes[](2);
        buyInputs[0] = abi.encode(PAYER, inputAmount, 1, buyPath, true, noHopPriceLimits);
        buyInputs[1] = abi.encode(address(pair), PAYER, 1, 10 ether, true);

        vm.prank(PAYER);
        router.execute(buyCommands, buyInputs, block.timestamp + 1);

        assertEq(inputToken.balanceOf(PAYER), payerInputBefore - inputAmount, "input token spent");
        assertEq(friendKey.balanceOf(PAYER, ROOM_TOKEN_ID), 1, "Room key bought");

        uint256 unusedCreatorCoin = creatorCoin.balanceOf(PAYER);
        vm.prank(PAYER);
        assertTrue(creatorCoin.transfer(SINK, unusedCreatorCoin), "clear unused Creator Coin");
        assertEq(creatorCoin.balanceOf(PAYER), 0, "sell route starts without Creator Coin");

        (CurveErrorCodes.Error quoteError,,, uint256 sellOutput,,) = pair.getSellNFTQuote(ROOM_TOKEN_ID, 1);
        assertEq(uint256(quoteError), uint256(CurveErrorCodes.Error.OK), "sell quote");
        assertGt(sellOutput, 0, "sell output");

        address[] memory sellPath = new address[](2);
        sellPath[0] = address(creatorCoin);
        sellPath[1] = address(inputToken);
        bytes memory sellCommands = abi.encodePacked(
            bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_SELL)), bytes1(uint8(AlfaClubCommands.V2_SWAP_EXACT_IN))
        );
        bytes[] memory sellInputs = new bytes[](2);
        sellInputs[0] = abi.encode(address(pair), PAYER, 1, 1, true);
        sellInputs[1] = abi.encode(PAYER, sellOutput, 1, sellPath, true, noHopPriceLimits);

        uint256 payerInputBeforeSell = inputToken.balanceOf(PAYER);
        vm.prank(PAYER);
        router.execute(sellCommands, sellInputs, block.timestamp + 1);

        assertEq(friendKey.balanceOf(PAYER, ROOM_TOKEN_ID), 0, "Room key sold");
        assertEq(creatorCoin.balanceOf(PAYER), 0, "Creator Coin consumed atomically");
        assertGt(inputToken.balanceOf(PAYER), payerInputBeforeSell, "input token received");
    }

    function _etchProductionAddressDependencies() private {
        RoyaltyRegistry registryRuntime = new RoyaltyRegistry(address(0));
        vm.etch(sudoswapScript.BASE_MANIFOLD_ROYALTY_REGISTRY(), address(registryRuntime).code);
        RoyaltyRegistry(sudoswapScript.BASE_MANIFOLD_ROYALTY_REGISTRY()).initialize(address(this));

        Test1155 friendKeyRuntime = new Test1155();
        Test20 creatorCoinRuntime = new Test20();
        vm.etch(routerScript.ALFA_CLUB_FRIEND_KEY(), address(friendKeyRuntime).code);
        vm.etch(pairScript.AKITA_CREATOR_COIN(), address(creatorCoinRuntime).code);
        friendKey = Test1155(routerScript.ALFA_CLUB_FRIEND_KEY());
        creatorCoin = Test20(pairScript.AKITA_CREATOR_COIN());

        address permit2Runtime = vm.deployCode("CompilePermit2.sol:CompilePermit2");
        vm.etch(routerScript.BASE_PERMIT2(), permit2Runtime.code);
        permit2 = IAllowanceTransfer(routerScript.BASE_PERMIT2());

        RouterParameters memory parameters = routerScript.baseRouterParameters();
        bytes memory stopRuntime = hex"00";
        vm.etch(parameters.v2Factory, stopRuntime);
        vm.etch(parameters.weth9, stopRuntime);
        vm.etch(parameters.v3Factory, stopRuntime);
        vm.etch(parameters.v4PoolManager, stopRuntime);
        vm.etch(parameters.v3NFTPositionManager, stopRuntime);
        vm.etch(parameters.v4PositionManager, stopRuntime);
        vm.etch(parameters.spokePool, stopRuntime);
    }

    function _fundDeploymentAccounts() private {
        vm.deal(vm.addr(SUDOSWAP_DEPLOYER_KEY), 100 ether);
        vm.deal(vm.addr(ROUTER_DEPLOYER_KEY), 100 ether);
        vm.deal(vm.addr(SEEDER_KEY), 100 ether);
    }

    function _deployProductionContracts() private {
        (, factory, xykCurve,) = sudoswapScript.runWithConfig(
            DeploySudoswapV2Base.DeployConfig({
                privateKey: SUDOSWAP_DEPLOYER_KEY,
                factoryOwner: address(safe),
                protocolFeeRecipient: payable(address(safe)),
                protocolFeeMultiplier: 0,
                allowNonBase: false
            })
        );

        address routerDeployer = vm.addr(ROUTER_DEPLOYER_KEY);
        DeployAlfaClubUniversalRouterBase.Deployment memory deployment = routerScript.runWithConfig(
            DeployAlfaClubUniversalRouterBase.DeployConfig({
                privateKey: ROUTER_DEPLOYER_KEY,
                expectedDeployerNonce: vm.getNonce(routerDeployer),
                factory: factory,
                xykCurve: xykCurve,
                adapterOwner: address(safe)
            })
        );
        adapter = deployment.adapter;
        router = deployment.router;
    }

    function _seedRoom1659Pair() private {
        address seeder = vm.addr(SEEDER_KEY);
        friendKey.mint(seeder, ROOM_TOKEN_ID, 50);
        creatorCoin.mint(seeder, 500 ether);

        pair = pairScript.runWithConfig(
            CreateRoom1659SudoswapPair.PairConfig({
                privateKey: SEEDER_KEY,
                factory: factory,
                xykCurve: xykCurve,
                pairOwner: address(safe),
                initialKeyBalance: 50,
                initialCreatorCoinBalance: 500 ether,
                virtualKeyReserve: 100,
                virtualCreatorCoinReserve: 100 ether,
                pairFee: PAIR_FEE
            })
        );
    }

    function _executeSafeConfiguration() private {
        safe.execute(
            address(adapter),
            abi.encodeCall(
                AlfaClubSudoswapAdapter.setMarket, (address(pair), address(creatorCoin), ROOM_TOKEN_ID, true)
            )
        );
    }

    function _seedUniswapV2Liquidity() private {
        inputToken = new Test20();
        (address token0, address token1) = address(inputToken) < address(creatorCoin)
            ? (address(inputToken), address(creatorCoin))
            : (address(creatorCoin), address(inputToken));
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        address canonicalPair = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex"ff", routerScript.BASE_V2_FACTORY(), salt, routerScript.BASE_V2_PAIR_INIT_CODE_HASH()
                        )
                    )
                )
            )
        );
        LifecycleCanonicalV2Pair pairRuntime = new LifecycleCanonicalV2Pair();
        vm.etch(canonicalPair, address(pairRuntime).code);
        uniswapV2Pair = ILifecycleUniswapV2Pair(canonicalPair);
        uniswapV2Pair.initialize(token0, token1);
        inputToken.mint(address(this), 1_000 ether);
        creatorCoin.mint(address(this), 1_000 ether);
        assertTrue(inputToken.transfer(address(uniswapV2Pair), 1_000 ether), "seed input token");
        assertTrue(creatorCoin.transfer(address(uniswapV2Pair), 1_000 ether), "seed Creator Coin");
        uniswapV2Pair.sync();
    }

    function _approvePayerAssets() private {
        inputToken.mint(PAYER, 100 ether);
        vm.startPrank(PAYER);
        inputToken.approve(address(permit2), type(uint256).max);
        creatorCoin.approve(address(permit2), type(uint256).max);
        permit2.approve(address(inputToken), address(router), type(uint160).max, type(uint48).max);
        permit2.approve(address(creatorCoin), address(router), type(uint160).max, type(uint48).max);
        permit2.approve(address(creatorCoin), address(adapter), type(uint160).max, type(uint48).max);
        IERC1155(address(friendKey)).setApprovalForAll(address(adapter), true);
        vm.stopPrank();
    }
}
