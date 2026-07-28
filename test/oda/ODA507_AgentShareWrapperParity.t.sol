// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {AgentOVaultWrapper} from "@4626/agent/vault/AgentOVaultWrapper.sol";
import {AgentShareOFT} from "@4626/agent/vault/AgentShareOFT.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {SendParam, MessagingFee} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

contract MockAgentTokenForODA507 is ERC20 {
    constructor() ERC20("Agent Token", "AGNT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAgentVaultForODA507 is ERC20 {
    ERC20 public immutable assetToken;

    constructor(address asset_) ERC20("Agent Vault Share", "avAGNT") {
        assetToken = ERC20(asset_);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        assetToken.transferFrom(msg.sender, address(this), assets);
        shares = assets;
        _mint(receiver, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        assetToken.transfer(receiver, shares);
        return shares;
    }

    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares;
    }
}

interface IWrapperCooldownHook {
    function propagateCooldownOnTransfer(address from, address to, uint256 amount) external;
}

/// @dev Minimal ShareOFT stand-in that mirrors AgentShareOFT._update hook shape.
contract MockAgentShareOFTWithHook is ERC20 {
    address public wrapper;

    constructor() ERC20("Agent Share", "ASHARE") {}

    function setWrapper(address _wrapper) external {
        wrapper = _wrapper;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);
        address _wrapper = wrapper;
        if (_wrapper == address(0)) return;
        if (from == address(0) || to == address(0)) return;
        if (from == to) return;
        IWrapperCooldownHook(_wrapper).propagateCooldownOnTransfer(from, to, value);
    }
}

contract MockShareOFTPlain {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }
}

contract MockRegistryForAgentShareOFTLzReceive {
    address public immutable endpoint;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30184;
    }

    function getLotteryManager(uint256) external pure returns (address) {
        return address(0);
    }
}

