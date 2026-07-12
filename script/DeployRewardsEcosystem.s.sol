// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {ve4626GaugeVoting} from "@4626/shared/governance/ve4626GaugeVoting.sol";
import {ve4626VoterRewardsDistributor} from "@4626/shared/governance/ve4626VoterRewardsDistributor.sol";
import {BribesFactory} from "@4626/shared/governance/factories/BribesFactory.sol";
import {ve4626} from "@4626/shared/governance/ve4626.sol";
import {ve4626BoostManager} from "@4626/shared/governance/ve4626BoostManager.sol";
import {ve4626Utility} from "@4626/shared/governance/ve4626Utility.sol";

interface IRegistry4626ForRewards {
    function getAllTokens() external view returns (address[] memory);
    function getGaugeControllerForToken(address token) external view returns (address);
    function getVaultForToken(address token) external view returns (address);
}

interface ICreatorGaugeControllerForRewards {
    function setVe4626GaugeVoting(address voting) external;
    function setVe4626VoterRewardsDistributor(address distributor) external;
}

/**
 * @notice Deploys + wires the ve■4626 rewards ecosystem:
 * - ve4626 (ve■4626 lock, dual-decay power)
 * - ve4626Utility (ve33 / veLottery utilities — opt-in claim)
 * - ve4626BoostManager (lottery mult from decay-safe effective veLottery)
 * - ve4626GaugeVoting (weekly gauge voting from decay-safe effective ve33)
 * - ve4626VoterRewardsDistributor (routes the 9.61% slice to voters)
 * - BribesFactory (CREATE2 BribeDepot per vault)
 *
 * Wiring:
 * - ve4626.setBoostManager(boostManager)
 * - boostManager.setUtility(utility)  (also sets veLotteryToken; decay-safe effectiveVeLottery)
 * - voting.setUtility(utility)        (also sets ve33Token; vote() syncs then effectiveVe33)
 * - LotteryManager activation is intentionally a later, separate Phase-3 change window.
 * - each CreatorGaugeController: setVe4626GaugeVoting + setVe4626VoterRewardsDistributor
 *
 * Naming: docs/contracts/governance/ve-naming.md
 *
 * Run (broadcast):
 *   export BASE_RPC_URL="https://mainnet.base.org"
 *   forge script script/DeployRewardsEcosystem.s.sol:DeployRewardsEcosystem --rpc-url "$BASE_RPC_URL" --broadcast -vvvv
 *
 * Env:
 *   PRIVATE_KEY=...
 *   OWNER=...                        (default: broadcaster)
 *   REGISTRY=0x...                    (default: Base registry)
 *   LOTTERY_MANAGER=0x...             (required for v1.11.1+)
 *   PROTOCOL_TREASURY=0x...           (default: Base protocol treasury)
 *   WRAPPED_SHARE_OFT=0x...           (required)  ■4626 token to lock in ve4626
 *
 * Optional:
 *   WIRE_EXISTING_GAUGES=1|0          (default: 1)
 *   SET_VOTING_REGISTRY_WHITELIST=1|0 (default: 1)
 *   VE_NAME="Vote-Escrowed ■4626"
 *   VE_SYMBOL="ve■4626"
 */
