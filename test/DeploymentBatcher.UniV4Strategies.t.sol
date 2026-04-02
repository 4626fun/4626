// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

contract MockCreate2DeployerForUniV4 is IUniversalCreate2DeployerFromStore {
    mapping(bytes32 => address) public deployments;

    function setDeployment(bytes32 codeId, address deployed) external {
        deployments[codeId] = deployed;
    }

    function deploy(bytes32, bytes32 codeId, bytes calldata) external view override returns (address addr) {
        addr = deployments[codeId];
        require(addr != address(0), "missing deployment");
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external pure override returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(salt, initCodeHash)))));
    }
}

contract MockVaultOwnerViewForUniV4 {
    address public owner;

    constructor(address owner_) {
        owner = owner_;
    }
}

contract MockApprovedV4HooksRegistryForBatcher {
    mapping(address => bool) public approved;
    address public transferredOwner;

    function setHookApproval(address hook, bool isApproved) external {
        approved[hook] = isApproved;
    }

    function transferOwnership(address newOwner) external {
        transferredOwner = newOwner;
    }
}

contract MockUniV4StrategyForBatcher {
    address public configuredPoolManager;
    address public configuredPositionManager;
    address public configuredPermit2;
    address public configuredCurrency0;
    address public configuredCurrency1;
    uint24 public configuredFee;
    int24 public configuredTickSpacing;
    address public configuredHook;
    address public transferredOwner;

    function configurePool(address _poolManager, address _positionManager, address _permit2, PoolKey calldata _poolKey)
        external
    {
        configuredPoolManager = _poolManager;
        configuredPositionManager = _positionManager;
        configuredPermit2 = _permit2;
        configuredCurrency0 = Currency.unwrap(_poolKey.currency0);
        configuredCurrency1 = Currency.unwrap(_poolKey.currency1);
        configuredFee = _poolKey.fee;
        configuredTickSpacing = _poolKey.tickSpacing;
        configuredHook = address(_poolKey.hooks);
    }

    function transferOwnership(address newOwner) external {
        transferredOwner = newOwner;
    }
}

