// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {AgentRevenuePolicyController} from
    "@4626/agent/revenue/AgentRevenuePolicyController.sol";
import {AgentRevenueRouter} from "@4626/agent/revenue/AgentRevenueRouter.sol";
import {AgentGaugeController} from "@4626/agent/revenue/AgentGaugeController.sol";
import {AgentShareOFT} from "@4626/agent/vault/AgentShareOFT.sol";
import {AgentOVault} from "@4626/agent/vault/AgentOVault.sol";
import {AgentOVaultWrapper} from "@4626/agent/vault/AgentOVaultWrapper.sol";
import {IAgentRevenuePolicyController4626} from
    "@4626/agent/interfaces/IAgentRevenuePolicyController4626.sol";
import {IAgentGaugeController} from "@4626/agent/interfaces/IAgentGaugeController.sol";
import {IAgentOVault} from "@4626/agent/interfaces/IAgentOVault.sol";
import {CreatorCoinPolicyController} from
    "@4626/creator/revenue/CreatorCoinPolicyController.sol";
import {CreatorPayoutRouter} from "@4626/creator/revenue/CreatorPayoutRouter.sol";
import {CreatorGaugeController} from "@4626/creator/revenue/CreatorGaugeController.sol";
import {CreatorShareOFT} from "@4626/creator/vault/CreatorShareOFT.sol";
import {CreatorOVault} from "@4626/creator/vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "@4626/creator/vault/CreatorOVaultWrapper.sol";
import {ICreatorCoinPolicyController4626} from
    "@4626/creator/interfaces/ICreatorCoinPolicyController4626.sol";
import {ICreatorGaugeController} from "@4626/creator/interfaces/ICreatorGaugeController.sol";
import {ICreatorOVault} from "@4626/creator/interfaces/ICreatorOVault.sol";
import {IRevenueRouter4626} from "@4626/shared/interfaces/revenue/IRevenueRouter4626.sol";
import {ITradeFeeCollector4626} from
    "@4626/shared/interfaces/revenue/ITradeFeeCollector4626.sol";
import {IRevenuePolicyController4626} from
    "@4626/shared/interfaces/revenue/IRevenuePolicyController4626.sol";
import {IShareOFT4626} from "@4626/shared/interfaces/vault/IShareOFT4626.sol";
import {IOVault4626} from "@4626/shared/interfaces/vault/IOVault4626.sol";
import {IOVaultWrapper4626} from "@4626/shared/interfaces/vault/IOVaultWrapper4626.sol";

