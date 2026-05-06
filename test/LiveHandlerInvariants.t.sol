// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";
import {MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

import {DeploymentBatcher} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import {
    MockAjnaAdapterForPhase3,
    MockAjnaPoolFactoryForPhase3,
    MockAjnaVaultAuthForPhase3,
    MockCharmStrategyForPhase3,
    MockCharmVaultForPhase3,
    MockCreate2DeployerForPhase3,
    MockOwnableTransferForPhase3,
    MockUniswapV3FactoryForPhase3,
    MockUniswapV3PoolForPhase3,
    MockVaultStrategyManagerForPhase3
} from "./DeploymentBatcher.SolanaStrategyPhase3.t.sol";
import {DeploymentBatcherPhase2Module} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import {IBaseSolanaBridge} from "../contracts/interfaces/IBaseSolanaBridge.sol";
import {OFTBootstrapRegistry} from "../contracts/helpers/infra/OFTBootstrapRegistry.sol";
import {
    MockBytecodeStore,
    MockCreatorRegistry,
    MockShareOFT,
    MockUniversalCreate2Deployer,
    MockWrapper
} from "./DeploymentBatcher.Phase1EndpointPoisoning.t.sol";
import {
    IDeploymentBatcherPermit2,
    MockCreatorTokenPermit2,
    MockOwnableTransferPermit2,
    MockPermit2Deployment,
    MockShareOFTPermit2,
    MockVaultPermit2,
    MockWrapperPermit2
} from "./DeploymentBatcher.Permit2.t.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

contract LiveMockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract LiveMockLotteryOracle {
    int256 public price = 1e18;
    uint256 public updatedAt;
    bool public shouldRevert;

    constructor() {
        updatedAt = block.timestamp;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        if (shouldRevert) revert("oracle-revert");
        return (price, updatedAt);
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }
}

contract LiveMockLotteryRegistry {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;
    address public immutable vault;
    address public immutable gauge;
    bool public active = true;

    constructor(
        address endpoint_,
        address creatorCoin_,
        address shareOFT_,
        address oracle_,
        address vault_,
        address gauge_
    ) {
        endpoint = endpoint_;
        creatorCoin = creatorCoin_;
        shareOFT = shareOFT_;
        oracle = oracle_;
        vault = vault_;
        gauge = gauge_;
    }

    function getVaultForToken(address token) external view returns (address) {
        return token == creatorCoin ? vault : address(0);
    }

    function getShareOFTForToken(address token) external view returns (address) {
        return token == creatorCoin ? shareOFT : address(0);
    }

    function getTokenForShareOFT(address token) external view returns (address) {
        return token == shareOFT ? creatorCoin : address(0);
    }

    function getOracleForToken(address token) external view returns (address) {
        return token == creatorCoin ? oracle : address(0);
    }

    function getGaugeControllerForToken(address token) external view returns (address) {
        return token == creatorCoin ? gauge : address(0);
    }

    function isCreatorCoinActive(address token) external view returns (bool) {
        return active && token == creatorCoin;
    }

    function setActive(bool value) external {
        active = value;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllCreatorCoins() external view returns (address[] memory coins) {
        coins = new address[](1);
        coins[0] = creatorCoin;
    }
}

contract LiveMockVrfIntegrator {
    uint256 public nativeFee = 0.01 ether;
    uint64 public nextSequence = 1;
    uint256 public requestCount;
    bool public forceRevert;
    uint256 public revertCount;

    function setForceRevert(bool value) external {
        forceRevert = value;
    }

    function quoteFee() external view returns (MessagingFee memory fee) {
        fee = MessagingFee({nativeFee: nativeFee, lzTokenFee: 0});
    }

    function requestRandomWordsPayable(uint32)
        external
        payable
        returns (MessagingReceipt memory receipt, uint64 sequence)
    {
        if (forceRevert) {
            revertCount++;
            revert("vrf-send-failed");
        }
        require(msg.value == nativeFee, "fee mismatch");
        requestCount++;
        sequence = nextSequence++;
        receipt = MessagingReceipt({
            guid: bytes32(uint256(sequence)), nonce: sequence, fee: MessagingFee({nativeFee: msg.value, lzTokenFee: 0})
        });
    }
}

contract LiveMockGauge {
    uint256 public jackpot = 1_000 ether;
    uint256 public payCount;

    function getJackpotReserve() external view returns (uint256) {
        return jackpot;
    }

    function payJackpot(address, uint256 shares) external {
        payCount++;
        jackpot = shares >= jackpot ? 0 : jackpot - shares;
    }
}

contract LiveLotteryManagerHarness is CreatorLotteryManager {
    constructor(address registry_, address owner_) CreatorLotteryManager(registry_, owner_) {}

    function exposedLzReceive(Origin calldata origin, bytes calldata payload) external {
        _lzReceive(origin, bytes32(0), payload, address(0), payload[:0]);
    }
}

contract LotteryManagerLiveHandler is Test {
    LiveLotteryManagerHarness public immutable manager;
    LiveMockVrfIntegrator public immutable integrator;
    LiveMockGauge public immutable gauge;
    LiveMockLotteryRegistry public immutable registry;
    LiveMockLotteryOracle public immutable oracle;
    IERC20 public immutable creatorToken;
    address public immutable authorizedSwap;
    address public immutable buyer;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable amoeRelayer;

    uint32 internal constant REMOTE_EID = 30110;
    bytes32 internal constant REMOTE_SENDER = bytes32(uint256(0x1234));
    uint32 internal constant SOURCE_CHAIN_ID = 42161;

    constructor(
        LiveLotteryManagerHarness manager_,
        LiveMockVrfIntegrator integrator_,
        LiveMockGauge gauge_,
        LiveMockLotteryRegistry registry_,
        LiveMockLotteryOracle oracle_,
        IERC20 creatorToken_,
        address authorizedSwap_,
        address buyer_,
        address creatorCoin_,
        address shareOFT_,
        address amoeRelayer_
    ) {
        manager = manager_;
        integrator = integrator_;
        gauge = gauge_;
        registry = registry_;
        oracle = oracle_;
        creatorToken = creatorToken_;
        authorizedSwap = authorizedSwap_;
        buyer = buyer_;
        creatorCoin = creatorCoin_;
        shareOFT = shareOFT_;
        amoeRelayer = amoeRelayer_;
    }

    function localEntry(uint96 amount) external {
        amount = uint96(bound(amount, 0, 10 ether));
        vm.prank(authorizedSwap);
        try manager.processSwapLottery(buyer, creatorCoin, amount, 0) {} catch {}
    }

    function remoteEntry(uint96 amount, uint32 buyerSeed) external {
        amount = uint96(bound(amount, 0, 10 ether));
        address remoteBuyer = address(uint160(uint256(keccak256(abi.encode(buyerSeed)))));
        Origin memory origin = Origin({srcEid: REMOTE_EID, sender: REMOTE_SENDER, nonce: uint64(buyerSeed)});
        bytes memory payload = abi.encode(
            uint16(manager.MSG_TYPE_LOTTERY_ENTRY()), remoteBuyer, shareOFT, uint256(amount), SOURCE_CHAIN_ID
        );
        try manager.exposedLzReceive(origin, payload) {} catch {}
    }

    function amoeEntry(uint96 pointsBurnedAsUSD, uint32 buyerSeed) external {
        pointsBurnedAsUSD = uint96(bound(pointsBurnedAsUSD, 0, 10_000 * 1_000_000));
        address amoeBuyer = address(uint160(uint256(keccak256(abi.encode("amoe", buyerSeed)))));
        vm.prank(amoeRelayer);
        try manager.processAmoeEntry(amoeBuyer, creatorCoin, pointsBurnedAsUSD) {} catch {}
    }

    function amoeEntryWithFailureBranch(uint96 pointsBurnedAsUSD, uint32 buyerSeed, uint8 mode) external {
        pointsBurnedAsUSD = uint96(bound(pointsBurnedAsUSD, 0, 10_000 * 1_000_000));
        address amoeBuyer = address(uint160(uint256(keccak256(abi.encode("amoe-failure", buyerSeed)))));

        registry.setActive(mode != 1);
        integrator.setForceRevert(mode == 2);
        oracle.setShouldRevert(mode == 3);
        if (mode == 4) {
            // Exercise the share-balance branch that reads the creator oracle.
            creatorToken.transfer(amoeBuyer, 1 ether);
        }

        vm.prank(amoeRelayer);
        try manager.processAmoeEntry(amoeBuyer, creatorCoin, pointsBurnedAsUSD) {} catch {}

        registry.setActive(true);
        integrator.setForceRevert(false);
        oracle.setShouldRevert(false);
    }

    function vrfResult(uint64 sequence, uint256 randomWord) external {
        uint256 key = uint256(keccak256(abi.encode("CROSS_CHAIN", uint256(sequence))));
        try manager.receiveRandomWords(_word(randomWord), key) {} catch {}
    }

    function processPending(uint64 sequence) external {
        uint256 key = uint256(keccak256(abi.encode("CROSS_CHAIN", uint256(sequence))));
        try manager.processPendingVrfResult(key) {} catch {}
    }

    function _word(uint256 value) internal pure returns (uint256[] memory words) {
        words = new uint256[](1);
        words[0] = value;
    }
}

contract CreatorLotteryManagerLiveInvariantTest is Test {
    LiveLotteryManagerHarness internal manager;
    LiveMockVrfIntegrator internal integrator;
    LiveMockGauge internal gauge;
    LiveMockLotteryRegistry internal registry;
    LiveMockLotteryOracle internal oracle;
    LiveMockERC20 internal creatorTokenMock;
    LotteryManagerLiveHandler internal handler;

    address internal owner = address(this);
    address internal authorizedSwap = makeAddr("lotterySwap");
    address internal buyer = makeAddr("lotteryBuyer");
    address internal amoeRelayer = makeAddr("amoeRelayer");
    address internal creatorCoin = makeAddr("creatorCoin");
    address internal shareOFT = makeAddr("shareOFT");
    address internal vault = makeAddr("vault");
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() external {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new LiveMockLotteryOracle();
        gauge = new LiveMockGauge();
        registry =
            new LiveMockLotteryRegistry(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle), vault, address(gauge));
        integrator = new LiveMockVrfIntegrator();
        creatorTokenMock = new LiveMockERC20("Creator Coin", "CREATOR");
        vm.etch(creatorCoin, address(creatorTokenMock).code);
        creatorTokenMock = LiveMockERC20(creatorCoin);

        manager = new LiveLotteryManagerHarness(address(registry), owner);
        manager.setAuthorizedSwapContract(authorizedSwap, true);
        manager.setVRFIntegrator(address(integrator));
        manager.setTargetEid(30184);
        manager.setUseLocalVRF(false);
        manager.setSponsoredVrfMinSwapAmountUSD(1_000_000);
        manager.setAuthorizedAmoeRelayer(amoeRelayer);
        manager.setVrfSponsorshipPolicy(true, 0.02 ether, 1 ether, 1 hours);
        manager.setPeer(30184, bytes32(uint256(0xBEEF)));
        manager.setAuthorizedRemoteOFT(30110, bytes32(uint256(0x1234)), true);
        vm.deal(address(manager), 10 ether);

        handler = new LotteryManagerLiveHandler(
            manager,
            integrator,
            gauge,
            registry,
            oracle,
            IERC20(creatorCoin),
            authorizedSwap,
            buyer,
            creatorCoin,
            shareOFT,
            amoeRelayer
        );
        creatorTokenMock.mint(address(handler), 1_000_000 ether);
        targetContract(address(handler));
    }

    function invariant_lotteryEntriesTrackVrfRequests() external view {
        assertGe(manager.totalLotteryEntries(), integrator.requestCount(), "vrf requests exceeded entries");
        assertLe(integrator.requestCount(), manager.totalLotteryEntries(), "entry/request accounting drift");
    }

    function invariant_lotteryPayoutsDoNotExceedEntries() external view {
        assertLe(manager.totalWinners(), manager.totalLotteryEntries(), "more winners than entries");
        assertLe(gauge.payCount(), manager.totalWinners(), "gauge payouts exceed winners");
    }

    function invariant_amoeEntriesUseSameVrfAccounting() external view {
        assertGe(manager.totalLotteryEntries(), integrator.requestCount(), "amoe vrf requests exceeded entries");
    }

    function invariant_failedAmoeBranchesDoNotMintRequests() external view {
        assertGe(manager.totalLotteryEntries(), integrator.requestCount(), "failed amoe branch minted extra request");
    }
}

contract BatcherPhaseHandler is Test {
    uint256 internal constant MAX_CASES = 24;
    address internal constant CHARM_FACTORY = 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa;
    bytes4 internal constant GOVERNANCE_SELECTOR = bytes4(keccak256("governance()"));
    bytes4 internal constant PROTOCOL_FEE_SELECTOR = bytes4(keccak256("protocolFee()"));
    bytes4 internal constant CREATE_VAULT_SELECTOR = bytes4(
        keccak256(
            "createVault((address,address,uint24,address,uint256,int24,int24,uint24,uint32,int24,int24,uint32,string,string))"
        )
    );
    uint24 internal constant CHARM_PROTOCOL_FEE_PIPS = 10_000;

    uint256 public accepted;
    uint256 public rejected;
    uint256 public badAccepted;
    uint256 public badRejected;

    function deployPhase3(uint16 charmRaw, uint16 ajnaRaw, uint16 solanaRaw) external {
        if (accepted + rejected + badAccepted + badRejected >= MAX_CASES) return;
        uint256 charm = charmRaw;
        uint256 ajna = ajnaRaw;
        uint256 solana = solanaRaw;
        bool shouldAccept = _valid(charm, ajna, solana);
        (
            DeploymentBatcher batcher,
            MockVaultStrategyManagerForPhase3 vault,
            DeploymentBatcher.Phase3Params memory params,
            DeploymentBatcher.StrategyCodeIds memory codeIds
        ) = _fixture(charm, ajna, solana);

        try batcher.deployPhase3Strategies(params, codeIds) {
            if (!shouldAccept) {
                badAccepted++;
                return;
            }
            accepted++;
            _assertPhase3(vault, charm, ajna, solana);
        } catch {
            shouldAccept ? badRejected++ : rejected++;
        }
    }

    function _valid(uint256 charm, uint256 ajna, uint256 solana) internal pure returns (bool) {
        if (charm > 10_000 || ajna > 10_000 || solana > 10_000) return false;
        uint256 total = charm + ajna + solana;
        return total > 0 && total <= 10_000;
    }

    function _fixture(uint256 charm, uint256 ajna, uint256 solana)
        internal
        returns (
            DeploymentBatcher batcher,
            MockVaultStrategyManagerForPhase3 vault,
            DeploymentBatcher.Phase3Params memory params,
            DeploymentBatcher.StrategyCodeIds memory codeIds
        )
    {
        vm.chainId(8453);
        address protocolTreasury = makeAddr("protocolTreasury");
        MockCreate2DeployerForPhase3 create2 = new MockCreate2DeployerForPhase3();
        MockUniswapV3FactoryForPhase3 uniswapFactory = new MockUniswapV3FactoryForPhase3();
        uniswapFactory.setPool(address(new MockUniswapV3PoolForPhase3()));
        MockAjnaPoolFactoryForPhase3 ajnaFactory = new MockAjnaPoolFactoryForPhase3(makeAddr("ajnaPool"));
        vault = new MockVaultStrategyManagerForPhase3(address(this));
        MockCharmStrategyForPhase3 charmStrategy = new MockCharmStrategyForPhase3();
        MockAjnaVaultAuthForPhase3 ajnaAuth = new MockAjnaVaultAuthForPhase3();
        MockAjnaAdapterForPhase3 ajnaStrategy = new MockAjnaAdapterForPhase3();
        MockOwnableTransferForPhase3 solanaStrategy = new MockOwnableTransferForPhase3();

        bytes32 charmAlpha = bytes32(uint256(1));
        bytes32 charmCode = bytes32(uint256(2));
        bytes32 ajnaAuthCode = bytes32(uint256(3));
        bytes32 ajnaVaultCode = bytes32(uint256(4));
        bytes32 ajnaAdapterCode = bytes32(uint256(5));
        bytes32 solanaCode = bytes32(uint256(6));
        codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: charm == 0 ? bytes32(0) : charmAlpha,
            creatorCharmStrategy: charm == 0 ? bytes32(0) : charmCode,
            ajnaVaultAuth: ajna == 0 ? bytes32(0) : ajnaAuthCode,
            ajnaVault: ajna == 0 ? bytes32(0) : ajnaVaultCode,
            erc4626StrategyAdapter: ajna == 0 ? bytes32(0) : ajnaAdapterCode,
            solanaStrategy: solana == 0 ? bytes32(0) : solanaCode
        });
        if (charm != 0) create2.setDeployment(charmCode, address(charmStrategy));
        if (ajna != 0) {
            create2.setDeployment(ajnaAuthCode, address(ajnaAuth));
            create2.setDeployment(ajnaVaultCode, makeAddr("ajnaVault"));
            create2.setDeployment(ajnaAdapterCode, address(ajnaStrategy));
        }
        if (solana != 0) create2.setDeployment(solanaCode, address(solanaStrategy));

        DeploymentBatcherPhase2Module phase2 = new DeploymentBatcherPhase2Module(
            address(create2),
            makeAddr("registry"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            protocolTreasury,
            makeAddr("lotteryManager"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("batcher")
        );
        batcher = new DeploymentBatcher(
            makeAddr("registry"),
            makeAddr("bytecodeStore"),
            address(create2),
            protocolTreasury,
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            makeAddr("permit2"),
            makeAddr("usdc"),
            address(uniswapFactory),
            makeAddr("uniswapRouter"),
            address(ajnaFactory),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule"),
            address(phase2)
        );
        vault.setManagement(address(batcher));
        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(GOVERNANCE_SELECTOR),
            abi.encode(address(0x424cdd9021AF88A86C76b245e24583f9a71e32a1))
        );
        vm.mockCall(CHARM_FACTORY, abi.encodeWithSelector(PROTOCOL_FEE_SELECTOR), abi.encode(CHARM_PROTOCOL_FEE_PIPS));
        vm.mockCall(
            CHARM_FACTORY,
            abi.encodeWithSelector(CREATE_VAULT_SELECTOR),
            abi.encode(address(new MockCharmVaultForPhase3(protocolTreasury)))
        );
        params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            vault: address(vault),
            version: "handler",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: charm,
            ajnaWeightBps: ajna,
            solanaWeightBps: solana,
            ajnaBufferRatioBps: 1_500,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: true,
            expectedCharmProtocolFeePips: CHARM_PROTOCOL_FEE_PIPS
        });
    }

    function _assertPhase3(MockVaultStrategyManagerForPhase3 vault, uint256 charm, uint256 ajna, uint256 solana)
        internal
        view
    {
        uint256 expectedCount = (charm == 0 ? 0 : 1) + (ajna == 0 ? 0 : 1) + (solana == 0 ? 0 : 1);
        uint256 totalWeight;
        assertEq(vault.strategyCount(), expectedCount, "strategy count");
        for (uint256 i = 0; i < expectedCount; i++) {
            uint256 weight = vault.weights(i);
            assertGt(weight, 0, "zero registered weight");
            assertLe(weight, 10_000, "registered overweight");
            totalWeight += weight;
        }
        assertEq(totalWeight, charm + ajna + solana, "total weight");
        assertLe(totalWeight, 10_000, "sum overweight");
    }
}

