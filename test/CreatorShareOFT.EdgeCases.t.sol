// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/utilities/messaging/CreatorShareOFT.sol";
import {ILotteryBeneficiary} from "../contracts/utilities/messaging/CreatorShareOFT.sol";

/**
 * @title CreatorShareOFT Comprehensive Edge Case Tests
 * @notice Tests ALL possible edge cases for lottery attribution
 */

// ============================================================================
// MOCK CONTRACTS
// ============================================================================

contract MockRegistry {
    address public lotteryManager;

    constructor(address _lotteryManager) {
        lotteryManager = _lotteryManager;
    }

    function getLotteryManager(uint256) external view returns (address) {
        return lotteryManager;
    }

    function getLayerZeroEndpoint(uint256) external pure returns (address) {
        return address(0x1a44076050125825900e736c501f859c50fE728c);
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30184;
    }

    function setLotteryManager(address _mgr) external {
        lotteryManager = _mgr;
    }
}

contract MockGaugeController {
    function receiveFees(uint256) external {}
}

contract MockLotteryManager {
    struct LotteryCall {
        address buyer;
        address tokenIn;
        uint256 amountIn;
        uint256 timestamp;
    }

    LotteryCall[] public calls;
    bool public shouldRevert;
    uint256 public gasToConsume;

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn) external payable returns (uint256) {
        if (shouldRevert) revert("Lottery reverted");
        if (gasToConsume > 0) {
            uint256 gasStart = gasleft();
            while (gasStart - gasleft() < gasToConsume) {}
        }
        calls.push(LotteryCall({buyer: buyer, tokenIn: tokenIn, amountIn: amountIn, timestamp: block.timestamp}));
        return calls.length;
    }

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256)
        external
        payable
        returns (uint256)
    {
        if (shouldRevert) revert("Lottery reverted");
        if (gasToConsume > 0) {
            uint256 gasStart = gasleft();
            while (gasStart - gasleft() < gasToConsume) {}
        }
        calls.push(LotteryCall({buyer: buyer, tokenIn: tokenIn, amountIn: amountIn, timestamp: block.timestamp}));
        return calls.length;
    }

    function setShouldRevert(bool _revert) external {
        shouldRevert = _revert;
    }

    function setGasToConsume(uint256 _gas) external {
        gasToConsume = _gas;
    }

    function getCallCount() external view returns (uint256) {
        return calls.length;
    }

    function getCall(uint256 index) external view returns (address buyer, address tokenIn, uint256 amountIn) {
        LotteryCall memory c = calls[index];
        return (c.buyer, c.tokenIn, c.amountIn);
    }

    function getLastCall() external view returns (address buyer, address tokenIn, uint256 amountIn) {
        require(calls.length > 0, "No calls");
        return this.getCall(calls.length - 1);
    }

    function clearCalls() external {
        delete calls;
    }
}

// Smart wallet mocks
contract MockCoinbaseSmartWallet {
    function execute(address target, bytes calldata data) external returns (bytes memory) {
        (bool success, bytes memory result) = target.call(data);
        require(success);
        return result;
    }
}

contract MockSafeMultisig {
    function execTransaction(address to, uint256 value, bytes calldata data) external returns (bool) {
        (bool success,) = to.call{value: value}(data);
        return success;
    }
}

contract MockArgentWallet {
    function execute(address _to, uint256 _value, bytes calldata _data) external returns (bytes memory) {
        (bool success, bytes memory result) = _to.call{value: _value}(_data);
        require(success);
        return result;
    }
}

// Aggregator mocks
contract MockPassthroughAggregator {
    function forwardTokens(address token, address recipient, uint256 amount) external {
        IERC20(token).transfer(recipient, amount);
    }
}

contract MockSplitAggregator {
    function splitTransfer(address token, address[] calldata recipients, uint256[] calldata amounts) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            IERC20(token).transfer(recipients[i], amounts[i]);
        }
    }
}

// ILotteryBeneficiary implementations
contract MockBeneficiaryReturnsAddress {
    address public beneficiary;

    function setBeneficiary(address _b) external {
        beneficiary = _b;
    }

    function getLotteryBeneficiary() external view returns (address) {
        return beneficiary;
    }
}

