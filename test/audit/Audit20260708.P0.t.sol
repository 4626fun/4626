// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {OVaultRecoveryEscrow} from "@4626/shared/vault/recovery/OVaultRecoveryEscrow.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {DeploymentBatcherUtilsHelper} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// =====================================================================
// Shared mocks for AUDIT-2026-07-08 P0 PoCs
// =====================================================================

contract MockERC20P0 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

contract MockOracleP0 {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function getAssetPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockRegistryP0 {
    address public immutable endpoint;
    address public immutable token;
    address public immutable shareOFT;
    address public immutable oracle;
    address public vault;
    bool public active = true;

    constructor(address _endpoint, address _token, address _shareOFT, address _oracle) {
        endpoint = _endpoint;
        token = _token;
        shareOFT = _shareOFT;
        oracle = _oracle;
    }

    function setVault(address v) external {
        vault = v;
    }

    function getVaultForToken(address) external view returns (address) {
        return vault;
    }

    function getShareOFTForToken(address t) external view returns (address) {
        return t == token ? shareOFT : address(0);
    }

    function getTokenForShareOFT(address s) external view returns (address) {
        return s == shareOFT ? token : address(0);
    }

    function getOracleForToken(address t) external view returns (address) {
        return t == token ? oracle : address(0);
    }

    function getGaugeControllerForToken(address) external pure returns (address) {
        return address(0);
    }

    function isTokenActive(address t) external view returns (bool) {
        return active && t == token;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllTokens() external view returns (address[] memory coins) {
        coins = new address[](1);
        coins[0] = token;
    }
}

contract MockVrfP0 {
    uint256 public nextRequestId = 1;

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}

contract MockBoostP0 {
    uint256 public boostBPS = 20_000; // 2x
    uint256 public probBoostBps = 100;

    function calculateBoost(address) external view returns (uint256) {
        return boostBPS;
    }

    function getTotalProbabilityBoost(address) external view returns (uint256) {
        return probBoostBps;
    }

    function getCoverageBps(
        address,
        address,
        address,
        address,
        uint256 creatorShareBalanceUSD,
        uint256 swapAmountUSD
    ) external pure returns (uint256) {
        if (swapAmountUSD == 0 || creatorShareBalanceUSD == 0) return 0;
        uint256 covered = creatorShareBalanceUSD < swapAmountUSD ? creatorShareBalanceUSD : swapAmountUSD;
        return (covered * 10_000) / swapAmountUSD;
    }
}

/// @dev Minimal ShareOFT stand-in that implements block-start coverage snapshots.
contract MockShareOftCoverageP0 is ERC20 {
    mapping(address => uint256) private _snapBlock;
    mapping(address => uint256) private _snapBal;

    constructor() ERC20("Share", unicode"■T") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        _snap(from);
        _snap(to);
        super._update(from, to, value);
    }

    function _snap(address account) internal {
        if (account == address(0)) return;
        if (_snapBlock[account] == block.number) return;
        _snapBal[account] = balanceOf(account);
        _snapBlock[account] = block.number;
    }

    function balanceEligibleForLotteryCoverage(address account) public view returns (uint256) {
        if (_snapBlock[account] == block.number) return _snapBal[account];
        return balanceOf(account);
    }
}

// =====================================================================
// H-01 — Recovery escrow push-then-notify
// =====================================================================

contract Audit20260708_H01_RecoveryEscrow is Test {
    OVaultRecoveryEscrow internal escrow;
    MockERC20P0 internal token;
    address internal vault = address(0xBEEF);
    address internal alice = address(0xA11CE);

    function setUp() public {
        escrow = new OVaultRecoveryEscrow(address(this));
        escrow.setVault(vault);
        token = new MockERC20P0("Coin", "CC");
    }

    function test_notifyRecovery_afterPush_creditsWithoutAllowance() public {
        // Vault pushes first (production path), then notifies — no approve.
        token.mint(address(escrow), 100 ether);
        vm.prank(vault);
        escrow.notifyRecovery(address(token), 1, 100 ether);
        assertEq(escrow.recoveredByEpochAsset(1, address(token)), 100 ether);
        assertEq(escrow.totalUnclaimedRecovery(), 100 ether);
    }

    function test_notifyRecovery_revertsWhenCustodyMissing() public {
        vm.prank(vault);
        vm.expectRevert(
            abi.encodeWithSelector(
                OVaultRecoveryEscrow.InsufficientRecoveryCustody.selector, address(token), 0, 1 ether
            )
        );
        escrow.notifyRecovery(address(token), 1, 1 ether);
    }

    function test_claimRecovery_fullFlow() public {
        token.mint(address(escrow), 10 ether);
        vm.prank(vault);
        escrow.notifyRecovery(address(token), 1, 10 ether);
        vm.prank(vault);
        escrow.claimRecovery(address(token), 1, alice, 7 ether);
        assertEq(token.balanceOf(alice), 7 ether);
    }
}

// =====================================================================
// C-01 — ShareOFT salt includes creatorToken
// =====================================================================

contract Audit20260708_C01_ShareOftSalt is Test {
    DeploymentBatcherUtilsHelper internal utils;

    function setUp() public {
        utils = new DeploymentBatcherUtilsHelper();
    }

    function test_deriveShareOftSalt_differsPerCreatorToken() public view {
        address owner = address(0xA);
        string memory symbol = "akita";
        string memory version = "v1.16.0";
        address tokenA = address(0x1111);
        address tokenB = address(0x2222);

        bytes32 saltA = utils.deriveShareOftSalt(tokenA, owner, symbol, version);
        bytes32 saltB = utils.deriveShareOftSalt(tokenB, owner, symbol, version);
        assertTrue(saltA != saltB, "same owner/symbol/version must not collide across creator tokens");
    }

    function test_deriveShareOftSalt_stableForSameToken() public view {
        address owner = address(0xA);
        address token = address(0x1111);
        bytes32 a = utils.deriveShareOftSalt(token, owner, "akita", "v1");
        bytes32 b = utils.deriveShareOftSalt(token, owner, "akita", "v1");
        assertEq(a, b);
    }

    function test_legacySalt_differsFromScopedSalt() public view {
        address owner = address(0xA);
        address token = address(0x1111);
        bytes32 scoped = utils.deriveShareOftSalt(token, owner, "akita", "v1");
        bytes32 legacy = utils.deriveShareOftSaltLegacy(owner, "akita", "v1");
        assertTrue(scoped != legacy, "new salt domain must diverge from pre-C01");
    }
}

// =====================================================================
// H-02 / H-03 — Lottery coverage cannot use same-block flash ShareOFT
// =====================================================================

contract Audit20260708_H02_LotteryCoverage is Test {
    LotteryManager4626 internal manager;
    MockShareOftCoverageP0 internal share;
    MockOracleP0 internal oracle;
    MockRegistryP0 internal registry;
    MockVrfP0 internal vrf;
    MockBoostP0 internal boost;
    address internal owner = address(this);
    address internal authorizedSwap = address(0x515151);
    address internal relayer = address(0x525252);
    address internal buyer = address(0xB0B);
    address internal token = address(0xC01);
    address internal constant LZ = address(0xDEAD);

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        share = new MockShareOftCoverageP0();
        oracle = new MockOracleP0();
        registry = new MockRegistryP0(LZ, token, address(share), address(oracle));
        registry.setVault(address(0xA11));
        vrf = new MockVrfP0();
        boost = new MockBoostP0();

        manager = new LotteryManager4626(address(registry), owner);
        manager.setAuthorizedSwapContract(authorizedSwap, true);
        manager.setLocalVRFConsumer(address(vrf));
        manager.setUseLocalVRF(true);
        manager.setBoostManager(address(boost));
        manager.setAuthorizedAmoeRelayer(relayer);
        // Neutralize slippage multiplier for clean arithmetic.
        manager.setLotteryConfig(1_000_000, 6900, true, 40, 150_000, 10_000);
    }

    function _effectivePPM(uint256 entryId) internal view returns (uint256 ppm) {
        (,,, ppm,,,) = manager.vrfRequests(entryId);
    }

    /// @notice PoC: same-block flash credit must not raise coverage above aged holdings.
    function test_PoC_sameBlockFlashShare_doesNotInflateCoverage() public {
        // Aged holding: 1 ShareOFT from a prior block.
        share.mint(buyer, 1e18);
        vm.roll(block.number + 1);

        // Same block: flash-borrow 1_000_000 ShareOFT, then enter lottery with a $10 buy.
        share.mint(buyer, 1_000_000e18);
        assertEq(share.balanceOf(buyer), 1_000_001e18);
        // Block-start eligible is still 1e18 (pre-flash snapshot).
        assertEq(share.balanceEligibleForLotteryCoverage(buyer), 1e18);

        uint256 amountIn = 10e18;
        // Live balance already includes flash; amountIn is the "buy".
        // Eligible reported = 1e18; pre-buy max = live - amountIn >> 1e18 → coverage = 1e18.
        vm.prank(authorizedSwap);
        uint256 entryId = manager.processSwapLottery(buyer, address(share), amountIn, 1e18);
        assertGt(entryId, 0);

        uint256 ppmWithFlash = _effectivePPM(entryId);

        // Control: only aged 1e18, no flash — same coverage PPM.
        address buyer2 = address(0xB0B2);
        share.mint(buyer2, 1e18);
        vm.roll(block.number + 1);
        // Buy size reflected in live bal for pre-buy cap (eligible still 1e18).
        share.mint(buyer2, amountIn);
        vm.prank(authorizedSwap);
        uint256 entryId2 = manager.processSwapLottery(buyer2, address(share), amountIn, 1e18);
        uint256 ppmNoFlash = _effectivePPM(entryId2);

        assertEq(ppmWithFlash, ppmNoFlash, "flash-borrowed ShareOFT must not lift coverage");
        // Sanity: personal boost fired (base $10 = 40 PPM without boost).
        assertGt(ppmWithFlash, 40, "aged holdings should still provide coverage");
    }

    /// @notice PoC: just-purchased amount alone does not grant full coverage of the trade.
    function test_PoC_justPurchasedAmount_excludedFromCoverage() public {
        // Buyer had 0 aged balance; only receives amountIn this block.
        uint256 amountIn = 10e18;
        share.mint(buyer, amountIn); // first credit this block → eligible = 0

        assertEq(share.balanceEligibleForLotteryCoverage(buyer), 0);

        vm.prank(authorizedSwap);
        uint256 entryId = manager.processSwapLottery(buyer, address(share), amountIn, 0);
        assertGt(entryId, 0);
        // Base odds only ($10 → 40 PPM); no personal coverage boost.
        assertEq(_effectivePPM(entryId), 40, "zero eligible coverage => base PPM only");
    }

    /// @notice PoC: AMOE uses ShareOFT balance, not lane coin.
    function test_PoC_amoeCoverage_usesShareOftNotLaneCoin() public {
        // Give buyer a huge lane-coin balance via mock would previously inflate coverage.
        // We do not mint lane coin (token is a bare address); ShareOFT balance = 0.
        vm.prank(relayer);
        uint256 entryZero = manager.processAmoeEntry(buyer, token, 10 * 1_000_000);
        assertEq(_effectivePPM(entryZero), 40, "no ShareOFT => base PPM");

        // Age 10 ShareOFT then AMOE again — personal boost should apply.
        share.mint(buyer, 10e18);
        vm.roll(block.number + 1);
        vm.prank(relayer);
        uint256 entryHeld = manager.processAmoeEntry(buyer, token, 10 * 1_000_000);
        assertGt(_effectivePPM(entryHeld), 40, "ShareOFT holdings enable AMOE coverage boost");
    }
}
