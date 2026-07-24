// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {
    DeploymentBatcher,
    DeploymentBatcherPhase2Module
} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {OFTBootstrapRegistry} from "@4626/shared/deploy/infra/OFTBootstrapRegistry.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import "test/helpers/DeploymentBatcherFixture.sol";

interface IEndpointRegistryLike {
    function getLayerZeroEndpoint(uint256 chainId) external view returns (address);
}

contract MockAgentLaneBytecodeStore {
    mapping(bytes32 => bytes) internal bytecodes;
    mapping(bytes32 => address) internal _pointers;

    function setCode(bytes32 codeId, bytes memory creationCode) external {
        bytecodes[codeId] = creationCode;
        if (creationCode.length > 0 && _pointers[codeId] == address(0)) {
            _pointers[codeId] = address(uint160(uint256(codeId) + 1));
        }
    }

    function get(bytes32 codeId) external view returns (bytes memory) {
        bytes memory creationCode = bytecodes[codeId];
        require(creationCode.length > 0, "missing code");
        return creationCode;
    }

    function pointers(bytes32 codeId) external view returns (address) {
        return _pointers[codeId];
    }
}

contract MockAgentLaneRegistry {
    address public endpoint;

    mapping(address => IRegistry4626.TokenInfo) internal tokenInfos;

    struct AgentIntegrationMeta {
        uint8 vaultKind;
        address nativeAgentVault;
        address taxRecipient;
        address taxAccountingAdapter;
        address pairToken;
        address uniswapV2Pair;
        bytes32 implementationFingerprint;
    }

    mapping(address => AgentIntegrationMeta) public agentIntegrationMetas;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function seedToken(address token, address creator) external {
        tokenInfos[token] = IRegistry4626.TokenInfo({
            token: token,
            name: "Agent Token",
            symbol: "AGNT",
            vault: address(0),
            shareOFT: address(0),
            wrapper: address(0),
            oracle: address(0),
            gaugeController: address(0),
            creator: creator,
            canonicalWallet: address(0),
            pool: address(0),
            poolFee: 0,
            primaryChainId: 8453,
            isActive: true,
            registeredAt: block.timestamp
        });
    }

    function getTokenInfo(address token) external view returns (IRegistry4626.TokenInfo memory) {
        return tokenInfos[token];
    }

    function setAgentIntegrationMeta(address token, AgentIntegrationMeta calldata meta) external {
        agentIntegrationMetas[token] = meta;
    }

    function getAgentIntegrationMeta(address token) external view returns (AgentIntegrationMeta memory) {
        return agentIntegrationMetas[token];
    }

    function getVaultKind(address token) external view returns (uint8) {
        AgentIntegrationMeta memory meta = agentIntegrationMetas[token];
        // Mirror Registry4626: Agent only when explicitly set; else Creator (0).
        if (meta.vaultKind == 1) return 1;
        return 0;
    }
}