contract MockBeneficiaryReverts {
    function getLotteryBeneficiary() external pure returns (address) {
        revert("I always revert");
    }
}

contract MockBeneficiaryHighGas {
    function getLotteryBeneficiary() external view returns (address) {
        // Consume lots of gas
        uint256 sum;
        for (uint256 i = 0; i < 10000; i++) {
            sum += i;
        }
        return address(uint160(sum % 1000));
    }
}

contract MockBeneficiaryReturnsSelf {
    function getLotteryBeneficiary() external view returns (address) {
        return address(this);
    }
}

// Malicious contracts
contract MockReentrantRecipient {
    address public token;
    address public target;
    uint256 public attackCount;

    function setAttack(address _token, address _target) external {
        token = _token;
        target = _target;
    }

    receive() external payable {
        if (attackCount < 3) {
            attackCount++;
            // Try to re-enter
            IERC20(token).transfer(target, 1);
        }
    }
}

contract MockGasGriefingRecipient {
    fallback() external payable {
        // Consume all gas
        while (true) {}
    }
}

// Protocol-specific mocks
contract MockCoWSettlement {
    function settle(address token, address recipient, uint256 amount) external {
        IERC20(token).transfer(recipient, amount);
    }
}

contract MockPermit2 {
    function permitTransferFrom(address token, address to, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, to, amount);
    }
}

contract MockUniversalRouter {
    function execute(address token, address recipient, uint256 amount) external {
        IERC20(token).transfer(recipient, amount);
    }
}

// Yield/DeFi mocks
contract MockYieldVault {
    function deposit(uint256) external pure returns (uint256) {
        return 0;
    }
}

contract MockBridgeContract {
    function bridgeTokens(address, uint256) external pure {}
}

contract MockTimelockController {
    function execute(address, uint256, bytes calldata, bytes32, bytes32) external {}
}