contract DeploymentBatcherUniV4StrategiesTest is Test {
    bytes32 internal constant HOOK_REGISTRY_CODE_ID = bytes32(uint256(11));
    bytes32 internal constant FULL_RANGE_CODE_ID = bytes32(uint256(12));
    bytes32 internal constant CONCENTRATED_CODE_ID = bytes32(uint256(13));
    bytes32 internal constant LIMIT_ORDER_CODE_ID = bytes32(uint256(14));
    bytes32 internal constant LP_MANAGER_CODE_ID = bytes32(uint256(15));

    DeploymentBatcher internal batcher;
    MockCreate2DeployerForUniV4 internal create2Deployer;
    MockApprovedV4HooksRegistryForBatcher internal hookRegistry;
    MockUniV4StrategyForBatcher internal fullRange;
    MockUniV4StrategyForBatcher internal concentrated;
    MockUniV4StrategyForBatcher internal limitOrder;
    MockUniV4StrategyForBatcher internal lpManager;

    MockVaultOwnerViewForUniV4 internal vault;

    address internal creatorToken;
    address internal pairedToken;
    address internal registryOwner;
    address internal hookA;
    address internal hookB;
    address internal hookC;
    address internal poolManager;
    address internal permit2;
    address internal positionManager;

    function setUp() public {
        creatorToken = makeAddr("creatorToken");
        pairedToken = makeAddr("pairedToken");
        registryOwner = makeAddr("registryOwner");
        hookA = makeAddr("hookA");
        hookB = makeAddr("hookB");
        hookC = makeAddr("hookC");
        poolManager = makeAddr("poolManager");
        permit2 = makeAddr("permit2");
        positionManager = makeAddr("positionManager");

        create2Deployer = new MockCreate2DeployerForUniV4();
        vault = new MockVaultOwnerViewForUniV4(address(this));

        hookRegistry = new MockApprovedV4HooksRegistryForBatcher();
        fullRange = new MockUniV4StrategyForBatcher();
        concentrated = new MockUniV4StrategyForBatcher();
        limitOrder = new MockUniV4StrategyForBatcher();
        lpManager = new MockUniV4StrategyForBatcher();

        create2Deployer.setDeployment(HOOK_REGISTRY_CODE_ID, address(hookRegistry));
        create2Deployer.setDeployment(FULL_RANGE_CODE_ID, address(fullRange));
        create2Deployer.setDeployment(CONCENTRATED_CODE_ID, address(concentrated));
        create2Deployer.setDeployment(LIMIT_ORDER_CODE_ID, address(limitOrder));
        create2Deployer.setDeployment(LP_MANAGER_CODE_ID, address(lpManager));

        batcher = new DeploymentBatcher(
            makeAddr("registry"),
            makeAddr("bytecodeStore"),
            address(create2Deployer),
            makeAddr("protocolTreasury"),
            poolManager,
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            permit2,
            makeAddr("usdc"),
            makeAddr("uniswapV3Factory"),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule")
        );
    }

    function _uniV4CodeIds() internal pure returns (DeploymentBatcher.UniV4CodeIds memory codeIds) {
        codeIds = DeploymentBatcher.UniV4CodeIds({
            approvedV4HooksRegistry: HOOK_REGISTRY_CODE_ID,
            fullRangeStrategy: FULL_RANGE_CODE_ID,
            concentratedStrategy: CONCENTRATED_CODE_ID,
            limitOrderStrategy: LIMIT_ORDER_CODE_ID,
            creatorLPManager: LP_MANAGER_CODE_ID
        });
    }

    function _uniV4Params(bool creatorIsCurrency0) internal view returns (DeploymentBatcher.UniV4DeployParams memory params) {
        address[] memory hooks = new address[](2);
        hooks[0] = hookA;
        hooks[1] = hookB;

        params = DeploymentBatcher.UniV4DeployParams({
            creatorToken: creatorToken,
            pairedToken: pairedToken,
            vault: address(vault),
            owner: address(this),
            version: "v1",
            positionManager: positionManager,
            fee: 6_900,
            tickSpacing: 60,
            creatorIsCurrency0: creatorIsCurrency0,
            poolHook: hookC,
            registryOwner: registryOwner,
            hooksToApprove: hooks
        });
    }

    function test_deployUniV4Strategies_deploysConfiguresAndTransfers() public {
        DeploymentBatcher.UniV4DeploymentResult memory out = batcher.deployUniV4Strategies(_uniV4Params(true), _uniV4CodeIds());

        assertEq(out.hookRegistry, address(hookRegistry), "hook registry mismatch");
        assertEq(out.fullRangeStrategy, address(fullRange), "full range mismatch");
        assertEq(out.concentratedStrategy, address(concentrated), "concentrated mismatch");
        assertEq(out.limitOrderStrategy, address(limitOrder), "limit order mismatch");
        assertEq(out.creatorLPManager, address(lpManager), "lp manager mismatch");

        assertTrue(hookRegistry.approved(hookA), "hook A should be approved");
        assertTrue(hookRegistry.approved(hookB), "hook B should be approved");
        assertTrue(hookRegistry.approved(hookC), "pool hook should be approved");
        assertEq(hookRegistry.transferredOwner(), registryOwner, "registry owner mismatch");

        assertEq(fullRange.configuredPoolManager(), poolManager, "full range pool manager mismatch");
        assertEq(fullRange.configuredPositionManager(), positionManager, "full range position manager mismatch");
        assertEq(fullRange.configuredPermit2(), permit2, "full range permit2 mismatch");
        assertEq(fullRange.configuredCurrency0(), creatorToken, "full range currency0 mismatch");
        assertEq(fullRange.configuredCurrency1(), pairedToken, "full range currency1 mismatch");
        assertEq(fullRange.configuredFee(), 6_900, "full range fee mismatch");
        assertEq(fullRange.configuredTickSpacing(), 60, "full range tick spacing mismatch");
        assertEq(fullRange.configuredHook(), hookC, "full range hook mismatch");

        assertEq(concentrated.configuredHook(), hookC, "concentrated hook mismatch");
        assertEq(limitOrder.configuredHook(), hookC, "limit order hook mismatch");
        assertEq(lpManager.configuredHook(), hookC, "lp manager hook mismatch");

        assertEq(fullRange.transferredOwner(), address(this), "full range owner mismatch");
        assertEq(concentrated.transferredOwner(), address(this), "concentrated owner mismatch");
        assertEq(limitOrder.transferredOwner(), address(this), "limit order owner mismatch");
        assertEq(lpManager.transferredOwner(), address(this), "lp manager owner mismatch");
    }

    function test_deployUniV4Strategies_respectsCurrencyOrderFlag() public {
        batcher.deployUniV4Strategies(_uniV4Params(false), _uniV4CodeIds());

        assertEq(fullRange.configuredCurrency0(), pairedToken, "currency0 should be paired token");
        assertEq(fullRange.configuredCurrency1(), creatorToken, "currency1 should be creator token");
    }

    function test_deployUniV4Strategies_revertsWhenCodeIdMissing() public {
        DeploymentBatcher.UniV4CodeIds memory codeIds = _uniV4CodeIds();
        codeIds.limitOrderStrategy = bytes32(0);

        vm.expectRevert(DeploymentBatcher.InvalidCodeId.selector);
        batcher.deployUniV4Strategies(_uniV4Params(true), codeIds);
    }

    function test_deployUniV4Strategies_revertsWhenVaultOwnerMismatch() public {
        MockVaultOwnerViewForUniV4 wrongVault = new MockVaultOwnerViewForUniV4(makeAddr("differentOwner"));
        DeploymentBatcher.UniV4DeployParams memory params = _uniV4Params(true);
        params.vault = address(wrongVault);

        vm.expectRevert(DeploymentBatcher.NotOwner.selector);
        batcher.deployUniV4Strategies(params, _uniV4CodeIds());
    }

    function test_deployUniV4Strategies_revertsWhenTickSpacingZero() public {
        DeploymentBatcher.UniV4DeployParams memory params = _uniV4Params(true);
        params.tickSpacing = 0;

        vm.expectRevert(DeploymentBatcher.InvalidTickSpacing.selector);
        batcher.deployUniV4Strategies(params, _uniV4CodeIds());
    }
}