contract DeploymentBatcherPhaseLiveInvariantTest is Test {
    BatcherPhaseHandler internal handler;

    function setUp() external {
        handler = new BatcherPhaseHandler();
        targetContract(address(handler));
    }

    function invariant_phase3DeploymentGateMatchesWeights() external view {
        assertEq(handler.badAccepted(), 0, "invalid phase accepted");
        assertEq(handler.badRejected(), 0, "valid phase rejected");
    }
}

contract BatcherPhase12Handler is Test {
    bytes32 internal constant VAULT_CODE_ID = bytes32(uint256(1));
    bytes32 internal constant WRAPPER_CODE_ID = bytes32(uint256(2));
    bytes32 internal constant SHARE_OFT_CODE_ID = bytes32(uint256(3));
    bytes32 internal constant OFT_BOOTSTRAP_CODE_ID = bytes32(uint256(4));
    bytes32 internal constant GAUGE_CODE_ID = bytes32(uint256(5));
    bytes32 internal constant CCA_CODE_ID = bytes32(uint256(6));
    bytes32 internal constant ORACLE_CODE_ID = bytes32(uint256(7));

    address internal constant CANONICAL_ENDPOINT = address(0x1a44076050125825900e736c501f859c50fE728c);
    address internal constant ATTACKER_ENDPOINT = address(0x2222222222222222222222222222222222222222);

    uint256 internal constant MAX_CASES = 24;

    uint256 public finalized;
    uint256 public coreOnly;
    uint256 public badEndpointBindings;
    uint256 public badWrapperWiring;
    uint256 public unexpectedReverts;

    function runPhase1(uint8 mode, uint32 seed) external {
        if (finalized + coreOnly + badEndpointBindings + badWrapperWiring + unexpectedReverts >= MAX_CASES) return;

        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();
        (DeploymentBatcher deployer, MockCreatorRegistry registry, MockUniversalCreate2Deployer create2) =
            _fixture(address(bootstrap));
        DeploymentBatcher.Phase1Params memory params = _params(seed);
        DeploymentBatcher.CodeIds memory codeIds = _codeIds();

        try deployer.deployPhase1CoreWithSalt(params, codeIds, bytes32(0)) returns (
            DeploymentBatcher.Phase1Result memory core
        ) {
            if (mode % 3 == 0) {
                coreOnly++;
                if (core.oftBootstrapRegistry != address(bootstrap)) badEndpointBindings++;
                return;
            }

            if (mode % 3 == 1) {
                registry.setEndpoint(ATTACKER_ENDPOINT);
            }

            if (mode % 3 == 2) {
                _predeployShareOft(create2, deployer, params, codeIds);
            }

            try deployer.finalizePhase1WithSalt(params, codeIds, bytes32(0)) returns (
                DeploymentBatcher.Phase1Result memory out
            ) {
                finalized++;
                if (MockShareOFT(out.shareOFT).constructorEndpoint() != bootstrap.LZ_COMMON_ENDPOINT()) {
                    badEndpointBindings++;
                }
                if (MockWrapper(out.wrapper).shareOFT() != out.shareOFT) {
                    badWrapperWiring++;
                }
            } catch {
                unexpectedReverts++;
            }
        } catch {
            unexpectedReverts++;
        }
    }

    function _params(uint32 seed) internal view returns (DeploymentBatcher.Phase1Params memory params) {
        params = DeploymentBatcher.Phase1Params({
            creatorToken: address(uint160(uint256(keccak256(abi.encode("creator", seed))))),
            owner: address(this),
            vaultName: "Creator Vault",
            vaultSymbol: "cvTOKEN",
            shareName: "Creator Shares",
            shareSymbol: "sTOK",
            version: string.concat("v", vm.toString(seed))
        });
    }

    function _codeIds() internal pure returns (DeploymentBatcher.CodeIds memory codeIds) {
        codeIds = DeploymentBatcher.CodeIds({
            vault: VAULT_CODE_ID,
            wrapper: WRAPPER_CODE_ID,
            shareOFT: SHARE_OFT_CODE_ID,
            gauge: GAUGE_CODE_ID,
            cca: CCA_CODE_ID,
            oracle: ORACLE_CODE_ID,
            oftBootstrap: OFT_BOOTSTRAP_CODE_ID
        });
    }

    function _fixture(address bootstrapAddress)
        internal
        returns (DeploymentBatcher deployer, MockCreatorRegistry registry, MockUniversalCreate2Deployer create2)
    {
        vm.chainId(8453);
        registry = new MockCreatorRegistry(CANONICAL_ENDPOINT);
        MockBytecodeStore store = new MockBytecodeStore();
        create2 = new MockUniversalCreate2Deployer();
        store.setCode(OFT_BOOTSTRAP_CODE_ID, bytes("mock-oft-bootstrap"));
        store.setCode(SHARE_OFT_CODE_ID, bytes("mock-share-oft"));
        create2.configureBootstrap(keccak256("4626:OFTBootstrapRegistry:v1"), OFT_BOOTSTRAP_CODE_ID, bootstrapAddress);
        create2.setCodeKind(VAULT_CODE_ID, 1);
        create2.setCodeKind(WRAPPER_CODE_ID, 2);
        create2.setCodeKind(SHARE_OFT_CODE_ID, 3);

        DeploymentBatcherPhase2Module phase2 = new DeploymentBatcherPhase2Module(
            address(create2),
            address(registry),
            address(0x1003),
            address(0x1001),
            address(0x1002),
            address(this),
            address(0x1005),
            address(0x1004),
            makeAddr("batcher")
        );
        deployer = new DeploymentBatcher(
            address(registry),
            address(store),
            address(create2),
            address(this),
            address(0x1001),
            address(0x1002),
            address(0x1003),
            address(0x1004),
            address(0x1005),
            address(0x1006),
            address(0x1007),
            address(0x1008),
            address(0x1009),
            address(0x1010),
            address(0x2001),
            address(0x2002),
            address(0x2003),
            address(phase2)
        );
    }

    function _predeployShareOft(
        MockUniversalCreate2Deployer create2,
        DeploymentBatcher deployer,
        DeploymentBatcher.Phase1Params memory params,
        DeploymentBatcher.CodeIds memory codeIds
    ) internal {
        bytes32 baseSalt = keccak256(
            abi.encodePacked(params.creatorToken, params.owner, block.chainid, "4626:deploy:", params.version)
        );
        (address bootstrapAddr,,,, bytes32 shareOftSalt,,,,) = deployer.phase1SplitStates(baseSalt);
        bytes memory shareOftArgs = abi.encode(params.shareName, "STOK", bootstrapAddr, address(deployer));
        bytes32 shareOftInitCodeHash = keccak256(bytes.concat(bytes("mock-share-oft"), shareOftArgs));
        MockShareOFT squattedShareOFT = new MockShareOFT(params.shareName, "STOK", bootstrapAddr, address(deployer));
        create2.setComputedAddress(shareOftSalt, shareOftInitCodeHash, address(squattedShareOFT));
        create2.setDeployRevert(shareOftSalt, codeIds.shareOFT, true);
    }
}

