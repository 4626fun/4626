// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OFTComposeMsgCodec} from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";
import {OVaultHubComposer} from "../contracts/utilities/messaging/OVaultHubComposer.sol";

contract MockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

contract MockRegistryForOVaultComposer {
    address public immutable endpoint;
    mapping(address => address) public wrapperForToken;
    mapping(address => address) public shareOftForToken;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function setBindings(address creatorToken, address wrapper, address shareOft) external {
        wrapperForToken[creatorToken] = wrapper;
        shareOftForToken[creatorToken] = shareOft;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getWrapperForToken(address creatorToken) external view returns (address) {
        return wrapperForToken[creatorToken];
    }

    function getShareOFTForToken(address creatorToken) external view returns (address) {
        return shareOftForToken[creatorToken];
    }
}

contract MockWrapperForComposer {
    MockToken public immutable creatorCoin;
    MockToken public immutable shareOFT;

    uint16 public depositSpendBps = 10_000;
    uint16 public depositMintBps = 10_000;
    uint16 public depositReturnBps = 10_000;

    uint16 public redeemBurnBps = 10_000;
    uint16 public redeemMintBps = 10_000;
    uint16 public redeemReturnBps = 10_000;

    constructor(address _creatorCoin, address _shareOft) {
        creatorCoin = MockToken(_creatorCoin);
        shareOFT = MockToken(_shareOft);
    }

    function setDepositConfig(uint16 spendBps, uint16 mintBps, uint16 returnBps) external {
        depositSpendBps = spendBps;
        depositMintBps = mintBps;
        depositReturnBps = returnBps;
    }

    function setRedeemConfig(uint16 burnBps, uint16 mintBps, uint16 returnBps) external {
        redeemBurnBps = burnBps;
        redeemMintBps = mintBps;
        redeemReturnBps = returnBps;
    }

    function deposit(uint256 amount, uint256 minOut) external returns (uint256 shareOftOut) {
        uint256 spend = (amount * depositSpendBps) / 10_000;
        if (spend > 0) {
            creatorCoin.transferFrom(msg.sender, address(this), spend);
        }
        uint256 minted = (amount * depositMintBps) / 10_000;
        if (minted > 0) {
            shareOFT.mint(msg.sender, minted);
        }
        shareOftOut = (amount * depositReturnBps) / 10_000;
        require(shareOftOut >= minOut, "slippage");
    }

    function withdraw(uint256 amount, uint256 minOut) external returns (uint256 creatorCoinOut) {
        uint256 burnAmount = (amount * redeemBurnBps) / 10_000;
        if (burnAmount > 0) {
            shareOFT.transferFrom(msg.sender, address(this), burnAmount);
            shareOFT.burn(address(this), burnAmount);
        }
        uint256 minted = (amount * redeemMintBps) / 10_000;
        if (minted > 0) {
            creatorCoin.mint(msg.sender, minted);
        }
        creatorCoinOut = (amount * redeemReturnBps) / 10_000;
        require(creatorCoinOut >= minOut, "slippage");
    }
}

contract OVaultHubComposerTest is Test {
    uint32 internal constant SRC_EID = 40168;

    address internal owner = address(this);
    address internal endpoint = address(0x1a44076050125825900e736c501f859c50fE728c);
    address internal sourceOft = address(0xBEEF);
    address internal receiver = address(0xCAFE);
    address internal composeFrom = address(0xF00D);

    MockToken internal creatorToken;
    MockToken internal shareOft;
    MockRegistryForOVaultComposer internal registry;
    MockWrapperForComposer internal wrapper;
    OVaultHubComposer internal composer;

    function setUp() public {
        creatorToken = new MockToken("Creator", "CRT");
        shareOft = new MockToken("Share", "SHARE");
        registry = new MockRegistryForOVaultComposer(endpoint);
        wrapper = new MockWrapperForComposer(address(creatorToken), address(shareOft));
        registry.setBindings(address(creatorToken), address(wrapper), address(shareOft));

        composer = new OVaultHubComposer(address(registry), owner);
        composer.setAllowedComposeSender(sourceOft, true);
        composer.setAllowedComposeSender(address(shareOft), true);
    }

    function test_RevertWhen_NotEndpoint() public {
        bytes memory message = _buildComposeMessage({
            nonce: 1,
            srcEid: SRC_EID,
            amountLD: 1e18,
            composeFrom_: composeFrom,
            action: composer.ACTION_DEPOSIT(),
            creatorToken_: address(creatorToken),
            wrapper_: address(wrapper),
            receiver_: receiver,
            sourceOft_: sourceOft,
            minOut: 0
        });

        vm.expectRevert(OVaultHubComposer.OnlyEndpoint.selector);
        composer.lzCompose(sourceOft, bytes32("guid"), message, address(0), "");
    }

    function test_DepositCompose_HappyPath_ExactInvariants() public {
        uint256 amountIn = 25e18;
        creatorToken.mint(address(composer), amountIn);

        bytes memory message = _buildComposeMessage({
            nonce: 11,
            srcEid: SRC_EID,
            amountLD: amountIn,
            composeFrom_: composeFrom,
            action: composer.ACTION_DEPOSIT(),
            creatorToken_: address(creatorToken),
            wrapper_: address(wrapper),
            receiver_: receiver,
            sourceOft_: sourceOft,
            minOut: 0
        });

        uint256 composerCreatorBefore = creatorToken.balanceOf(address(composer));
        uint256 composerShareBefore = shareOft.balanceOf(address(composer));

        vm.prank(endpoint);
        composer.lzCompose(sourceOft, bytes32("g1"), message, address(0xE1), "");

        assertEq(creatorToken.balanceOf(address(composer)), composerCreatorBefore - amountIn, "creator spend mismatch");
        assertEq(shareOft.balanceOf(address(composer)), composerShareBefore, "share residual mismatch");
        assertEq(shareOft.balanceOf(receiver), amountIn, "receiver share out mismatch");
    }

    function test_RedeemCompose_HappyPath_ExactInvariants() public {
        uint256 sharesIn = 9e18;
        shareOft.mint(address(composer), sharesIn);

        bytes memory message = _buildComposeMessage({
            nonce: 22,
            srcEid: SRC_EID,
            amountLD: sharesIn,
            composeFrom_: composeFrom,
            action: composer.ACTION_REDEEM(),
            creatorToken_: address(creatorToken),
            wrapper_: address(wrapper),
            receiver_: receiver,
            sourceOft_: address(shareOft),
            minOut: 0
        });

        uint256 composerCreatorBefore = creatorToken.balanceOf(address(composer));
        uint256 composerShareBefore = shareOft.balanceOf(address(composer));

        vm.prank(endpoint);
        composer.lzCompose(address(shareOft), bytes32("g2"), message, address(0xE2), "");

        assertEq(shareOft.balanceOf(address(composer)), composerShareBefore - sharesIn, "share spend mismatch");
        assertEq(creatorToken.balanceOf(address(composer)), composerCreatorBefore, "creator residual mismatch");
        assertEq(creatorToken.balanceOf(receiver), sharesIn, "receiver creator out mismatch");
    }

    function test_DepositCompose_RevertOnInputSpendInvariant() public {
        uint256 amountIn = 10e18;
        creatorToken.mint(address(composer), amountIn);
        wrapper.setDepositConfig(5_000, 10_000, 10_000); // spends only 50%

        bytes memory message = _buildComposeMessage({
            nonce: 33,
            srcEid: SRC_EID,
            amountLD: amountIn,
            composeFrom_: composeFrom,
            action: composer.ACTION_DEPOSIT(),
            creatorToken_: address(creatorToken),
            wrapper_: address(wrapper),
            receiver_: receiver,
            sourceOft_: sourceOft,
            minOut: 0
        });

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("InputSpendInvariantFailed(address,uint256,uint256,uint256)")),
                address(creatorToken),
                amountIn,
                amountIn / 2,
                amountIn
            )
        );
        vm.prank(endpoint);
        composer.lzCompose(sourceOft, bytes32("g3"), message, address(0), "");
    }

    function test_RedeemCompose_RevertOnOutputMintInvariant() public {
        uint256 sharesIn = 10e18;
        shareOft.mint(address(composer), sharesIn);
        wrapper.setRedeemConfig(10_000, 5_000, 10_000); // mints less creator than returned

        bytes memory message = _buildComposeMessage({
            nonce: 44,
            srcEid: SRC_EID,
            amountLD: sharesIn,
            composeFrom_: composeFrom,
            action: composer.ACTION_REDEEM(),
            creatorToken_: address(creatorToken),
            wrapper_: address(wrapper),
            receiver_: receiver,
            sourceOft_: address(shareOft),
            minOut: 0
        });

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("OutputMintInvariantFailed(address,uint256,uint256,uint256)")),
                address(creatorToken),
                0,
                sharesIn / 2,
                sharesIn
            )
        );
        vm.prank(endpoint);
        composer.lzCompose(address(shareOft), bytes32("g4"), message, address(0), "");
    }

    function _buildComposeMessage(
        uint64 nonce,
        uint32 srcEid,
        uint256 amountLD,
        address composeFrom_,
        uint8 action,
        address creatorToken_,
        address wrapper_,
        address receiver_,
        address sourceOft_,
        uint256 minOut
    ) internal pure returns (bytes memory) {
        bytes memory userPayload = abi.encode(action, creatorToken_, wrapper_, receiver_, sourceOft_, minOut);
        bytes memory oftComposeMsg = abi.encodePacked(bytes32(uint256(uint160(composeFrom_))), userPayload);
        return OFTComposeMsgCodec.encode(nonce, srcEid, amountLD, oftComposeMsg);
    }
}
