// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

/// @dev Halmos-friendly model checks for product-level invariants that span
/// larger contracts. These do not replace integration tests; they pin the
/// arithmetic and state-gate rules so Foundry fuzz + Halmos can exhaustively
/// check the small decision surfaces before deeper harnesses are added.
contract WrapperBackingAndCooldownSymbolicTest is Test {
    uint256 internal constant NORMALIZATION_FACTOR = 1_000;

    function check_wrapperBackingAndEmergencyWithdraw(
        uint64 minted,
        uint64 dust,
        uint64 actualLocked,
        uint64 sweepAmount
    ) public pure {
        uint256 required = _requiredBacking(minted, dust);
        bool balanced = actualLocked >= required;
        bool sweepAllowed = _emergencySweepAllowed(actualLocked, required, sweepAmount);

        if (sweepAllowed) {
            assert(balanced);
            assert(actualLocked - sweepAmount >= required);
        }
        if (!balanced) {
            assert(!sweepAllowed);
        }
    }

    function check_cooldownPropagation(uint64 fromCooldown, uint64 toCooldown, bool mintOrBurn, bool selfTransfer)
        public
        pure
    {
        uint256 propagated = _propagatedCooldown(fromCooldown, toCooldown, mintOrBurn, selfTransfer);

        if (mintOrBurn || selfTransfer) {
            assert(propagated == toCooldown);
        } else {
            assert(propagated >= fromCooldown);
            assert(propagated >= toCooldown);
        }
    }

    function testFuzz_wrapperBackingAndCooldownModels(
        uint64 minted,
        uint64 dust,
        uint64 actualLocked,
        uint64 sweepAmount,
        uint64 fromCooldown,
        uint64 toCooldown,
        bool mintOrBurn,
        bool selfTransfer
    ) public pure {
        check_wrapperBackingAndEmergencyWithdraw(minted, dust, actualLocked, sweepAmount);
        check_cooldownPropagation(fromCooldown, toCooldown, mintOrBurn, selfTransfer);
    }

    function _requiredBacking(uint256 minted, uint256 dust) internal pure returns (uint256) {
        return minted * NORMALIZATION_FACTOR + dust;
    }

    function _emergencySweepAllowed(uint256 actualLocked, uint256 required, uint256 amount)
        internal
        pure
        returns (bool)
    {
        if (actualLocked <= required) return false;
        return amount <= actualLocked - required;
    }

    function _propagatedCooldown(uint256 fromCooldown, uint256 toCooldown, bool mintOrBurn, bool selfTransfer)
        internal
        pure
        returns (uint256)
    {
        if (mintOrBurn || selfTransfer) return toCooldown;
        return fromCooldown > toCooldown ? fromCooldown : toCooldown;
    }
}

contract StrategyWithdrawalAndNavSymbolicTest is Test {
    function check_strategyWithdrawAccounting(
        uint64 remaining,
        uint64 balanceBefore,
        uint64 balanceAfter,
        uint64 withdrawn,
        uint64 currentDebt
    ) public pure {
        uint256 nextRemaining = _nextRemainingAfterWithdraw(remaining, balanceBefore, balanceAfter, withdrawn);
        uint256 debtReduction = _debtReduction(currentDebt, withdrawn);

        assert(debtReduction <= currentDebt);
        assert(debtReduction <= withdrawn || withdrawn > currentDebt);

        if (withdrawn == 0 && balanceAfter < balanceBefore) {
            assert(nextRemaining == uint256(remaining) + (uint256(balanceBefore) - balanceAfter));
        }
        if (withdrawn != 0 && remaining > withdrawn) {
            assert(nextRemaining == remaining - withdrawn);
        }
        if (withdrawn != 0 && remaining <= withdrawn) {
            assert(nextRemaining == 0);
        }
    }

    function model_navShareSupplyMonotonicity(uint64 totalAssetsBefore, uint64 assetGain, uint16 totalSupply)
        public
        pure
    {
        vm.assume(totalSupply > 0);

        uint256 ppsBefore = (uint256(totalAssetsBefore) * 1e18) / totalSupply;
        uint256 ppsAfter = ((uint256(totalAssetsBefore) + assetGain) * 1e18) / totalSupply;

        assert(ppsAfter >= ppsBefore);
    }

    function testFuzz_strategyWithdrawAndNavModels(
        uint64 remaining,
        uint64 balanceBefore,
        uint64 balanceAfter,
        uint64 withdrawn,
        uint64 currentDebt,
        uint64 totalAssetsBefore,
        uint64 assetGain,
        uint16 totalSupply
    ) public pure {
        check_strategyWithdrawAccounting(remaining, balanceBefore, balanceAfter, withdrawn, currentDebt);
        model_navShareSupplyMonotonicity(totalAssetsBefore, assetGain, totalSupply);
    }

    function _nextRemainingAfterWithdraw(
        uint256 remaining,
        uint256 balanceBefore,
        uint256 balanceAfter,
        uint256 withdrawn
    ) internal pure returns (uint256) {
        if (withdrawn == 0) {
            return balanceAfter < balanceBefore ? remaining + (balanceBefore - balanceAfter) : remaining;
        }
        return remaining > withdrawn ? remaining - withdrawn : 0;
    }

    function _debtReduction(uint256 currentDebt, uint256 withdrawn) internal pure returns (uint256) {
        return withdrawn > currentDebt ? currentDebt : withdrawn;
    }
}

