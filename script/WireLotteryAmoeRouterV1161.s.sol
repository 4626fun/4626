// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {LotteryAmoeRouter} from "@4626/shared/lottery/zk/LotteryAmoeRouter.sol";

interface ILotteryManager4626AmoeWire {
    function authorizedAmoeRelayer() external view returns (address);
    function setAuthorizedAmoeRelayer(address _relayer) external;
}

/**
 * @title WireLotteryAmoeRouterV1161
 * @notice Cut AMOE production over to the v3 `LotteryAmoeRouter` + v1.16.1
 *         `LotteryManager4626` on Registry4626 `0x1eb9…`.
 *
 * Fixes the split where Vercel still pointed at legacy router `0xc57aed…`
 * (manager = v1.11 `0x04CADE…`) while the v3 router `0x066e11…` was only
 * authorized on the old manager.
 *
 * Required env:
 * - PRIVATE_KEY (owner on router + v1.16.1 manager)
 * - BASE_RPC_URL
 *
 * Optional:
 * - AMOE_ROUTER (default v3 router `0x066e11…`)
 * - AMOE_MANAGER (default v1.16.1 manager `0xD62a…`)
 * - AMOE_PUBLISHER (default protocol CSW `0x793c…`)
 * - LEGACY_AMOE_MANAGER (default v1.11 manager `0x04CADE…`)
 * - DISABLE_LEGACY_AMOE_RELAYER=1 (default 1) — zero relayer on legacy manager
 */
contract WireLotteryAmoeRouterV1161 is Script {
    address constant DEFAULT_AMOE_ROUTER = 0x066e11d795656A2A980585a414BC0fD6BB12e057;
    address constant DEFAULT_AMOE_MANAGER = 0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b;
    address constant DEFAULT_AMOE_PUBLISHER = 0x793CA28123cBA3cA3c20b9C6C67f37510c89C145;
    address constant DEFAULT_LEGACY_AMOE_MANAGER = 0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address routerAddr = vm.envOr("AMOE_ROUTER", DEFAULT_AMOE_ROUTER);
        address managerAddr = vm.envOr("AMOE_MANAGER", DEFAULT_AMOE_MANAGER);
        address publisherAddr = vm.envOr("AMOE_PUBLISHER", DEFAULT_AMOE_PUBLISHER);
        address legacyManagerAddr = vm.envOr("LEGACY_AMOE_MANAGER", DEFAULT_LEGACY_AMOE_MANAGER);
        bool disableLegacyRelayer = vm.envOr("DISABLE_LEGACY_AMOE_RELAYER", uint256(1)) == 1;

        LotteryAmoeRouter router = LotteryAmoeRouter(routerAddr);
        ILotteryManager4626AmoeWire manager = ILotteryManager4626AmoeWire(managerAddr);
        ILotteryManager4626AmoeWire legacyManager = ILotteryManager4626AmoeWire(legacyManagerAddr);

        console2.log("Broadcaster:", broadcaster);
        console2.log("AMOE router:", routerAddr);
        console2.log("AMOE manager (v1.16.1):", managerAddr);
        console2.log("AMOE publisher (canonical CSW):", publisherAddr);
        console2.log("Legacy manager (v1.11):", legacyManagerAddr);

        vm.startBroadcast(pk);

        if (address(router.manager()) != managerAddr) {
            router.setManager(managerAddr);
            console2.log("router.setManager executed");
        }

        if (router.allowlistPublisher() != publisherAddr) {
            router.setAllowlistPublisher(publisherAddr);
            console2.log("router.setAllowlistPublisher executed");
        }

        if (router.pointsLedgerPublisher() != publisherAddr) {
            router.setPointsLedgerPublisher(publisherAddr);
            console2.log("router.setPointsLedgerPublisher executed");
        }

        if (manager.authorizedAmoeRelayer() != routerAddr) {
            manager.setAuthorizedAmoeRelayer(routerAddr);
            console2.log("manager.setAuthorizedAmoeRelayer executed");
        }

        if (disableLegacyRelayer && legacyManager.authorizedAmoeRelayer() != address(0)) {
            legacyManager.setAuthorizedAmoeRelayer(address(0));
            console2.log("legacyManager.setAuthorizedAmoeRelayer(0) kill-switch executed");
        }

        vm.stopBroadcast();

        require(address(router.manager()) == managerAddr, "router manager mismatch");
        require(router.allowlistPublisher() == publisherAddr, "allowlist publisher mismatch");
        require(router.pointsLedgerPublisher() == publisherAddr, "ledger publisher mismatch");
        require(manager.authorizedAmoeRelayer() == routerAddr, "manager relayer mismatch");
    }
}
