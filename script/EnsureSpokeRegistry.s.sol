// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

/**
 * @title EnsureSpokeRegistry
 * @notice Idempotent spoke prep: CREATE2-deploy Registry4626 if missing, then seed
 *         hub EID + LayerZero endpoints needed by CreatorOracle / ShareOFT.
 *
 * @dev Registry is chain-wide infra (one per spoke). CreatorOracle is per-asset and
 *      is deployed separately via DeployRemoteCreatorOracle.
 *
 * @dev CREATE2 address parity with Base live registry (0xF60a…) requires the same
 *      owner + salt + bytecode that produced that address. Defaults here match
 *      DeployCreatorRegistryCreate2 vanity (0x7776…4626). Override SALT / OWNER /
 *      EXPECTED_ADDRESS when targeting hub address parity.
 *
 * Required env:
 * - PRIVATE_KEY (must be registry owner to seed)
 *
 * Optional env:
 * - OWNER (ctor owner; default 0xB05C…FdD)
 * - SALT / EXPECTED_ADDRESS (CREATE2; defaults = DeployCreatorRegistryCreate2 vanity)
 * - REGISTRY (skip CREATE2; seed this address if it already has code)
 * - SKIP_SEED=1 (deploy-only)
 * - EXPECTED_CHAIN_ID
 *
 * Usage:
 *   EXPECTED_CHAIN_ID=42161 forge script script/EnsureSpokeRegistry.s.sol:EnsureSpokeRegistry \
 *     --rpc-url $ARBITRUM_RPC_URL --broadcast -vvvv
 */
contract EnsureSpokeRegistry is Script {
    address constant DETERMINISTIC_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address constant DEFAULT_OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    bytes32 constant DEFAULT_SALT = 0xba3f2191b669d00d72af79ff766df084862e99ef0a9b922251475dbc843aa713;
    address constant DEFAULT_EXPECTED = 0x777616Bc376ebf9A9F2C7E3cFB64123FB8e84626;

    uint256 constant BASE_CHAIN_ID = 8453;
    uint32 constant BASE_EID = 30184;
    address constant BASE_LZ = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant BASE_WETH = 0x4200000000000000000000000000000000000006;

    uint256 constant ETH_CHAIN_ID = 1;
    uint32 constant ETH_EID = 30101;
    address constant ETH_LZ = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant ETH_WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    uint256 constant ARB_CHAIN_ID = 42161;
    uint32 constant ARB_EID = 30110;
    address constant ARB_LZ = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant ARB_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    uint256 constant UNICHAIN_CHAIN_ID = 130;
    uint32 constant UNICHAIN_EID = 30320;
    address constant UNICHAIN_LZ = 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B;
    address constant UNICHAIN_WETH = 0x4200000000000000000000000000000000000006;

    uint256 constant ROBINHOOD_CHAIN_ID = 4663;
    uint32 constant ROBINHOOD_EID = 30416;
    address constant ROBINHOOD_LZ = 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B;
    address constant ROBINHOOD_WETH = 0x4200000000000000000000000000000000000006;

    function run() external returns (address registryAddr) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address owner = vm.envOr("OWNER", DEFAULT_OWNER);
        bool skipSeed = vm.envOr("SKIP_SEED", uint256(0)) != 0;
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", uint256(0));
        if (expectedChainId != 0) {
            require(block.chainid == expectedChainId, "Unexpected chain id");
        }

        address preset = vm.envOr("REGISTRY", address(0));
        bytes32 salt = vm.envOr("SALT", DEFAULT_SALT);
        address expected = vm.envOr("EXPECTED_ADDRESS", DEFAULT_EXPECTED);

        console.log("Chain ID:     ", block.chainid);
        console.log("Broadcaster:  ", broadcaster);

        if (preset != address(0) && preset.code.length > 0) {
            registryAddr = preset;
            console.log("Using existing REGISTRY:", registryAddr);
        } else {
            bytes memory initcode = abi.encodePacked(type(Registry4626).creationCode, abi.encode(owner));
            bytes32 initCodeHash = keccak256(initcode);
            address predicted = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DETERMINISTIC_DEPLOYER, salt, initCodeHash))))
            );
            if (expected != address(0)) {
                require(predicted == expected, "Predicted registry != EXPECTED_ADDRESS");
            }
            registryAddr = predicted;
            console.log("Predicted registry:", registryAddr);

            if (registryAddr.code.length == 0) {
                require(DETERMINISTIC_DEPLOYER.code.length > 0, "Deterministic deployer missing on chain");
                vm.startBroadcast(pk);
                (bool ok,) = DETERMINISTIC_DEPLOYER.call(abi.encodePacked(salt, initcode));
                require(ok, "CREATE2 registry deploy failed");
                vm.stopBroadcast();
                require(registryAddr.code.length > 0, "Registry missing after CREATE2");
                console.log("Deployed Registry4626");
            } else {
                console.log("Registry already deployed");
            }
        }

        if (skipSeed) {
            console.log("SKIP_SEED=1 — done");
            return registryAddr;
        }

        Registry4626 registry = Registry4626(registryAddr);
        require(registry.owner() == broadcaster, "PRIVATE_KEY must be registry owner to seed");

        vm.startBroadcast(pk);
        registry.setHubChain(BASE_CHAIN_ID, BASE_EID);
        _tryRegister(registry, BASE_CHAIN_ID, "Base", BASE_WETH);
        _tryRegister(registry, ETH_CHAIN_ID, "Ethereum", ETH_WETH);
        _tryRegister(registry, ARB_CHAIN_ID, "Arbitrum", ARB_WETH);
        _tryRegister(registry, UNICHAIN_CHAIN_ID, "Unichain", UNICHAIN_WETH);
        _tryRegister(registry, ROBINHOOD_CHAIN_ID, "Robinhood", ROBINHOOD_WETH);

        registry.setLayerZeroEndpoint(BASE_CHAIN_ID, BASE_LZ);
        registry.setLayerZeroEndpoint(ETH_CHAIN_ID, ETH_LZ);
        registry.setLayerZeroEndpoint(ARB_CHAIN_ID, ARB_LZ);
        registry.setLayerZeroEndpoint(UNICHAIN_CHAIN_ID, UNICHAIN_LZ);
        registry.setLayerZeroEndpoint(ROBINHOOD_CHAIN_ID, ROBINHOOD_LZ);

        registry.setChainIdToEid(BASE_CHAIN_ID, BASE_EID);
        registry.setChainIdToEid(ETH_CHAIN_ID, ETH_EID);
        registry.setChainIdToEid(ARB_CHAIN_ID, ARB_EID);
        registry.setChainIdToEid(UNICHAIN_CHAIN_ID, UNICHAIN_EID);
        registry.setChainIdToEid(ROBINHOOD_CHAIN_ID, ROBINHOOD_EID);
        vm.stopBroadcast();

        require(registry.hubChainEid() == BASE_EID, "hubChainEid mismatch");
        require(registry.getLayerZeroEndpoint(block.chainid) != address(0), "local LZ endpoint unset");
        console.log("Spoke registry seeded. REGISTRY=", registryAddr);
    }

    function _tryRegister(Registry4626 registry, uint256 chainId, string memory name, address wrappedNative)
        internal
    {
        try registry.registerChain(chainId, name, wrappedNative, true) {}
        catch {
            // already registered
        }
    }
}
