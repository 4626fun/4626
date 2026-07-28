// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {ve4626GaugeVoting} from "@4626/shared/governance/ve4626GaugeVoting.sol";
import {ve4626VoterRewardsDistributor} from "@4626/shared/governance/ve4626VoterRewardsDistributor.sol";
import {BribesFactory4626} from "@4626/shared/governance/factories/BribesFactory4626.sol";
import {RewardStreamFactory4626} from "@4626/shared/governance/rewards/RewardStreamFactory4626.sol";
import {GaugeSurfaceRegistry4626} from "@4626/shared/governance/surfaces/GaugeSurfaceRegistry4626.sol";
import {ve4626} from "@4626/shared/governance/ve4626.sol";
import {ve4626BoostManager} from "@4626/shared/governance/ve4626BoostManager.sol";
import {ve4626Utility} from "@4626/shared/governance/ve4626Utility.sol";

interface ILotteryManager4626ForRewards {
    function setBoostManager(address manager) external;
    function setve4626GaugeVoting(address ve4626GaugeVoting_) external;
}

interface IRegistry4626ForRewards {
    function getAllTokens() external view returns (address[] memory);
    function getGaugeControllerForToken(address token) external view returns (address);
    function getVaultForToken(address token) external view returns (address);
}

interface ICreatorGaugeControllerForRewards {
    function setve4626GaugeVoting(address voting) external;
    function setve4626VoterRewardsDistributor(address distributor) external;
}

/**
 * @notice Deploys + wires the ve■4626 rewards ecosystem (Base mainnet canary-ready).
 *
 * Deploys:
 * - ve4626 (ve■4626 lock, dual-decay power)
 * - ve4626Utility (ve33 / veLottery utilities — opt-in claim)
 * - ve4626BoostManager (lottery mult from decay-safe effective veLottery)
 * - ve4626GaugeVoting (weekly gauge voting from decay-safe effective ve33; utility required)
 * - ve4626VoterRewardsDistributor (routes the 21.39% ShareOFT voter slice)
 * - BribesFactory4626 (CREATE2 BribeDepot4626 per vault)
 * - RewardStreamFactory4626 (CREATE2 RewardStream4626 per vault)
 * - GaugeSurfaceRegistry4626 (optional votes/bribes/streams allowlist)
 *
 * Wiring:
 * - ve4626.setBoostManager(boostManager)
 * - boostManager.setUtility(utility)  (also sets veLotteryToken; decay-safe effectiveVeLottery)
 * - voting.setUtility(utility)        (also sets ve33Token; vote() requires utility)
 *
 * Canary posture (defaults):
 * - Does **not** wire LotteryManager boostManager / vaultGaugeVoting (leave 0x0)
 * - Does **not** enable useSurfaceRegistry on voting
 * - When WIRE_SURFACE_REGISTRY=1: set surfaceRegistry on voting only (factories always
 *   gate via voting.canReceiveBribes / canReceiveStreams — no factory-local registry)
 * - BribeDepot4626 Ownable owner = DEPOT_OWNER (default OWNER), not the factory
 * - LotteryManager activation is intentionally a later, separate Phase-3 change window
 *   (optional WIRE_LOTTERY_MANAGER=1 for explicit opt-in)
 *
 * Runbook: docs/operations/rewards-ecosystem-canary-2026-07.md
 *
 * Broadcast:
 *   export BASE_RPC_URL="https://mainnet.base.org"
 *   export PRIVATE_KEY=...
 *   export WRAPPED_SHARE_OFT=0x...   # ■4626 lock asset
 *   forge script script/DeployRewardsEcosystem.s.sol:DeployRewardsEcosystem \
 *     --rpc-url "$BASE_RPC_URL" --broadcast -vvvv
 *
 * Env:
 *   PRIVATE_KEY=...
 *   OWNER=...                        (default: broadcaster)
 *   REGISTRY=0x...                    (default: v1.18.0 Registry4626)
 *   LOTTERY_MANAGER=0x...             (default: v1.18.0 remediation LM)
 *   PROTOCOL_TREASURY=0x...           (default: Base protocol treasury Safe)
 *   WRAPPED_SHARE_OFT=0x...           (required)  ■4626 token to lock in ve4626
 *   STREAM_OWNER=0x...                (default: OWNER) RewardStream4626 owner for allowlists
 *   DEPOT_OWNER=0x...                 (default: OWNER) BribeDepot4626 Ownable for rollover
 *
 * Optional flags (0/1):
 *   WIRE_LOTTERY_MANAGER=0            (default 0 — canary: keep LM boost/gauge at 0x0)
 *   WIRE_EXISTING_GAUGES=0            (default 0 — canary: skip gauge owner-only writes)
 *   SET_VOTING_REGISTRY_WHITELIST=1   (default 1 — seed vault whitelist from registry)
 *   WIRE_SURFACE_REGISTRY=0           (default 0 — deploy registry but do not arm gates)
 *   DEPLOY_SURFACE_REGISTRY=1         (default 1)
 *   SURFACE_REGISTRY=0x...            (required when WIRE=1 and DEPLOY=0 — existing registry)
 *   DEPLOY_REWARD_STREAM_FACTORY=1    (default 1)
 *   VE_NAME / VE_SYMBOL
 */
