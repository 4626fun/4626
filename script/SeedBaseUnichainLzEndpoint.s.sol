// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

/**
 * @title SeedBaseUnichainLzEndpoint
 * @notice Fix Base hub Registry4626 Unichain LZ mapping (canonical 0x1a44… has no code on Unichain).
 *
 * @dev Sets:
 *      - registerChain(130) if missing
 *      - setLayerZeroEndpoint(130, 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B)
 *      - setChainIdToEid(130, 30320)
 *
 * Required env:
 * - PRIVATE_KEY (must be registry owner)
 * - REGISTRY (default Base live 0xF60a1490…)
 *
 * Usage (Base only):
 *   forge script script/SeedBaseUnichainLzEndpoint.s.sol:SeedBaseUnichainLzEndpoint \
 *     --rpc-url $BASE_RPC_URL --broadcast -vvvv
 */
contract SeedBaseUnichainLzEndpoint is Script {
    address internal constant DEFAULT_REGISTRY = 0xF60a1490C4129f2b6ae540734D3C2C8C6111824e;
    uint256 internal constant UNICHAIN_CHAIN_ID = 130;
    uint32 internal constant UNICHAIN_EID = 30320;
    address internal constant UNICHAIN_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant UNICHAIN_LZ = 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address registryAddr = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        require(block.chainid == 8453, "Run on Base only");
        require(registryAddr != address(0) && registryAddr.code.length > 0, "REGISTRY missing");

        Registry4626 registry = Registry4626(registryAddr);
        require(registry.owner() == vm.addr(pk), "PRIVATE_KEY must be registry owner");

        address beforeEp = registry.getLayerZeroEndpoint(UNICHAIN_CHAIN_ID);
        uint32 beforeEid = registry.getEidForChainId(UNICHAIN_CHAIN_ID);
        console.log("Registry:          ", registryAddr);
        console.log("Unichain LZ before:", beforeEp);
        console.log("Unichain EID before:", beforeEid);

        vm.startBroadcast(pk);
        try registry.registerChain(UNICHAIN_CHAIN_ID, "Unichain", UNICHAIN_WETH, true) {}
        catch {}
        registry.setLayerZeroEndpoint(UNICHAIN_CHAIN_ID, UNICHAIN_LZ);
        registry.setChainIdToEid(UNICHAIN_CHAIN_ID, UNICHAIN_EID);
        vm.stopBroadcast();

        require(registry.getLayerZeroEndpoint(UNICHAIN_CHAIN_ID) == UNICHAIN_LZ, "LZ endpoint mismatch");
        require(registry.getEidForChainId(UNICHAIN_CHAIN_ID) == UNICHAIN_EID, "EID mismatch");
        console.log("Unichain LZ after: ", registry.getLayerZeroEndpoint(UNICHAIN_CHAIN_ID));
        console.log("Unichain EID after:", registry.getEidForChainId(UNICHAIN_CHAIN_ID));
    }
}
