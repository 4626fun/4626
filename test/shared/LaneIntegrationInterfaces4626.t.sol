// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {AgentRevenuePolicyController} from
    "@4626/agent/revenue/AgentRevenuePolicyController.sol";
import {AgentRevenueRouter} from "@4626/agent/revenue/AgentRevenueRouter.sol";
import {AgentGaugeController} from "@4626/agent/revenue/AgentGaugeController.sol";
import {AgentShareOFT} from "@4626/agent/vault/AgentShareOFT.sol";
import {IAgentRevenuePolicyController4626} from
    "@4626/agent/interfaces/IAgentRevenuePolicyController4626.sol";
import {CreatorCoinPolicyController} from
    "@4626/creator/revenue/CreatorCoinPolicyController.sol";
import {CreatorPayoutRouter} from "@4626/creator/revenue/CreatorPayoutRouter.sol";
import {CreatorGaugeController} from "@4626/creator/revenue/CreatorGaugeController.sol";
import {CreatorShareOFT} from "@4626/creator/vault/CreatorShareOFT.sol";
import {ICreatorCoinPolicyController4626} from
    "@4626/creator/interfaces/ICreatorCoinPolicyController4626.sol";
import {IRevenueRouter4626} from "@4626/shared/interfaces/revenue/IRevenueRouter4626.sol";
import {ITradeFeeCollector4626} from
    "@4626/shared/interfaces/revenue/ITradeFeeCollector4626.sol";
import {IShareOFT4626} from "@4626/shared/interfaces/vault/IShareOFT4626.sol";

contract LaneIntegrationInterfaces4626Test is Test {
    function _assertSelector(bytes4 actual, bytes4 expected) internal pure {
        assertEq(uint32(actual), uint32(expected));
    }

    function testRevenueRoutersExposeNeutralExecutionSelectors() public pure {
        _assertSelector(
            CreatorPayoutRouter.convertAndQueue.selector,
            IRevenueRouter4626.convertAndQueue.selector
        );
        _assertSelector(
            AgentRevenueRouter.convertAndQueue.selector,
            IRevenueRouter4626.convertAndQueue.selector
        );
        _assertSelector(
            CreatorPayoutRouter.convertViaExternalAndQueue.selector,
            IRevenueRouter4626.convertViaExternalAndQueue.selector
        );
        _assertSelector(
            AgentRevenueRouter.convertViaExternalAndQueue.selector,
            IRevenueRouter4626.convertViaExternalAndQueue.selector
        );
        _assertSelector(
            CreatorPayoutRouter.processBatch.selector,
            IRevenueRouter4626.processBatch.selector
        );
        _assertSelector(
            AgentRevenueRouter.processBatch.selector,
            IRevenueRouter4626.processBatch.selector
        );
        _assertSelector(
            CreatorPayoutRouter.claimProtocolRewards.selector,
            IRevenueRouter4626.claimProtocolRewards.selector
        );
        _assertSelector(
            AgentRevenueRouter.claimProtocolRewards.selector,
            IRevenueRouter4626.claimProtocolRewards.selector
        );
    }

    function testGaugeControllersExposeNeutralTradeFeeSelectors() public pure {
        _assertSelector(
            CreatorGaugeController.receiveFees.selector,
            ITradeFeeCollector4626.receiveFees.selector
        );
        _assertSelector(
            AgentGaugeController.receiveFees.selector,
            ITradeFeeCollector4626.receiveFees.selector
        );
        _assertSelector(
            CreatorGaugeController.receiveBridgedFees.selector,
            ITradeFeeCollector4626.receiveBridgedFees.selector
        );
        _assertSelector(
            AgentGaugeController.receiveBridgedFees.selector,
            ITradeFeeCollector4626.receiveBridgedFees.selector
        );
        _assertSelector(
            CreatorGaugeController.getFeeSplit.selector,
            ITradeFeeCollector4626.getFeeSplit.selector
        );
        _assertSelector(
            AgentGaugeController.getFeeSplit.selector,
            ITradeFeeCollector4626.getFeeSplit.selector
        );
        _assertSelector(
            CreatorGaugeController.payJackpot.selector,
            ITradeFeeCollector4626.payJackpot.selector
        );
        _assertSelector(
            AgentGaugeController.payJackpot.selector,
            ITradeFeeCollector4626.payJackpot.selector
        );
    }

    function testShareOftsExposeNeutralMeshSelectors() public pure {
        _assertSelector(CreatorShareOFT.setRegistry.selector, IShareOFT4626.setRegistry.selector);
        _assertSelector(AgentShareOFT.setRegistry.selector, IShareOFT4626.setRegistry.selector);
        _assertSelector(
            CreatorShareOFT.setGaugeController.selector,
            IShareOFT4626.setGaugeController.selector
        );
        _assertSelector(
            AgentShareOFT.setGaugeController.selector,
            IShareOFT4626.setGaugeController.selector
        );
        _assertSelector(
            CreatorShareOFT.setHubConfig.selector,
            IShareOFT4626.setHubConfig.selector
        );
        _assertSelector(
            AgentShareOFT.setHubConfig.selector,
            IShareOFT4626.setHubConfig.selector
        );
        _assertSelector(
            CreatorShareOFT.setAddressType.selector,
            IShareOFT4626.setAddressType.selector
        );
        _assertSelector(
            AgentShareOFT.setAddressType.selector,
            IShareOFT4626.setAddressType.selector
        );
        _assertSelector(
            CreatorShareOFT.setAddressTypes.selector,
            IShareOFT4626.setAddressTypes.selector
        );
        _assertSelector(
            AgentShareOFT.setAddressTypes.selector,
            IShareOFT4626.setAddressTypes.selector
        );
        _assertSelector(
            CreatorShareOFT.flushPendingFeesToGauge.selector,
            IShareOFT4626.flushPendingFeesToGauge.selector
        );
        _assertSelector(
            AgentShareOFT.flushPendingFeesToGauge.selector,
            IShareOFT4626.flushPendingFeesToGauge.selector
        );
        _assertSelector(
            CreatorShareOFT.balanceEligibleForLotteryCoverage.selector,
            IShareOFT4626.balanceEligibleForLotteryCoverage.selector
        );
        _assertSelector(
            AgentShareOFT.balanceEligibleForLotteryCoverage.selector,
            IShareOFT4626.balanceEligibleForLotteryCoverage.selector
        );
    }

    function testPolicyControllersKeepEcosystemSpecificEnforcementSelectors() public pure {
        _assertSelector(
            CreatorCoinPolicyController.enforcePayoutRouter.selector,
            ICreatorCoinPolicyController4626.enforcePayoutRouter.selector
        );
        _assertSelector(
            CreatorCoinPolicyController.proposeCreatorCoinOwnershipTransfer.selector,
            ICreatorCoinPolicyController4626.proposeCreatorCoinOwnershipTransfer.selector
        );
        _assertSelector(
            AgentRevenuePolicyController.enforceProjectTaxRecipient.selector,
            IAgentRevenuePolicyController4626.enforceProjectTaxRecipient.selector
        );
        assertTrue(
            ICreatorCoinPolicyController4626.enforcePayoutRouter.selector
                != IAgentRevenuePolicyController4626.enforceProjectTaxRecipient.selector
        );
    }
}