contract CreatorOVaultAccountingSymbolicTest is Test {
    uint256 internal constant DECIMALS_OFFSET_SCALE = 1_000;

    function model_firstDepositShareOffset(uint64 assets) public pure {
        vm.assume(assets > 0);

        uint256 shares = uint256(assets) * DECIMALS_OFFSET_SCALE;

        assert(shares >= assets);
        assert(shares % DECIMALS_OFFSET_SCALE == 0);
    }

    function check_coinBalanceTracksMeasuredTransfers(uint64 balanceBefore, uint64 requested, uint64 received)
        public
        pure
    {
        bool accepted = received == requested;
        uint256 coinBalanceAfter = accepted ? uint256(balanceBefore) + received : balanceBefore;
        uint256 actualBalanceAfter = accepted ? uint256(balanceBefore) + received : balanceBefore;

        assert(coinBalanceAfter == actualBalanceAfter);
        if (!accepted) {
            assert(coinBalanceAfter == balanceBefore);
        }
    }

    function check_previewRedeemCapsQueuedAssets(uint64 rawAssets, uint64 totalAssets, uint64 reservedAssets)
        public
        pure
    {
        uint256 available = totalAssets > reservedAssets ? uint256(totalAssets) - reservedAssets : 0;
        uint256 preview = rawAssets > available ? available : rawAssets;

        assert(preview <= rawAssets);
        assert(preview <= available);
    }

    function check_maxDepositGate(
        bool paused,
        bool shutdown,
        bool whitelistEnabled,
        bool receiverWhitelisted,
        bool valuationReady,
        uint64 currentSupply,
        uint64 maxTotalSupply,
        uint64 totalAssets
    ) public pure {
        uint256 maxDeposit = _maxDepositModel(
            paused,
            shutdown,
            whitelistEnabled,
            receiverWhitelisted,
            valuationReady,
            currentSupply,
            maxTotalSupply,
            totalAssets
        );

        if (paused || shutdown || (whitelistEnabled && !receiverWhitelisted) || !valuationReady) {
            assert(maxDeposit == 0);
        }
        if (currentSupply >= maxTotalSupply) {
            assert(maxDeposit == 0);
        }
    }

    function testFuzz_creatorOVaultAccountingModels(
        uint64 assets,
        uint64 balanceBefore,
        uint64 requested,
        uint64 received,
        uint64 rawAssets,
        uint64 totalAssets,
        uint64 reservedAssets,
        bool paused,
        bool shutdown,
        bool whitelistEnabled,
        bool receiverWhitelisted,
        bool valuationReady,
        uint64 currentSupply,
        uint64 maxTotalSupply
    ) public pure {
        model_firstDepositShareOffset(assets);
        check_coinBalanceTracksMeasuredTransfers(balanceBefore, requested, received);
        check_previewRedeemCapsQueuedAssets(rawAssets, totalAssets, reservedAssets);
        check_maxDepositGate(
            paused,
            shutdown,
            whitelistEnabled,
            receiverWhitelisted,
            valuationReady,
            currentSupply,
            maxTotalSupply,
            totalAssets
        );
    }

    function _maxDepositModel(
        bool paused,
        bool shutdown,
        bool whitelistEnabled,
        bool receiverWhitelisted,
        bool valuationReady,
        uint256 currentSupply,
        uint256 maxTotalSupply,
        uint256 totalAssets
    ) internal pure returns (uint256) {
        if (paused || shutdown) return 0;
        if (whitelistEnabled && !receiverWhitelisted) return 0;
        if (!valuationReady) return 0;
        if (currentSupply >= maxTotalSupply) return 0;

        uint256 remainingShares = maxTotalSupply - currentSupply;
        if (currentSupply == 0) return remainingShares / DECIMALS_OFFSET_SCALE;
        return (remainingShares * totalAssets) / currentSupply;
    }
}