contract DeployRewardsEcosystem is Script {
    // v1.20.0-greenfield (docs/reference/addresses.md) — not historical v1.14/v1.19 defaults
    address constant DEFAULT_REGISTRY = 0xF60a1490C4129f2b6ae540734D3C2C8C6111824e;
    address constant DEFAULT_LOTTERY_MANAGER = 0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address owner = vm.envOr("OWNER", broadcaster);
        address registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        address lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        address protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        address wrappedShareOFT = vm.envAddress("WRAPPED_SHARE_OFT");
        address streamOwner = vm.envOr("STREAM_OWNER", owner);
        address depotOwner = vm.envOr("DEPOT_OWNER", owner);

        bool wireLotteryManager = vm.envOr("WIRE_LOTTERY_MANAGER", uint256(0)) == 1;
        // Canary-safe default: skip owner-only gauge writes unless explicitly enabled.
        bool wireExistingGauges = vm.envOr("WIRE_EXISTING_GAUGES", uint256(0)) == 1;
        bool setRegistryWhitelist = vm.envOr("SET_VOTING_REGISTRY_WHITELIST", uint256(1)) == 1;
        bool deploySurfaceRegistry = vm.envOr("DEPLOY_SURFACE_REGISTRY", uint256(1)) == 1;
        bool wireSurfaceRegistry = vm.envOr("WIRE_SURFACE_REGISTRY", uint256(0)) == 1;
        bool deployRewardStreamFactory = vm.envOr("DEPLOY_REWARD_STREAM_FACTORY", uint256(1)) == 1;
        // Existing registry only used when wiring without deploying (canary re-wire / upgrade).
        address existingSurfaceRegistry = vm.envOr("SURFACE_REGISTRY", address(0));
        if (wireSurfaceRegistry && !deploySurfaceRegistry && existingSurfaceRegistry == address(0)) {
            revert("WIRE_SURFACE_REGISTRY=1 requires DEPLOY_SURFACE_REGISTRY=1 or SURFACE_REGISTRY");
        }

        string memory veName = vm.envOr("VE_NAME", string("Vote-Escrowed \u25A04626"));
        string memory veSymbol = vm.envOr("VE_SYMBOL", string("ve\u25A04626"));

        console2.log("Broadcaster:", broadcaster);
        console2.log("Owner:", owner);
        console2.log("Registry:", registry);
        console2.log("LotteryManager:", lotteryManager);
        console2.log("ProtocolTreasury (sweep target):", protocolTreasury);
        console2.log("WRAPPED_SHARE_OFT:", wrappedShareOFT);
        console2.log("STREAM_OWNER:", streamOwner);
        console2.log("DEPOT_OWNER:", depotOwner);
        console2.log("WIRE_LOTTERY_MANAGER:", wireLotteryManager ? "1" : "0");
        console2.log("WIRE_EXISTING_GAUGES:", wireExistingGauges ? "1" : "0");
        console2.log("WIRE_SURFACE_REGISTRY:", wireSurfaceRegistry ? "1" : "0");

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

        console2.log("\nDeploy BribesFactory4626...");
        BribesFactory4626 bribesFactory = new BribesFactory4626(address(voting), depotOwner);
        console2.log("BribesFactory4626:", address(bribesFactory));
        console2.log("  depotOwner:", bribesFactory.depotOwner());

        address streamFactoryAddr;
        if (deployRewardStreamFactory) {
            console2.log("\nDeploy RewardStreamFactory4626...");
            RewardStreamFactory4626 streamFactory = new RewardStreamFactory4626(address(voting), streamOwner);
            streamFactoryAddr = address(streamFactory);
            console2.log("RewardStreamFactory4626:", streamFactoryAddr);
        }

        address surfaceRegistryAddr;
        if (deploySurfaceRegistry) {
            console2.log("\nDeploy GaugeSurfaceRegistry4626...");
            GaugeSurfaceRegistry4626 surfaces = new GaugeSurfaceRegistry4626(owner);
            surfaceRegistryAddr = address(surfaces);
            console2.log("GaugeSurfaceRegistry4626:", surfaceRegistryAddr);
        } else if (wireSurfaceRegistry) {
            surfaceRegistryAddr = existingSurfaceRegistry;
            console2.log("\nUsing existing GaugeSurfaceRegistry4626:", surfaceRegistryAddr);
        }

        if (wireSurfaceRegistry && surfaceRegistryAddr != address(0)) {
            // Point voting at the registry; keep useSurfaceRegistry=false until Phase C.
            // Factories always consult voting.canReceiveBribes / canReceiveStreams.
            console2.log("Wiring surface registry address on voting (useSurfaceRegistry stays false)...");
            voting.setSurfaceRegistry(surfaceRegistryAddr);
        }

        console2.log("\nWire ve4626 -> boostManager...");
        ve.setBoostManager(address(boostManager));

        if (wireLotteryManager) {
            console2.log("\nWire LotteryManager4626 -> boostManager + gauge voting...");
            require(lotteryManager != address(0), "LOTTERY_MANAGER required when WIRE_LOTTERY_MANAGER=1");
            ILotteryManager4626ForRewards(lotteryManager).setBoostManager(address(boostManager));
            ILotteryManager4626ForRewards(lotteryManager).setve4626GaugeVoting(address(voting));
        } else {
            console2.log("\nLotteryManager activation intentionally skipped (Phase 3 only):", lotteryManager);
        }

        if (wireExistingGauges) {
            console2.log("\nWire existing gauge controllers (set voting + rewards distributor)...");
            address[] memory tokens = IRegistry4626ForRewards(registry).getAllTokens();
            for (uint256 i = 0; i < tokens.length; i++) {
                address gauge = IRegistry4626ForRewards(registry).getGaugeControllerForToken(tokens[i]);
                if (gauge == address(0)) continue;
                // Owner-only on gauge (often protocol treasury Safe). Broadcaster must be owner.
                ICreatorGaugeControllerForRewards(gauge).setve4626GaugeVoting(address(voting));
                ICreatorGaugeControllerForRewards(gauge).setve4626VoterRewardsDistributor(address(rewards));
            }
            console2.log("Wired gauges for token count:", tokens.length);
        }

        vm.stopBroadcast();

        console2.log("\n=== SUMMARY (copy into handoff + addresses.md) ===");
        console2.log("ve4626:", address(ve));
        console2.log("ve4626Utility:", address(utility));
        console2.log("ve33:", address(utility.ve33()));
        console2.log("veLottery:", address(utility.veLottery()));
        console2.log("ve4626BoostManager:", address(boostManager));
        console2.log("ve4626GaugeVoting:", address(voting));
        console2.log("ve4626VoterRewardsDistributor:", address(rewards));
        console2.log("BribesFactory4626:", address(bribesFactory));
        console2.log("RewardStreamFactory4626:", streamFactoryAddr);
        console2.log("GaugeSurfaceRegistry4626:", surfaceRegistryAddr);
        console2.log("\nVite env keys:");
        console2.log("  VITE_VE4626=", address(ve));
        console2.log("  VITE_VE4626_BOOST_MANAGER=", address(boostManager));
        console2.log("  VITE_VE4626_GAUGE_VOTING=", address(voting));
        console2.log("  VITE_VE4626_VOTER_REWARDS_DISTRIBUTOR=", address(rewards));
        console2.log("  VITE_BRIBES_FACTORY_4626=", address(bribesFactory));
        console2.log("  VITE_REWARD_STREAM_FACTORY_4626=", streamFactoryAddr);
        console2.log("  VITE_GAUGE_SURFACE_REGISTRY_4626=", surfaceRegistryAddr);
    }
}
