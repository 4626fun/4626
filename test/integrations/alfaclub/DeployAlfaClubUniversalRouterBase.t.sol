// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {RouterParameters} from "universal-router/types/RouterParameters.sol";
import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {ICurve} from "sudoswap/bonding-curves/ICurve.sol";

import {
    DeployAlfaClubUniversalRouterBase
} from "../../../alfaclub/contracts/script/DeployAlfaClubUniversalRouterBase.s.sol";

contract MockAlfaClubRouterAdmin {}

contract MockAlfaClubXykCurve {}

contract MockAlfaClubSudoswapFactory {
    struct RouterStatus {
        bool allowed;
        bool wasEverTouched;
    }

    address public owner;
    mapping(address curve => bool allowed) private _curves;
    mapping(address router => RouterStatus status) private _routers;
    uint256 public setRouterAllowedCalls;

    constructor(address owner_) {
        owner = owner_;
    }

    function setOwner(address owner_) external {
        owner = owner_;
    }

    function setCurve(address curve, bool allowed) external {
        _curves[curve] = allowed;
    }

    function setRouterStatus(address router, bool allowed, bool wasEverTouched) external {
        _routers[router] = RouterStatus({allowed: allowed, wasEverTouched: wasEverTouched});
    }

    function bondingCurveAllowed(ICurve curve) external view returns (bool) {
        return _curves[address(curve)];
    }

    function routerStatus(LSSVMRouter router) external view returns (bool allowed, bool wasEverTouched) {
        RouterStatus memory status = _routers[address(router)];
        return (status.allowed, status.wasEverTouched);
    }

    function setRouterAllowed(LSSVMRouter router, bool allowed) external {
        setRouterAllowedCalls++;
        _routers[address(router)] = RouterStatus({allowed: allowed, wasEverTouched: true});
    }
}