contract CreatorShareOFTFeeAndLotterySymbolicTest is Test {
    uint16 internal constant BASIS_POINTS = 10_000;
    uint16 internal constant MAX_FEE_BPS = 1_000;

    enum OperationType {
        Unknown,
        SwapOnly,
        NoFees
    }

    function check_buyFeeConservation(uint64 amount, uint16 buyFeeBps) public pure {
        vm.assume(buyFeeBps <= MAX_FEE_BPS);

        (uint256 netAmount, uint256 feeAmount) = _applyBuyFee(amount, buyFeeBps);

        assert(netAmount + feeAmount == amount);
        assert(feeAmount <= amount);
        assert(netAmount <= amount);
    }

    function check_feeAppliesOnlyOnSwapOnlyBuy(
        uint64 amount,
        uint16 buyFeeBps,
        uint8 fromType,
        uint8 toType,
        bool feesEnabled
    ) public pure {
        vm.assume(buyFeeBps <= MAX_FEE_BPS);
        vm.assume(fromType <= uint8(type(OperationType).max));
        vm.assume(toType <= uint8(type(OperationType).max));

        bool feeApplies = _feeApplies(fromType, toType, feesEnabled);
        (, uint256 feeAmount) = feeApplies ? _applyBuyFee(amount, buyFeeBps) : (uint256(amount), uint256(0));

        if (!feeApplies || buyFeeBps == 0) {
            assert(feeAmount == 0);
        }
        if (feeApplies && amount > 0 && buyFeeBps > 0) {
            assert(feeAmount <= amount);
        }
    }

    function check_lotteryBeneficiarySelection(
        address recipient,
        bool resolverAllowed,
        bool resolverReturnsZero,
        address resolverBeneficiary
    ) public pure {
        address beneficiary = _lotteryBeneficiary(recipient, resolverAllowed, resolverReturnsZero, resolverBeneficiary);

        if (!resolverAllowed || resolverReturnsZero) {
            assert(beneficiary == recipient);
        } else {
            assert(beneficiary == resolverBeneficiary);
        }
    }

    function check_remotePendingFees(uint64 pendingBefore, uint64 feeAmount, bool isHub) public pure {
        uint256 pendingAfter = isHub ? pendingBefore : uint256(pendingBefore) + feeAmount;

        if (isHub) {
            assert(pendingAfter == pendingBefore);
        } else {
            assert(pendingAfter >= pendingBefore);
        }
    }

    function testFuzz_creatorShareOFTFeeAndLotteryModels(
        uint64 amount,
        uint16 buyFeeBps,
        uint8 fromType,
        uint8 toType,
        bool feesEnabled,
        address recipient,
        bool resolverAllowed,
        bool resolverReturnsZero,
        address resolverBeneficiary,
        uint64 pendingBefore,
        uint64 feeAmount,
        bool isHub
    ) public pure {
        check_buyFeeConservation(amount, buyFeeBps);
        check_feeAppliesOnlyOnSwapOnlyBuy(amount, buyFeeBps, fromType, toType, feesEnabled);
        check_lotteryBeneficiarySelection(recipient, resolverAllowed, resolverReturnsZero, resolverBeneficiary);
        check_remotePendingFees(pendingBefore, feeAmount, isHub);
    }

    function _applyBuyFee(uint256 amount, uint256 buyFeeBps)
        internal
        pure
        returns (uint256 netAmount, uint256 feeAmount)
    {
        feeAmount = (amount * buyFeeBps) / BASIS_POINTS;
        netAmount = amount - feeAmount;
    }

    function _feeApplies(uint8 fromType, uint8 toType, bool feesEnabled) internal pure returns (bool) {
        return feesEnabled && fromType == uint8(OperationType.SwapOnly) && toType != uint8(OperationType.SwapOnly)
            && toType != uint8(OperationType.NoFees);
    }

    function _lotteryBeneficiary(
        address recipient,
        bool resolverAllowed,
        bool resolverReturnsZero,
        address resolverBeneficiary
    ) internal pure returns (address) {
        if (!resolverAllowed || resolverReturnsZero) return recipient;
        return resolverBeneficiary;
    }
}

