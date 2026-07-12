// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {LotteryManager4626PricingLib} from "@4626/shared/lottery/manager/LotteryManager4626PricingLib.sol";

/**
 * @title DeployLotteryManagerCreate2V2
 * @notice Deploys the current LotteryManager4626 at a new vanity CREATE2 address
 *         matching "0x777...4626", then wires it as the Base registry lottery manager.
 *
 * Why:
 * - The previous mined address was tied to older constructor args (registry address).
 * - We re-mine against the current initcode while keeping the vanity pattern.
 *
 * Deployer (EIP-2470 deterministic deployment proxy):
 * - 0x4e59b44847b379578588920cA78FbF26c0B4956C
 *
 * Library prerequisite:
 * - `LotteryManager4626` creation bytecode is linked to `LotteryManager4626PricingLib`
 *   at Foundry's default CREATE2 library address (EIP-2470 + `create2_library_salt` 0).
 * - This script deploys that library first (idempotent) before CREATE2-deploying the manager.
 *
 * This script is intended to be safe to re-run (idempotent wiring).
 */

interface IRegistry4626LotteryManager {
    function owner() external view returns (address);
    function getLotteryManager(uint256 chainId) external view returns (address);
    function setLotteryManager(uint256 chainId, address manager) external;

    function getAllTokens() external view returns (address[] memory);
    function getShareOFTForToken(address token) external view returns (address);
}

interface IVRFConsumer4626Auth {
    function authorizedLocalCallers(address caller) external view returns (bool);
    function setLocalCallerAuthorization(address caller, bool authorized) external;
}

interface ILotteryManagerAdmin {
    function owner() external view returns (address);

    function useLocalVRF() external view returns (bool);
    function setUseLocalVRF(bool useLocal) external;

    function localVRFConsumer() external view returns (address);
    function setLocalVRFConsumer(address consumer) external;

    function authorizedSwapContracts(address swapContract) external view returns (bool);
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
}

