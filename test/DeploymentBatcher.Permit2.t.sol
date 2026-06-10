// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeploymentBatcher, DeploymentBatcherPhase2Module, DeploymentBatcherUtilsHelper} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {IOFT, SendParam, MessagingFee, MessagingReceipt, OFTReceipt, OFTLimit, OFTFeeDetail} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import {IBaseSolanaBridge} from "../contracts/interfaces/IBaseSolanaBridge.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

interface IDeploymentBatcherPermit2 {
    function finalizePhase2WithPermit2(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external payable returns (DeploymentBatcher.Phase2Result memory out);
}

contract MockCreatorTokenPermit2 is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockShareOFTPermit2 is ERC20 {
    address public owner;
    mapping(uint32 => bytes32) public peers;

    constructor() ERC20("Share Token", "SHARE") {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }

    function setPeer(uint32 eid, bytes32 peer) external {
        require(msg.sender == owner, "not owner");
        peers[eid] = peer;
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

contract MockWrapperPermit2 {
    IERC20 internal immutable creatorToken;
    MockShareOFTPermit2 internal immutable shareToken;
    address public owner;

    constructor(address creatorToken_, address shareToken_) {
        creatorToken = IERC20(creatorToken_);
        shareToken = MockShareOFTPermit2(shareToken_);
        owner = msg.sender;
    }

    function deposit(uint256 amount) external returns (uint256 shareTokens) {
        creatorToken.transferFrom(msg.sender, address(this), amount);
        shareToken.mint(msg.sender, amount);
        return amount;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockVaultPermit2 {
    address public protocolRescue;
    address public owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function setProtocolRescue(address rescue) external {
        protocolRescue = rescue;
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockOwnableTransferPermit2 {
    address public owner = msg.sender;

    function transferOwnership(address newOwner) external {
        owner = newOwner;
    }
}

contract MockPermit2Deployment is ISignatureTransfer {
    address internal immutable expectedToken;

    address public lastOwner;
    address public lastTo;
    uint256 public lastRequestedAmount;

    constructor(address token_) {
        expectedToken = token_;
    }

    function DOMAIN_SEPARATOR() external pure override returns (bytes32) {
        return bytes32(uint256(1));
    }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata
    ) external override {
        require(permit.permitted.token == expectedToken, "unexpected token");
        require(transferDetails.requestedAmount <= permit.permitted.amount, "amount exceeds permit");
        lastOwner = owner;
        lastTo = transferDetails.to;
        lastRequestedAmount = transferDetails.requestedAmount;
        IERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }

    function permitWitnessTransferFrom(
        PermitTransferFrom calldata,
        SignatureTransferDetails calldata,
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external pure override {
        revert("unused");
    }

    function permitTransferFrom(
        PermitBatchTransferFrom calldata,
        SignatureTransferDetails[] calldata,
        address,
        bytes calldata
    ) external pure override {
        revert("unused");
    }

    function permitWitnessTransferFrom(
        PermitBatchTransferFrom calldata,
        SignatureTransferDetails[] calldata,
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external pure override {
        revert("unused");
    }

    function invalidateUnorderedNonces(uint256, uint256) external pure override {
        revert("unused");
    }

    function nonceBitmap(address, uint256) external pure override returns (uint256) {
        return 0;
    }
}

contract DeploymentBatcherHarness is DeploymentBatcher {
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

    function setUtilsHelperForTest(DeploymentBatcherUtilsHelper helper_) external {
        utilsHelper = helper_;
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

contract DeploymentBatcherPermit2Test is Test {
    address internal ownerAddr = makeAddr("owner");

    MockCreatorTokenPermit2 internal creatorToken;
    MockShareOFTPermit2 internal shareOFT;
    MockWrapperPermit2 internal wrapper;
    MockVaultPermit2 internal vault;
    MockOwnableTransferPermit2 internal gauge;
    MockOwnableTransferPermit2 internal cca;
    MockOwnableTransferPermit2 internal oracle;
    MockPermit2Deployment internal permit2;
    DeploymentBatcherHarness internal batcher;
    CreatorRegistry internal registry;
    address internal protocolTreasury = makeAddr("protocolTreasury");

    function setUp() public {
        vm.chainId(8453);

        registry = new CreatorRegistry(address(this));
        creatorToken = new MockCreatorTokenPermit2();
        shareOFT = new MockShareOFTPermit2();
        wrapper = new MockWrapperPermit2(address(creatorToken), address(shareOFT));
        vault = new MockVaultPermit2(address(this));
        gauge = new MockOwnableTransferPermit2();
        cca = new MockOwnableTransferPermit2();
        oracle = new MockOwnableTransferPermit2();
        permit2 = new MockPermit2Deployment(address(creatorToken));

        batcher = new DeploymentBatcherHarness(
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
            address(permit2),
            makeAddr("usdc"),
            makeAddr("uniswapV3Factory"),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule"),
            address(0)
        );
        shareOFT.transferOwnership(address(batcher));
        DeploymentBatcherPhase2Module phase2Fixture = new DeploymentBatcherPhase2Module(
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
        batcher.setPhase2ModuleForTest(phase2Fixture);
        batcher.setUtilsHelperForTest(new DeploymentBatcherUtilsHelper());
        registry.setAuthorizedFactory(address(batcher), true);
        vm.startPrank(protocolTreasury);
        batcher.setOVaultRuntimeConfig(makeAddr("hubComposer"), 30_168, true);
        batcher.setSolanaConfig(makeAddr("solanaAdapter"), bytes32(uint256(0xABCD)));
        batcher.setSolanaShareOftPeer(bytes32(uint256(0x5678)));
        vm.stopPrank();

        creatorToken.mint(ownerAddr, 100_000_000e18);
        vm.deal(ownerAddr, 1 ether);
        vm.prank(ownerAddr);
        creatorToken.approve(address(permit2), type(uint256).max);

        bytes32 baseSalt = keccak256(abi.encodePacked(address(creatorToken), ownerAddr, block.chainid, "4626:deploy:", "v-test"));
        batcher.seedPhase1StateForTest(baseSalt, address(vault), address(wrapper), address(shareOFT), true, true);
    }

    function test_finalizePhase2WithPermit2_pullsFundsViaPermit2_and_defersAuction() external {
        uint256 depositAmount = 50_000_000e18;
        DeploymentBatcher.Phase2FinalizeParams memory params = DeploymentBatcher.Phase2FinalizeParams({
            creatorToken: address(creatorToken),
            owner: ownerAddr,
            vault: address(vault),
            wrapper: address(wrapper),
            shareOFT: address(shareOFT),
            gaugeController: address(gauge),
            ccaStrategy: address(cca),
            oracle: address(oracle),
            version: "v-test",
            depositAmount: depositAmount,
            requiredRaise: 1 ether,
            floorPriceQ96: 1,
            auctionSteps: hex"1234",
            meteoraAlphaVault: bytes32(0),
            solanaIxs: new IBaseSolanaBridge.Ix[](0)
        });

        ISignatureTransfer.PermitTransferFrom memory permit = _permit(depositAmount);

        vm.prank(ownerAddr);
        IDeploymentBatcherPermit2(address(batcher)).finalizePhase2WithPermit2{value: 1}(params, permit, hex"abcd");

        bytes32 baseSalt = keccak256(abi.encodePacked(address(creatorToken), ownerAddr, block.chainid, "4626:deploy:", "v-test"));
        (address pendingShareOFT, address pendingCca, uint256 pendingAmount, uint256 pendingLpReserveAmount) =
            batcher.pendingAuctions(baseSalt);

        assertEq(permit2.lastOwner(), ownerAddr);
        assertEq(permit2.lastTo(), address(batcher));
        assertEq(permit2.lastRequestedAmount(), depositAmount);
        assertEq(creatorToken.balanceOf(address(wrapper)), depositAmount);
        assertEq(pendingShareOFT, address(shareOFT));
        assertEq(pendingCca, address(cca));
        assertEq(pendingAmount, (depositAmount * 30) / 100);
        assertEq(pendingLpReserveAmount, (depositAmount * 10) / 100);
    }

    function _permit(uint256 amount) internal view returns (ISignatureTransfer.PermitTransferFrom memory permit) {
        permit.permitted = ISignatureTransfer.TokenPermissions({token: address(creatorToken), amount: amount});
        permit.nonce = 1;
        permit.deadline = block.timestamp + 1 days;
    }
}