/// @notice ODA-507 Creator-lane parity remediations for AgentShareOFT + AgentOVaultWrapper.
contract ODA507AgentShareWrapperParityTest is Test {
    using stdStorage for StdStorage;

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint32 internal constant SRC_EID_HUB = 22222;
    bytes32 internal constant HUB_LOTTERY_PEER = bytes32(uint256(uint160(address(0xCAFE))));
    bytes32 internal constant HUB_OFT_PEER = bytes32(uint256(uint160(address(0xBEEF))));

    event LotteryWinnerNotification(
        address indexed winner, address indexed creatorCoin, uint256 totalSharesPaid, uint32 indexed sourceHubEid
    );

    function test_ODA507_2_withdrawFor_doesNotSiphonBeneficiaryDust() public {
        address alice = makeAddr("alice");
        address composer = makeAddr("composer");

        MockAgentTokenForODA507 token = new MockAgentTokenForODA507();
        MockAgentVaultForODA507 vault = new MockAgentVaultForODA507(address(token));
        MockShareOFTPlain shareOFT = new MockShareOFTPlain();
        AgentOVaultWrapper wrapper = new AgentOVaultWrapper(address(token), address(vault), address(this));
        wrapper.setShareOFT(address(shareOFT));
        wrapper.setBeneficiaryOperator(composer, true);

        token.mint(composer, 1_001);
        vm.prank(composer);
        token.approve(address(wrapper), type(uint256).max);

        vm.prank(composer);
        wrapper.depositFor(1_001, 0, alice);
        assertEq(wrapper.userDustShares(alice), 1);
        assertEq(shareOFT.balanceOf(composer), 1);

        vm.roll(block.number + 1);

        vm.prank(composer);
        uint256 agentOut = wrapper.withdrawFor(1, 0, alice);
        assertEq(agentOut, 1_000);
        assertEq(wrapper.userDustShares(alice), 1, "beneficiary dust must remain");
        assertEq(shareOFT.balanceOf(composer), 0);
        assertTrue(wrapper.isBalanced());
    }

    function test_ODA507_1_hotDustDoesNotFreezeEstablishedCooledBalance() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        MockAgentTokenForODA507 token = new MockAgentTokenForODA507();
        MockAgentVaultForODA507 vault = new MockAgentVaultForODA507(address(token));
        MockAgentShareOFTWithHook shareOFT = new MockAgentShareOFTWithHook();
        AgentOVaultWrapper wrapper = new AgentOVaultWrapper(address(token), address(vault), address(this));
        wrapper.setShareOFT(address(shareOFT));
        shareOFT.setWrapper(address(wrapper));

        vault.mint(alice, 10_000);
        vault.mint(bob, 10_000);
        vm.prank(alice);
        vault.approve(address(wrapper), type(uint256).max);
        vm.prank(bob);
        vault.approve(address(wrapper), type(uint256).max);

        // bob wraps at block N and waits out cooldown
        vm.prank(bob);
        wrapper.wrap(1_000);
        vm.roll(block.number + 1);

        // alice wraps later and dust-transfers to bob
        vm.prank(alice);
        wrapper.wrap(1_000);
        vm.prank(alice);
        shareOFT.transfer(bob, 1);

        uint256 bobStamp = wrapper.lastWrapperDepositBlock(bob);
        assertEq(bobStamp, block.number, "established holder inherits hot cooldown");
        assertEq(wrapper.cooldownShareOFTBalance(bob), 1, "only transferred dust is hot");

        // Bob may still withdraw his previously cooled unit.
        vm.prank(bob);
        wrapper.unwrap(1);

        // The unsolicited hot unit remains blocked until the next block.
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(AgentOVaultWrapper.WrapperWithdrawTooSoon.selector, bobStamp, bobStamp + 1)
        );
        wrapper.unwrap(1);
    }

    function test_ODA507_5_flushFees_rejectsComposeMsg() public {
        address owner = makeAddr("owner");
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        MockRegistryForAgentShareOFTLzReceive registry = new MockRegistryForAgentShareOFTLzReceive(LZ_ENDPOINT);

        vm.prank(owner);
        AgentShareOFT shareOFT = new AgentShareOFT("Agent Share", "aSHARE", address(registry), owner);

        vm.prank(owner);
        shareOFT.setHubConfig(false, SRC_EID_HUB, address(0xFEED));

        stdstore.target(address(shareOFT)).sig("pendingFees()").checked_write(uint256(1e18));

        SendParam memory sendParam = shareOFT.buildFlushSendParam();
        sendParam.composeMsg = hex"01";

        vm.expectRevert(bytes("No compose allowed"));
        shareOFT.flushFees(sendParam, MessagingFee({nativeFee: 0, lzTokenFee: 0}));
    }

    function test_ODA507_11_renounceOwnershipDisabled() public {
        address owner = makeAddr("owner");
        MockAgentTokenForODA507 token = new MockAgentTokenForODA507();
        MockAgentVaultForODA507 vault = new MockAgentVaultForODA507(address(token));
        AgentOVaultWrapper wrapper = new AgentOVaultWrapper(address(token), address(vault), owner);

        vm.prank(owner);
        vm.expectRevert(bytes("RenounceDisabled"));
        wrapper.renounceOwnership();

        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        MockRegistryForAgentShareOFTLzReceive registry = new MockRegistryForAgentShareOFTLzReceive(LZ_ENDPOINT);
        vm.prank(owner);
        AgentShareOFT shareOFT = new AgentShareOFT("Agent Share", "aSHARE", address(registry), owner);
        vm.prank(owner);
        vm.expectRevert(bytes("RenounceDisabled"));
        shareOFT.renounceOwnership();
    }

    function test_ODA507_4_winnerCallbackAcceptedFromOftHubPeer() public {
        address owner = makeAddr("owner");
        address winner = address(0x1111111111111111111111111111111111111111);
        address agentToken = address(0x2222222222222222222222222222222222222222);
        uint256 totalSharesPaid = 123e18;

        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        MockRegistryForAgentShareOFTLzReceive registry = new MockRegistryForAgentShareOFTLzReceive(LZ_ENDPOINT);

        vm.prank(owner);
        AgentShareOFT shareOFT = new AgentShareOFT("Agent Share", "aSHARE", address(registry), owner);

        vm.startPrank(owner);
        shareOFT.setHubConfig(false, SRC_EID_HUB, address(0xFEED));
        shareOFT.setHubLotteryPeer(SRC_EID_HUB, HUB_LOTTERY_PEER);
        // Forwarded-callback wiring: OFT peer is the hub ShareOFT, not the lottery manager.
        shareOFT.setPeer(SRC_EID_HUB, HUB_OFT_PEER);
        vm.stopPrank();

        bytes memory message =
            abi.encode(uint16(shareOFT.MSG_TYPE_WINNER_CALLBACK()), winner, agentToken, totalSharesPaid);
        assertEq(message.length, 128);

        Origin memory origin = Origin({srcEid: SRC_EID_HUB, sender: HUB_OFT_PEER, nonce: 3});

        vm.expectEmit(true, true, true, true, address(shareOFT));
        emit LotteryWinnerNotification(winner, agentToken, totalSharesPaid, SRC_EID_HUB);

        uint256 winnerBalBefore = shareOFT.balanceOf(winner);
        vm.prank(LZ_ENDPOINT);
        shareOFT.lzReceive(origin, bytes32(uint256(3)), message, address(0), "");
        assertEq(shareOFT.balanceOf(winner), winnerBalBefore, "winner callback must not credit OFT tokens");
    }
}
