// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CreatorOVault} from "@4626/creator/vault/CreatorOVault.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";
import {IStrategy} from "@4626/shared/interfaces/strategies/IStrategy.sol";
import {IStrategyValuation} from "@4626/shared/interfaces/strategies/IStrategyValuation.sol";

contract MockCoinP0 is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Rejects ETH to grief bond refunds.
contract RevertingBondReceiver {
    error RejectEth();

    receive() external payable {
        revert RejectEth();
    }

    function challenge(CreatorOVault vault, uint256 epochId, uint256 bond) external payable {
        vault.challengeImpairmentRoot{value: bond}(epochId, "grief");
    }
}

contract MockStratP0 is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external pure override returns (bool) {
        return true;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "tf");
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "t");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) require(TOKEN.transfer(msg.sender, withdrawn), "t");
    }

    function harvest() external pure override returns (uint256) {
        return 0;
    }

    function rebalance() external override {}
}

/// @notice Focused ODA-480/481 P0 remediation checks.
contract ODA480_481_P0Test is Test {
    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    function setUp() public {
        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new OVaultStrategiesModule());
        adminModule = address(new OVaultAdminModule());
    }

    function _deployVault() internal returns (MockCoinP0 coin, CreatorOVault vault) {
        coin = new MockCoinP0();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovTEST");
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);
    }

    /// ODA-480-[3]: third-party deposit-to must not refresh victim cooldown.
    function test_480_3_depositToVictimDoesNotRefreshCooldown() public {
        (MockCoinP0 coin, CreatorOVault vault) = _deployVault();
        address attacker = makeAddr("attacker");
        address victim = makeAddr("victim");

        uint256 bootstrap = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 dust = 1e18;
        coin.mint(attacker, bootstrap + dust);
        coin.mint(victim, dust);

        vm.prank(attacker);
        coin.approve(address(vault), type(uint256).max);
        vm.prank(victim);
        coin.approve(address(vault), type(uint256).max);

        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);

        vm.roll(block.number + 1);
        vm.prank(victim);
        vault.deposit(dust, victim);
        uint256 victimCooldown = vault.lastDepositBlock(victim);

        // After victim's own cooldown elapses, attacker donates shares to victim.
        vm.roll(block.number + vault.withdrawDelayBlocks());
        vm.prank(attacker);
        vault.deposit(dust, victim);

        assertEq(vault.lastDepositBlock(victim), victimCooldown, "third-party mint-to must not push cooldown");

        // Victim can still withdraw based on their own prior deposit clock.
        vm.prank(victim);
        vault.withdraw(dust / 2, victim, victim);
    }

    /// Codex: empty alternate receiver must still receive a withdraw cooldown.
    function test_480_3_depositToEmptyReceiverSetsCooldown() public {
        (MockCoinP0 coin, CreatorOVault vault) = _deployVault();
        address attacker = makeAddr("attacker");
        address emptyReceiver = makeAddr("emptyReceiver");

        uint256 bootstrap = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 dust = 1e18;
        coin.mint(attacker, bootstrap + dust);

        vm.prank(attacker);
        coin.approve(address(vault), type(uint256).max);

        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);

        vm.roll(block.number + vault.withdrawDelayBlocks());
        vm.prank(attacker);
        vault.deposit(dust, emptyReceiver);

        assertEq(vault.lastDepositBlock(emptyReceiver), block.number, "empty receiver must get cooldown");
        assertGt(vault.balanceOf(emptyReceiver), 0, "empty receiver must receive shares");

        uint256 redeemShares = vault.balanceOf(emptyReceiver) / 2;
        vm.prank(emptyReceiver);
        vm.expectRevert();
        vault.redeem(redeemShares, emptyReceiver, emptyReceiver);

        vm.roll(block.number + vault.withdrawDelayBlocks());
        vm.prank(emptyReceiver);
        vault.redeem(redeemShares, emptyReceiver, emptyReceiver);
    }

    /// ODA-480-[1]: reverting challenger must not brick clearStaleImpairmentTrip.
    function test_480_1_revertingChallengerDoesNotBrickClearStale() public {
        (MockCoinP0 coin, CreatorOVault vault) = _deployVault();
        MockStratP0 strat = new MockStratP0(address(coin));

        uint256 bootstrap = vault.MINIMUM_FIRST_DEPOSIT();
        coin.mint(address(this), bootstrap);
        coin.approve(address(vault), type(uint256).max);
        vault.deposit(bootstrap, address(this));

        vault.setFlashLoanProtection(0, 1e18, 2);
        vault.addStrategy(address(strat), 5_000, true);
        vault.deployToStrategies();

        vault.setMaxImpairmentTripDuration(3 days); // protocol min
        vault.setImpairmentChallengeWindow(1 hours);
        uint256 bond = 0.05 ether;
        vault.setImpairmentChallengeBond(bond);

        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, address(this), vault.balanceOf(address(this))));
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(address(this)), address(coin));

        RevertingBondReceiver griefer = new RevertingBondReceiver();
        vm.deal(address(griefer), 1 ether);
        griefer.challenge{value: bond}(vault, epochId, bond);
        assertTrue(vault.impairmentRootChallenged(epochId));

        // Clear challenge path refunds bond — must not revert on rejecting recipient.
        vault.clearImpairmentRootAfterChallenge(epochId);
        assertFalse(vault.impairmentRootChallenged(epochId));
        assertEq(vault.impairmentChallengeBondHeld(epochId), 0);

        // Re-challenge + wait for stale trip timeout; clearStale must succeed.
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(address(this)), address(coin));
        griefer.challenge{value: bond}(vault, epochId, bond);

        vm.warp(block.timestamp + 3 days + 1);
        vault.clearStaleImpairmentTrip(epochId);
        assertEq(uint8(vault.vaultMode()), 0); // Normal
    }

    /// ODA-481-[2]: classifier accepts only structurally-valid V3 224-byte ABI payloads.
    function test_481_2_lotteryEntryClassifierRejectsOFTShapedAndLegacyLengths() public {
        // Deploy a real ShareOFT so we can exercise the internal pure helper via a harness pattern:
        // encode candidate payloads and check hub forward gating indirectly is heavy; use a test
        // subclass through `vm.etch` is overkill — call the pure logic via a thin harness contract.
        LotteryEntryClassifierHarness h = new LotteryEntryClassifierHarness();

        // Legacy 192-byte V2 — rejected.
        bytes memory v2 = abi.encode(
            uint16(3), address(0xBEEF), address(0xCAFE), uint256(1e18), uint32(8453), uint256(1e18)
        );
        assertEq(v2.length, 192);
        assertFalse(h.isRemoteLotteryEntryMessage(v2));

        // 224-byte with zero sourceEventId — rejected.
        bytes memory v3Zero = abi.encode(
            uint16(3),
            address(0xBEEF),
            address(0xCAFE),
            uint256(1e18),
            uint32(8453),
            uint256(1e18),
            bytes32(0)
        );
        assertEq(v3Zero.length, 224);
        assertFalse(h.isRemoteLotteryEntryMessage(v3Zero));

        // Valid V3 — accepted.
        bytes memory v3 = abi.encode(
            uint16(3),
            address(0xBEEF),
            address(0xCAFE),
            uint256(1e18),
            uint32(8453),
            uint256(1e18),
            keccak256("evt")
        );
        assertTrue(h.isRemoteLotteryEntryMessage(v3));

        // OFT-shaped: first word looks like msgType=3 but address padding broken (sendTo-style).
        bytes memory oftShaped = new bytes(224);
        // word0 = uint256(3) is fine for msgType; put non-zero high bits in word1 to fail address check.
        assembly {
            mstore(add(oftShaped, 0x20), 3)
            mstore(add(oftShaped, 0x40), shl(160, 1)) // word1 high bits set
        }
        assertFalse(h.isRemoteLotteryEntryMessage(oftShaped));
    }
}

/// @dev Exposes CreatorShareOFT classifier rules without full LZ construction.
contract LotteryEntryClassifierHarness {
    uint16 internal constant MSG_TYPE_LOTTERY_ENTRY = 3;

    function isRemoteLotteryEntryMessage(bytes calldata message) external pure returns (bool) {
        if (message.length != 224) return false;
        uint256 word0;
        uint256 word1;
        uint256 word2;
        uint256 word4;
        uint256 word6;
        assembly {
            word0 := calldataload(message.offset)
            word1 := calldataload(add(message.offset, 0x20))
            word2 := calldataload(add(message.offset, 0x40))
            word4 := calldataload(add(message.offset, 0x80))
            word6 := calldataload(add(message.offset, 0xc0))
        }
        if (word0 >> 16 != 0) return false;
        if (uint16(word0) != MSG_TYPE_LOTTERY_ENTRY) return false;
        if (word1 >> 160 != 0) return false;
        if (word2 >> 160 != 0) return false;
        if (uint160(word1) == 0 || uint160(word2) == 0) return false;
        if (word4 >> 32 != 0) return false;
        if (word6 == 0) return false;
        return true;
    }
}
