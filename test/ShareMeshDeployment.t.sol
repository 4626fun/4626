// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import "test/helpers/DeploymentBatcherFixture.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {OVaultLPManager} from "@4626/shared/shareoft-mesh/univ4/OVaultLPManager.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockPermit2ForShareMesh {
    function approve(address, address, uint160, uint48) external {}
}

contract MockShareOFTForShareMesh is ERC20 {
    constructor() ERC20("Share", "SHR") {}
}

contract MockCreate2DeployerForShareMesh is IUniversalCreate2DeployerFromStore {
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

contract MockVaultOwnerViewForShareMesh {
    address public owner;

    constructor(address owner_) {
        owner = owner_;
    }
}

contract MockApprovedV4HooksRegistryForShareMesh {
    mapping(address => bool) public approved;
    address public transferredOwner;

    function setHookApproval(address hook, bool isApproved) external {
        approved[hook] = isApproved;
    }

    function isHookApproved(address hook) external view returns (bool) {
        return approved[hook];
    }

    function transferOwnership(address newOwner) external {
        transferredOwner = newOwner;
    }
}

contract MockCCAStrategyForShareMesh {
    bool public ready;
    bool public migrated;
    bool public currencySwept;
    bool public isGraduated = true;
    address public lpManager;
    address public auctionAddress;
    PoolKey public poolKey;

    function setAuctionAddress(address value) external {
        auctionAddress = value;
    }

    function setReady(bool value) external {
        ready = value;
        migrated = value;
        currencySwept = value;
    }

    function setPoolKey(PoolKey calldata key) external {
        poolKey = key;
    }

    function getLifecycleStatus()
        external
        view
        returns (
            uint8 phase,
            address auction,
            bool graduated,
            bool auctionWindowOpen,
            bool claimOpen,
            bool swept,
            bool unsoldSwept,
            bool migratedOut,
            bool failedFinalized,
            uint64 startBlock,
            uint64 endBlock,
            uint64 claimBlock,
            uint64 migrationBlock,
            uint64 sweepBlock,
            uint256 lpReserveAmount,
            uint256 clearingPrice,
            uint256 currencyRaised
        )
    {
        phase = ready ? 5 : 0;
        auction = auctionAddress;
        graduated = isGraduated;
        swept = currencySwept;
        migratedOut = migrated;
        lpReserveAmount = 1 ether;
        clearingPrice = 1;
        currencyRaised = 1 ether;
        startBlock = 1;
        endBlock = 2;
        claimBlock = 3;
        migrationBlock = 4;
        sweepBlock = 5;
    }

    function getPoolKey() external view returns (PoolKey memory) {
        return poolKey;
    }

    function setLpManager(address manager) external {
        require(lpManager == address(0), "already set");
        lpManager = manager;
    }
}

contract DeploymentBatcherShareMeshTest is Test {
    bytes32 internal constant HOOK_REGISTRY_CODE_ID = bytes32(uint256(11));
    bytes32 internal constant LP_MANAGER_CODE_ID = bytes32(uint256(15));

    DeploymentBatcher internal batcher;
    MockCreate2DeployerForShareMesh internal create2Deployer;
    MockApprovedV4HooksRegistryForShareMesh internal hookRegistry;
    MockVaultOwnerViewForShareMesh internal vault;
    MockCCAStrategyForShareMesh internal cca;

    address internal creatorToken;
    address internal shareOFT;
    address internal registryOwner;
    address internal poolHook;
    address internal poolManager;
    address internal permit2;
    address internal positionManager;
    address internal oracle;

    function setUp() public {
        vm.chainId(8453);

        creatorToken = makeAddr("creatorToken");
        shareOFT = address(new MockShareOFTForShareMesh());
        registryOwner = makeAddr("registryOwner");
        poolHook = makeAddr("poolHook");
        poolManager = makeAddr("poolManager");
        permit2 = address(new MockPermit2ForShareMesh());
        positionManager = makeAddr("positionManager");
        oracle = makeAddr("oracle");

        create2Deployer = new MockCreate2DeployerForShareMesh();
        vault = new MockVaultOwnerViewForShareMesh(address(this));
        cca = new MockCCAStrategyForShareMesh();
        cca.setAuctionAddress(makeAddr("auction"));

        hookRegistry = new MockApprovedV4HooksRegistryForShareMesh();
        create2Deployer.setDeployment(HOOK_REGISTRY_CODE_ID, address(hookRegistry));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(shareOFT),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(poolHook)
        });
        cca.setPoolKey(key);
        cca.setReady(true);

        DeploymentBatcherFixture.BatcherConfig memory cfg = DeploymentBatcherFixture.BatcherConfig({
            registry: makeAddr("registry"),
            bytecodeStore: makeAddr("bytecodeStore"),
            create2Deployer: address(create2Deployer),
            protocolTreasury: makeAddr("protocolTreasury"),
            protocolAutomation: makeAddr("protocolAutomation"),
            poolManager: poolManager,
            taxHook: poolHook,
            chainlinkEthUsd: makeAddr("chainlink"),
            vaultActivationBatcher: makeAddr("activation"),
            lotteryManager: makeAddr("lottery"),
            permit2: permit2,
            usdc: makeAddr("usdc"),
            uniswapV3Factory: makeAddr("v3Factory"),
            uniswapRouter: makeAddr("v3Router"),
            ajnaFactory: makeAddr("ajnaFactory"),
            vaultCoreModule: makeAddr("vaultCore"),
            agentVaultCoreModule: address(0),
            vaultStrategiesModule: makeAddr("vaultStrategies"),
            vaultAdminModule: makeAddr("vaultAdmin")
        });

        DeploymentBatcherFixture fixture = new DeploymentBatcherFixture();
        DeploymentBatcherFixture.Helpers memory helpers;
        (batcher, helpers) = fixture.deployBatcher(cfg);

        OVaultLPManager realManager = new OVaultLPManager(
            shareOFT, address(0), address(vault), address(helpers.shareMesh), address(hookRegistry)
        );
        create2Deployer.setDeployment(LP_MANAGER_CODE_ID, address(realManager));
    }

    function _shareMeshCodeIds() internal pure returns (DeploymentBatcher.ShareMeshCodeIds memory codeIds) {
        codeIds = DeploymentBatcher.ShareMeshCodeIds({
            approvedV4HooksRegistry: HOOK_REGISTRY_CODE_ID,
            lpManager: LP_MANAGER_CODE_ID
        });
    }

    function _shareMeshParams() internal view returns (DeploymentBatcher.ShareMeshDeployParams memory params) {
        address[] memory hooks = new address[](0);
        params = DeploymentBatcher.ShareMeshDeployParams({
            creatorToken: creatorToken,
            shareOFT: shareOFT,
            vault: address(vault),
            ccaLaunchArm: address(cca),
            oracle: oracle,
            owner: address(this),
            version: "test-v1",
            positionManager: positionManager,
            poolHook: poolHook,
            registryOwner: registryOwner,
            keeperManager: address(this),
            hooksToApprove: hooks
        });
    }

    function test_deployShareMeshLpManager_wiresCcaAndOwnership() public {
        DeploymentBatcher.ShareMeshDeployResult memory out =
            batcher.deployShareMeshLpManager(_shareMeshParams(), _shareMeshCodeIds());

        OVaultLPManager manager = OVaultLPManager(payable(out.lpManager));
        assertEq(cca.lpManager(), out.lpManager);
        assertTrue(hookRegistry.transferredOwner() == registryOwner);
        assertTrue(manager.pairedIsNative());
        assertTrue(address(manager.twapOracle()) == oracle);
        assertTrue(manager.isManager(address(this)));
    }

    function test_deployShareMeshLpManager_revertsBeforeMigration() public {
        cca.setReady(false);
        vm.expectRevert(DeploymentBatcherShareMeshHelper.ShareMeshNotReady.selector);
        batcher.deployShareMeshLpManager(_shareMeshParams(), _shareMeshCodeIds());
    }
}