contract MockAgentLaneVault {
    address public creatorToken;
    address public owner;
    address public gaugeController;
    address public ccaLaunchArm;
    address public modulesCore;

    constructor(address _creatorToken, address _owner, string memory, string memory) {
        creatorToken = _creatorToken;
        owner = _owner;
    }

    function setModulesOnce(address coreModule, address, address) external {
        modulesCore = coreModule;
    }

    function setWhitelist(address, bool) external {}

    function setGaugeController(address controller) external {
        gaugeController = controller;
    }

    function setCcaLaunchArm(address strategy) external {
        ccaLaunchArm = strategy;
    }

    function setProtocolRescue(address) external {}

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockAgentLaneWrapper {
    address public creatorToken;
    address public vault;
    address public owner;
    address public shareOFT;

    constructor(address _creatorToken, address _vault, address _owner) {
        creatorToken = _creatorToken;
        vault = _vault;
        owner = _owner;
    }

    function setShareOFT(address _shareOFT) external {
        shareOFT = _shareOFT;
    }

    function deposit(uint256) external pure returns (uint256) {
        return 0;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockAgentLaneShareOFT {
    address public owner;
    address public registry;
    address public vault;
    address public wrapper;
    address public gaugeController;

    constructor(string memory, string memory, address _registry, address _owner) {
        registry = _registry;
        owner = _owner;
    }

    function setRegistry(address _registry) external {
        registry = _registry;
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function setWrapper(address _wrapper) external {
        wrapper = _wrapper;
    }

    function setMinter(address, bool) external {}

    function setGaugeController(address controller) external {
        gaugeController = controller;
    }

    function setHubConfig(bool, uint32, address) external {}

    function setAddressType(address, uint8) external {}

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockAgentLaneGauge {
    address public vault;
    address public wrapper;
    address public agentToken;
    address public creatorCoin;
    address public oracle;
    address public owner;

    constructor(address, address, address, address owner_) {
        owner = owner_;
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function setWrapper(address _wrapper) external {
        wrapper = _wrapper;
    }

    function setAgentToken(address token) external {
        agentToken = token;
    }

    function setCreatorCoin(address token) external {
        creatorCoin = token;
    }

    function setLotteryManager(address) external {}

    function setOracle(address _oracle) external {
        oracle = _oracle;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockCreatorLaneGauge {
    address public vault;
    address public wrapper;
    address public agentToken;
    address public creatorCoin;
    address public oracle;
    address public owner;

    constructor(address, address, address, address owner_) {
        owner = owner_;
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function setWrapper(address _wrapper) external {
        wrapper = _wrapper;
    }

    function setAgentToken(address token) external {
        agentToken = token;
    }

    function setCreatorCoin(address token) external {
        creatorCoin = token;
    }

    function setLotteryManager(address) external {}

    function setOracle(address _oracle) external {
        oracle = _oracle;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockAgentLaneCca {
    address public owner;

    constructor(address, address, address, address, address owner_) {
        owner = owner_;
    }

    function setApprovedLauncher(address, bool) external {}

    function setOracleConfig(address, address, address, address) external {}

    function setLaunchDiscountBps(uint16) external {}

    function setLaunchTickSpacingBps(uint16) external {}

    function setRecipients(address, address) external {}

    function setBackingVault(address) external {}

    function setMigrationConfig(address, address, address, uint64, uint64) external {}

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockAgentLaneOracle {
    address public owner;

    constructor(address, address, string memory, address owner_) {
        owner = owner_;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockAgentLaneCreate2Deployer {
    mapping(bytes32 => uint8) public codeKinds;
    bytes32 public bootstrapSalt;
    address public bootstrapAddress;
    address public storeAddr;

    function configureBootstrap(bytes32 salt, address bootstrap) external {
        bootstrapSalt = salt;
        bootstrapAddress = bootstrap;
    }

    function setCodeKind(bytes32 codeId, uint8 kind) external {
        codeKinds[codeId] = kind;
    }

    /// @dev Default zero skips store.get reuse path. Tests that exercise initCodeHash
    ///      reuse set this to a MockAgentLaneBytecodeStore.
    function setStore(address store_) external {
        storeAddr = store_;
    }

    function store() external view returns (address) {
        return storeAddr;
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        if (salt == bootstrapSalt) return bootstrapAddress;
        return address(uint160(uint256(keccak256(abi.encodePacked("mock-create2", salt, initCodeHash)))));
    }

    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr) {
        uint8 kind = codeKinds[codeId];
        if (kind == 1) {
            (address creatorToken, address owner, string memory vaultName, string memory vaultSymbol) =
                abi.decode(constructorArgs, (address, address, string, string));
            return address(new MockAgentLaneVault(creatorToken, owner, vaultName, vaultSymbol));
        }
        if (kind == 2) {
            (address creatorToken, address vault, address owner) =
                abi.decode(constructorArgs, (address, address, address));
            return address(new MockAgentLaneWrapper(creatorToken, vault, owner));
        }
        if (kind == 3) {
            (string memory name, string memory symbol, address registry, address owner) =
                abi.decode(constructorArgs, (string, string, address, address));
            return address(new MockAgentLaneShareOFT(name, symbol, registry, owner));
        }
        if (kind == 4) {
            (,,, address owner) = abi.decode(constructorArgs, (address, address, address, address));
            return address(new MockAgentLaneGauge(address(0), address(0), address(0), owner));
        }
        if (kind == 5) {
            (,,,, address owner) = abi.decode(constructorArgs, (address, address, address, address, address));
            return address(new MockAgentLaneCca(address(0), address(0), address(0), address(0), owner));
        }
        if (kind == 6) {
            (,,, address owner) = abi.decode(constructorArgs, (address, address, string, address));
            return address(new MockAgentLaneOracle(address(0), address(0), "", owner));
        }
        if (kind == 7) {
            (,,, address owner) = abi.decode(constructorArgs, (address, address, address, address));
            return address(new MockCreatorLaneGauge(address(0), address(0), address(0), owner));
        }
        revert("unknown code kind");
    }
}

contract DeploymentBatcherAgentLanePhase12Test is Test {
    bytes32 internal constant VAULT_CODE_ID = bytes32(uint256(1));
    bytes32 internal constant WRAPPER_CODE_ID = bytes32(uint256(2));
    bytes32 internal constant SHARE_OFT_CODE_ID = bytes32(uint256(3));
    bytes32 internal constant AGENT_GAUGE_CODE_ID = bytes32(uint256(4));
    bytes32 internal constant CCA_CODE_ID = bytes32(uint256(5));
    bytes32 internal constant ORACLE_CODE_ID = bytes32(uint256(6));
    bytes32 internal constant CREATOR_GAUGE_CODE_ID = bytes32(uint256(7));
    bytes32 internal constant OFT_BOOTSTRAP_CODE_ID = bytes32(uint256(8));

    address internal constant AGENT_CORE_MODULE = address(0xA601);
    address internal constant CREATOR_CORE_MODULE = address(0xC001);
    address internal agentToken = address(0xA6E7);

    DeploymentBatcher internal batcher;
    MockAgentLaneCreate2Deployer internal create2;
    MockAgentLaneRegistry internal registry;
    MockAgentLaneBytecodeStore internal store;
    OFTBootstrapRegistry internal bootstrap;

    function setUp() public {
        vm.chainId(8453);
        bootstrap = new OFTBootstrapRegistry();
        registry = new MockAgentLaneRegistry(bootstrap.LZ_COMMON_ENDPOINT());
        registry.seedToken(agentToken, address(this));
        store = new MockAgentLaneBytecodeStore();
        create2 = new MockAgentLaneCreate2Deployer();
        store.setCode(VAULT_CODE_ID, bytes("mock-vault"));
        store.setCode(WRAPPER_CODE_ID, bytes("mock-wrapper"));
        store.setCode(OFT_BOOTSTRAP_CODE_ID, bytes("mock-bootstrap"));
        store.setCode(SHARE_OFT_CODE_ID, bytes("mock-share-oft"));
        store.setCode(AGENT_GAUGE_CODE_ID, bytes("mock-agent-gauge"));
        store.setCode(CCA_CODE_ID, bytes("mock-cca"));
        store.setCode(ORACLE_CODE_ID, bytes("mock-oracle"));
        store.setCode(CREATOR_GAUGE_CODE_ID, bytes("mock-creator-gauge"));
        create2.configureBootstrap(keccak256("4626:OFTBootstrapRegistry:v1"), address(bootstrap));
        create2.setCodeKind(VAULT_CODE_ID, 1);
        create2.setCodeKind(WRAPPER_CODE_ID, 2);
        create2.setCodeKind(SHARE_OFT_CODE_ID, 3);
        create2.setCodeKind(AGENT_GAUGE_CODE_ID, 4);
        create2.setCodeKind(CCA_CODE_ID, 5);
        create2.setCodeKind(ORACLE_CODE_ID, 6);
        create2.setCodeKind(CREATOR_GAUGE_CODE_ID, 7);

        DeploymentBatcherFixture deployerLib = new DeploymentBatcherFixture();
        DeploymentBatcherFixture.BatcherConfig memory cfg = DeploymentBatcherFixture.BatcherConfig({
            registry: address(registry),
            bytecodeStore: address(store),
            create2Deployer: address(create2),
            protocolTreasury: address(this),
            protocolAutomation: makeAddr("protocolAutomation"),
            poolManager: makeAddr("poolManager"),
            taxHook: makeAddr("taxHook"),
            chainlinkEthUsd: makeAddr("chainlinkEthUsd"),
            vaultActivationBatcher: makeAddr("vaultActivationBatcher"),
            lotteryManager: makeAddr("lotteryManager"),
            permit2: makeAddr("permit2"),
            usdc: makeAddr("usdc"),
            uniswapV3Factory: makeAddr("uniswapV3Factory"),
            uniswapRouter: makeAddr("uniswapRouter"),
            ajnaFactory: makeAddr("ajnaFactory"),
            vaultCoreModule: CREATOR_CORE_MODULE,
            agentVaultCoreModule: AGENT_CORE_MODULE,
            vaultStrategiesModule: makeAddr("vaultStrategiesModule"),
            vaultAdminModule: makeAddr("vaultAdminModule")
        });
        (batcher,) = deployerLib.deployBatcher(cfg);
    }

    function _codeIds(bool agentGauge) internal pure returns (DeploymentBatcher.CodeIds memory codeIds) {
        codeIds = DeploymentBatcher.CodeIds({
            vault: VAULT_CODE_ID,
            wrapper: WRAPPER_CODE_ID,
            shareOFT: SHARE_OFT_CODE_ID,
            gauge: agentGauge ? AGENT_GAUGE_CODE_ID : CREATOR_GAUGE_CODE_ID,
            cca: CCA_CODE_ID,
            oracle: ORACLE_CODE_ID,
            oftBootstrap: OFT_BOOTSTRAP_CODE_ID
        });
    }

    function _phase1Params(DeploymentBatcher.VaultKind vaultKind)
        internal
        view
        returns (DeploymentBatcher.Phase1Params memory params)
    {
        params = DeploymentBatcher.Phase1Params({
            creatorToken: agentToken,
            owner: address(this),
            vaultName: "Agent OVault",
            vaultSymbol: "ovAGNT",
            shareName: "Agent Share",
            shareSymbol: "sAGNT",
            version: "v1",
            vaultKind: vaultKind
        });
    }

    function _runPhase1(DeploymentBatcher.VaultKind vaultKind)
        internal
        returns (DeploymentBatcher.Phase1Result memory out)
    {
        DeploymentBatcher.Phase1Params memory params = _phase1Params(vaultKind);
        batcher.deployPhase1CoreWithSalt(params, _codeIds(true), bytes32(0));
        out = batcher.finalizePhase1WithSalt(params, _codeIds(true), bytes32(0));
    }

    function _baseSalt() internal view returns (bytes32) {
        return keccak256(abi.encodePacked(agentToken, address(this), block.chainid, "4626:deploy:", "v1"));
    }

    function test_agentPhase1_persistsVaultKindAndUsesAgentCoreModule() public {
        DeploymentBatcher.Phase1Result memory out = _runPhase1(DeploymentBatcher.VaultKind.Agent);

        assertEq(MockAgentLaneVault(out.vault).modulesCore(), AGENT_CORE_MODULE, "agent core module");

        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            bool coreDone,
            bool finalized,
            DeploymentBatcher.VaultKind vaultKind
        ) = batcher.phase1SplitStates(_baseSalt());
        assertTrue(coreDone);
        assertTrue(finalized);
        assertEq(uint256(vaultKind), uint256(DeploymentBatcher.VaultKind.Agent));
    }

    function test_agentPhase2Core_wiresSetAgentTokenNotSetCreatorCoin() public {
        DeploymentBatcher.Phase1Result memory p1 = _runPhase1(DeploymentBatcher.VaultKind.Agent);

        DeploymentBatcher.Phase2CoreParams memory params = DeploymentBatcher.Phase2CoreParams({
            creatorToken: agentToken,
            owner: address(this),
            creatorTreasury: address(0),
            payoutRecipient: address(0),
            vault: p1.vault,
            wrapper: p1.wrapper,
            shareOFT: p1.shareOFT,
            shareSymbol: "sAGNT",
            version: "v1",
            floorPriceQ96: 0
        });

        DeploymentBatcher.Phase2Result memory p2 = batcher.deployPhase2Core(params, _codeIds(true));

        MockAgentLaneGauge gauge = MockAgentLaneGauge(p2.gaugeController);
        assertEq(MockAgentLaneShareOFT(p1.shareOFT).wrapper(), p1.wrapper, "share OFT wrapper");
        assertEq(gauge.agentToken(), agentToken, "agent gauge asset token");
        assertEq(gauge.creatorCoin(), address(0), "creator setter must not run on agent gauge");
        assertEq(gauge.vault(), p1.vault);
        assertEq(gauge.wrapper(), p1.wrapper);
        assertEq(MockAgentLaneShareOFT(p1.shareOFT).gaugeController(), p2.gaugeController);
        assertEq(MockAgentLaneVault(p1.vault).gaugeController(), p2.gaugeController);
        assertEq(MockAgentLaneVault(p1.vault).ccaLaunchArm(), p2.ccaLaunchArm);
        assertEq(uint256(registry.getVaultKind(agentToken)), uint256(1), "getVaultKind Agent");
        assertEq(registry.getAgentIntegrationMeta(agentToken).nativeAgentVault, p1.vault, "nativeAgentVault");
    }

    function test_creatorPhase2Core_stillWiresSetCreatorCoin() public {
        DeploymentBatcher.Phase1Params memory params = _phase1Params(DeploymentBatcher.VaultKind.Creator);
        batcher.deployPhase1CoreWithSalt(params, _codeIds(false), bytes32(0));
        DeploymentBatcher.Phase1Result memory p1 = batcher.finalizePhase1WithSalt(params, _codeIds(false), bytes32(0));

        assertEq(MockAgentLaneVault(p1.vault).modulesCore(), CREATOR_CORE_MODULE, "creator core module");

        DeploymentBatcher.Phase2CoreParams memory phase2 = DeploymentBatcher.Phase2CoreParams({
            creatorToken: agentToken,
            owner: address(this),
            creatorTreasury: address(0),
            payoutRecipient: address(0),
            vault: p1.vault,
            wrapper: p1.wrapper,
            shareOFT: p1.shareOFT,
            shareSymbol: "sAGNT",
            version: "v1",
            floorPriceQ96: 0
        });

        DeploymentBatcher.Phase2Result memory p2 = batcher.deployPhase2Core(phase2, _codeIds(false));

        MockCreatorLaneGauge gauge = MockCreatorLaneGauge(p2.gaugeController);
        assertEq(gauge.creatorCoin(), agentToken, "creator gauge asset token");
        assertEq(gauge.agentToken(), address(0), "agent setter must not run on creator gauge");
        assertEq(uint256(registry.getVaultKind(agentToken)), uint256(0), "getVaultKind Creator");
    }

    function test_phase1ParamsHash_includesVaultKind() public {
        DeploymentBatcherUtilsHelper helper = DeploymentBatcherUtilsHelper(batcher.utilsHelper());

        bytes32 creatorHash = helper.phase1ParamsHash(
            agentToken,
            address(this),
            "Agent OVault",
            "ovAGNT",
            "Agent Share",
            "sAGNT",
            "v1",
            DeploymentBatcher.VaultKind.Creator
        );
        bytes32 agentHash = helper.phase1ParamsHash(
            agentToken,
            address(this),
            "Agent OVault",
            "ovAGNT",
            "Agent Share",
            "sAGNT",
            "v1",
            DeploymentBatcher.VaultKind.Agent
        );

        assertTrue(creatorHash != agentHash, "vaultKind must affect params hash");
    }

    function test_phase2_reusesPrecreatedGaugeWhenInitCodeHashProvided() public {
        create2.setStore(address(store));
        DeploymentBatcher.Phase1Result memory p1 = _runPhase1(DeploymentBatcher.VaultKind.Agent);

        DeploymentBatcherUtilsHelper helper = DeploymentBatcherUtilsHelper(batcher.utilsHelper());
        bytes32 baseSalt = helper.deriveBaseSalt(agentToken, address(this), block.chainid, "v1");
        bytes32 gaugeSalt = helper.saltFor(baseSalt, "gauge");
        bytes memory gaugeArgs = abi.encode(p1.shareOFT, address(this), address(this), address(batcher));
        bytes32 gaugeInitHash = keccak256(bytes.concat(store.get(AGENT_GAUGE_CODE_ID), gaugeArgs));
        address predicted = create2.computeAddress(gaugeSalt, gaugeInitHash);

        MockAgentLaneGauge pre = new MockAgentLaneGauge(address(0), address(0), address(0), address(batcher));
        vm.etch(predicted, address(pre).code);

        // Publish hash on the module contract (shell ABI stays unchanged).
        bytes32[3] memory salts;
        bytes32[3] memory hashes;
        salts[0] = gaugeSalt;
        hashes[0] = gaugeInitHash;
        DeploymentBatcherPhase2Module(address(batcher.phase2Module())).setPendingInitCodeHashes(salts, hashes);

        DeploymentBatcher.Phase2CoreParams memory params = DeploymentBatcher.Phase2CoreParams({
            creatorToken: agentToken,
            owner: address(this),
            creatorTreasury: address(0),
            payoutRecipient: address(0),
            vault: p1.vault,
            wrapper: p1.wrapper,
            shareOFT: p1.shareOFT,
            shareSymbol: "sAGNT",
            version: "v1",
            floorPriceQ96: 0
        });

        DeploymentBatcher.Phase2Result memory p2 = batcher.deployPhase2Core(params, _codeIds(true));
        assertEq(p2.gaugeController, predicted, "must reuse pre-created gauge");
    }

    function test_finalizePhase2_revertsWhenCcaDoesNotMatchVaultWiring() public {
        DeploymentBatcher.Phase1Result memory p1 = _runPhase1(DeploymentBatcher.VaultKind.Agent);
        DeploymentBatcher.Phase2CoreParams memory params = DeploymentBatcher.Phase2CoreParams({
            creatorToken: agentToken,
            owner: address(this),
            creatorTreasury: address(0),
            payoutRecipient: address(0),
            vault: p1.vault,
            wrapper: p1.wrapper,
            shareOFT: p1.shareOFT,
            shareSymbol: "sAGNT",
            version: "v1",
            floorPriceQ96: 0
        });
        DeploymentBatcher.Phase2Result memory p2 = batcher.deployPhase2Core(params, _codeIds(true));

        address diverted = makeAddr("divertedCca");
        vm.etch(diverted, hex"00");

        DeploymentBatcher.Phase2FinalizeParams memory fin = DeploymentBatcher.Phase2FinalizeParams({
            creatorToken: agentToken,
            owner: address(this),
            vault: p1.vault,
            wrapper: p1.wrapper,
            shareOFT: p1.shareOFT,
            gaugeController: p2.gaugeController,
            ccaLaunchArm: diverted,
            oracle: p2.oracle,
            version: "v1",
            depositAmount: 50_000_000 ether,
            requiredRaise: 0,
            floorPriceQ96: 0,
            auctionSteps: ""
        });

        vm.expectRevert(); // Phase2WiringMismatch via module delegatecall
        batcher.finalizePhase2(fin);
    }
}
