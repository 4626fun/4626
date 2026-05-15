// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/infra/UniversalBytecodeStore.sol";

/**
 * @dev Seed UniversalBytecodeStore with all creation codes used by the phased deploy flow
 * (`DeploymentBatcher`, Phases 1–3).
 *
 * Run:
 *  forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore --rpc-url $BASE_RPC_URL --broadcast
 *
 * Env overrides:
 *  PRIVATE_KEY (required)
 *  UNIVERSAL_BYTECODE_STORE (optional; defaults to Base mainnet store)
 */
contract SeedUniversalBytecodeStore is Script {
    // Base mainnet: current live chunked store; override via env for fresh release epochs.
    address constant DEFAULT_BYTECODE_STORE = 0x9C3e2A7bd73690d5b5DC0C47f8dB74c4dc5D1c69;
    uint256 constant MAX_SSTORE2_BYTES = 24_575; // EIP-170 runtime limit (24,576) minus STOP prefix.

    function _shouldProcess(uint256 index, uint256 offset, uint256 limit) internal pure returns (bool) {
        if (limit == 0) return true;
        return index >= offset && index < offset + limit;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address storeAddr = vm.envOr("UNIVERSAL_BYTECODE_STORE", DEFAULT_BYTECODE_STORE);
        uint256 seedOffset = vm.envOr("SEED_OFFSET", uint256(0));
        uint256 seedLimit = vm.envOr("SEED_LIMIT", uint256(0));
        address broadcaster = vm.addr(pk);

        console2.log("Broadcaster:", broadcaster);
        console2.log("Broadcaster balance (ETH):", broadcaster.balance);

        console2.log("UniversalBytecodeStore:", storeAddr);
        console2.log("Seed offset:", seedOffset);
        console2.log("Seed limit:", seedLimit);
        UniversalBytecodeStore store = UniversalBytecodeStore(storeAddr);

        bool supportsChunking = _supportsChunking(storeAddr);
        console2.log("Store supports chunking:", supportsChunking);

        // Foundry will happily simulate these calls even if the broadcaster can't pay gas,
        // which is confusing because you'll see "stored" logs but nothing is actually mined.
        // Fail fast for the common case: 0 balance.
        if (broadcaster.balance == 0) {
            console2.log("ERROR: broadcaster has 0 ETH on this chain. Fund it and rerun.");
            return;
        }

        vm.startBroadcast(pk);
        uint256 i = 0;
        // Shared CreatorOVault delegatecall modules.
        // These are deployed as standalone CREATE2 contracts (not via the store),
        // but we keep their creation code in the bytecode store for completeness/debugging.
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CreatorOVaultCoreModule.sol/CreatorOVaultCoreModule.json"),
                "CreatorOVaultCoreModule",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CreatorOVaultStrategiesModule.sol/CreatorOVaultStrategiesModule.json"),
                "CreatorOVaultStrategiesModule",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CreatorOVaultAdminModule.sol/CreatorOVaultAdminModule.json"),
                "CreatorOVaultAdminModule",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/OFTBootstrapRegistry.sol/OFTBootstrapRegistry.json"),
                "OFTBootstrapRegistry",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store, vm.getCode("out/CreatorShareOFT.sol/CreatorShareOFT.json"), "CreatorShareOFT", supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store, vm.getCode("out/CreatorOVault.sol/CreatorOVault.json"), "CreatorOVault", supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CreatorOVaultWrapper.sol/CreatorOVaultWrapper.json"),
                "CreatorOVaultWrapper",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CreatorGaugeController.sol/CreatorGaugeController.json"),
                "CreatorGaugeController",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CCALaunchStrategy.sol/CCALaunchStrategy.json"),
                "CCALaunchStrategy",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store, vm.getCode("out/CreatorOracle.sol/CreatorOracle.json"), "CreatorOracle", supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store, vm.getCode("out/PayoutRouter.sol/PayoutRouter.json"), "PayoutRouter", supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/VaultShareBurnStream.sol/VaultShareBurnStream.json"),
                "VaultShareBurnStream",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CreatorCoinPolicyController.sol/CreatorCoinPolicyController.json"),
                "CreatorCoinPolicyController",
                supportsChunking
            );
        }
        // CharmAlphaVaultDeploy removed - now using Charm's official factory
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/CreatorCharmStrategy.sol/CreatorCharmStrategy.json"),
                "CreatorCharmStrategy",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store, vm.getCode("out/AjnaVaultAuth.sol/AjnaVaultAuth.json"), "AjnaVaultAuth", supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/AjnaERC4626Vault.sol/AjnaERC4626Vault.json"),
                "AjnaERC4626Vault",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store,
                vm.getCode("out/ERC4626StrategyAdapter.sol/ERC4626StrategyAdapter.json"),
                "ERC4626StrategyAdapter",
                supportsChunking
            );
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(
                store, vm.getCode("out/SolanaStrategy.sol/SolanaStrategy.json"), "SolanaStrategy", supportsChunking
            );
        }
        vm.stopBroadcast();
    }

    function _storeIfMissing(
        UniversalBytecodeStore store,
        bytes memory creationCode,
        string memory label,
        bool supportsChunking
    ) internal {
        bytes32 codeId = keccak256(creationCode);
        address pointer = store.pointers(codeId);
        if (pointer == address(0)) {
            if (!supportsChunking && creationCode.length > MAX_SSTORE2_BYTES) {
                console2.log("ERROR:", label, "creation bytecode too large for v1 store:", creationCode.length);
                console2.log("       Deploy UniversalBytecodeStoreV2 and rerun with:");
                console2.log("       UNIVERSAL_BYTECODE_STORE=<v2_store_address>");
                return;
            }

            try store.store(creationCode) returns (bytes32 storedId, address storedPointer) {
                console2.log(label, "stored codeId:", uint256(storedId));
                console2.log(label, "pointer:", storedPointer);
            } catch (bytes memory err) {
                console2.log("ERROR:", label, "store() reverted");
                console2.logBytes(err);
            }
        } else {
            console2.log(label, "already stored codeId:", uint256(codeId));
            console2.log(label, "pointer:", pointer);
        }
    }

    function _supportsChunking(address storeAddr) internal view returns (bool ok) {
        // `UniversalBytecodeStoreV2` exposes `chunkCount(bytes32)` for debugging.
        // v1 stores will not recognize the selector, causing the call to fail.
        (ok,) = storeAddr.staticcall(abi.encodeWithSignature("chunkCount(bytes32)", bytes32(0)));
    }
}
