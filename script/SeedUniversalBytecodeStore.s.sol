// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

/**
 * @dev Seed UniversalBytecodeStoreV2 with v1.16.1 creation codes (CCALaunchArm + share-mesh lane).
 *
 * Run:
 *   forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
 *     --rpc-url $BASE_RPC_URL --broadcast
 *
 * Env:
 *   PRIVATE_KEY (required)
 *   UNIVERSAL_BYTECODE_STORE (optional; defaults to live Base v2 store)
 *   SEED_OFFSET / SEED_LIMIT (optional batch window over the ordered list below)
 */
interface IUniversalBytecodeStoreSeed {
    function store(bytes calldata creationCode) external returns (bytes32 codeId, address pointer);
    function pointers(bytes32 codeId) external view returns (address);
}

contract SeedUniversalBytecodeStore is Script {
    // Live Base mainnet UniversalBytecodeStoreV2 (see test/current-release-target-guard.sh).
    address constant DEFAULT_BYTECODE_STORE = 0xF9622613682a12E46b914c7498716F42E44c4d36;

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
        console2.log("UniversalBytecodeStoreV2:", storeAddr);
        console2.log("Seed offset:", seedOffset);
        console2.log("Seed limit:", seedLimit);

        if (broadcaster.balance == 0) {
            console2.log("ERROR: broadcaster has 0 ETH on this chain. Fund it and rerun.");
            return;
        }

        IUniversalBytecodeStoreSeed store = IUniversalBytecodeStoreSeed(storeAddr);
        vm.startBroadcast(pk);

        uint256 i = 0;
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorOVaultCoreModule.sol/CreatorOVaultCoreModule.json"), "CreatorOVaultCoreModule");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentOVaultCoreModule.sol/AgentOVaultCoreModule.json"), "AgentOVaultCoreModule");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/OVaultStrategiesModule.sol/OVaultStrategiesModule.json"), "OVaultStrategiesModule");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/OVaultAdminModule.sol/OVaultAdminModule.json"), "OVaultAdminModule");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/OFTBootstrapRegistry.sol/OFTBootstrapRegistry.json"), "OFTBootstrapRegistry");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorShareOFT.sol/CreatorShareOFT.json"), "CreatorShareOFT");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentShareOFT.sol/AgentShareOFT.json"), "AgentShareOFT");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorOVault.sol/CreatorOVault.json"), "CreatorOVault");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentOVault.sol/AgentOVault.json"), "AgentOVault");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorOVaultWrapper.sol/CreatorOVaultWrapper.json"), "CreatorOVaultWrapper");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentOVaultWrapper.sol/AgentOVaultWrapper.json"), "AgentOVaultWrapper");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorGaugeController.sol/CreatorGaugeController.json"), "CreatorGaugeController");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentGaugeController.sol/AgentGaugeController.json"), "AgentGaugeController");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CCALaunchArm.sol/CCALaunchArm.json"), "CCALaunchArm");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorOracle.sol/CreatorOracle.json"), "CreatorOracle");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentOracle.sol/AgentOracle.json"), "AgentOracle");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorPayoutRouter.sol/CreatorPayoutRouter.json"), "CreatorPayoutRouter");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentRevenueRouter.sol/AgentRevenueRouter.json"), "AgentRevenueRouter");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/VaultShareBurnStream.sol/VaultShareBurnStream.json"), "VaultShareBurnStream");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CreatorCoinPolicyController.sol/CreatorCoinPolicyController.json"), "CreatorCoinPolicyController");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AgentRevenuePolicyController.sol/AgentRevenuePolicyController.json"), "AgentRevenuePolicyController");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/CharmStrategy4626.sol/CharmStrategy4626.json"), "CharmStrategy4626");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AjnaVaultAuth.sol/AjnaVaultAuth.json"), "AjnaVaultAuth");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/AjnaERC4626Vault.sol/AjnaERC4626Vault.json"), "AjnaERC4626Vault");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/ERC4626StrategyAdapter.sol/ERC4626StrategyAdapter.json"), "ERC4626StrategyAdapter");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/DeploymentBatcher.sol/DeploymentBatcherPhase1Module.json"), "DeploymentBatcherPhase1Module");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/DeploymentBatcher.sol/DeploymentBatcherPhase2Module.json"), "DeploymentBatcherPhase2Module");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/DeploymentBatcher.sol/DeploymentBatcherPhase3Helper.json"), "DeploymentBatcherPhase3Helper");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/DeploymentBatcher.sol/DeploymentBatcherShareMeshHelper.json"), "DeploymentBatcherShareMeshHelper");
            _storeIfMissing(store, vm.getCode("out/ApprovedV4HooksRegistry.sol/ApprovedV4HooksRegistry.json"), "ApprovedV4HooksRegistry");
            _storeIfMissing(store, vm.getCode("out/OVaultLPManager.sol/OVaultLPManager.json"), "OVaultLPManager");
        }
        if (_shouldProcess(i++, seedOffset, seedLimit)) {
            _storeIfMissing(store, vm.getCode("out/DeploymentBatcher.sol/DeploymentBatcherUtilsHelper.json"), "DeploymentBatcherUtilsHelper");
        }

        vm.stopBroadcast();
        console2.log("Processed entries:", i);
    }

    function _storeIfMissing(IUniversalBytecodeStoreSeed store, bytes memory creationCode, string memory label) internal {
        bytes32 codeId = keccak256(creationCode);
        address pointer = store.pointers(codeId);
        if (pointer != address(0)) {
            console2.log(label, "already stored codeId:", uint256(codeId));
            console2.log(label, "pointer:", pointer);
            return;
        }

        try store.store(creationCode) returns (bytes32 storedId, address storedPointer) {
            console2.log(label, "stored codeId:", uint256(storedId));
            console2.log(label, "pointer:", storedPointer);
        } catch (bytes memory err) {
            console2.log("ERROR:", label, "store() reverted");
            console2.logBytes(err);
        }
    }
}