contract GaugePayoutAndPayoutRouterSymbolicTest is Test {
    function check_jackpotReserveCannotOverpay(uint64 reserve, uint64 requestedPayout) public pure {
        bool allowed = requestedPayout <= reserve;
        uint256 reserveAfter = allowed ? uint256(reserve) - requestedPayout : reserve;

        assert(reserveAfter <= reserve);
        if (!allowed) {
            assert(reserveAfter == reserve);
        }
    }

    function check_payoutRouterQueuesConvertedShares(uint64 creatorOut, uint64 minCreatorOut) public pure {
        bool allowed = creatorOut >= minCreatorOut;
        uint256 vaultDeposited = allowed ? creatorOut : 0;
        uint256 sharesQueued = allowed ? creatorOut : 0;

        assert(vaultDeposited == sharesQueued);
        if (allowed) {
            assert(sharesQueued >= minCreatorOut);
        }
    }

    function testFuzz_gaugeAndPayoutModels(
        uint64 reserve,
        uint64 requestedPayout,
        uint64 creatorOut,
        uint64 minCreatorOut
    ) public pure {
        check_jackpotReserveCannotOverpay(reserve, requestedPayout);
        check_payoutRouterQueuesConvertedShares(creatorOut, minCreatorOut);
    }
}

contract SolanaBridgeAndCcaCompletionSymbolicTest is Test {
    function check_solanaBridgeUnitConversion(uint64 amountBaseUnits, uint8 solanaDecimals) public pure {
        vm.assume(solanaDecimals <= 18);

        uint256 scale = 10 ** (18 - solanaDecimals);
        bool bridgeable = amountBaseUnits >= scale;
        uint256 remoteAmount = bridgeable ? amountBaseUnits / scale : 0;

        if (bridgeable) {
            assert(remoteAmount > 0);
        } else {
            assert(remoteAmount == 0);
        }
    }

    function check_registerTokenIsOneWay(bool alreadyRegistered, bytes32 existingMint, bytes32 newMint) public pure {
        bool canRegister = !alreadyRegistered && newMint != bytes32(0);
        bytes32 finalMint = canRegister ? newMint : existingMint;

        if (alreadyRegistered) {
            assert(finalMint == existingMint);
        }
        if (canRegister) {
            assert(finalMint == newMint);
        }
    }

    function check_ccaCompletionGate(
        bool feeRecipientsAligned,
        bool payoutTargetAligned,
        bool creatorTreasuryRequired,
        bool creatorTreasurySet,
        bool sweepSucceeded,
        bool migrateSucceeded,
        bool hookConfiguredOrAwaiting
    ) public pure {
        bool completed = _ccaCanComplete(
            feeRecipientsAligned,
            payoutTargetAligned,
            creatorTreasuryRequired,
            creatorTreasurySet,
            sweepSucceeded,
            migrateSucceeded,
            hookConfiguredOrAwaiting
        );

        if (completed) {
            assert(feeRecipientsAligned);
            assert(payoutTargetAligned);
            assert(!creatorTreasuryRequired || creatorTreasurySet);
            assert(sweepSucceeded);
            assert(migrateSucceeded);
            assert(hookConfiguredOrAwaiting);
        }
    }

    function testFuzz_solanaBridgeAndCcaCompletionModels(
        uint64 amountBaseUnits,
        uint8 solanaDecimals,
        bool alreadyRegistered,
        bytes32 existingMint,
        bytes32 newMint,
        bool feeRecipientsAligned,
        bool payoutTargetAligned,
        bool creatorTreasuryRequired,
        bool creatorTreasurySet,
        bool sweepSucceeded,
        bool migrateSucceeded,
        bool hookConfiguredOrAwaiting
    ) public pure {
        check_solanaBridgeUnitConversion(amountBaseUnits, solanaDecimals);
        check_registerTokenIsOneWay(alreadyRegistered, existingMint, newMint);
        check_ccaCompletionGate(
            feeRecipientsAligned,
            payoutTargetAligned,
            creatorTreasuryRequired,
            creatorTreasurySet,
            sweepSucceeded,
            migrateSucceeded,
            hookConfiguredOrAwaiting
        );
    }

    function _ccaCanComplete(
        bool feeRecipientsAligned,
        bool payoutTargetAligned,
        bool creatorTreasuryRequired,
        bool creatorTreasurySet,
        bool sweepSucceeded,
        bool migrateSucceeded,
        bool hookConfiguredOrAwaiting
    ) internal pure returns (bool) {
        return feeRecipientsAligned && payoutTargetAligned && (!creatorTreasuryRequired || creatorTreasurySet)
            && sweepSucceeded && migrateSucceeded && hookConfiguredOrAwaiting;
    }
}

