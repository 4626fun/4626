// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CreatorLotteryManager} from "../contracts/services/lottery/CreatorLotteryManager.sol";

/**
 * @title DeployLotteryManagerCreate2V2
 * @notice Deploys the current CreatorLotteryManager at a new vanity CREATE2 address
 *         matching "0x777...4626", then wires it as the Base registry lottery manager.
 *
 * Why:
 * - The old vanity address (0x77740C...4626) is already occupied on Base.
 * - We want a fresh deployment for updated bytecode while keeping the vanity pattern.
 *
 * Deployer (EIP-2470 deterministic deployment proxy):
 * - 0x4e59b44847b379578588920cA78FbF26c0B4956C
 *
 * This script is intended to be safe to re-run (idempotent wiring).
 */

interface ICreatorRegistryLotteryManager {
    function owner() external view returns (address);
    function getLotteryManager(uint256 chainId) external view returns (address);
    function setLotteryManager(uint256 chainId, address manager) external;

    function getAllCreatorCoins() external view returns (address[] memory);
    function getShareOFTForToken(address token) external view returns (address);
}

interface ICreatorVRFConsumerAuth {
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
    // EIP-2470 deterministic deployment proxy (universal CREATE2 deployer).
    address constant DETERMINISTIC_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Mined salt for the current initcode (re-mine if bytecode/args change).
    bytes32 constant SALT = 0xe65abe49028b3b75b120aca5277cf7d7f9fd3df6b60794260956285cf5d43fa4;

    // Expected vanity address for this salt+initcode on Base.
    address constant EXPECTED_ADDRESS = 0x77705A2f173dd52F28300447506Dc35086c34626;

    // Base mainnet canonical registry + owner (EOA that holds registry ownership).
    address constant REGISTRY = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;
    address constant OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    uint256 constant BASE_CHAIN_ID = 8453;

    // Base VRF hub consumer (local VRF mode).
    address constant VRF_CONSUMER = 0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304;

    // Swap entrypoints that should be allowed to create lottery entries.
    address constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant SOLANA_BRIDGE_ADAPTER = 0x2414b595c4f18532A5836B6e2E6d536832c572e8;
    // Legacy adapter address (safe to keep authorized).
    address constant SOLANA_BRIDGE_ADAPTER_LEGACY = 0x648A01f6e125A46c4695CA70D0EB455f053d36A2;

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        console.log("");
        console.log("DeployLotteryManagerCreate2V2");
        console.log("Broadcaster:", broadcaster);
        console.log("Chain ID:   ", block.chainid);

        // Build initcode: creation bytecode + constructor args
        bytes memory initcode = abi.encodePacked(type(CreatorLotteryManager).creationCode, abi.encode(REGISTRY, OWNER));
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

        if (codeSize == 0) {
            // Calldata = salt (32 bytes) ++ initcode
            bytes memory callData = abi.encodePacked(SALT, initcode);
            (bool ok,) = DETERMINISTIC_DEPLOYER.call(callData);
            require(ok, "CREATE2 deployment failed");
            console.log("Deployed CreatorLotteryManager:", predicted);
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
        ICreatorVRFConsumerAuth vrf = ICreatorVRFConsumerAuth(VRF_CONSUMER);
        if (!vrf.authorizedLocalCallers(predicted)) {
            vrf.setLocalCallerAuthorization(predicted, true);
            console.log("vrf.setLocalCallerAuthorization(lottery, true)");
        }

        // Point registry to the new lottery manager (affects existing creators too).
        ICreatorRegistryLotteryManager registry = ICreatorRegistryLotteryManager(REGISTRY);
        require(registry.owner() == OWNER, "registry owner mismatch");
        if (registry.getLotteryManager(BASE_CHAIN_ID) != predicted) {
            registry.setLotteryManager(BASE_CHAIN_ID, predicted);
            console.log("registry.setLotteryManager(Base, lottery)");
        }

        // Authorize existing ShareOFTs to trigger buy-side lottery entries.
        // ShareOFT calls `processSwapLottery()` directly from `_triggerLotteryLocal(...)`,
        // so the token contract must be an authorized swap entrypoint.
        address[] memory tokens = registry.getAllCreatorCoins();
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

