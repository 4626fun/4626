// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {ICreatorRegistry} from "../contracts/interfaces/core/ICreatorRegistry.sol";
import {DeploymentBatcher, DeploymentBatcherPhase2Module} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import {IBaseSolanaBridge} from "../contracts/interfaces/IBaseSolanaBridge.sol";
import {IOFT, SendParam, MessagingFee, MessagingReceipt, OFTReceipt, OFTLimit, OFTFeeDetail} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

contract MockCreatorTokenPeerWiring is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockShareOftPeerWiring is ERC20 {
    address public owner;
    mapping(uint32 => bytes32) public peers;
    uint256 public setPeerCallCount;

    constructor(address owner_) ERC20("Share Token", "SHARE") {
        owner = owner_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setPeer(uint32 eid, bytes32 peer) external {
        require(msg.sender == owner, "not owner");
        peers[eid] = peer;
        setPeerCallCount += 1;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }

    function quoteOFT(SendParam calldata sendParam)
        external
        pure
        returns (OFTLimit memory oftLimit, OFTFeeDetail[] memory oftFeeDetails, OFTReceipt memory receipt)
    {
        oftLimit = OFTLimit({minAmountLD: 0, maxAmountLD: sendParam.amountLD});
        oftFeeDetails = new OFTFeeDetail[](0);
        receipt = OFTReceipt({amountSentLD: sendParam.amountLD, amountReceivedLD: sendParam.amountLD});
    }

    function quoteSend(SendParam calldata, bool) external pure returns (MessagingFee memory fee) {
        fee = MessagingFee({nativeFee: 1, lzTokenFee: 0});
    }

    function send(SendParam calldata, MessagingFee calldata, address)
        external
        payable
        returns (MessagingReceipt memory receipt, OFTReceipt memory oftReceipt)
    {
        receipt = MessagingReceipt({guid: bytes32(0), nonce: 0, fee: MessagingFee({nativeFee: 0, lzTokenFee: 0})});
        oftReceipt = OFTReceipt({amountSentLD: 0, amountReceivedLD: 0});
    }
}

contract MockWrapperPeerWiring {
    IERC20 internal immutable creatorToken;
    MockShareOftPeerWiring internal immutable shareToken;
    address public owner;

    constructor(address creatorToken_, address shareToken_, address owner_) {
        creatorToken = IERC20(creatorToken_);
        shareToken = MockShareOftPeerWiring(shareToken_);
        owner = owner_;
    }

    function deposit(uint256 amount) external returns (uint256 shareTokens) {
        address tokenSource = msg.sender;
        if (creatorToken.balanceOf(tokenSource) < amount) {
            tokenSource = owner;
        }
        creatorToken.transferFrom(tokenSource, address(this), amount);
        shareToken.mint(owner, amount);
        return amount;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockVaultPeerWiring {
    address public owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function setProtocolRescue(address) external {}

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockOwnablePeerWiring {
    address public owner = msg.sender;

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract Phase2DelegatecallProbe is DeploymentBatcherPhase2Module {
    constructor(
        address _create2Deployer,
        address _registry,
        address _chainlinkEthUsd,
        address _poolManager,
        address _taxHook,
        address _protocolTreasury,
        address _lotteryManager,
        address _vaultActivationBatcher,
        address _batcher
    )
        DeploymentBatcherPhase2Module(
            _create2Deployer,
            _registry,
            _chainlinkEthUsd,
            _poolManager,
            _taxHook,
            _protocolTreasury,
            _lotteryManager,
            _vaultActivationBatcher,
            _batcher
        )
    {}

    function probeContext() external view returns (address selfAddr, address batcherAddr, bool matches) {
        selfAddr = address(this);
        batcherAddr = batcher;
        matches = selfAddr == batcherAddr;
    }

    function runEnsureRegistryAndShareOftPeerWired(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        uint32 solanaEid
    ) external {
        if (address(this) != batcher) revert NotBatcherContext();
        _ensureRegistryAndShareOftPeerWired(params, solanaEid);
    }
}

contract DeploymentBatcherPeerHarness is DeploymentBatcher {
    constructor(
        address _registry,
        address _bytecodeStore,
        address _create2Deployer,
        address _protocolTreasury,
        address _protocolAutomation,
        address _poolManager,
        address _taxHook,
        address _chainlinkEthUsd,
        address _vaultActivationBatcher,
        address _lotteryManager,
        address _permit2,
        address _usdc,
        address _uniswapV3Factory,
        address _uniswapRouter,
        address _ajnaFactory,
        address _vaultCoreModule,
        address _vaultStrategiesModule,
        address _vaultAdminModule,
        address _phase2Module
    )
        DeploymentBatcher(
            _registry,
            _bytecodeStore,
            _create2Deployer,
            _protocolTreasury,
            _protocolAutomation,
            _poolManager,
            _taxHook,
            _chainlinkEthUsd,
            _vaultActivationBatcher,
            _lotteryManager,
            _permit2,
            _usdc,
            _uniswapV3Factory,
            _uniswapRouter,
            _ajnaFactory,
            _vaultCoreModule,
            _vaultStrategiesModule,
            _vaultAdminModule,
            address(0),
            address(0),
            address(0),
            address(0)
        )
    {}

    function setPhase2ModuleForTest(DeploymentBatcherPhase2Module module_) external {
        phase2Module = module_;
    }

    function probePhase2DelegatecallContext()
        external
        returns (address selfAddr, address batcherAddr, bool matches)
    {
        (bool ok, bytes memory outData) = address(phase2Module).delegatecall(
            abi.encodeWithSelector(Phase2DelegatecallProbe.probeContext.selector)
        );
        require(ok, "probe delegatecall failed");
        return abi.decode(outData, (address, address, bool));
    }

    function runEnsureShareOftPeerWiringForTest(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        uint32 solanaEid
    ) external {
        _delegatePhase2(
            abi.encodeWithSelector(
                Phase2DelegatecallProbe.runEnsureRegistryAndShareOftPeerWired.selector, params, solanaEid
            )
        );
    }

    function seedPhase1StateForTest(
        bytes32 baseSalt,
        address vault_,
        address wrapper_,
        address shareOFT_,
        bool coreDone_,
        bool finalized_
    ) external {
        Phase1SplitState storage state = phase1SplitStates[baseSalt];
        state.vault = vault_;
        state.wrapper = wrapper_;
        state.shareOFT = shareOFT_;
        state.coreDone = coreDone_;
        state.finalized = finalized_;
    }
}

contract DeploymentBatcherShareOftPeerWiringTest is Test {
    uint32 internal constant SOLANA_EID = 30168;
    bytes32 internal constant SOLANA_DESTINATION = bytes32(uint256(0xABCD));
    bytes32 internal constant REGISTRY_PEER = bytes32(uint256(0x1234));
    bytes32 internal constant BATCHER_DEFAULT_PEER = bytes32(uint256(0x5678));

    address internal ownerAddr = makeAddr("owner");
    address internal protocolTreasury = makeAddr("protocolTreasury");

    CreatorRegistry internal registry;
    MockCreatorTokenPeerWiring internal creatorToken;
    MockShareOftPeerWiring internal shareOFT;
    MockWrapperPeerWiring internal wrapper;
    MockVaultPeerWiring internal vault;
    MockOwnablePeerWiring internal gauge;
    MockOwnablePeerWiring internal cca;
    MockOwnablePeerWiring internal oracle;
    DeploymentBatcherPeerHarness internal batcher;

    function setUp() public {
        vm.chainId(8453);

        registry = new CreatorRegistry(address(this));
        creatorToken = new MockCreatorTokenPeerWiring();
        batcher = new DeploymentBatcherPeerHarness(
            address(registry),
            makeAddr("bytecodeStore"),
            makeAddr("create2Deployer"),
            protocolTreasury,
            makeAddr("protocolAutomation"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            makeAddr("permit2"),
            makeAddr("usdc"),
            makeAddr("uniswapV3Factory"),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule"),
            address(0)
        );

        shareOFT = new MockShareOftPeerWiring(address(batcher));
        wrapper = new MockWrapperPeerWiring(address(creatorToken), address(shareOFT), address(batcher));
        vault = new MockVaultPeerWiring(address(this));
        gauge = new MockOwnablePeerWiring();
        cca = new MockOwnablePeerWiring();
        oracle = new MockOwnablePeerWiring();

        DeploymentBatcherPhase2Module phase2Module = new Phase2DelegatecallProbe(
            makeAddr("create2Deployer"),
            address(registry),
            makeAddr("chainlinkEthUsd"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            protocolTreasury,
            makeAddr("lotteryManager"),
            makeAddr("vaultActivationBatcher"),
            address(batcher)
        );
        batcher.setPhase2ModuleForTest(phase2Module);

        registry.setAuthorizedFactory(address(batcher), true);

        vm.startPrank(protocolTreasury);
        batcher.setOVaultRuntimeConfig(makeAddr("hubComposer"), SOLANA_EID, true);
        batcher.setSolanaConfig(makeAddr("adapter"), SOLANA_DESTINATION);
        vm.stopPrank();
    }

    function _params() internal view returns (DeploymentBatcher.Phase2FinalizeParams memory params) {
        params = DeploymentBatcher.Phase2FinalizeParams({
            creatorToken: address(creatorToken),
            owner: ownerAddr,
            vault: address(vault),
            wrapper: address(wrapper),
            shareOFT: address(shareOFT),
            gaugeController: address(gauge),
            ccaStrategy: address(cca),
            oracle: address(oracle),
            version: "v-peer",
            depositAmount: 50_000_000e18,
            requiredRaise: 1 ether,
            floorPriceQ96: 1,
            auctionSteps: hex"1234",
            meteoraAlphaVault: bytes32(0),
            solanaIxs: new IBaseSolanaBridge.Ix[](0)
        });
    }

    function _runPeerWiring() internal {
        batcher.runEnsureShareOftPeerWiringForTest(_params(), SOLANA_EID);
    }

    function test_delegatecallContextMatchesOnProbeModule() external {
        Phase2DelegatecallProbe probeModule = new Phase2DelegatecallProbe(
            makeAddr("create2Deployer"),
            address(registry),
            makeAddr("chainlinkEthUsd"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            protocolTreasury,
            makeAddr("lotteryManager"),
            makeAddr("vaultActivationBatcher"),
            address(batcher)
        );
        batcher.setPhase2ModuleForTest(probeModule);
        (address selfAddr, address batcherAddr, bool matches) = batcher.probePhase2DelegatecallContext();
        assertEq(selfAddr, address(batcher));
        assertEq(batcherAddr, address(batcher));
        assertTrue(matches);
    }

    function test_phase2ModuleBatcherMatchesHarness() external view {
        DeploymentBatcherPhase2Module module = DeploymentBatcherPhase2Module(batcher.phase2Module());
        assertEq(module.batcher(), address(batcher));
    }

    function test_ensureShareOftPeerWiring_wiresShareOftPeerFromRegistry() external {
        registry.registerCreatorCoin(
            address(creatorToken), "Creator Coin", "CR8R", ownerAddr, address(0), 0
        );
        registry.setRemoteOFTPeerBytes32(address(creatorToken), SOLANA_EID, REGISTRY_PEER);

        _runPeerWiring();

        assertEq(shareOFT.peers(SOLANA_EID), REGISTRY_PEER, "share oft peer not wired");
        assertEq(registry.getRemoteOFTPeerBytes32(address(creatorToken), SOLANA_EID), REGISTRY_PEER);
    }

    function test_ensureShareOftPeerWiring_seedsRegistryFromBatcherDefaultPeer() external {
        vm.prank(protocolTreasury);
        batcher.setSolanaShareOftPeer(BATCHER_DEFAULT_PEER);

        _runPeerWiring();

        assertEq(shareOFT.peers(SOLANA_EID), BATCHER_DEFAULT_PEER, "default peer not wired");
        assertEq(registry.getRemoteOFTPeerBytes32(address(creatorToken), SOLANA_EID), BATCHER_DEFAULT_PEER);
        ICreatorRegistry.CreatorCoinInfo memory info = registry.getCreatorCoin(address(creatorToken));
        assertEq(info.token, address(creatorToken), "creator not auto-registered");
        assertEq(info.shareOFT, address(shareOFT), "share oft not synced");
    }

    function test_ensureShareOftPeerWiring_revertsWhenNoPeerConfigured() external {
        vm.expectRevert(DeploymentBatcherPhase2Module.SolanaShareOftPeerNotConfigured.selector);
        _runPeerWiring();
    }

    function test_ensureShareOftPeerWiring_skipsSetPeerWhenAlreadyMatched() external {
        registry.registerCreatorCoin(
            address(creatorToken), "Creator Coin", "CR8R", ownerAddr, address(0), 0
        );
        registry.setRemoteOFTPeerBytes32(address(creatorToken), SOLANA_EID, REGISTRY_PEER);
        vm.prank(address(batcher));
        shareOFT.setPeer(SOLANA_EID, REGISTRY_PEER);
        uint256 callsBefore = shareOFT.setPeerCallCount();

        _runPeerWiring();

        assertEq(shareOFT.peers(SOLANA_EID), REGISTRY_PEER);
        assertEq(shareOFT.setPeerCallCount(), callsBefore, "setPeer should not run when peer already matches");
    }
}