contract LotteryAmoeDeadlineAndReplaySymbolicTest is Test {
    uint256 internal constant MIN_DEADLINE_BUFFER = 30;

    function check_amoeDeadlineGate(uint64 nowTs, uint64 deadline) public pure {
        bool accepted = _deadlineAccepted(nowTs, deadline);

        if (deadline < nowTs) {
            assert(!accepted);
        }
        if (deadline >= nowTs && uint256(deadline) - nowTs < MIN_DEADLINE_BUFFER) {
            assert(!accepted);
        }
        if (accepted) {
            assert(deadline >= nowTs);
            assert(uint256(deadline) - nowTs >= MIN_DEADLINE_BUFFER);
        }
    }

    function check_amoeReplayState(
        bool nonceUsed,
        bool walletUsed,
        bool pointsNullifierUsed,
        bool proofOk,
        bool managerReturnsEntry
    ) public pure {
        bool accepted = _zkEntryAccepted(nonceUsed, walletUsed, pointsNullifierUsed, proofOk, managerReturnsEntry);

        if (accepted) {
            assert(!nonceUsed);
            assert(!walletUsed);
            assert(!pointsNullifierUsed);
            assert(proofOk);
            assert(managerReturnsEntry);
        }
        if (nonceUsed || walletUsed || pointsNullifierUsed || !proofOk || !managerReturnsEntry) {
            assert(!accepted);
        }
    }

    function testFuzz_amoeDeadlineAndReplayModels(
        uint64 nowTs,
        uint64 deadline,
        bool nonceUsed,
        bool walletUsed,
        bool pointsNullifierUsed,
        bool proofOk,
        bool managerReturnsEntry
    ) public pure {
        check_amoeDeadlineGate(nowTs, deadline);
        check_amoeReplayState(nonceUsed, walletUsed, pointsNullifierUsed, proofOk, managerReturnsEntry);
    }

    function _deadlineAccepted(uint256 nowTs, uint256 deadline) internal pure returns (bool) {
        if (nowTs > deadline) return false;
        return deadline - nowTs >= MIN_DEADLINE_BUFFER;
    }

    function _zkEntryAccepted(
        bool nonceUsed,
        bool walletUsed,
        bool pointsNullifierUsed,
        bool proofOk,
        bool managerReturnsEntry
    ) internal pure returns (bool) {
        return !nonceUsed && !walletUsed && !pointsNullifierUsed && proofOk && managerReturnsEntry;
    }
}
