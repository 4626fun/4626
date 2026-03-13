// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/utilities/messaging/CreatorShareOFT.sol";

/**
 * @title CreatorShareOFT Lottery Tests
 * @notice Tests for smart wallet and ERC-4337 compatibility in lottery triggering
 */

// Mock Registry that returns a lottery manager
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
}

// Mock Gauge Controller that accepts fee deposits
contract MockGaugeController {
    function receiveFees(uint256) external {
        // Accept fees silently
    }
}

// Mock Lottery Manager that records calls
contract MockLotteryManager {
    struct LotteryCall {
        address buyer;
        address tokenIn;
        uint256 amountIn;
    }

    LotteryCall[] public calls;

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn) external payable returns (uint256) {
        calls.push(LotteryCall({buyer: buyer, tokenIn: tokenIn, amountIn: amountIn}));
        return calls.length; // Return non-zero to indicate success
    }

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256)
        external
        payable
        returns (uint256)
    {
        calls.push(LotteryCall({buyer: buyer, tokenIn: tokenIn, amountIn: amountIn}));
        return calls.length; // Return non-zero to indicate success
    }

    function getCallCount() external view returns (uint256) {
        return calls.length;
    }

    function getLastCall() external view returns (address buyer, address tokenIn, uint256 amountIn) {
        require(calls.length > 0, "No calls");
        LotteryCall memory last = calls[calls.length - 1];
        return (last.buyer, last.tokenIn, last.amountIn);
    }
}

// Mock Smart Wallet (simulates Coinbase Smart Wallet)
contract MockSmartWallet {
    function execute(address target, bytes calldata data) external returns (bytes memory) {
        (bool success, bytes memory result) = target.call(data);
        require(success, "Execution failed");
        return result;
    }
}

// Mock DEX Router (simulates Uniswap-like router)
contract MockDexRouter {
    function swap(address token, address recipient, uint256 amount) external {
        // Simulate a swap by transferring tokens to recipient
        // In reality this would do the actual swap
        IERC20(token).transfer(recipient, amount);
    }
}

