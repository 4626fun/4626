// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SolanaBridgeAdapter} from "../contracts/utilities/bridge/SolanaBridgeAdapter.sol";
import {IBaseSolanaBridge} from "../contracts/interfaces/IBaseSolanaBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BaseSolanaBridgeMock {
    address public lastLocalToken;
    bytes32 public lastRemoteToken;
    bytes32 public lastDestination;
    uint64 public lastRemoteAmount;
    uint256 public lastIxCount;
    bytes32 public lastIxProgramId;

    function getPredictedTwinAddress(bytes32 solanaPubkey) external pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(solanaPubkey)))));
    }

    function bridgeToken(IBaseSolanaBridge.Transfer calldata transfer, IBaseSolanaBridge.Ix[] calldata ixs)
        external
        payable
    {
        lastLocalToken = transfer.localToken;
        lastRemoteToken = transfer.remoteToken;
        lastDestination = transfer.to;
        lastRemoteAmount = transfer.remoteAmount;
        lastIxCount = ixs.length;
        lastIxProgramId = ixs.length > 0 ? ixs[0].programId : bytes32(0);
    }
}

contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockRegistry {
    address public shareOft;
    address public creatorCoin;
    address public gauge;

    function setMappings(address _shareOft, address _creatorCoin, address _gauge) external {
        shareOft = _shareOft;
        creatorCoin = _creatorCoin;
        gauge = _gauge;
    }

    function getTokenForShareOFT(address shareOft_) external view returns (address) {
        if (shareOft_ == shareOft) return creatorCoin;
        return address(0);
    }

    function getGaugeControllerForToken(address token) external view returns (address) {
        if (token == creatorCoin) return gauge;
        return address(0);
    }
}

contract MockGauge {
    uint256 public totalReceived;

    function receiveFees(uint256 amount) external {
        totalReceived += amount;
    }
}

contract MockLotteryManager {
    uint256 public calls;
    address public lastBuyer;
    address public lastToken;
    uint256 public lastAmount;

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn) external payable returns (uint256) {
        calls += 1;
        lastBuyer = buyer;
        lastToken = tokenIn;
        lastAmount = amountIn;
        return calls;
    }

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256)
        external
        payable
        returns (uint256)
    {
        calls += 1;
        lastBuyer = buyer;
        lastToken = tokenIn;
        lastAmount = amountIn;
        return calls;
    }
}