contract DeployLotteryManagerCreate2V2 is Script {
    error DeprecatedDeploymentScript();

    // EIP-2470 deterministic deployment proxy (universal CREATE2 deployer).
    address constant DETERMINISTIC_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Mined salt for the current initcode (re-mine if bytecode/args change).
    bytes32 constant SALT = 0x677c2dd18a357e3ccc1987d7bdf5dac0b82097a7f3713070bd67fa4c98a41412;

    // v1.10.1 orphaned the previous replacement-manager target; do not reuse.
    address constant EXPECTED_ADDRESS = address(0);

    // Base mainnet canonical registry + owner (EOA that holds registry ownership).
    address constant REGISTRY = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;
    address constant OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    uint256 constant BASE_CHAIN_ID = 8453;

    // Base VRF hub consumer (local VRF mode).
    address constant VRF_CONSUMER = 0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304;

    // Swap entrypoints that should be allowed to create lottery entries.
    address constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant SOLANA_BRIDGE_ADAPTER = 0x700b4BBAf965c013123bAd02a6562FBa487aC0f1;
    // Legacy adapter address (safe to keep authorized).
    address constant SOLANA_BRIDGE_ADAPTER_LEGACY = 0x648A01f6e125A46c4695CA70D0EB455f053d36A2;

    /// @dev Foundry default `create2_library_salt` (foundry.toml) — keep in sync.
    bytes32 constant LIBRARY_SALT = bytes32(0);

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    /// @notice Ensure PricingLib is at the address baked into LM creation bytecode.
    function _ensurePricingLibLinked() internal returns (address lib) {
        bytes memory libInit = type(LotteryManager4626PricingLib).creationCode;
        lib = _create2(DETERMINISTIC_DEPLOYER, LIBRARY_SALT, keccak256(libInit));
        uint256 libSize;
        assembly {
            libSize := extcodesize(lib)
        }
        if (libSize == 0) {
            (bool ok,) = DETERMINISTIC_DEPLOYER.call(abi.encodePacked(LIBRARY_SALT, libInit));
            require(ok, "PricingLib CREATE2 failed");
            assembly {
                libSize := extcodesize(lib)
            }
            require(libSize > 0, "PricingLib missing after CREATE2");
            console.log("Deployed LotteryManager4626PricingLib:", lib);
        } else {
            console.log("PricingLib already at:", lib);
        }
    }

    function run() external {
        // Historical replacement path only. Use DeployLotteryManagerCreate2V1180.
        revert DeprecatedDeploymentScript();

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        console.log("");
        console.log("DeployLotteryManagerCreate2V2");
        console.log("Broadcaster:", broadcaster);
        console.log("Chain ID:   ", block.chainid);

        // Build initcode: creation bytecode + constructor args
        // (Forge links PricingLib to CREATE2(EIP-2470, LIBRARY_SALT) in creationCode.)
        bytes memory initcode = abi.encodePacked(type(LotteryManager4626).creationCode, abi.encode(REGISTRY, OWNER));
        bytes32 initCodeHash = keccak256(initcode);
        address predicted = _create2(DETERMINISTIC_DEPLOYER, SALT, initCodeHash);

        console.log("Salt:            ", vm.toString(SALT));
        console.log("Init code hash:  ", vm.toString(initCodeHash));
        console.log("Predicted:       ", predicted);
        console.log("Expected:        ", EXPECTED_ADDRESS);

        require(predicted == EXPECTED_ADDRESS, "predicted != expected (salt/initcode mismatch)");

        // Skip deploy if already deployed.
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(predicted)
        }

        vm.startBroadcast(pk);

        // External pricing library must exist before LM runtime CALL targets it.
        _ensurePricingLibLinked();

        if (codeSize == 0) {
            // Calldata = salt (32 bytes) ++ initcode
            bytes memory callData = abi.encodePacked(SALT, initcode);
            (bool ok,) = DETERMINISTIC_DEPLOYER.call(callData);
            require(ok, "CREATE2 deployment failed");
            console.log("Deployed LotteryManager4626:", predicted);
        } else {
            console.log("Already deployed at:", predicted);
        }

        // ────────────────────────────────────────────────────────────────
        // Wiring (idempotent)
        // ────────────────────────────────────────────────────────────────

        ILotteryManagerAdmin lottery = ILotteryManagerAdmin(predicted);

        // Ensure owner is as expected (sanity check; doesn't block wiring if already deployed).
        address actualOwner = lottery.owner();
        require(actualOwner == OWNER, "lottery owner mismatch");

        // Local VRF configuration (Base hub mode).
        if (lottery.localVRFConsumer() != VRF_CONSUMER) {
            lottery.setLocalVRFConsumer(VRF_CONSUMER);
            console.log("setLocalVRFConsumer:", VRF_CONSUMER);
        }
        if (!lottery.useLocalVRF()) {
            lottery.setUseLocalVRF(true);
            console.log("setUseLocalVRF: true");
        }

        // Authorize swap entrypoints.
        if (!lottery.authorizedSwapContracts(TAX_HOOK)) {
            lottery.setAuthorizedSwapContract(TAX_HOOK, true);
            console.log("authorized TAX_HOOK");
        }
        if (!lottery.authorizedSwapContracts(SOLANA_BRIDGE_ADAPTER)) {
            lottery.setAuthorizedSwapContract(SOLANA_BRIDGE_ADAPTER, true);
            console.log("authorized SOLANA_BRIDGE_ADAPTER");
        }
        if (!lottery.authorizedSwapContracts(SOLANA_BRIDGE_ADAPTER_LEGACY)) {
            lottery.setAuthorizedSwapContract(SOLANA_BRIDGE_ADAPTER_LEGACY, true);
            console.log("authorized SOLANA_BRIDGE_ADAPTER_LEGACY");
        }

        // Ensure the VRF consumer can callback the new lottery manager.
        IVRFConsumer4626Auth vrf = IVRFConsumer4626Auth(VRF_CONSUMER);
        if (!vrf.authorizedLocalCallers(predicted)) {
            vrf.setLocalCallerAuthorization(predicted, true);
            console.log("vrf.setLocalCallerAuthorization(lottery, true)");
        }

        // Point registry to the new lottery manager (affects existing creators too).
        IRegistry4626LotteryManager registry = IRegistry4626LotteryManager(REGISTRY);
        address registryOwner = registry.owner();
        if (registryOwner == OWNER) {
            if (registry.getLotteryManager(BASE_CHAIN_ID) != predicted) {
                registry.setLotteryManager(BASE_CHAIN_ID, predicted);
                console.log("registry.setLotteryManager(Base, lottery)");
            }
        } else {
            console.log("registry owner is not broadcaster; skipping setLotteryManager");
        }

        // Authorize existing ShareOFTs to trigger buy-side lottery entries.
        // ShareOFT calls `processSwapLottery()` directly from `_triggerLotteryLocal(...)`,
        // so the token contract must be an authorized swap entrypoint.
        address[] memory tokens = registry.getAllTokens();
        for (uint256 i; i < tokens.length; i++) {
            address shareOFT = registry.getShareOFTForToken(tokens[i]);
            if (shareOFT == address(0)) continue;
            if (!lottery.authorizedSwapContracts(shareOFT)) {
                lottery.setAuthorizedSwapContract(shareOFT, true);
                console.log("authorized ShareOFT:", shareOFT);
            }
        }

        vm.stopBroadcast();

        console.log("");
        console.log("LotteryManager (new):", predicted);
        console.log("Salt:", vm.toString(SALT));
    }
}