contract LaneIntegrationInterfaces4626Test is Test {
    function _assertSelector(bytes4 actual, bytes4 expected) internal pure {
        assertEq(uint32(actual), uint32(expected));
    }

    function _sig(string memory signature) internal pure returns (bytes4) {
        return bytes4(keccak256(bytes(signature)));
    }

    function testRevenueRoutersExposeFullNeutralSurface() public pure {
        // Public immutable/auto getters (identical selector on both lane ABIs).
        _assertSelector(_sig("vault()"), IRevenueRouter4626.vault.selector);
        _assertSelector(_sig("wrapper()"), IRevenueRouter4626.wrapper.selector);
        _assertSelector(_sig("burnStream()"), IRevenueRouter4626.burnStream.selector);
        _assertSelector(_sig("shareOFT()"), IRevenueRouter4626.shareOFT.selector);
        _assertSelector(_sig("swapRouter()"), IRevenueRouter4626.swapRouter.selector);
        _assertSelector(_sig("weth()"), IRevenueRouter4626.weth.selector);
        _assertSelector(_sig("protocolRewards()"), IRevenueRouter4626.protocolRewards.selector);
        _assertSelector(_sig("keeper()"), IRevenueRouter4626.keeper.selector);
        _assertSelector(
            _sig("approvedExternalSwapTargets(address)"),
            IRevenueRouter4626.approvedExternalSwapTargets.selector
        );
        _assertSelector(
            _sig("approvedExternalSwapSpenders(address)"),
            IRevenueRouter4626.approvedExternalSwapSpenders.selector
        );
        _assertSelector(
            _sig("swapPathToShareOFT(address)"), IRevenueRouter4626.swapPathToShareOFT.selector
        );

        _assertSelector(
            CreatorPayoutRouter.protocolRewardsClaimable.selector,
            IRevenueRouter4626.protocolRewardsClaimable.selector
        );
        _assertSelector(
            AgentRevenueRouter.protocolRewardsClaimable.selector,
            IRevenueRouter4626.protocolRewardsClaimable.selector
        );
        _assertSelector(
            CreatorPayoutRouter.convertAndQueue.selector, IRevenueRouter4626.convertAndQueue.selector
        );
        _assertSelector(
            AgentRevenueRouter.convertAndQueue.selector, IRevenueRouter4626.convertAndQueue.selector
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
            CreatorPayoutRouter.processBatch.selector, IRevenueRouter4626.processBatch.selector
        );
        _assertSelector(
            AgentRevenueRouter.processBatch.selector, IRevenueRouter4626.processBatch.selector
        );
        _assertSelector(
            CreatorPayoutRouter.claimProtocolRewards.selector,
            IRevenueRouter4626.claimProtocolRewards.selector
        );
        _assertSelector(
            AgentRevenueRouter.claimProtocolRewards.selector,
            IRevenueRouter4626.claimProtocolRewards.selector
        );
        _assertSelector(
            CreatorPayoutRouter.claimAllProtocolRewards.selector,
            IRevenueRouter4626.claimAllProtocolRewards.selector
        );
        _assertSelector(
            AgentRevenueRouter.claimAllProtocolRewards.selector,
            IRevenueRouter4626.claimAllProtocolRewards.selector
        );
        _assertSelector(CreatorPayoutRouter.setKeeper.selector, IRevenueRouter4626.setKeeper.selector);
        _assertSelector(AgentRevenueRouter.setKeeper.selector, IRevenueRouter4626.setKeeper.selector);
        _assertSelector(
            CreatorPayoutRouter.removeKeeper.selector, IRevenueRouter4626.removeKeeper.selector
        );
        _assertSelector(
            AgentRevenueRouter.removeKeeper.selector, IRevenueRouter4626.removeKeeper.selector
        );
        _assertSelector(
            CreatorPayoutRouter.setSwapPath.selector, IRevenueRouter4626.setSwapPath.selector
        );
        _assertSelector(
            AgentRevenueRouter.setSwapPath.selector, IRevenueRouter4626.setSwapPath.selector
        );
        _assertSelector(
            CreatorPayoutRouter.setExternalSwapTargetApproval.selector,
            IRevenueRouter4626.setExternalSwapTargetApproval.selector
        );
        _assertSelector(
            AgentRevenueRouter.setExternalSwapTargetApproval.selector,
            IRevenueRouter4626.setExternalSwapTargetApproval.selector
        );
        _assertSelector(
            CreatorPayoutRouter.setExternalSwapSpenderApproval.selector,
            IRevenueRouter4626.setExternalSwapSpenderApproval.selector
        );
        _assertSelector(
            AgentRevenueRouter.setExternalSwapSpenderApproval.selector,
            IRevenueRouter4626.setExternalSwapSpenderApproval.selector
        );

        assertEq(
            uint256(
                keccak256(
                    abi.encode(
                        IRevenueRouter4626.ExternalSwapParams({
                            tokenIn: address(1),
                            amountIn: 2,
                            minOut: 3,
                            spender: address(4),
                            swapTarget: address(5),
                            swapCallData: hex"06"
                        })
                    )
                )
            ),
            uint256(
                keccak256(
                    abi.encode(
                        CreatorPayoutRouter.ExternalSwapParams({
                            tokenIn: address(1),
                            amountIn: 2,
                            minOut: 3,
                            spender: address(4),
                            swapTarget: address(5),
                            swapCallData: hex"06"
                        })
                    )
                )
            )
        );
        assertEq(
            uint256(
                keccak256(
                    abi.encode(
                        AgentRevenueRouter.ExternalSwapParams({
                            tokenIn: address(1),
                            amountIn: 2,
                            minOut: 3,
                            spender: address(4),
                            swapTarget: address(5),
                            swapCallData: hex"06"
                        })
                    )
                )
            ),
            uint256(
                keccak256(
                    abi.encode(
                        IRevenueRouter4626.ExternalSwapParams({
                            tokenIn: address(1),
                            amountIn: 2,
                            minOut: 3,
                            spender: address(4),
                            swapTarget: address(5),
                            swapCallData: hex"06"
                        })
                    )
                )
            )
        );
        assertEq(
            uint256(
                keccak256(
                    abi.encode(
                        IRevenueRouter4626.BatchAction({
                            kind: 1,
                            tokenIn: address(2),
                            amountIn: 3,
                            minOut: 4,
                            spender: address(5),
                            swapTarget: address(6),
                            swapCallData: hex"07"
                        })
                    )
                )
            ),
            uint256(
                keccak256(
                    abi.encode(
                        CreatorPayoutRouter.BatchAction({
                            kind: 1,
                            tokenIn: address(2),
                            amountIn: 3,
                            minOut: 4,
                            spender: address(5),
                            swapTarget: address(6),
                            swapCallData: hex"07"
                        })
                    )
                )
            )
        );
    }

    function testGaugeControllersExposeFullNeutralSurface() public pure {
        _assertSelector(_sig("vault()"), ITradeFeeCollector4626.vault.selector);
        _assertSelector(_sig("wrapper()"), ITradeFeeCollector4626.wrapper.selector);
        _assertSelector(_sig("shareOFT()"), ITradeFeeCollector4626.shareOFT.selector);
        _assertSelector(_sig("oracle()"), ITradeFeeCollector4626.oracle.selector);
        _assertSelector(_sig("lotteryManager()"), ITradeFeeCollector4626.lotteryManager.selector);
        _assertSelector(_sig("burnShareBps()"), ITradeFeeCollector4626.burnShareBps.selector);
        _assertSelector(_sig("lotteryShareBps()"), ITradeFeeCollector4626.lotteryShareBps.selector);
        _assertSelector(_sig("protocolShareBps()"), ITradeFeeCollector4626.protocolShareBps.selector);

        _assertSelector(
            CreatorGaugeController.receiveFees.selector, ITradeFeeCollector4626.receiveFees.selector
        );
        _assertSelector(
            AgentGaugeController.receiveFees.selector, ITradeFeeCollector4626.receiveFees.selector
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
            CreatorGaugeController.receiveWETHFees.selector,
            ITradeFeeCollector4626.receiveWETHFees.selector
        );
        _assertSelector(
            AgentGaugeController.receiveWETHFees.selector,
            ITradeFeeCollector4626.receiveWETHFees.selector
        );
        _assertSelector(
            CreatorGaugeController.distribute.selector, ITradeFeeCollector4626.distribute.selector
        );
        _assertSelector(
            AgentGaugeController.distribute.selector, ITradeFeeCollector4626.distribute.selector
        );
        _assertSelector(
            CreatorGaugeController.forceDistribute.selector,
            ITradeFeeCollector4626.forceDistribute.selector
        );
        _assertSelector(
            AgentGaugeController.forceDistribute.selector,
            ITradeFeeCollector4626.forceDistribute.selector
        );
        _assertSelector(
            CreatorGaugeController.payJackpot.selector, ITradeFeeCollector4626.payJackpot.selector
        );
        _assertSelector(
            AgentGaugeController.payJackpot.selector, ITradeFeeCollector4626.payJackpot.selector
        );
        _assertSelector(
            CreatorGaugeController.availableJackpotReserve.selector,
            ITradeFeeCollector4626.availableJackpotReserve.selector
        );
        _assertSelector(
            AgentGaugeController.availableJackpotReserve.selector,
            ITradeFeeCollector4626.availableJackpotReserve.selector
        );
        _assertSelector(
            CreatorGaugeController.getAvailableJackpotReserve.selector,
            ITradeFeeCollector4626.getAvailableJackpotReserve.selector
        );
        _assertSelector(
            AgentGaugeController.getAvailableJackpotReserve.selector,
            ITradeFeeCollector4626.getAvailableJackpotReserve.selector
        );
        _assertSelector(
            CreatorGaugeController.getJackpotReserve.selector,
            ITradeFeeCollector4626.getJackpotReserve.selector
        );
        _assertSelector(
            AgentGaugeController.getJackpotReserve.selector,
            ITradeFeeCollector4626.getJackpotReserve.selector
        );
        _assertSelector(
            CreatorGaugeController.getFeeSplit.selector, ITradeFeeCollector4626.getFeeSplit.selector
        );
        _assertSelector(
            AgentGaugeController.getFeeSplit.selector, ITradeFeeCollector4626.getFeeSplit.selector
        );
        _assertSelector(
            CreatorGaugeController.setVault.selector, ITradeFeeCollector4626.setVault.selector
        );
        _assertSelector(AgentGaugeController.setVault.selector, ITradeFeeCollector4626.setVault.selector);
        _assertSelector(
            CreatorGaugeController.setWrapper.selector, ITradeFeeCollector4626.setWrapper.selector
        );
        _assertSelector(
            AgentGaugeController.setWrapper.selector, ITradeFeeCollector4626.setWrapper.selector
        );
        _assertSelector(
            CreatorGaugeController.setLotteryManager.selector,
            ITradeFeeCollector4626.setLotteryManager.selector
        );
        _assertSelector(
            AgentGaugeController.setLotteryManager.selector,
            ITradeFeeCollector4626.setLotteryManager.selector
        );
        _assertSelector(
            CreatorGaugeController.setOracle.selector, ITradeFeeCollector4626.setOracle.selector
        );
        _assertSelector(
            AgentGaugeController.setOracle.selector, ITradeFeeCollector4626.setOracle.selector
        );
        _assertSelector(
            _sig("transferOwnership(address)"), ITradeFeeCollector4626.transferOwnership.selector
        );

        _assertSelector(
            CreatorGaugeController.setCreatorCoin.selector,
            ICreatorGaugeController.setCreatorCoin.selector
        );
        _assertSelector(
            AgentGaugeController.setAgentToken.selector, IAgentGaugeController.setAgentToken.selector
        );
        assertTrue(
            ICreatorGaugeController.setCreatorCoin.selector
                != IAgentGaugeController.setAgentToken.selector
        );
        // Agent-only timelock executor is intentionally outside the neutral surface.
        assertTrue(AgentGaugeController.executeLotteryManagerUpdate.selector != bytes4(0));
    }

    function testShareOftsExposeFullNeutralSurface() public pure {
        _assertSelector(_sig("registry()"), IShareOFT4626.registry.selector);
        _assertSelector(_sig("vault()"), IShareOFT4626.vault.selector);
        _assertSelector(_sig("wrapper()"), IShareOFT4626.wrapper.selector);
        _assertSelector(_sig("gaugeController()"), IShareOFT4626.gaugeController.selector);

        _assertSelector(
            CreatorShareOFT.tradeFeeCollector.selector, IShareOFT4626.tradeFeeCollector.selector
        );
        _assertSelector(
            AgentShareOFT.tradeFeeCollector.selector, IShareOFT4626.tradeFeeCollector.selector
        );
        _assertSelector(CreatorShareOFT.setRegistry.selector, IShareOFT4626.setRegistry.selector);
        _assertSelector(AgentShareOFT.setRegistry.selector, IShareOFT4626.setRegistry.selector);
        _assertSelector(CreatorShareOFT.setVault.selector, IShareOFT4626.setVault.selector);
        _assertSelector(AgentShareOFT.setVault.selector, IShareOFT4626.setVault.selector);
        _assertSelector(CreatorShareOFT.setWrapper.selector, IShareOFT4626.setWrapper.selector);
        _assertSelector(AgentShareOFT.setWrapper.selector, IShareOFT4626.setWrapper.selector);
        _assertSelector(CreatorShareOFT.setMinter.selector, IShareOFT4626.setMinter.selector);
        _assertSelector(AgentShareOFT.setMinter.selector, IShareOFT4626.setMinter.selector);
        _assertSelector(
            CreatorShareOFT.setGaugeController.selector, IShareOFT4626.setGaugeController.selector
        );
        _assertSelector(
            AgentShareOFT.setGaugeController.selector, IShareOFT4626.setGaugeController.selector
        );
        _assertSelector(CreatorShareOFT.setHubConfig.selector, IShareOFT4626.setHubConfig.selector);
        _assertSelector(AgentShareOFT.setHubConfig.selector, IShareOFT4626.setHubConfig.selector);
        _assertSelector(
            CreatorShareOFT.setAddressType.selector, IShareOFT4626.setAddressType.selector
        );
        _assertSelector(AgentShareOFT.setAddressType.selector, IShareOFT4626.setAddressType.selector);
        _assertSelector(
            CreatorShareOFT.setAddressTypes.selector, IShareOFT4626.setAddressTypes.selector
        );
        _assertSelector(AgentShareOFT.setAddressTypes.selector, IShareOFT4626.setAddressTypes.selector);
        _assertSelector(_sig("transferOwnership(address)"), IShareOFT4626.transferOwnership.selector);
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

    function testVaultsAndWrappersExposeNeutralWiringSurfaces() public pure {
        _assertSelector(_sig("deposit(uint256,address)"), IOVault4626.deposit.selector);
        _assertSelector(_sig("setModulesOnce(address,address,address)"), IOVault4626.setModulesOnce.selector);
        _assertSelector(_sig("setGaugeController(address)"), IOVault4626.setGaugeController.selector);
        _assertSelector(_sig("setCcaLaunchArm(address)"), IOVault4626.setCcaLaunchArm.selector);
        _assertSelector(_sig("setWhitelist(address,bool)"), IOVault4626.setWhitelist.selector);
        _assertSelector(_sig("setProtocolRescue(address)"), IOVault4626.setProtocolRescue.selector);
        _assertSelector(_sig("transferOwnership(address)"), IOVault4626.transferOwnership.selector);
        _assertSelector(_sig("convertToAssets(uint256)"), IOVault4626.convertToAssets.selector);

        // Compile-time proof that lane vault interfaces extend the shared surface.
        ICreatorOVault creatorLane = ICreatorOVault(address(0));
        IAgentOVault agentLane = IAgentOVault(address(0));
        IOVault4626 creatorAsShared = creatorLane;
        IOVault4626 agentAsShared = agentLane;
        assertTrue(address(creatorAsShared) == address(0));
        assertTrue(address(agentAsShared) == address(0));

        // Concrete Creator vault exposes the shared wiring selectors that are
        // defined directly on the 4626 vault surface (not ERC4626 parents).
        _assertSelector(CreatorOVault.setModulesOnce.selector, IOVault4626.setModulesOnce.selector);
        _assertSelector(
            CreatorOVault.setGaugeController.selector, IOVault4626.setGaugeController.selector
        );
        _assertSelector(CreatorOVault.setCcaLaunchArm.selector, IOVault4626.setCcaLaunchArm.selector);
        _assertSelector(CreatorOVault.setWhitelist.selector, IOVault4626.setWhitelist.selector);
        _assertSelector(
            CreatorOVault.setProtocolRescue.selector, IOVault4626.setProtocolRescue.selector
        );

        _assertSelector(_sig("vault()"), IOVaultWrapper4626.vault.selector);
        _assertSelector(_sig("shareOFT()"), IOVaultWrapper4626.shareOFT.selector);
        _assertSelector(
            CreatorOVaultWrapper.vaultToken.selector, IOVaultWrapper4626.vaultToken.selector
        );
        _assertSelector(AgentOVaultWrapper.vaultToken.selector, IOVaultWrapper4626.vaultToken.selector);
        _assertSelector(CreatorOVaultWrapper.oftToken.selector, IOVaultWrapper4626.oftToken.selector);
        _assertSelector(AgentOVaultWrapper.oftToken.selector, IOVaultWrapper4626.oftToken.selector);
        _assertSelector(
            CreatorOVaultWrapper.setShareOFT.selector, IOVaultWrapper4626.setShareOFT.selector
        );
        _assertSelector(
            AgentOVaultWrapper.setShareOFT.selector, IOVaultWrapper4626.setShareOFT.selector
        );
        _assertSelector(
            CreatorOVaultWrapper.setWhitelist.selector, IOVaultWrapper4626.setWhitelist.selector
        );
        _assertSelector(
            AgentOVaultWrapper.setWhitelist.selector, IOVaultWrapper4626.setWhitelist.selector
        );
        _assertSelector(
            _sig("transferOwnership(address)"), IOVaultWrapper4626.transferOwnership.selector
        );
        _assertSelector(_sig("deposit(uint256)"), IOVaultWrapper4626.deposit.selector);
        _assertSelector(CreatorOVaultWrapper.wrap.selector, IOVaultWrapper4626.wrap.selector);
        _assertSelector(AgentOVaultWrapper.wrap.selector, IOVaultWrapper4626.wrap.selector);
        _assertSelector(CreatorOVaultWrapper.unwrap.selector, IOVaultWrapper4626.unwrap.selector);
        _assertSelector(AgentOVaultWrapper.unwrap.selector, IOVaultWrapper4626.unwrap.selector);

        assertTrue(
            CreatorOVaultWrapper.propagateCooldownOnTransfer.selector
                != AgentOVaultWrapper.propagateCooldownOnTransfer.selector
        );
    }

    function testPolicyControllersExposeSharedOwnershipAndLaneEnforcement() public pure {
        _assertSelector(_sig("owner()"), IRevenuePolicyController4626.owner.selector);
        _assertSelector(
            _sig("transferOwnership(address)"), IRevenuePolicyController4626.transferOwnership.selector
        );
        _assertSelector(
            _sig("creatorCoin()"), ICreatorCoinPolicyController4626.creatorCoin.selector
        );
        _assertSelector(
            _sig("payoutRouter()"), ICreatorCoinPolicyController4626.payoutRouter.selector
        );
        _assertSelector(
            _sig("pendingCreatorCoinOwner()"),
            ICreatorCoinPolicyController4626.pendingCreatorCoinOwner.selector
        );
        _assertSelector(
            CreatorCoinPolicyController.enforcePayoutRouter.selector,
            ICreatorCoinPolicyController4626.enforcePayoutRouter.selector
        );
        _assertSelector(
            CreatorCoinPolicyController.proposeCreatorCoinOwnershipTransfer.selector,
            ICreatorCoinPolicyController4626.proposeCreatorCoinOwnershipTransfer.selector
        );
        _assertSelector(
            CreatorCoinPolicyController.acceptCreatorCoinOwnership.selector,
            ICreatorCoinPolicyController4626.acceptCreatorCoinOwnership.selector
        );
        _assertSelector(
            CreatorCoinPolicyController.cancelCreatorCoinOwnershipTransfer.selector,
            ICreatorCoinPolicyController4626.cancelCreatorCoinOwnershipTransfer.selector
        );
        _assertSelector(
            _sig("agentToken()"), IAgentRevenuePolicyController4626.agentToken.selector
        );
        _assertSelector(
            _sig("agentRevenueRouter()"),
            IAgentRevenuePolicyController4626.agentRevenueRouter.selector
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
