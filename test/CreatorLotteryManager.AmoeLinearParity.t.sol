// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";

// =====================================================================
// Mocks (namespaced -Amoe to avoid collision with other test files)
// =====================================================================

contract MockCreatorOracleAmoe {
    int256 public price = 1e18; // $1 per token (1e18 scale)
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function setPrice(int256 nextPrice) external {
        price = nextPrice;
        updatedAt = block.timestamp;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockLotteryRegistryAmoe {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;
    address public vault;
    bool public active = true;

    constructor(address _endpoint, address _creatorCoin, address _shareOFT, address _oracle) {
        endpoint = _endpoint;
        creatorCoin = _creatorCoin;
        shareOFT = _shareOFT;
        oracle = _oracle;
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function setActive(bool _active) external {
        active = _active;
    }

    function getVaultForToken(address) external view returns (address) {
        return vault;
    }

    function getShareOFTForToken(address token) external view returns (address) {
        if (token == creatorCoin) return shareOFT;
        return address(0);
    }

    function getTokenForShareOFT(address _shareOFT) external view returns (address) {
        if (_shareOFT == shareOFT) return creatorCoin;
        return address(0);
    }

    function getOracleForToken(address token) external view returns (address) {
        if (token == creatorCoin) return oracle;
        return address(0);
    }

    function getGaugeControllerForToken(address) external pure returns (address) {
        return address(0);
    }

    function isCreatorCoinActive(address token) external view returns (bool) {
        return active && token == creatorCoin;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllCreatorCoins() external view returns (address[] memory coins) {
        coins = new address[](1);
        coins[0] = creatorCoin;
    }
}

contract MockLocalVrfConsumerAmoe {
    uint256 public nextRequestId = 1;

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}

// Pluggable boost manager: returns configurable boost / probBoost. Coverage
// mirrors the real `ve4626BoostManager` formula:
//   coverage = min(creatorShareBalanceUSD, swapAmountUSD) / swapAmountUSD
// so PR 2 follow-up tests can exercise the real "coverage gates personal
// boost" behavior end-to-end. Tests that want a fixed coverage can call
// `setForcedCoverageBps` to override.
contract MockBoostManagerAmoe {
    uint256 internal constant BOOST_PRECISION = 10_000;

    uint256 public boostBPS = 10_000; // 1.00x default (no extra boost)
    uint256 public probBoostBps;
    uint256 public forcedCoverageBps; // 0 = use real formula
    bool public forcedCoverageActive;

    function setBoostBPS(uint256 v) external { boostBPS = v; }
    function setProbBoostBps(uint256 v) external { probBoostBps = v; }
    function setForcedCoverageBps(uint256 v) external {
        forcedCoverageBps = v;
        forcedCoverageActive = true;
    }
    function clearForcedCoverage() external {
        forcedCoverageActive = false;
        forcedCoverageBps = 0;
    }

    function calculateBoost(address) external view returns (uint256) {
        return boostBPS;
    }

    function getCoverageBps(
        address,
        address,
        address,
        address,
        uint256 creatorShareBalanceUSD,
        uint256 swapAmountUSD
    ) external view returns (uint256) {
        if (forcedCoverageActive) return forcedCoverageBps;
        if (swapAmountUSD == 0 || creatorShareBalanceUSD == 0) return 0;
        uint256 covered = creatorShareBalanceUSD < swapAmountUSD ? creatorShareBalanceUSD : swapAmountUSD;
        uint256 cov = (covered * BOOST_PRECISION) / swapAmountUSD;
        return cov > BOOST_PRECISION ? BOOST_PRECISION : cov;
    }

    function getTotalProbabilityBoost(address) external view returns (uint256) {
        return probBoostBps;
    }
}

// Pluggable vault gauge: configurable boost PPM.
contract MockVaultGaugeAmoe {
    uint256 public gaugeBoostPPM;

    function setGaugeBoostPPM(uint256 v) external { gaugeBoostPPM = v; }

    function getVaultGaugeProbabilityBoostPPM(address) external view returns (uint256) {
        return gaugeBoostPPM;
    }
}

// =====================================================================
// Test contract
// =====================================================================

contract CreatorLotteryManagerAmoeLinearParityTest is Test {
    CreatorLotteryManager internal manager;
    MockLotteryRegistryAmoe internal registry;
    MockCreatorOracleAmoe internal oracle;
    MockLocalVrfConsumerAmoe internal vrf;
    MockBoostManagerAmoe internal boostManager;
    MockVaultGaugeAmoe internal gauge;

    address internal owner = address(0xA11CE);
    address internal authorizedSwap = address(0xBEEF);
    address internal relayer = address(0xC0DE);
    address internal buyer = address(0xCAFE);

    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);
    address internal vault = address(0x1003);

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new MockCreatorOracleAmoe();
        vrf = new MockLocalVrfConsumerAmoe();
        registry = new MockLotteryRegistryAmoe(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));
        registry.setVault(vault);
        boostManager = new MockBoostManagerAmoe();
        gauge = new MockVaultGaugeAmoe();

        vm.prank(owner);
        manager = new CreatorLotteryManager(address(registry), owner);

        vm.startPrank(owner);
        manager.setAuthorizedSwapContract(authorizedSwap, true);
        manager.setLocalVRFConsumer(address(vrf));
        manager.setUseLocalVRF(true);
        manager.setBoostManager(address(boostManager));
        manager.setVaultGaugeVoting(address(gauge));
        manager.setAuthorizedAmoeRelayer(relayer);
        vm.stopPrank();

        // PR 2 follow-up — `processAmoeEntry` now reads the buyer's creator-share
        // balance via `IERC20(creatorCoin).balanceOf(buyer)` so coverage-scaled
        // ve4626 personal/lock-duration boosts have parity with the paid path.
        // Default mock return is 0 (no shares held) so existing tests keep their
        // expected boost shape; tests that exercise the holdings path override
        // this with their own `vm.mockCall`.
        vm.mockCall(
            creatorCoin,
            abi.encodeWithSelector(bytes4(keccak256("balanceOf(address)")), buyer),
            abi.encode(uint256(0))
        );
    }

    // -------------------------------------------------------------
    // Linear odds boundaries — calculateWinChance
    // -------------------------------------------------------------

    function test_LinearOdds_OneDollar_Returns4PPM() public view {
        // $1 in 1e6 units = 1_000_000. 1_000_000 / 250_000 = 4 PPM (0.0004%).
        assertEq(manager.calculateWinChance(1_000_000), 4, "$1 should be 4 PPM");
    }

    function test_LinearOdds_TenDollars_Returns40PPM() public view {
        assertEq(manager.calculateWinChance(10 * 1_000_000), 40, "$10 should be 40 PPM");
    }

    function test_LinearOdds_OneHundredDollars_Returns400PPM() public view {
        assertEq(manager.calculateWinChance(100 * 1_000_000), 400, "$100 should be 400 PPM");
    }

    function test_LinearOdds_OneThousandDollars_Returns4000PPM() public view {
        assertEq(manager.calculateWinChance(1_000 * 1_000_000), 4_000, "$1K should be 4000 PPM");
    }

    function test_LinearOdds_TenThousandDollars_Returns40000PPM() public view {
        assertEq(manager.calculateWinChance(10_000 * 1_000_000), 40_000, "$10K should hit baseCeilingPPM");
    }

    function test_LinearOdds_AboveCeiling_StaysAtBaseCeilingPPM() public view {
        // $100K nominal — pre-boost still capped at 40_000 PPM.
        assertEq(manager.calculateWinChance(100_000 * 1_000_000), 40_000, "ceiling enforced");
    }

    function test_LinearOdds_BelowMinSwap_ReturnsZero() public view {
        // minSwap defaults to MIN_SWAP_USD ($1 = 1e6). Anything strictly below floors to 0.
        assertEq(manager.calculateWinChance(0), 0, "zero in -> zero out");
        assertEq(manager.calculateWinChance(999_999), 0, "below minSwap -> zero");
    }

    function test_LinearOdds_AtMinSwap_ReturnsLinearValue() public view {
        // At exactly minSwap ($1), formula yields 4 PPM.
        assertEq(manager.calculateWinChance(1_000_000), 4, "at floor returns 4 PPM");
    }

    // -------------------------------------------------------------
    // baseCeilingPPM admin
    // -------------------------------------------------------------

    function test_SetBaseCeilingPPM_RespectsMaxWinChance() public {
        // maxWinChance default = 150_000. Set ceiling to 50_000 should succeed.
        vm.prank(owner);
        manager.setBaseCeilingPPM(50_000);
        assertEq(manager.baseCeilingPPM(), 50_000);
    }

    function test_SetBaseCeilingPPM_RejectsAboveMaxWinChance() public {
        // 200_000 > maxWinChance (150_000) → revert
        vm.prank(owner);
        vm.expectRevert();
        manager.setBaseCeilingPPM(200_000);
    }

    function test_SetBaseCeilingPPM_RejectsAboveSanityCap() public {
        // Even though maxWinChance=150_000, the setter clamps at 100_000.
        vm.prank(owner);
        vm.expectRevert();
        manager.setBaseCeilingPPM(150_000);
    }

    function test_SetBaseCeilingPPM_RejectsZero() public {
        vm.prank(owner);
        vm.expectRevert();
        manager.setBaseCeilingPPM(0);
    }

    function test_DefaultBaseCeilingPPM_Is40000() public view {
        assertEq(manager.baseCeilingPPM(), 40_000);
    }

    // -------------------------------------------------------------
    // processAmoeEntry — auth & validation
    // -------------------------------------------------------------

    function test_ProcessAmoeEntry_OnlyRelayerCanCall() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        manager.processAmoeEntry(buyer, creatorCoin, 100 * 1_000_000);
    }

    function test_ProcessAmoeEntry_RevertsWhenRelayerUnset() public {
        vm.prank(owner);
        manager.setAuthorizedAmoeRelayer(address(0));

        // Even calling from address(0) (impossible in practice) must not pass — and
        // any other address must revert.
        vm.prank(relayer);
        vm.expectRevert();
        manager.processAmoeEntry(buyer, creatorCoin, 100 * 1_000_000);
    }

    function test_ProcessAmoeEntry_RevertsOnZeroBuyer() public {
        vm.prank(relayer);
        vm.expectRevert();
        manager.processAmoeEntry(address(0), creatorCoin, 100 * 1_000_000);
    }

    function test_ProcessAmoeEntry_RevertsOnZeroCreator() public {
        vm.prank(relayer);
        vm.expectRevert();
        manager.processAmoeEntry(buyer, address(0), 100 * 1_000_000);
    }

    function test_ProcessAmoeEntry_RevertsOnZeroPoints() public {
        vm.prank(relayer);
        vm.expectRevert();
        manager.processAmoeEntry(buyer, creatorCoin, 0);
    }

    function test_ProcessAmoeEntry_BelowFloor_SilentSkip() public {
        // Below minSwap ($1 = 1e6) — silent skip, no revert.
        vm.prank(relayer);
        uint256 entryId = manager.processAmoeEntry(buyer, creatorCoin, 999_999);
        assertEq(entryId, 0, "below floor should skip");
    }

    function test_ProcessAmoeEntry_InactiveCreator_SilentSkip() public {
        registry.setActive(false);
        vm.prank(relayer);
        uint256 entryId = manager.processAmoeEntry(buyer, creatorCoin, 100 * 1_000_000);
        assertEq(entryId, 0, "inactive creator should skip");
    }

    function test_ProcessAmoeEntry_HappyPath_CreatesEntry() public {
        vm.prank(relayer);
        uint256 entryId = manager.processAmoeEntry(buyer, creatorCoin, 100 * 1_000_000);
        assertGt(entryId, 0, "should create entry");
        assertEq(manager.totalLotteryEntries(), 1);
    }

    // -------------------------------------------------------------
    // AMOE / paid boost parity (Option B2)
    // -------------------------------------------------------------

    function test_BoostParity_VaultGaugeBoost_AppliesEqually_BothPaths() public {
        // Vault gauge boost of 10_000 PPM (1%).
        // Note: gauge boost is scaled by swap size — at $10K swap (max scale), full boost applies.
        gauge.setGaugeBoostPPM(10_000);
        boostManager.setBoostBPS(10_000); // 1.00x — personal boost adds 0
        boostManager.setProbBoostBps(0);

        // Run AMOE at the saturated USD value ($10K).
        uint256 swapUSD_AMOE = 10_000 * 1_000_000;
        vm.prank(relayer);
        uint256 amoeEntryId = manager.processAmoeEntry(buyer, creatorCoin, swapUSD_AMOE);
        assertGt(amoeEntryId, 0);
        (, , uint256 amoeAmountUSD, uint256 amoeEffectivePPM, , , ) = manager.vrfRequests(amoeEntryId);
        assertEq(amoeAmountUSD, swapUSD_AMOE);

        // Drive paid path to a USD value also above the ceiling so calculateWinChance
        // saturates at 40_000 for both. Pick price=1e22 so 1 ether → 1e22/1e12 = 1e10 → $10K
        // before multiplier; with 1.05x → ~$10.5K. Both > $10K → both saturate at 40_000 base.
        oracle.setPrice(int256(uint256(1e22)));
        vm.prank(authorizedSwap);
        uint256 paidEntryId = manager.processSwapLottery(buyer, shareOFT, 1 ether, 0);
        assertGt(paidEntryId, 0);
        (, , uint256 paidAmountUSD, uint256 paidEffectivePPM, , , ) = manager.vrfRequests(paidEntryId);

        // Both have base = 40_000 (ceiling), so post-boost should match exactly.
        assertEq(manager.calculateWinChance(amoeAmountUSD), 40_000, "AMOE base saturated");
        assertEq(manager.calculateWinChance(paidAmountUSD), 40_000, "Paid base saturated");
        assertEq(amoeEffectivePPM, paidEffectivePPM, "AMOE and paid boosted PPM must match");
        // Sanity: it's > base ceiling because boost added.
        assertGt(amoeEffectivePPM, 40_000, "boost should kick in");
    }

    // -------------------------------------------------------------
    // Absolute cap enforcement (post-boost)
    // -------------------------------------------------------------

    function test_BoostedChance_NeverExceedsMaxWinChance() public {
        // Force a huge gauge boost so the sum would exceed maxWinChance.
        gauge.setGaugeBoostPPM(1_000_000);
        boostManager.setBoostBPS(50_000); // 5.00x — multiplies base ceiling 5×

        uint256 swapUSD = 10_000 * 1_000_000; // base = 40_000 PPM
        vm.prank(relayer);
        uint256 entryId = manager.processAmoeEntry(buyer, creatorCoin, swapUSD);
        assertGt(entryId, 0);
        (, , , uint256 effectivePPM, , , ) = manager.vrfRequests(entryId);
        assertEq(effectivePPM, 150_000, "must cap at maxWinChance");
    }

    // -------------------------------------------------------------
    // PR 2 follow-up — personal-boost parity with paid path
    //
    // Regression for the P1 review finding: prior code passed
    // `creatorShareBalanceUSD = 0` to `_boostAndDispatchVRF` from the AMOE
    // path, which silently disabled the ve4626 personal multiplier and
    // lock-duration additive boost branches in `_applyBoost`. Fix: read
    // `IERC20(creatorCoin).balanceOf(buyer)` and convert via the per-creator
    // oracle, exactly like `processSwapLottery`.
    // -------------------------------------------------------------

    function test_BoostParity_PersonalBoost_AppliesEqually_BothPaths() public {
        // Configure a real personal boost: 2.00x multiplier and a lock-duration
        // additive boost. Both branches in `_applyBoost` are gated by
        // `coverageBps > 0`, so they trigger only when the buyer actually holds
        // creator shares.
        boostManager.setBoostBPS(20_000); // 2.00x personal multiplier
        boostManager.setProbBoostBps(100); // +100 bps lock-duration additive
        gauge.setGaugeBoostPPM(0); // isolate personal boost from gauge

        // Neutralize the 1.05x slippage bonus (`usdMultiplierBps`). The paid
        // path applies it to BOTH `swapValueUSD` and `creatorShareBalanceUSD`
        // via `_calculateTokenUSD`; the AMOE path passes `pointsBurnedAsUSD`
        // through unscaled (slippage isn't a thing for AMOE) but still applies
        // it to the on-chain balance read. With the multiplier > 1, the two
        // paths cannot produce identical PPMs even at equal notional. Setting
        // it to 1.00x (10_000) isolates the personal-boost gating fix being
        // verified here. The slippage-bonus semantic itself is exercised by
        // existing `processSwapLottery` tests in the main suite.
        vm.prank(owner);
        manager.setLotteryConfig(1_000_000, 6900, true, 40, 150_000, 10_000);

        // Pin the oracle at $1/token so 1 share = $1 (1e6 units), giving the
        // buyer $1 of "covered" balance at the same notional as a $1 entry.
        oracle.setPrice(int256(1e18));

        // 1) AMOE path: $10 entry. Buyer holds 1 share ($1) — partial coverage,
        //    but coverageBps > 0 so personal boost is applied to the $10 entry.
        vm.mockCall(
            creatorCoin,
            abi.encodeWithSelector(bytes4(keccak256("balanceOf(address)")), buyer),
            abi.encode(uint256(1e18)) // 1 share (18 decimals)
        );
        uint256 swapUSD = 10 * 1_000_000;
        vm.prank(relayer);
        uint256 amoeEntryId = manager.processAmoeEntry(buyer, creatorCoin, swapUSD);
        assertGt(amoeEntryId, 0);
        (, , , uint256 amoeEffectivePPM, , , ) = manager.vrfRequests(amoeEntryId);

        // 2) Paid path with the same buyer and same $10 swap and same balance.
        vm.prank(authorizedSwap);
        uint256 paidEntryId = manager.processSwapLottery(buyer, shareOFT, 10 * 1e18, 1e18);
        assertGt(paidEntryId, 0);
        (, , , uint256 paidEffectivePPM, , , ) = manager.vrfRequests(paidEntryId);

        // Parity assertion (the regression): both paths must produce the same
        // boosted PPM at equal notional + equal balance. Pre-fix this was
        // `amoe < paid` because the AMOE coverageBps was forced to 0.
        assertEq(amoeEffectivePPM, paidEffectivePPM, "AMOE personal boost must match paid");
        // Sanity: boost actually fired (> base of 40 PPM).
        assertGt(amoeEffectivePPM, 40, "personal boost should kick in when shares held");
    }

    function test_BoostParity_PersonalBoost_ZeroBalance_NoPersonalBoost() public {
        // Mirror of the above with balance=0 — personal boost stays gated off
        // because `coverageBps == 0`. This locks in the "no shares = no
        // personal boost" behavior that existed before the fix, ensuring the
        // change is additive only.
        boostManager.setBoostBPS(20_000);
        boostManager.setProbBoostBps(100);
        gauge.setGaugeBoostPPM(0);

        // Default `vm.mockCall` in setUp returns 0 — no override needed.
        uint256 swapUSD = 10 * 1_000_000;
        vm.prank(relayer);
        uint256 entryId = manager.processAmoeEntry(buyer, creatorCoin, swapUSD);
        assertGt(entryId, 0);
        (, , , uint256 effectivePPM, , , ) = manager.vrfRequests(entryId);

        // Base is $10 → 40 PPM. With coverage=0 both personal branches are
        // gated off, so effective == base.
        assertEq(effectivePPM, 40, "no shares -> base PPM only");
    }

    // -------------------------------------------------------------
    // Relayer setter / event
    // -------------------------------------------------------------

    function test_SetAuthorizedAmoeRelayer_OwnerOnly() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        manager.setAuthorizedAmoeRelayer(address(0xBABE));
    }

    function test_SetAuthorizedAmoeRelayer_UpdatesAndAllowsZero() public {
        vm.prank(owner);
        manager.setAuthorizedAmoeRelayer(address(0xBABE));
        assertEq(manager.authorizedAmoeRelayer(), address(0xBABE));

        // Zero disables AMOE.
        vm.prank(owner);
        manager.setAuthorizedAmoeRelayer(address(0));
        assertEq(manager.authorizedAmoeRelayer(), address(0));
    }

    // -------------------------------------------------------------
    // setLotteryConfig invariant: maxWinChance >= baseCeilingPPM
    // -------------------------------------------------------------

    function test_SetLotteryConfig_RejectsMaxBelowBaseCeiling() public {
        // baseCeilingPPM defaults to 40_000. Setting maxWinChance=30_000 must revert.
        vm.prank(owner);
        vm.expectRevert();
        manager.setLotteryConfig(1_000_000, 6900, true, 40, 30_000, 10_500);
    }

    function test_SetLotteryConfig_AllowsMaxAtOrAboveBaseCeiling() public {
        // 40_000 is at the ceiling — must succeed.
        vm.prank(owner);
        manager.setLotteryConfig(1_000_000, 6900, true, 40, 40_000, 10_500);
    }
}
