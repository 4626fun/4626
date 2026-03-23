// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DeploymentBatcher} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import {IBaseSolanaBridge} from "../contracts/interfaces/IBaseSolanaBridge.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

interface IDeploymentBatcherPermit2 {
    function finalizePhase2WithPermit2(
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external returns (DeploymentBatcher.Phase2Result memory out);
}

contract MockCreatorTokenPermit2 is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockShareOFTPermit2 is ERC20 {
    address public owner;

    constructor() ERC20("Share Token", "SHARE") {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferOwnership(address newOwner) external {
        owner = newOwner;
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
    DeploymentBatcher internal batcher;

    function setUp() public {
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
            makeAddr("vaultAdminModule")
        );

        creatorToken.mint(ownerAddr, 100_000_000e18);
        vm.prank(ownerAddr);
        creatorToken.approve(address(permit2), type(uint256).max);
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
        IDeploymentBatcherPermit2(address(batcher)).finalizePhase2WithPermit2(params, permit, hex"abcd");

        bytes32 baseSalt = keccak256(abi.encodePacked(address(creatorToken), ownerAddr, block.chainid, "4626:deploy:", "v-test"));
        (address pendingShareOFT, address pendingCca, uint256 pendingAmount) = batcher.pendingAuctions(baseSalt);

        assertEq(permit2.lastOwner(), ownerAddr);
        assertEq(permit2.lastTo(), address(batcher));
        assertEq(permit2.lastRequestedAmount(), depositAmount);
        assertEq(creatorToken.balanceOf(address(wrapper)), depositAmount);
        assertEq(pendingShareOFT, address(shareOFT));
        assertEq(pendingCca, address(cca));
        assertEq(pendingAmount, depositAmount / 2);
    }

    function _permit(uint256 amount) internal view returns (ISignatureTransfer.PermitTransferFrom memory permit) {
        permit.permitted = ISignatureTransfer.TokenPermissions({token: address(creatorToken), amount: amount});
        permit.nonce = 1;
        permit.deadline = block.timestamp + 1 days;
    }
}