contract DeployRewardsEcosystem is Script {
    address constant DEFAULT_REGISTRY = 0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0;
    address constant DEFAULT_LOTTERY_MANAGER = 0xB68F359e01626Ec5d15C624037311C70DacAba43;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address owner = vm.envOr("OWNER", broadcaster);
        address registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        address lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        require(lotteryManager != address(0), "LOTTERY_MANAGER required for v1.11.1+");
        address protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        address wrappedShareOFT = vm.envAddress("WRAPPED_SHARE_OFT");

        bool wireExistingGauges = vm.envOr("WIRE_EXISTING_GAUGES", uint256(1)) == 1;
        bool setRegistryWhitelist = vm.envOr("SET_VOTING_REGISTRY_WHITELIST", uint256(1)) == 1;

        string memory veName = vm.envOr("VE_NAME", string("Vote-Escrowed \u25A04626"));
        string memory veSymbol = vm.envOr("VE_SYMBOL", string("ve\u25A04626"));

        console2.log("Broadcaster:", broadcaster);
        console2.log("Owner:", owner);
        console2.log("Registry:", registry);
        console2.log("LotteryManager:", lotteryManager);
        console2.log("ProtocolTreasury (sweep target):", protocolTreasury);
        console2.log("WRAPPED_SHARE_OFT:", wrappedShareOFT);

        vm.startBroadcast(pk);

        console2.log("\nDeploy ve4626...");
        ve4626 ve = new ve4626(veName, veSymbol, wrappedShareOFT, owner);
        console2.log("ve4626:", address(ve));

        console2.log("\nDeploy ve4626Utility (ve33 + veLottery)...");
        ve4626Utility utility = new ve4626Utility(address(ve), owner);
        console2.log("ve4626Utility:", address(utility));
        console2.log("  ve33:", address(utility.ve33()));
        console2.log("  veLottery:", address(utility.veLottery()));

        console2.log("\nDeploy ve4626BoostManager...");
        ve4626BoostManager boostManager = new ve4626BoostManager(address(ve), owner);
        boostManager.setUtility(address(utility));
        console2.log("ve4626BoostManager:", address(boostManager));

        console2.log("\nDeploy ve4626GaugeVoting...");
        ve4626GaugeVoting voting = new ve4626GaugeVoting(address(ve), owner);
        voting.setUtility(address(utility));
        console2.log("ve4626GaugeVoting:", address(voting));

        if (setRegistryWhitelist) {
            console2.log("\nConfigure ve4626GaugeVoting registry whitelist...");
            voting.setRegistry(registry);
            voting.setUseRegistryWhitelist(true);

            // Seed the manual whitelist from the registry so the gauge is usable immediately.
            console2.log("\nSeed ve4626GaugeVoting manual whitelist from registry vaults...");
            IRegistry4626ForRewards reg = IRegistry4626ForRewards(registry);
            address[] memory tokens = reg.getAllTokens();
            address[] memory vaultsTmp = new address[](tokens.length);
            uint256 count = 0;

            for (uint256 i = 0; i < tokens.length; i++) {
                address vault = reg.getVaultForToken(tokens[i]);
                if (vault == address(0)) continue;
                vaultsTmp[count] = vault;
                count++;
            }

            console2.log("Registry token count:", tokens.length);
            console2.log("Whitelisting vault count:", count);

            if (count > 0) {
                uint256 chunkSize = 100;
                for (uint256 start = 0; start < count; start += chunkSize) {
                    uint256 end = start + chunkSize;
                    if (end > count) end = count;

                    address[] memory vaults = new address[](end - start);
                    bool[] memory statuses = new bool[](end - start);

                    for (uint256 j = start; j < end; j++) {
                        vaults[j - start] = vaultsTmp[j];
                        statuses[j - start] = true;
                    }

                    voting.batchSetVaultWhitelist(vaults, statuses);
                }
            }
        }

        console2.log("\nDeploy ve4626VoterRewardsDistributor...");
        ve4626VoterRewardsDistributor rewards = new ve4626VoterRewardsDistributor(address(voting), registry, owner);
        rewards.setProtocolTreasury(protocolTreasury);
        console2.log("ve4626VoterRewardsDistributor:", address(rewards));

        console2.log("\nDeploy BribesFactory...");
        BribesFactory bribesFactory = new BribesFactory(address(voting));
        console2.log("BribesFactory:", address(bribesFactory));

        console2.log("\nWire ve4626 -> boostManager...");
        ve.setBoostManager(address(boostManager));

        console2.log("\nLotteryManager activation intentionally skipped (Phase 3 only):", lotteryManager);

        if (wireExistingGauges) {
            console2.log("\nWire existing CreatorGaugeControllers (set voting + rewards distributor)...");
            address[] memory tokens = IRegistry4626ForRewards(registry).getAllTokens();
            for (uint256 i = 0; i < tokens.length; i++) {
                address gauge = IRegistry4626ForRewards(registry).getGaugeControllerForToken(tokens[i]);
                if (gauge == address(0)) continue;
                // These setters are owner-only on the gauge controller (protocol treasury owner).
                // This script must be broadcast by the gauge owner to succeed.
                ICreatorGaugeControllerForRewards(gauge).setVe4626GaugeVoting(address(voting));
                ICreatorGaugeControllerForRewards(gauge).setVe4626VoterRewardsDistributor(address(rewards));
            }
            console2.log("Wired gauges for token count:", tokens.length);
        }

        vm.stopBroadcast();

        console2.log("\n=== SUMMARY ===");
        console2.log("ve4626:", address(ve));
        console2.log("ve4626Utility:", address(utility));
        console2.log("ve33:", address(utility.ve33()));
        console2.log("veLottery:", address(utility.veLottery()));
        console2.log("ve4626BoostManager:", address(boostManager));
        console2.log("ve4626GaugeVoting:", address(voting));
        console2.log("ve4626VoterRewardsDistributor:", address(rewards));
        console2.log("BribesFactory:", address(bribesFactory));
    }
}