contract CreatorShareOFTLotteryTest is Test {
    CreatorShareOFT public shareOFT;
    MockRegistry public registry;
    MockLotteryManager public lotteryManager;
    MockGaugeController public gaugeController;
    MockSmartWallet public smartWallet;
    MockDexRouter public dexRouter;

    address public owner = address(0x1);
    address public eoaUser = address(0x2);
    address public bundler = address(0x3); // ERC-4337 bundler

    // LayerZero endpoint (Base mainnet)
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        // Deploy mock contracts
        lotteryManager = new MockLotteryManager();
        registry = new MockRegistry(address(lotteryManager));
        gaugeController = new MockGaugeController();

        // Deploy CreatorShareOFT
        // Note: We need to mock the LZ endpoint or use a fork
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        vm.prank(owner);
        shareOFT = new CreatorShareOFT("Test Share", "sTEST", address(registry), owner);

        // Configure shareOFT
        vm.startPrank(owner);
        shareOFT.setRegistry(address(registry));
        // Run these tests in hub mode so lottery entries are processed locally.
        shareOFT.setHubConfig(true, 0, address(0));
        shareOFT.setLotteryEnabled(true);

        // CRITICAL: Set gauge controller and enable fees for lottery to trigger
        shareOFT.setGaugeController(address(gaugeController));
        shareOFT.setFeesEnabled(true);
        // buyFeeBps defaults to 690 (6.9%) which is > 0, so fees will be collected

        // Deploy mock DEX router and mark it as SwapOnly
        dexRouter = new MockDexRouter();
        shareOFT.setAddressType(address(dexRouter), CreatorShareOFT.OperationType.SwapOnly);

        // Mint some tokens for testing
        shareOFT.setMinter(owner, true);
        vm.stopPrank();

        // Mint tokens to dexRouter for swap simulation
        vm.prank(owner);
        shareOFT.mint(address(dexRouter), 1000 ether);

        // Deploy smart wallet
        smartWallet = new MockSmartWallet();
    }

    /**
     * @notice Test that EOA recipients can participate in lottery
     */
    function test_EOA_CanParticipateInLottery() public {
        uint256 swapAmount = 100 ether;
        uint256 expectedPostFeeAmount = swapAmount * 9310 / 10000; // 93.1% after 6.9% fee

        // Simulate swap from DEX router to EOA user
        vm.prank(address(dexRouter));
        shareOFT.transfer(eoaUser, swapAmount);

        // Check lottery was triggered with correct buyer
        assertEq(lotteryManager.getCallCount(), 1, "Lottery should be triggered");

        (address buyer, address tokenIn, uint256 amountIn) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "Buyer should be the EOA recipient");
        assertEq(tokenIn, address(shareOFT), "TokenIn should be shareOFT");
        assertEq(amountIn, expectedPostFeeAmount, "Amount should be post-fee amount");
    }

    /**
     * @notice Test that smart contract wallet recipients can participate in lottery
     * @dev This was previously blocked by the `buyer.code.length > 0` check
     */
    function test_SmartWallet_CanParticipateInLottery() public {
        uint256 swapAmount = 100 ether;
        uint256 expectedPostFeeAmount = swapAmount * 9310 / 10000; // 93.1% after 6.9% fee

        // Simulate swap from DEX router to smart wallet
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(smartWallet), swapAmount);

        // Check lottery was triggered with smart wallet as buyer
        assertEq(lotteryManager.getCallCount(), 1, "Lottery should be triggered for smart wallet");

        (address buyer, address tokenIn, uint256 amountIn) = lotteryManager.getLastCall();
        assertEq(buyer, address(smartWallet), "Buyer should be the smart wallet");
        assertEq(tokenIn, address(shareOFT), "TokenIn should be shareOFT");
        assertEq(amountIn, expectedPostFeeAmount, "Amount should be post-fee amount");
    }

    /**
     * @notice Test ERC-4337 bundled transaction scenario
     * @dev tx.origin is the bundler, but recipient is the user's smart wallet
     *      The lottery should use the recipient (smart wallet), not tx.origin (bundler)
     */
    function test_ERC4337_BundledTransaction_UsesRecipientNotTxOrigin() public {
        uint256 swapAmount = 100 ether;

        // Simulate ERC-4337 bundled transaction:
        // - tx.origin = bundler (EOA that submitted the bundle)
        // - The actual user is the smart wallet receiving tokens

        // Set tx.origin to bundler, msg.sender to dexRouter
        vm.prank(address(dexRouter), bundler);
        shareOFT.transfer(address(smartWallet), swapAmount);

        // Check lottery was triggered
        assertEq(lotteryManager.getCallCount(), 1, "Lottery should be triggered");

        (address buyer,,) = lotteryManager.getLastCall();

        // CRITICAL: buyer should be the smart wallet (recipient), NOT the bundler (tx.origin)
        assertEq(buyer, address(smartWallet), "Buyer should be recipient (smart wallet), not tx.origin (bundler)");
        assertTrue(buyer != bundler, "Buyer must NOT be the bundler");
    }

    /**
     * @notice Test that the recipient address is used correctly even when tx.origin differs
     */
    function test_RecipientUsedRegardlessOfTxOrigin() public {
        uint256 swapAmount = 50 ether;
        address randomTxOrigin = address(0x999);

        // Simulate transfer with different tx.origin
        vm.prank(address(dexRouter), randomTxOrigin);
        shareOFT.transfer(eoaUser, swapAmount);

        // Verify recipient is used
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "Should use recipient, not tx.origin");
        assertTrue(buyer != randomTxOrigin, "Should not use tx.origin");
    }

    /**
     * @notice Test multiple smart wallet types can participate
     */
    function test_MultipleSmartWalletTypes() public {
        // Deploy additional mock smart wallets (simulating different wallet types)
        MockSmartWallet safeWallet = new MockSmartWallet();
        MockSmartWallet coinbaseWallet = new MockSmartWallet();

        uint256 swapAmount = 25 ether;

        // Transfer to Safe-like wallet
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(safeWallet), swapAmount);

        // Transfer to Coinbase-like wallet
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(coinbaseWallet), swapAmount);

        // Both should trigger lottery
        assertEq(lotteryManager.getCallCount(), 2, "Both smart wallets should trigger lottery");
    }

    /**
     * @notice Test zero address recipient doesn't trigger lottery
     */
    function test_ZeroAddressRecipient_NoLottery() public {
        // The transfer to zero address should revert anyway due to ERC20 rules
        // but our lottery guard also checks for zero address
        vm.prank(address(dexRouter));
        vm.expectRevert(); // ERC20 prevents transfer to zero address
        shareOFT.transfer(address(0), 100 ether);
    }

    /**
     * @notice Test lottery disabled doesn't trigger
     */
    function test_LotteryDisabled_NoTrigger() public {
        // Disable lottery
        vm.prank(owner);
        shareOFT.setLotteryEnabled(false);

        // Transfer should succeed but not trigger lottery
        vm.prank(address(dexRouter));
        shareOFT.transfer(eoaUser, 100 ether);

        assertEq(lotteryManager.getCallCount(), 0, "Lottery should not trigger when disabled");
    }

    // =========================================================================
    // EDGE CASE TESTS - Potential unexpected behaviors
    // =========================================================================

    /**
     * @notice EDGE CASE: DEX Aggregator as intermediate recipient
     * @dev When using 1inch/Paraswap/CoW, the aggregator contract receives tokens
     *      first, then forwards to user. The AGGREGATOR gets lottery entry, not user.
     *
     *      This is a known limitation - aggregator contracts will accumulate lottery
     *      entries that they cannot claim (no owner to receive winnings).
     */
    function test_EdgeCase_AggregatorAsRecipient() public {
        // Deploy mock aggregator (simulates 1inch/Paraswap)
        MockAggregator aggregator = new MockAggregator();

        uint256 swapAmount = 100 ether;

        // User swaps via aggregator: DEX → Aggregator → User
        // Step 1: DEX sends to aggregator
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(aggregator), swapAmount);

        // Lottery entry goes to AGGREGATOR, not the actual user
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(aggregator), "Aggregator gets lottery entry, not user");

        // This is a limitation: aggregator contracts cannot claim winnings
        // RECOMMENDATION: Consider whitelisting known aggregators as NoFees
    }

    /**
     * @notice EDGE CASE: Multicall/Batch contract as recipient
     * @dev Users batching txs via multicall have the multicall contract as recipient
     */
    function test_EdgeCase_MulticallAsRecipient() public {
        MockMulticall multicall = new MockMulticall();

        uint256 swapAmount = 100 ether;

        // Swap via multicall batcher
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(multicall), swapAmount);

        // Multicall contract gets the lottery entry
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(multicall), "Multicall contract gets lottery entry");

        // RECOMMENDATION: Users should ensure final recipient is their wallet
    }

    /**
     * @notice EDGE CASE: Yield vault/aggregator deposits
     * @dev When users deposit via yield vaults, the vault gets lottery entries
     */
    function test_EdgeCase_YieldVaultAsRecipient() public {
        MockYieldVault yieldVault = new MockYieldVault();

        uint256 swapAmount = 100 ether;

        // User deposits via yield vault
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(yieldVault), swapAmount);

        // Yield vault gets the lottery entry, not depositor
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(yieldVault), "Yield vault gets lottery entry");
    }

    /**
     * @notice EDGE CASE: Same address swapping repeatedly (potential spam)
     * @dev A contract could spam small swaps to farm lottery entries
     *      Mitigated by: min USD threshold + VRF costs + probability scaling
     */
    function test_EdgeCase_RepeatedSwapsFromSameAddress() public {
        uint256 swapAmount = 10 ether; // Small amount

        // Same user does multiple swaps
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(address(dexRouter));
            shareOFT.transfer(eoaUser, swapAmount);
        }

        // All 5 entries go to same address (no rate limiting)
        assertEq(lotteryManager.getCallCount(), 5, "All swaps create entries");

        // CONSIDERATION: Add rate limiting per address per epoch?
    }

    /**
     * @notice EDGE CASE: Sandwich attack vector
     * @dev Attacker sandwiches user's swap - attacker's contract gets entry
     *      This is acceptable because attacker pays real swap fees/costs
     */
    function test_EdgeCase_SandwichAttackVector() public {
        MockAttackerContract attacker = new MockAttackerContract();

        uint256 victimSwapAmount = 100 ether;
        uint256 attackerSwapAmount = 500 ether;

        // Mint extra tokens for attacker simulation
        vm.prank(owner);
        shareOFT.mint(address(dexRouter), 500 ether);

        // Attacker front-runs
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(attacker), attackerSwapAmount);

        // Victim swap
        vm.prank(address(dexRouter));
        shareOFT.transfer(eoaUser, victimSwapAmount);

        // Attacker back-runs (would need to sell, but for lottery they already got entry)

        // Both get lottery entries - attacker's entry is from their contract
        assertEq(lotteryManager.getCallCount(), 2, "Both attacker and victim get entries");

        // This is acceptable: attacker pays real costs (fees, capital, MEV competition)
    }

    /**
     * @notice POSITIVE CASE: Gnosis Safe as recipient works correctly
     * @dev Safe multi-sig should be able to receive lottery entries
     */
    function test_SafeMultisig_CanParticipateInLottery() public {
        // Safe is just another smart contract wallet
        MockSmartWallet safe = new MockSmartWallet();

        uint256 swapAmount = 100 ether;

        vm.prank(address(dexRouter));
        shareOFT.transfer(address(safe), swapAmount);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(safe), "Safe multi-sig correctly receives lottery entry");
    }

    /**
     * @notice EDGE CASE: Transfer to self (router arbitrage)
     * @dev If router sends to itself, it would get lottery entry
     */
    function test_EdgeCase_RouterTransferToSelf() public {
        // This shouldn't happen in normal flows but let's verify behavior
        // Router is SwapOnly, transferring to itself means toType is also SwapOnly
        // So it won't trigger _processBuy (requires toType != SwapOnly)

        vm.prank(address(dexRouter));
        shareOFT.transfer(address(dexRouter), 100 ether);

        // No lottery entry because both from and to are SwapOnly
        assertEq(lotteryManager.getCallCount(), 0, "Router-to-router has no lottery");
    }

    // =========================================================================
    // ILOTTERYBENEFICIARY INTEGRATION TESTS
    // =========================================================================

    /**
     * @notice Test aggregator WITH ILotteryBeneficiary gives entry to user
     * @dev This is the SOLUTION for aggregator integration
     */
    function test_LotteryAwareAggregator_UserGetsEntry() public {
        MockLotteryAwareAggregator lotteryAggregator = new MockLotteryAwareAggregator();

        uint256 swapAmount = 100 ether;

        // Mint tokens to aggregator for the swap
        vm.prank(owner);
        shareOFT.mint(address(lotteryAggregator), swapAmount);

        // Mark aggregator as SwapOnly so transfers from it trigger lottery
        vm.prank(owner);
        shareOFT.setAddressType(address(lotteryAggregator), CreatorShareOFT.OperationType.SwapOnly);

        // User swaps via lottery-aware aggregator
        // Aggregator sets beneficiary to user before transfer
        lotteryAggregator.executeSwapForUser(
            address(shareOFT),
            eoaUser, // tokens go to user
            eoaUser, // lottery entry also goes to user
            swapAmount
        );

        // User gets the lottery entry, NOT the aggregator
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "User should get lottery entry via ILotteryBeneficiary");
    }

    /**
     * @notice Test lottery-aware multicall gives entry to user
     */
    function test_LotteryAwareMulticall_UserGetsEntry() public {
        MockLotteryAwareMulticall lotteryMulticall = new MockLotteryAwareMulticall();

        uint256 swapAmount = 50 ether;

        // User sets themselves as beneficiary
        lotteryMulticall.setBeneficiary(eoaUser);

        // Simulate swap ending at multicall contract
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(lotteryMulticall), swapAmount);

        // User gets the lottery entry via ILotteryBeneficiary
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "User should get lottery entry via multicall");
    }

    /**
     * @notice Test that smart wallets without ILotteryBeneficiary still work
     * @dev Smart wallets that don't implement the interface should still get entries
     */
    function test_SmartWalletWithoutInterface_StillWorks() public {
        // MockSmartWallet doesn't implement ILotteryBeneficiary
        uint256 swapAmount = 100 ether;

        vm.prank(address(dexRouter));
        shareOFT.transfer(address(smartWallet), swapAmount);

        // Smart wallet itself gets the entry (fallback behavior)
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(smartWallet), "Smart wallet gets entry when no interface");
    }

    /**
     * @notice Test that returning address(0) from getLotteryBeneficiary falls back to recipient
     */
    function test_ZeroBeneficiary_FallsBackToRecipient() public {
        MockZeroBeneficiaryContract zeroBeneficiary = new MockZeroBeneficiaryContract();

        uint256 swapAmount = 50 ether;

        vm.prank(address(dexRouter));
        shareOFT.transfer(address(zeroBeneficiary), swapAmount);

        // Should fall back to the contract itself
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(zeroBeneficiary), "Falls back to recipient when beneficiary is zero");
    }

    /**
     * @notice Test aggregator as intermediate recipient with user attribution
     * @dev DEX → Aggregator (implements ILotteryBeneficiary) → user gets entry
     *      This is the correct flow: aggregator IS the recipient, implements interface
     */
    function test_AggregatorAsRecipient_WithBeneficiary_UserGetsEntry() public {
        MockLotteryAwareAggregator lotteryAggregator = new MockLotteryAwareAggregator();

        uint256 swapAmount = 100 ether;

        // Aggregator needs to set beneficiary BEFORE receiving tokens
        // In practice, this would be done via a multicall or the aggregator's own execute function

        // Simulate: User calls aggregator.swap() which:
        // 1. Sets _currentBeneficiary = user
        // 2. Calls DEX to swap tokens to aggregator
        // 3. Aggregator receives tokens, ILotteryBeneficiary.getLotteryBeneficiary() returns user

        // For testing, we manually set the beneficiary state
        // In production, the aggregator would do this atomically
        vm.mockCall(
            address(lotteryAggregator),
            abi.encodeWithSelector(ILotteryBeneficiary.getLotteryBeneficiary.selector),
            abi.encode(eoaUser)
        );

        // DEX sends to aggregator (aggregator is recipient)
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(lotteryAggregator), swapAmount);

        // User gets the lottery entry because aggregator implements ILotteryBeneficiary
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "User gets entry via aggregator's ILotteryBeneficiary");
    }

    /**
     * @notice Test direct transfer to smart wallet (no aggregator)
     * @dev When tokens go directly to smart wallet, wallet gets entry
     */
    function test_DirectToSmartWallet_WalletGetsEntry() public {
        uint256 swapAmount = 100 ether;

        // Direct swap to smart wallet
        vm.prank(address(dexRouter));
        shareOFT.transfer(address(smartWallet), swapAmount);

        // Smart wallet gets the entry (correct behavior)
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(smartWallet), "Smart wallet gets entry on direct transfer");
    }

    // =========================================================================
    // ZERO-INTEGRATION AGGREGATOR SOLUTION TESTS
    // Marking aggregators as SwapOnly - NO AGGREGATOR CHANGES REQUIRED
    // =========================================================================

    /**
     * @notice SOLUTION: Mark aggregator as SwapOnly for automatic user attribution
     * @dev This is the zero-integration solution - aggregators don't need to change anything
     *
     *      Flow: DEX Pool (SwapOnly) → Aggregator (SwapOnly) → User
     *      - Pool → Aggregator: No lottery (both SwapOnly)
     *      - Aggregator → User: Lottery for USER (SwapOnly → non-SwapOnly)
     */
    function test_ZeroIntegration_AggregatorMarkedSwapOnly_UserGetsEntry() public {
        // Deploy mock aggregator (simulates 1inch, Paraswap, LlamaSwap)
        MockPassthroughAggregator aggregator = new MockPassthroughAggregator();

        uint256 swapAmount = 100 ether;

        // SOLUTION: Mark aggregator as SwapOnly (one-time admin action)
        vm.prank(owner);
        shareOFT.setAddressType(address(aggregator), CreatorShareOFT.OperationType.SwapOnly);

        // Mint tokens to aggregator (simulates pool → aggregator transfer)
        vm.prank(owner);
        shareOFT.mint(address(aggregator), swapAmount);

        // Aggregator forwards to user (this is where lottery triggers!)
        aggregator.forwardTokens(address(shareOFT), eoaUser, swapAmount);

        // USER gets the lottery entry, not the aggregator!
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "User gets lottery entry when aggregator is SwapOnly");
    }

    /**
     * @notice Test multi-hop through multiple aggregators
     * @dev Pool → Aggregator1 → Aggregator2 → User
     */
    function test_ZeroIntegration_MultiHopAggregators_UserGetsEntry() public {
        MockPassthroughAggregator aggregator1 = new MockPassthroughAggregator();
        MockPassthroughAggregator aggregator2 = new MockPassthroughAggregator();

        uint256 swapAmount = 100 ether;

        // Mark both aggregators as SwapOnly
        vm.startPrank(owner);
        shareOFT.setAddressType(address(aggregator1), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.setAddressType(address(aggregator2), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.mint(address(aggregator1), swapAmount);
        vm.stopPrank();

        // Multi-hop: aggregator1 → aggregator2 (no lottery, both SwapOnly)
        aggregator1.forwardTokens(address(shareOFT), address(aggregator2), swapAmount);
        assertEq(lotteryManager.getCallCount(), 0, "No lottery between SwapOnly addresses");

        // Final hop: aggregator2 → user (lottery triggers!)
        aggregator2.forwardTokens(address(shareOFT), eoaUser, swapAmount);

        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, eoaUser, "User gets entry on final hop from SwapOnly");
    }

    /**
     * @notice Test aggregator to smart wallet (Coinbase Smart Wallet via 1inch)
     */
    function test_ZeroIntegration_AggregatorToSmartWallet() public {
        MockPassthroughAggregator aggregator = new MockPassthroughAggregator();

        uint256 swapAmount = 100 ether;

        vm.startPrank(owner);
        shareOFT.setAddressType(address(aggregator), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.mint(address(aggregator), swapAmount);
        vm.stopPrank();

        // Aggregator sends to user's smart wallet
        aggregator.forwardTokens(address(shareOFT), address(smartWallet), swapAmount);

        // Smart wallet gets the lottery entry
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(smartWallet), "Smart wallet gets entry via aggregator");
    }

    /**
     * @notice Test smart wallet using aggregator (e.g., Coinbase Wallet via 1inch)
     * @dev This is the full ERC-4337 + Aggregator scenario:
     *      - tx.origin = Bundler (not the user!)
     *      - Smart wallet calls aggregator
     *      - Aggregator sends to smart wallet
     *      - Smart wallet should get lottery entry
     */
    function test_ZeroIntegration_SmartWalletViaAggregator_ERC4337() public {
        MockPassthroughAggregator aggregator = new MockPassthroughAggregator();

        uint256 swapAmount = 100 ether;

        // Mark aggregator as SwapOnly
        vm.startPrank(owner);
        shareOFT.setAddressType(address(aggregator), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.mint(address(aggregator), swapAmount);
        vm.stopPrank();

        // Simulate ERC-4337 context:
        // - tx.origin = bundler (0x3)
        // - msg.sender = aggregator
        // - recipient = smart wallet
        vm.prank(address(aggregator), bundler); // msg.sender=aggregator, tx.origin=bundler
        shareOFT.transfer(address(smartWallet), swapAmount);

        // Smart wallet gets the lottery entry (NOT the bundler!)
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, address(smartWallet), "Smart wallet gets entry, not bundler");
        assertTrue(buyer != bundler, "Must NOT be bundler");
    }

    /**
     * @notice Test smart wallet using aggregator to send to EOA
     * @dev Smart wallet swaps via aggregator, but sends result to a different EOA
     *      (e.g., user wants tokens in their hot wallet)
     */
    function test_ZeroIntegration_SmartWalletViaAggregator_ToEOA() public {
        MockPassthroughAggregator aggregator = new MockPassthroughAggregator();
        address hotWallet = address(0x4);

        uint256 swapAmount = 100 ether;

        vm.startPrank(owner);
        shareOFT.setAddressType(address(aggregator), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.mint(address(aggregator), swapAmount);
        vm.stopPrank();

        // Smart wallet uses aggregator, but recipient is a different EOA
        vm.prank(address(aggregator), bundler);
        shareOFT.transfer(hotWallet, swapAmount);

        // Hot wallet (EOA) gets the lottery entry
        (address buyer,,) = lotteryManager.getLastCall();
        assertEq(buyer, hotWallet, "Hot wallet EOA gets entry");
    }

    /**
     * @notice Test batch setting aggregators as SwapOnly
     */
    function test_BatchSetAggregatorsAsSwapOnly() public {
        // Deploy multiple mock aggregators
        address[] memory aggregators = new address[](5);
        aggregators[0] = address(new MockPassthroughAggregator());
        aggregators[1] = address(new MockPassthroughAggregator());
        aggregators[2] = address(new MockPassthroughAggregator());
        aggregators[3] = address(new MockPassthroughAggregator());
        aggregators[4] = address(new MockPassthroughAggregator());

        // Batch set all as SwapOnly (one transaction!)
        vm.prank(owner);
        shareOFT.setAddressTypes(aggregators, CreatorShareOFT.OperationType.SwapOnly);

        // Verify all are set correctly
        for (uint256 i = 0; i < aggregators.length; i++) {
            assertEq(
                uint256(shareOFT.addressType(aggregators[i])),
                uint256(CreatorShareOFT.OperationType.SwapOnly),
                "Aggregator should be SwapOnly"
            );
        }
    }
}

// Import for the mock
import {ILotteryBeneficiary} from "../contracts/utilities/messaging/CreatorShareOFT.sol";

/**
 * @notice Mock aggregator that just forwards tokens (simulates 1inch, Paraswap, etc.)
 * @dev NO INTEGRATION REQUIRED - just mark as SwapOnly
 */
contract MockPassthroughAggregator {
    function forwardTokens(address token, address recipient, uint256 amount) external {
        IERC20(token).transfer(recipient, amount);
    }
}

// =========================================================================
// MOCK CONTRACTS FOR EDGE CASE TESTING
// =========================================================================

contract MockAggregator {
    // Simulates 1inch/Paraswap aggregator WITHOUT ILotteryBeneficiary
    function executeSwap(address token, address recipient, uint256 amount) external {
        IERC20(token).transfer(recipient, amount);
    }
}

contract MockMulticall {
    // Simulates multicall/batch execution contract
    function multicall(bytes[] calldata) external pure returns (bytes[] memory) {
        return new bytes[](0);
    }
}

contract MockYieldVault {
    // Simulates Yearn-style yield vault
    function deposit(uint256) external pure returns (uint256) {
        return 0;
    }
}

contract MockAttackerContract {
    // Simulates MEV/sandwich attacker contract
    function attack() external {}
}

// =========================================================================
// ILOTTERYBENEFICIARY-COMPLIANT MOCK CONTRACTS
// =========================================================================

/**
 * @notice Mock aggregator that implements ILotteryBeneficiary
 * @dev Shows how 1inch/Paraswap could integrate to give users lottery entries
 */
contract MockLotteryAwareAggregator {
    // Stores the current beneficiary for the ongoing swap
    address private _currentBeneficiary;

    /**
     * @notice Execute swap with lottery beneficiary attribution
     * @param token Token to transfer
     * @param recipient Intermediate recipient (this contract)
     * @param finalUser The actual user who should get lottery entry
     * @param amount Amount to swap
     */
    function executeSwapForUser(address token, address recipient, address finalUser, uint256 amount) external {
        _currentBeneficiary = finalUser;
        IERC20(token).transfer(recipient, amount);
        _currentBeneficiary = address(0);
    }

    /**
     * @notice ILotteryBeneficiary implementation
     * @return The user who should receive lottery entries
     */
    function getLotteryBeneficiary() external view returns (address) {
        return _currentBeneficiary;
    }
}

/**
 * @notice Mock multicall that implements ILotteryBeneficiary
 * @dev Shows how batch execution contracts could integrate
 */
contract MockLotteryAwareMulticall {
    address private _beneficiary;

    function setBeneficiary(address user) external {
        _beneficiary = user;
    }

    function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "Multicall failed");
            results[i] = result;
        }
    }

    function getLotteryBeneficiary() external view returns (address) {
        return _beneficiary;
    }
}

/**
 * @notice Mock contract that returns address(0) from getLotteryBeneficiary
 * @dev Tests fallback to recipient when beneficiary is zero
 */
contract MockZeroBeneficiaryContract {
    function getLotteryBeneficiary() external pure returns (address) {
        return address(0);
    }
}