contract SolanaBridgeAdapterEdgeCasesTest is Test {
    address constant BRIDGE = address(bytes20(hex"3eff766c76a1be2ce1acf2b69c78bcae257d5188"));

    SolanaBridgeAdapter adapter;
    MockRegistry registry;
    MockGauge gauge;
    MockLotteryManager lottery;
    MockERC20 shareOFT;

    bytes32 keeperPubkey;
    bytes32 buyerPubkey;
    address keeperTwin;
    address buyerTwin;

    function setUp() public {
        registry = new MockRegistry();
        gauge = new MockGauge();
        lottery = new MockLotteryManager();
        shareOFT = new MockERC20("ShareOFT", "SHARE", 18);

        adapter = new SolanaBridgeAdapter(address(registry), address(this));

        BaseSolanaBridgeMock bridge = new BaseSolanaBridgeMock();
        vm.etch(BRIDGE, address(bridge).code);

        keeperPubkey = keccak256(abi.encodePacked("keeper"));
        buyerPubkey = keccak256(abi.encodePacked("buyer"));
        keeperTwin = _predictedTwin(keeperPubkey);
        buyerTwin = _predictedTwin(buyerPubkey);

        registry.setMappings(address(shareOFT), address(0xBEEF), address(gauge));
        adapter.registerToken(address(shareOFT), bytes32(uint256(1)), 9);
        adapter.setLotteryManager(address(lottery));
    }

    function test_getTwinAddress_revertsOnZero() public {
        vm.expectRevert(SolanaBridgeAdapter.InvalidAddress.selector);
        adapter.getTwinAddress(bytes32(0));
    }

    function test_setLotteryManager_revertsOnZero() public {
        vm.expectRevert(SolanaBridgeAdapter.InvalidAddress.selector);
        adapter.setLotteryManager(address(0));
    }

    function test_setFeeKeeper_revertsOnZeroPubkey() public {
        vm.expectRevert(SolanaBridgeAdapter.InvalidAddress.selector);
        adapter.setFeeKeeper(bytes32(0), true);
    }

    function test_setRegistry_revertsOnZero() public {
        vm.expectRevert(SolanaBridgeAdapter.InvalidAddress.selector);
        adapter.setRegistry(address(0));
    }

    function test_bridgeToSolana_revertsOnDust() public {
        shareOFT.mint(address(this), 1);
        IERC20(address(shareOFT)).approve(address(adapter), 1);

        vm.expectRevert(SolanaBridgeAdapter.InvalidAmount.selector);
        adapter.bridgeToSolana(address(shareOFT), 1, bytes32(uint256(123)));
    }

    function test_bridgeToSolanaWithIxs_forwardsInstructionPayload() public {
        uint256 amount = 1e18;
        shareOFT.mint(address(this), amount);
        IERC20(address(shareOFT)).approve(address(adapter), amount);

        IBaseSolanaBridge.Ix[] memory ixs = new IBaseSolanaBridge.Ix[](1);
        bytes[] memory serializedAccounts = new bytes[](1);
        serializedAccounts[0] = hex"010203";
        ixs[0] = IBaseSolanaBridge.Ix({
            programId: bytes32(uint256(1234)), serializedAccounts: serializedAccounts, data: hex"deadbeef"
        });

        adapter.bridgeToSolanaWithIxs(address(shareOFT), amount, bytes32(uint256(456)), ixs);

        BaseSolanaBridgeMock bridge = BaseSolanaBridgeMock(BRIDGE);
        assertEq(bridge.lastIxCount(), 1);
        assertEq(uint256(bridge.lastIxProgramId()), uint256(bytes32(uint256(1234))));
        assertEq(bridge.lastLocalToken(), address(shareOFT));
    }

    function test_receiveFeeFromSolana_revertsForUnauthorizedKeeper() public {
        vm.prank(keeperTwin);
        vm.expectRevert(abi.encodeWithSelector(SolanaBridgeAdapter.UnauthorizedFeeKeeper.selector, keeperPubkey));
        adapter.receiveFeeFromSolana(keeperPubkey, address(shareOFT), 1);
    }

    function test_receiveFeeFromSolana_revertsForGaugeNotFound() public {
        adapter.setFeeKeeper(keeperPubkey, true);
        registry.setMappings(address(shareOFT), address(0xBEEF), address(0));

        vm.prank(keeperTwin);
        vm.expectRevert(abi.encodeWithSelector(SolanaBridgeAdapter.GaugeNotFound.selector, address(shareOFT)));
        adapter.receiveFeeFromSolana(keeperPubkey, address(shareOFT), 1);
    }

    function test_receiveFeeFromSolana_forwardsFees() public {
        uint256 amount = 5e18;
        adapter.setFeeKeeper(keeperPubkey, true);

        shareOFT.mint(keeperTwin, amount);
        vm.startPrank(keeperTwin);
        IERC20(address(shareOFT)).approve(address(adapter), amount);
        adapter.receiveFeeFromSolana(keeperPubkey, address(shareOFT), amount);
        vm.stopPrank();

        assertEq(gauge.totalReceived(), amount);
    }

    function test_processLotteryEntryFromSolana_requiresManager() public {
        SolanaBridgeAdapter fresh = new SolanaBridgeAdapter(address(registry), address(this));
        fresh.registerToken(address(shareOFT), bytes32(uint256(1)), 9);
        fresh.setEntryKeeper(keeperPubkey, true);

        SolanaBridgeAdapter.LotteryEntry[] memory entries = new SolanaBridgeAdapter.LotteryEntry[](1);
        entries[0] = SolanaBridgeAdapter.LotteryEntry({
            buyerSolanaPubkey: buyerPubkey, shareOFT: address(shareOFT), amountSolanaUnits: 1
        });

        vm.prank(keeperTwin);
        vm.expectRevert(SolanaBridgeAdapter.LotteryManagerNotSet.selector);
        fresh.processLotteryEntryFromSolana(keeperPubkey, entries);
    }

    function test_processLotteryEntryFromSolana_scalesAndCalls() public {
        adapter.setEntryKeeper(keeperPubkey, true);

        SolanaBridgeAdapter.LotteryEntry[] memory entries = new SolanaBridgeAdapter.LotteryEntry[](1);
        entries[0] = SolanaBridgeAdapter.LotteryEntry({
            buyerSolanaPubkey: buyerPubkey, shareOFT: address(shareOFT), amountSolanaUnits: 2
        });

        vm.prank(keeperTwin);
        adapter.processLotteryEntryFromSolana(keeperPubkey, entries);

        assertEq(lottery.calls(), 1);
        assertEq(lottery.lastBuyer(), buyerTwin);
        assertEq(lottery.lastToken(), address(shareOFT));
        assertEq(lottery.lastAmount(), 2e9);
    }

    function test_processLotteryEntryFromSolana_skipsZeroAmount() public {
        MockERC20 lowDecimals = new MockERC20("Low", "LOW", 6);
        adapter.registerToken(address(lowDecimals), bytes32(uint256(2)), 9);
        adapter.setEntryKeeper(keeperPubkey, true);

        SolanaBridgeAdapter.LotteryEntry[] memory entries = new SolanaBridgeAdapter.LotteryEntry[](1);
        entries[0] = SolanaBridgeAdapter.LotteryEntry({
            buyerSolanaPubkey: buyerPubkey, shareOFT: address(lowDecimals), amountSolanaUnits: 1
        });

        vm.prank(keeperTwin);
        adapter.processLotteryEntryFromSolana(keeperPubkey, entries);

        assertEq(lottery.calls(), 0);
    }

    function test_processLotteryEntryFromSolana_skipsUnregisteredToken() public {
        MockERC20 unregistered = new MockERC20("Unregistered", "UNR", 18);
        adapter.setEntryKeeper(keeperPubkey, true);

        SolanaBridgeAdapter.LotteryEntry[] memory entries = new SolanaBridgeAdapter.LotteryEntry[](1);
        entries[0] = SolanaBridgeAdapter.LotteryEntry({
            buyerSolanaPubkey: buyerPubkey, shareOFT: address(unregistered), amountSolanaUnits: 10
        });

        vm.prank(keeperTwin);
        adapter.processLotteryEntryFromSolana(keeperPubkey, entries);

        assertEq(lottery.calls(), 0);
    }

    function _predictedTwin(bytes32 pubkey) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(pubkey)))));
    }
}