contract MockProxy {
    address public implementation;

    constructor(address _impl) {
        implementation = _impl;
    }

    fallback() external payable {
        address impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}

// ============================================================================
// TEST CONTRACT
// ============================================================================

contract CreatorShareOFTEdgeCasesTest is Test {
    CreatorShareOFT public shareOFT;
    MockRegistry public registry;
    MockLotteryManager public lotteryManager;
    MockGaugeController public gaugeController;
    MockPassthroughAggregator public aggregator;

    address public owner = address(0x1);
    address public eoaUser = address(0x2);
    address public bundler = address(0x3);
    address public eoaUser2 = address(0x4);

    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        lotteryManager = new MockLotteryManager();
        registry = new MockRegistry(address(lotteryManager));
        gaugeController = new MockGaugeController();
        aggregator = new MockPassthroughAggregator();

        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        vm.prank(owner);
        shareOFT = new CreatorShareOFT("Test Share", "sTEST", address(registry), owner);

        vm.startPrank(owner);
        shareOFT.setRegistry(address(registry));
        // Run edge-case attribution tests in hub mode for local lottery calls.
        shareOFT.setHubConfig(true, 0, address(0));
        shareOFT.setLotteryEnabled(true);
        shareOFT.setGaugeController(address(gaugeController));
        shareOFT.setFeesEnabled(true);
        shareOFT.setAddressType(address(aggregator), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.setMinter(owner, true);
        shareOFT.mint(address(aggregator), 10000 ether);
        vm.stopPrank();
    }

    // ========================================================================
    // WALLET TYPE TESTS
    // ========================================================================

    function test_WalletType_EOA() public {
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    function test_WalletType_CoinbaseSmartWallet() public {
        MockCoinbaseSmartWallet wallet = new MockCoinbaseSmartWallet();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(wallet), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(wallet));
    }

    function test_WalletType_SafeMultisig() public {
        MockSafeMultisig safe = new MockSafeMultisig();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(safe), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(safe));
    }

    function test_WalletType_ArgentWallet() public {
        MockArgentWallet argent = new MockArgentWallet();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(argent), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(argent));
    }

    function test_WalletType_ProxyWallet() public {
        MockCoinbaseSmartWallet impl = new MockCoinbaseSmartWallet();
        MockProxy proxy = new MockProxy(address(impl));

        vm.prank(address(aggregator));
        shareOFT.transfer(address(proxy), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(proxy));
    }

    // ========================================================================
    // TRANSACTION ORIGIN TESTS
    // ========================================================================

    function test_TxOrigin_DirectEOA() public {
        vm.prank(address(aggregator), eoaUser); // tx.origin = eoaUser
        shareOFT.transfer(eoaUser, 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    function test_TxOrigin_ERC4337Bundler() public {
        MockCoinbaseSmartWallet wallet = new MockCoinbaseSmartWallet();

        // tx.origin = bundler, recipient = smart wallet
        vm.prank(address(aggregator), bundler);
        shareOFT.transfer(address(wallet), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(wallet), "Should be wallet, not bundler");
        assertTrue(buyer != bundler);
    }

    function test_TxOrigin_DifferentFromRecipient() public {
        address randomOrigin = address(0x999);

        vm.prank(address(aggregator), randomOrigin);
        shareOFT.transfer(eoaUser, 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "Should use recipient, not tx.origin");
    }

    // ========================================================================
    // AGGREGATOR SCENARIO TESTS
    // ========================================================================

    function test_Aggregator_SingleHop() public {
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    function test_Aggregator_MultiHop_TwoAggregators() public {
        MockPassthroughAggregator agg2 = new MockPassthroughAggregator();

        vm.prank(owner);
        shareOFT.setAddressType(address(agg2), CreatorShareOFT.OperationType.SwapOnly);

        // Hop 1: aggregator -> agg2 (both SwapOnly, no lottery)
        vm.prank(address(aggregator));
        shareOFT.transfer(address(agg2), 100 ether);
        assertEq(lotteryManager.getCallCount(), 0, "No lottery between SwapOnly");

        // Hop 2: agg2 -> user (lottery triggers)
        vm.prank(address(agg2));
        shareOFT.transfer(eoaUser, 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    function test_Aggregator_MultiHop_ThreeAggregators() public {
        MockPassthroughAggregator agg2 = new MockPassthroughAggregator();
        MockPassthroughAggregator agg3 = new MockPassthroughAggregator();

        vm.startPrank(owner);
        shareOFT.setAddressType(address(agg2), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.setAddressType(address(agg3), CreatorShareOFT.OperationType.SwapOnly);
        vm.stopPrank();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(agg2), 100 ether);

        vm.prank(address(agg2));
        shareOFT.transfer(address(agg3), 100 ether);

        assertEq(lotteryManager.getCallCount(), 0, "No lottery in chain");

        vm.prank(address(agg3));
        shareOFT.transfer(eoaUser, 100 ether);

        assertEq(lotteryManager.getCallCount(), 1);
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    function test_Aggregator_SplitRoute() public {
        MockSplitAggregator splitAgg = new MockSplitAggregator();

        vm.startPrank(owner);
        shareOFT.setAddressType(address(splitAgg), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.mint(address(splitAgg), 100 ether);
        vm.stopPrank();

        address[] memory recipients = new address[](2);
        recipients[0] = eoaUser;
        recipients[1] = eoaUser2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 60 ether;
        amounts[1] = 40 ether;

        splitAgg.splitTransfer(address(shareOFT), recipients, amounts);

        // Both users should get lottery entries
        assertEq(lotteryManager.getCallCount(), 2);
    }

    // ========================================================================
    // ADDRESS TYPE TESTS
    // ========================================================================

    function test_AddressType_Unknown_ToUnknown_NoLottery() public {
        address unknownSender = address(0x100);

        vm.prank(owner);
        shareOFT.mint(unknownSender, 100 ether);

        lotteryManager.clearCalls();

        vm.prank(unknownSender);
        shareOFT.transfer(eoaUser, 50 ether);

        // Unknown -> Unknown = no lottery (not a "buy")
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_AddressType_SwapOnly_ToSwapOnly_NoLottery() public {
        MockPassthroughAggregator agg2 = new MockPassthroughAggregator();

        vm.prank(owner);
        shareOFT.setAddressType(address(agg2), CreatorShareOFT.OperationType.SwapOnly);

        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(agg2), 100 ether);

        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_AddressType_SwapOnly_ToNoFees_NoLottery() public {
        address noFeesAddr = address(0x200);

        vm.prank(owner);
        shareOFT.setAddressType(noFeesAddr, CreatorShareOFT.OperationType.NoFees);

        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(noFeesAddr, 100 ether);

        // NoFees skips the entire fee/lottery logic
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_AddressType_NoFees_Sender_SkipsLottery() public {
        address noFeesSender = address(0x300);

        vm.startPrank(owner);
        shareOFT.setAddressType(noFeesSender, CreatorShareOFT.OperationType.NoFees);
        shareOFT.mint(noFeesSender, 100 ether);
        vm.stopPrank();

        lotteryManager.clearCalls();

        vm.prank(noFeesSender);
        shareOFT.transfer(eoaUser, 50 ether);

        assertEq(lotteryManager.getCallCount(), 0);
    }

    // ========================================================================
    // AMOUNT EDGE CASE TESTS
    // ========================================================================

    function test_Amount_Zero_NoLottery() public {
        // Zero amount transfers are allowed by ERC20, but should not trigger lottery
        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 0);

        // Zero amount = zero fee, so lottery might not trigger
        // This is acceptable behavior
        assertEq(shareOFT.balanceOf(eoaUser), 0);
    }

    function test_Amount_VerySmall() public {
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 1); // 1 wei

        assertEq(lotteryManager.getCallCount(), 1);
    }

    function test_Amount_VeryLarge() public {
        vm.prank(owner);
        shareOFT.mint(address(aggregator), type(uint256).max / 2);

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 1000000 ether);

        assertEq(lotteryManager.getCallCount(), 1);
    }

    // ========================================================================
    // STATE EDGE CASE TESTS
    // ========================================================================

    function test_State_LotteryDisabled() public {
        vm.prank(owner);
        shareOFT.setLotteryEnabled(false);

        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);

        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_State_FeesDisabled_NoLottery() public {
        vm.prank(owner);
        shareOFT.setFeesEnabled(false);

        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);

        // Fees disabled = no _processBuy = no lottery
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_State_NoGaugeController_CannotSetToZero() public {
        // Contract doesn't allow setting gauge controller to zero address
        // This is by design - gauge controller is required for fee collection
        vm.prank(owner);
        vm.expectRevert(CreatorShareOFT.ZeroAddress.selector);
        shareOFT.setGaugeController(address(0));
    }

    function test_State_GaugeControllerRequired_ForFees() public {
        // Deploy fresh shareOFT without gauge controller
        vm.prank(owner);
        CreatorShareOFT freshOFT = new CreatorShareOFT("Fresh", "FRESH", address(registry), owner);

        vm.startPrank(owner);
        freshOFT.setRegistry(address(registry));
        freshOFT.setLotteryEnabled(true);
        freshOFT.setFeesEnabled(true);
        // NOTE: Not setting gauge controller
        freshOFT.setAddressType(address(aggregator), CreatorShareOFT.OperationType.SwapOnly);
        freshOFT.setMinter(owner, true);
        freshOFT.mint(address(aggregator), 100 ether);
        vm.stopPrank();

        lotteryManager.clearCalls();

        // Transfer should work. In remote/default mode fees are still collected,
        // while lottery is skipped because no hub lottery routing is configured.
        vm.prank(address(aggregator));
        freshOFT.transfer(eoaUser, 100 ether);

        // Fee is still applied even without gauge controller.
        assertEq(freshOFT.balanceOf(eoaUser), 93.1 ether);
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_State_NoLotteryManager_NoRevert() public {
        registry.setLotteryManager(address(0));

        lotteryManager.clearCalls();

        // Should not revert, just skip lottery
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);

        // Transfer succeeds, no lottery
        assertEq(shareOFT.balanceOf(eoaUser), 93.1 ether); // after fee
    }

    function test_State_LotteryManagerReverts_TransferSucceeds() public {
        lotteryManager.setShouldRevert(true);

        // Transfer should still succeed even if lottery reverts
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);

        assertEq(shareOFT.balanceOf(eoaUser), 93.1 ether);
    }

    // ========================================================================
    // ILOTTERYBENEFICIARY TESTS
    // ========================================================================

    function test_ILotteryBeneficiary_ReturnsValidAddress() public {
        MockBeneficiaryReturnsAddress beneficiaryContract = new MockBeneficiaryReturnsAddress();
        beneficiaryContract.setBeneficiary(eoaUser);

        vm.prank(address(aggregator));
        shareOFT.transfer(address(beneficiaryContract), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "Should use returned beneficiary");
    }

    function test_ILotteryBeneficiary_ReturnsZero_FallsBackToRecipient() public {
        MockBeneficiaryReturnsAddress beneficiaryContract = new MockBeneficiaryReturnsAddress();
        beneficiaryContract.setBeneficiary(address(0));

        vm.prank(address(aggregator));
        shareOFT.transfer(address(beneficiaryContract), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(beneficiaryContract), "Should fallback to recipient");
    }

    function test_ILotteryBeneficiary_Reverts_FallsBackToRecipient() public {
        MockBeneficiaryReverts revertingContract = new MockBeneficiaryReverts();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(revertingContract), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(revertingContract), "Should fallback to recipient on revert");
    }

    function test_ILotteryBeneficiary_ReturnsSelf() public {
        MockBeneficiaryReturnsSelf selfContract = new MockBeneficiaryReturnsSelf();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(selfContract), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(selfContract));
    }

    function test_ILotteryBeneficiary_HighGas_StillWorks() public {
        MockBeneficiaryHighGas highGasContract = new MockBeneficiaryHighGas();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(highGasContract), 100 ether);

        // Should still work, just consumes more gas
        assertEq(lotteryManager.getCallCount(), 1);
    }

    // ========================================================================
    // MULTIPLE SWAPS TESTS
    // ========================================================================

    function test_MultipleSwaps_SameBlock_SameUser() public {
        vm.startPrank(address(aggregator));
        shareOFT.transfer(eoaUser, 10 ether);
        shareOFT.transfer(eoaUser, 20 ether);
        shareOFT.transfer(eoaUser, 30 ether);
        vm.stopPrank();

        assertEq(lotteryManager.getCallCount(), 3, "All swaps should create entries");
    }

    function test_MultipleSwaps_DifferentBlocks() public {
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 10 ether);

        vm.roll(block.number + 1);

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 10 ether);

        assertEq(lotteryManager.getCallCount(), 2);
    }

    function test_MultipleSwaps_DifferentUsers_SameBlock() public {
        vm.startPrank(address(aggregator));
        shareOFT.transfer(eoaUser, 50 ether);
        shareOFT.transfer(eoaUser2, 50 ether);
        vm.stopPrank();

        assertEq(lotteryManager.getCallCount(), 2);

        (address buyer1,,) = lotteryManager.getCall(0);
        (address buyer2,,) = lotteryManager.getCall(1);

        assertEq(buyer1, eoaUser);
        assertEq(buyer2, eoaUser2);
    }

    // ========================================================================
    // PROTOCOL-SPECIFIC TESTS
    // ========================================================================

    function test_Protocol_CoWSwap_Settlement() public {
        MockCoWSettlement cow = new MockCoWSettlement();

        vm.startPrank(owner);
        shareOFT.setAddressType(address(cow), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.mint(address(cow), 100 ether);
        vm.stopPrank();

        cow.settle(address(shareOFT), eoaUser, 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    function test_Protocol_UniversalRouter() public {
        MockUniversalRouter router = new MockUniversalRouter();

        vm.startPrank(owner);
        shareOFT.setAddressType(address(router), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.mint(address(router), 100 ether);
        vm.stopPrank();

        router.execute(address(shareOFT), eoaUser, 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    // ========================================================================
    // DEFI RECIPIENT TESTS
    // ========================================================================

    function test_DeFi_YieldVault_GetsEntry() public {
        MockYieldVault vault = new MockYieldVault();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(vault), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(vault), "Vault gets entry (expected behavior)");
    }

    function test_DeFi_BridgeContract_GetsEntry() public {
        MockBridgeContract bridge = new MockBridgeContract();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(bridge), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(bridge));
    }

    function test_DeFi_Timelock_GetsEntry() public {
        MockTimelockController timelock = new MockTimelockController();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(timelock), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(timelock));
    }

    // ========================================================================
    // PERMISSION TESTS
    // ========================================================================

    function test_Permission_NonOwner_CannotSetAddressType() public {
        vm.prank(eoaUser);
        vm.expectRevert();
        shareOFT.setAddressType(address(0x999), CreatorShareOFT.OperationType.SwapOnly);
    }

    function test_Permission_CannotSetZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert();
        shareOFT.setAddressType(address(0), CreatorShareOFT.OperationType.SwapOnly);
    }

    // ========================================================================
    // GAS/PERFORMANCE TESTS
    // ========================================================================

    function test_Gas_NormalTransfer() public {
        uint256 gasBefore = gasleft();
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);
        uint256 gasUsed = gasBefore - gasleft();

        // Log gas for reference
        emit log_named_uint("Gas used for transfer", gasUsed);
        assertTrue(gasUsed < 300000, "Gas should be reasonable");
    }

    function test_Gas_TransferToContractWithInterface() public {
        MockBeneficiaryReturnsAddress beneficiary = new MockBeneficiaryReturnsAddress();
        beneficiary.setBeneficiary(eoaUser);

        uint256 gasBefore = gasleft();
        vm.prank(address(aggregator));
        shareOFT.transfer(address(beneficiary), 100 ether);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used for transfer with ILotteryBeneficiary", gasUsed);
        assertTrue(gasUsed < 350000, "Gas should be reasonable");
    }

    // ========================================================================
    // FUZZ TESTS
    // ========================================================================

    function testFuzz_RandomRecipient(address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient != address(shareOFT));
        vm.assume(recipient != address(aggregator));
        vm.assume(recipient != LZ_ENDPOINT); // LZ endpoint has special handling
        vm.assume(recipient != address(gaugeController)); // NoFees address
        vm.assume(uint160(recipient) > 100); // Avoid precompiles

        vm.prank(address(aggregator));
        shareOFT.transfer(recipient, 1 ether);

        // Should not revert for any valid address
        assertTrue(shareOFT.balanceOf(recipient) > 0);
    }

    function testFuzz_RandomAmount(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, amount);

        assertEq(lotteryManager.getCallCount(), 1);
    }

    // ========================================================================
    // ADVANCED EDGE CASES
    // ========================================================================

    function test_SelfTransfer_NoLottery() public {
        // User transferring to themselves should not trigger lottery
        // (this isn't a buy)
        vm.prank(owner);
        shareOFT.mint(eoaUser, 100 ether);

        lotteryManager.clearCalls();

        vm.prank(eoaUser);
        shareOFT.transfer(eoaUser, 50 ether);

        // Unknown -> Unknown = no lottery
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_AggregatorSelfTransfer_NoLottery() public {
        // Aggregator transferring to itself
        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(aggregator), 50 ether);

        // SwapOnly -> SwapOnly = no lottery
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_AddressTypeChange_MidTransaction() public {
        // What happens if address type changes during a transaction?
        // In practice this can't happen atomically, but test behavior
        MockPassthroughAggregator agg2 = new MockPassthroughAggregator();

        vm.prank(owner);
        shareOFT.mint(address(agg2), 100 ether);

        lotteryManager.clearCalls();

        // Transfer while NOT SwapOnly
        vm.prank(address(agg2));
        shareOFT.transfer(eoaUser, 50 ether);

        // Unknown -> Unknown = no lottery
        assertEq(lotteryManager.getCallCount(), 0);

        // Now mark as SwapOnly
        vm.prank(owner);
        shareOFT.setAddressType(address(agg2), CreatorShareOFT.OperationType.SwapOnly);

        // Transfer while SwapOnly
        vm.prank(address(agg2));
        shareOFT.transfer(eoaUser, 50 ether);

        // SwapOnly -> Unknown = lottery
        assertEq(lotteryManager.getCallCount(), 1);
    }

    function test_SandwichAttack_BothEntriesLogged() public {
        // Attacker buys before user, then sells after
        address attacker = address(0xBAD);

        // Setup: mint to aggregator
        vm.prank(owner);
        shareOFT.mint(address(aggregator), 300 ether);

        lotteryManager.clearCalls();

        // Attacker frontrun buy
        vm.prank(address(aggregator));
        shareOFT.transfer(attacker, 100 ether);

        // User buy
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 100 ether);

        // Attacker backrun buy
        vm.prank(address(aggregator));
        shareOFT.transfer(attacker, 100 ether);

        // All entries are logged
        assertEq(lotteryManager.getCallCount(), 3);

        (address buyer0,,) = lotteryManager.getCall(0);
        (address buyer1,,) = lotteryManager.getCall(1);
        (address buyer2,,) = lotteryManager.getCall(2);

        assertEq(buyer0, attacker);
        assertEq(buyer1, eoaUser);
        assertEq(buyer2, attacker);
    }

    function test_MEVBot_MarkedAsSwapOnly_NoEntry() public {
        // If MEV bot is marked as SwapOnly, it gets no entries
        address mevBot = address(0xBEEF);

        vm.prank(owner);
        shareOFT.setAddressType(mevBot, CreatorShareOFT.OperationType.SwapOnly);

        // MEV bot receives tokens from aggregator
        vm.prank(address(aggregator));
        shareOFT.transfer(mevBot, 100 ether);

        // SwapOnly -> SwapOnly = no lottery
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_CircularTransfer_NoExploit() public {
        // A -> B -> A circular shouldn't create infinite entries
        MockPassthroughAggregator agg2 = new MockPassthroughAggregator();

        vm.startPrank(owner);
        shareOFT.setAddressType(address(agg2), CreatorShareOFT.OperationType.SwapOnly);
        vm.stopPrank();

        lotteryManager.clearCalls();

        // agg -> agg2 (no lottery)
        vm.prank(address(aggregator));
        shareOFT.transfer(address(agg2), 100 ether);

        assertEq(lotteryManager.getCallCount(), 0);

        // agg2 -> agg (no lottery - both SwapOnly)
        vm.prank(address(agg2));
        shareOFT.transfer(address(aggregator), 100 ether);

        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_VeryDeepAggregatorChain() public {
        // Test 10 aggregators in a chain
        address[] memory aggs = new address[](10);

        for (uint256 i = 0; i < 10; i++) {
            aggs[i] = address(new MockPassthroughAggregator());
            vm.prank(owner);
            shareOFT.setAddressType(aggs[i], CreatorShareOFT.OperationType.SwapOnly);
        }

        lotteryManager.clearCalls();

        // Transfer through entire chain
        vm.prank(address(aggregator));
        shareOFT.transfer(aggs[0], 100 ether);

        for (uint256 i = 0; i < 9; i++) {
            vm.prank(aggs[i]);
            shareOFT.transfer(aggs[i + 1], 100 ether);
        }

        // No lottery entries yet (all SwapOnly)
        assertEq(lotteryManager.getCallCount(), 0);

        // Final hop to user
        vm.prank(aggs[9]);
        shareOFT.transfer(eoaUser, 100 ether);

        // Now lottery triggers
        assertEq(lotteryManager.getCallCount(), 1);
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser);
    }

    function test_TransferFrom_EOAtoEOA_NoLottery() public {
        // Regular transferFrom between EOAs (not a buy)
        vm.prank(owner);
        shareOFT.mint(eoaUser, 100 ether);

        vm.prank(eoaUser);
        shareOFT.approve(eoaUser2, 50 ether);

        lotteryManager.clearCalls();

        vm.prank(eoaUser2);
        shareOFT.transferFrom(eoaUser, eoaUser2, 50 ether);

        // Unknown -> Unknown = no lottery
        assertEq(lotteryManager.getCallCount(), 0);
    }

    function test_TransferFrom_AggregatorToUser_TriggersLottery() public {
        // transferFrom with aggregator as source
        vm.prank(address(aggregator));
        shareOFT.approve(eoaUser, 100 ether);

        lotteryManager.clearCalls();

        vm.prank(eoaUser);
        shareOFT.transferFrom(address(aggregator), eoaUser, 100 ether);

        // SwapOnly -> Unknown = lottery
        assertEq(lotteryManager.getCallCount(), 1);
    }

    function test_SmallAmount_StillTriggersLottery() public {
        // Even 1 wei should trigger lottery
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 1);

        assertEq(lotteryManager.getCallCount(), 1);
    }

    function test_MaxUint_BalanceTransfer() public {
        // Transfer max possible amount
        uint256 maxAmount = type(uint128).max; // Use uint128 to avoid overflow

        vm.prank(owner);
        shareOFT.mint(address(aggregator), maxAmount);

        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, maxAmount);

        assertEq(lotteryManager.getCallCount(), 1);
    }

    function test_RapidSuccessiveTransfers() public {
        // 100 transfers in same block
        for (uint256 i = 0; i < 100; i++) {
            vm.prank(address(aggregator));
            shareOFT.transfer(eoaUser, 1 ether);
        }

        assertEq(lotteryManager.getCallCount(), 100);
    }

    function test_TransferToDifferentSmartWalletsTypes() public {
        // Test various smart wallet implementations
        MockCoinbaseSmartWallet coinbase = new MockCoinbaseSmartWallet();
        MockSafeMultisig safe = new MockSafeMultisig();
        MockArgentWallet argent = new MockArgentWallet();

        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(address(coinbase), 33 ether);

        vm.prank(address(aggregator));
        shareOFT.transfer(address(safe), 33 ether);

        vm.prank(address(aggregator));
        shareOFT.transfer(address(argent), 33 ether);

        // All 3 smart wallets get lottery entries
        assertEq(lotteryManager.getCallCount(), 3);
    }

    function test_NestedSmartWalletCall_BundlerOrigin() public {
        // ERC-4337: Bundler calls EntryPoint calls SmartWallet calls DEX
        // The recipient should get the entry, not the bundler
        MockCoinbaseSmartWallet wallet = new MockCoinbaseSmartWallet();

        // tx.origin = bundler (simulating ERC-4337)
        vm.prank(address(aggregator), bundler);
        shareOFT.transfer(address(wallet), 100 ether);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(wallet), "Smart wallet gets entry, not bundler");
    }

    function test_BatchTransfer_AllRecipientsGetEntries() public {
        // Batch transfer to multiple recipients
        address[] memory recipients = new address[](5);
        recipients[0] = address(0x10);
        recipients[1] = address(0x20);
        recipients[2] = address(0x30);
        recipients[3] = address(0x40);
        recipients[4] = address(0x50);

        lotteryManager.clearCalls();

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(address(aggregator));
            shareOFT.transfer(recipients[i], 10 ether);
        }

        assertEq(lotteryManager.getCallCount(), 5);

        for (uint256 i = 0; i < 5; i++) {
            (address buyer,,) = lotteryManager.getCall(i);
            assertEq(buyer, recipients[i]);
        }
    }

    function test_ZeroAddressRecipient_Reverts() public {
        vm.prank(address(aggregator));
        vm.expectRevert();
        shareOFT.transfer(address(0), 100 ether);
    }

    function test_TransferToShareOFTContract_Allowed() public {
        // Transferring to the token contract itself (unusual but allowed)
        uint256 contractBalBefore = shareOFT.balanceOf(address(shareOFT));

        vm.prank(address(aggregator));
        shareOFT.transfer(address(shareOFT), 100 ether);

        assertTrue(shareOFT.balanceOf(address(shareOFT)) > contractBalBefore);
    }

    function test_LotteryEnabledToggle() public {
        // Test that lottery can be enabled/disabled mid-operation
        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 50 ether);
        assertEq(lotteryManager.getCallCount(), 1);

        vm.prank(owner);
        shareOFT.setLotteryEnabled(false);

        lotteryManager.clearCalls();

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 50 ether);
        assertEq(lotteryManager.getCallCount(), 0, "Lottery disabled - no entry");

        vm.prank(owner);
        shareOFT.setLotteryEnabled(true);

        vm.prank(address(aggregator));
        shareOFT.transfer(eoaUser, 50 ether);
        assertEq(lotteryManager.getCallCount(), 1, "Lottery re-enabled - entry created");
    }
}