contract DeploymentBatcherPhase12LiveInvariantTest is Test {
    BatcherPhase12Handler internal handler;

    function setUp() external {
        handler = new BatcherPhase12Handler();
        targetContract(address(handler));
    }

    function invariant_phase1AndPhase2EndpointsStayCanonical() external view {
        assertEq(handler.badEndpointBindings(), 0, "shareOFT endpoint drift");
        assertEq(handler.badWrapperWiring(), 0, "wrapper shareOFT wiring drift");
        assertEq(handler.unexpectedReverts(), 0, "phase1/phase2 unexpected revert");
    }
}

contract BatcherPhase2Handler is Test {
    uint256 internal constant MAX_CASES = 24;

    uint256 public accepted;
    uint256 public rejected;
    uint256 public badAccepted;
    uint256 public badRejected;

    function finalizePhase2(uint96 rawDepositAmount, bool sufficientPermit, uint32 seed) external {
        if (accepted + rejected + badAccepted + badRejected >= MAX_CASES) return;

        rawDepositAmount;
        uint256 depositAmount = 50_000_000 ether;
        uint256 permitAmount = sufficientPermit ? depositAmount : depositAmount - 1;
        (
            DeploymentBatcher batcher,
            MockCreatorTokenPermit2 creatorToken,
            MockShareOFTPermit2 shareOFT,
            MockWrapperPermit2 wrapper,
            MockVaultPermit2 vault,
            MockOwnableTransferPermit2 gauge,
            MockOwnableTransferPermit2 cca,
            MockOwnableTransferPermit2 oracle,
            MockPermit2Deployment permit2,
            address ownerAddr
        ) = _fixture(seed);

        DeploymentBatcher.Phase2FinalizeParams memory params = DeploymentBatcher.Phase2FinalizeParams({
            creatorToken: address(creatorToken),
            owner: ownerAddr,
            vault: address(vault),
            wrapper: address(wrapper),
            shareOFT: address(shareOFT),
            gaugeController: address(gauge),
            ccaStrategy: address(cca),
            oracle: address(oracle),
            version: string.concat("v-test-", vm.toString(seed)),
            depositAmount: depositAmount,
            requiredRaise: 1 ether,
            floorPriceQ96: 1,
            auctionSteps: hex"1234",
            meteoraAlphaVault: bytes32(0),
            solanaIxs: new IBaseSolanaBridge.Ix[](0)
        });

        ISignatureTransfer.PermitTransferFrom memory permit = _permit(address(creatorToken), permitAmount);

        vm.prank(ownerAddr);
        try IDeploymentBatcherPermit2(address(batcher)).finalizePhase2WithPermit2(params, permit, hex"abcd") {
            if (!sufficientPermit) {
                badAccepted++;
                return;
            }
            accepted++;
            if (permit2.lastOwner() != ownerAddr) badAccepted++;
            if (permit2.lastRequestedAmount() != depositAmount) badAccepted++;
            if (creatorToken.balanceOf(address(wrapper)) != depositAmount) badAccepted++;
            bytes32 baseSalt = keccak256(
                abi.encodePacked(address(creatorToken), ownerAddr, block.chainid, "4626:deploy:", params.version)
            );
            (address pendingShareOFT, address pendingCca, uint256 pendingAmount, uint256 pendingLpReserveAmount) =
                batcher.pendingAuctions(baseSalt);
            if (pendingShareOFT != address(shareOFT) || pendingCca != address(cca)) badAccepted++;
            if (pendingAmount != (depositAmount * 40) / 100) badAccepted++;
            if (pendingLpReserveAmount != (depositAmount * 20) / 100) badAccepted++;
        } catch {
            sufficientPermit ? badRejected++ : rejected++;
        }
    }

    function _fixture(uint32 seed)
        internal
        returns (
            DeploymentBatcher batcher,
            MockCreatorTokenPermit2 creatorToken,
            MockShareOFTPermit2 shareOFT,
            MockWrapperPermit2 wrapper,
            MockVaultPermit2 vault,
            MockOwnableTransferPermit2 gauge,
            MockOwnableTransferPermit2 cca,
            MockOwnableTransferPermit2 oracle,
            MockPermit2Deployment permit2,
            address ownerAddr
        )
    {
        vm.chainId(8453);
        ownerAddr = address(uint160(uint256(keccak256(abi.encode("phase2-owner", seed)))));
        creatorToken = new MockCreatorTokenPermit2();
        shareOFT = new MockShareOFTPermit2();
        wrapper = new MockWrapperPermit2(address(creatorToken), address(shareOFT));
        vault = new MockVaultPermit2(address(this));
        gauge = new MockOwnableTransferPermit2();
        cca = new MockOwnableTransferPermit2();
        oracle = new MockOwnableTransferPermit2();
        permit2 = new MockPermit2Deployment(address(creatorToken));

        batcher = new DeploymentBatcher(
            makeAddr("registry"),
            makeAddr("bytecodeStore"),
            makeAddr("create2Deployer"),
            makeAddr("protocolTreasury"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            address(permit2),
            makeAddr("usdc"),
            makeAddr("uniswapV3Factory"),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule"),
            makeAddr("phase2Module")
        );
        DeploymentBatcherPhase2Module phase2 = new DeploymentBatcherPhase2Module(
            makeAddr("create2Deployer"),
            makeAddr("registry"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("protocolTreasury"),
            makeAddr("lotteryManager"),
            makeAddr("vaultActivationBatcher"),
            address(batcher)
        );
        vm.store(address(batcher), bytes32(uint256(8)), bytes32(uint256(uint160(address(phase2)))));

        creatorToken.mint(ownerAddr, 100_000_000 ether);
        vm.prank(ownerAddr);
        creatorToken.approve(address(permit2), type(uint256).max);

        string memory version = string.concat("v-test-", vm.toString(seed));
        bytes32 baseSalt =
            keccak256(abi.encodePacked(address(creatorToken), ownerAddr, block.chainid, "4626:deploy:", version));
        bytes32 base = keccak256(abi.encode(baseSalt, uint256(4)));
        vm.store(address(batcher), bytes32(uint256(base) + 1), bytes32(uint256(uint160(address(vault)))));
        vm.store(address(batcher), bytes32(uint256(base) + 2), bytes32(uint256(uint160(address(wrapper)))));
        vm.store(address(batcher), bytes32(uint256(base) + 3), bytes32(uint256(uint160(address(shareOFT)))));
        vm.store(address(batcher), bytes32(uint256(base) + 7), bytes32(uint256(0x0101)));
    }

    function _permit(address token, uint256 amount)
        internal
        view
        returns (ISignatureTransfer.PermitTransferFrom memory permit)
    {
        permit.permitted = ISignatureTransfer.TokenPermissions({token: token, amount: amount});
        permit.nonce = 1;
        permit.deadline = block.timestamp + 1 days;
    }
}

contract DeploymentBatcherPhase2LiveInvariantTest is Test {
    BatcherPhase2Handler internal handler;

    function setUp() external {
        handler = new BatcherPhase2Handler();
        targetContract(address(handler));
    }

    function invariant_phase2Permit2FinalizationMatchesDepositState() external view {
        assertEq(handler.badAccepted(), 0, "invalid phase2 accepted");
        assertEq(handler.badRejected(), 0, "valid phase2 rejected");
    }
}