contract DeployAlfaClubUniversalRouterBaseTest is Test {
    uint256 private constant DEPLOYER_PRIVATE_KEY = 0xA11CE;
    uint64 private constant DEPLOYER_NONCE = 17;

    DeployAlfaClubUniversalRouterBase private script;
    MockAlfaClubRouterAdmin private admin;
    MockAlfaClubXykCurve private xykCurve;
    MockAlfaClubSudoswapFactory private factory;
    address private deployer;

    function setUp() public {
        vm.chainId(8453);

        script = new DeployAlfaClubUniversalRouterBase();
        admin = new MockAlfaClubRouterAdmin();
        xykCurve = new MockAlfaClubXykCurve();
        factory = new MockAlfaClubSudoswapFactory(address(admin));
        factory.setCurve(address(xykCurve), true);

        deployer = vm.addr(DEPLOYER_PRIVATE_KEY);
        vm.deal(deployer, 100 ether);
        vm.setNonce(deployer, DEPLOYER_NONCE);

        _etchPinnedBaseDependencies();
        _setRequiredEnvironment();
    }

    function testDeploysCircularImmutablesAtConsecutiveEoaCreateAddresses() public {
        address expectedAdapter = vm.computeCreateAddress(deployer, DEPLOYER_NONCE);
        address expectedRouter = vm.computeCreateAddress(deployer, uint256(DEPLOYER_NONCE) + 1);

        DeployAlfaClubUniversalRouterBase.Deployment memory deployment = script.run();

        assertEq(address(deployment.adapter), expectedAdapter);
        assertEq(address(deployment.router), expectedRouter);
        assertEq(deployment.predictedAdapter, expectedAdapter);
        assertEq(deployment.predictedRouter, expectedRouter);
        assertEq(deployment.adapter.universalRouter(), expectedRouter);
        assertEq(address(deployment.router.SUDOSWAP_ADAPTER()), expectedAdapter);
        assertEq(deployment.adapter.owner(), address(admin));
        assertEq(address(deployment.adapter.factory()), address(factory));
        assertEq(address(deployment.adapter.xykCurve()), address(xykCurve));
        assertEq(vm.getNonce(deployer), DEPLOYER_NONCE + 2);

        // The production ETH -> ZORA -> Creator Coin leg relies on the
        // router being wired to Base's canonical Uniswap V4 PoolManager, not
        // merely having the address present in deployment parameters.
        assertEq(address(deployment.router.poolManager()), script.BASE_V4_POOL_MANAGER());

        assertEq(factory.setRouterAllowedCalls(), 0, "deployment must not impersonate the Safe");
    }

    function testPinnedBaseRouterParametersMatchVendoredUpstreamValues() public view {
        RouterParameters memory parameters = script.baseRouterParameters();

        assertEq(parameters.permit2, 0x000000000022D473030F116dDEE9F6B43aC78BA3);
        assertEq(parameters.weth9, 0x4200000000000000000000000000000000000006);
        assertEq(parameters.v2Factory, 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6);
        assertEq(parameters.v3Factory, 0x33128a8fC17869897dcE68Ed026d694621f6FDfD);
        assertEq(parameters.pairInitCodeHash, 0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f);
        assertEq(parameters.poolInitCodeHash, 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54);
        assertEq(parameters.v4PoolManager, 0x498581fF718922c3f8e6A244956aF099B2652b2b);
        assertEq(parameters.permissionsAdapterFactory, address(0));
        assertEq(parameters.v3NFTPositionManager, 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1);
        assertEq(parameters.v4PositionManager, 0x7C5f5A4bBd8fD63184577525326123B519429bDc);
        assertEq(parameters.spokePool, 0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64);
    }

    function testRejectsNonBaseBeforeReadingDeploymentConfiguration() public {
        vm.chainId(84532);

        vm.expectRevert(
            abi.encodeWithSelector(DeployAlfaClubUniversalRouterBase.RefusingNonBaseDeployment.selector, 84532)
        );
        script.run();
    }

    function testRejectsNonceDriftBeforeComputingImmutableAddresses() public {
        vm.setNonce(deployer, DEPLOYER_NONCE + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                DeployAlfaClubUniversalRouterBase.UnexpectedDeployerNonce.selector, DEPLOYER_NONCE + 1, DEPLOYER_NONCE
            )
        );
        script.run();
    }

    function testFactoryOwnerMayDifferFromAdapterAdmin() public {
        MockAlfaClubRouterAdmin otherAdmin = new MockAlfaClubRouterAdmin();
        factory.setOwner(address(otherAdmin));

        DeployAlfaClubUniversalRouterBase.Deployment memory deployment = script.run();
        assertEq(deployment.adapter.owner(), address(admin));
        assertEq(factory.owner(), address(otherAdmin));
    }

    function testPreviouslyDisabledPredictedAdapterUsesDirectPairPath() public {
        address predictedAdapter = vm.computeCreateAddress(deployer, DEPLOYER_NONCE);
        factory.setRouterStatus(predictedAdapter, false, true);

        DeployAlfaClubUniversalRouterBase.Deployment memory deployment = script.run();
        assertEq(address(deployment.adapter), predictedAdapter);
    }

    function _setRequiredEnvironment() private {
        vm.setEnv("PRIVATE_KEY", vm.toString(DEPLOYER_PRIVATE_KEY));
        vm.setEnv("EXPECTED_DEPLOYER_NONCE", vm.toString(uint256(DEPLOYER_NONCE)));
        vm.setEnv("SUDOSWAP_PAIR_FACTORY", vm.toString(address(factory)));
        vm.setEnv("SUDOSWAP_XYK_CURVE", vm.toString(address(xykCurve)));
        vm.setEnv("ALFACLUB_MARKET_ADMIN_SAFE", vm.toString(address(admin)));
    }

    function _etchPinnedBaseDependencies() private {
        RouterParameters memory parameters = script.baseRouterParameters();
        bytes memory stopRuntime = hex"00";

        vm.etch(script.ALFA_CLUB_FRIEND_KEY(), stopRuntime);
        vm.etch(parameters.permit2, stopRuntime);
        vm.etch(parameters.weth9, stopRuntime);
        vm.etch(parameters.v2Factory, stopRuntime);
        vm.etch(parameters.v3Factory, stopRuntime);
        vm.etch(parameters.v4PoolManager, stopRuntime);
        vm.etch(parameters.v3NFTPositionManager, stopRuntime);
        vm.etch(parameters.v4PositionManager, stopRuntime);
        vm.etch(parameters.spokePool, stopRuntime);
    }
}
