// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

contract VanitySharedGlobalCatalogTest is Test {
    string private constant CATALOG_PATH = "./deployments/base/shared-global-vanity-targets.json";

    function testCatalogLocksPhase1TargetsDeferredGlobalsAndRenameCandidates() public view {
        string memory json = vm.readFile(CATALOG_PATH);

        assertEq(vm.parseJsonUint(json, ".version"), 1);
        assertEq(vm.parseJsonString(json, ".chain"), "base");
        assertEq(vm.parseJsonUint(json, ".chainId"), 8453);
        assertEq(vm.parseJsonString(json, ".vanitySuffix"), "4626");
        assertEq(vm.parseJsonString(json, ".recommendedEpochTag"), "v1.8.1");
        assertEq(
            vm.parseJsonString(json, ".recommendedManifestPath"),
            "deployments/base/v1.8.1-vanity-manifest.json"
        );
        assertEq(vm.parseJsonString(json, ".phase1VanityTargets[0].contractName"), "UniversalBytecodeStoreV2");
        assertEq(vm.parseJsonString(json, ".phase1VanityTargets[1].contractName"), "UniversalCreate2DeployerFromStore");
        assertEq(vm.parseJsonString(json, ".phase1VanityTargets[2].contractName"), "CreatorOVaultCoreModule");
        assertEq(vm.parseJsonString(json, ".phase1VanityTargets[3].contractName"), "CreatorOVaultStrategiesModule");
        assertEq(vm.parseJsonString(json, ".phase1VanityTargets[4].contractName"), "CreatorOVaultAdminModule");
        assertEq(vm.parseJsonString(json, ".phase1VanityTargets[5].contractName"), "DeploymentBatcher");
        assertTrue(vm.parseJsonBool(json, ".phase1VanityTargets[5].suffixRequired"), "batcher should remain suffix-enforced");
        assertEq(
            vm.parseJsonString(json, ".phase1VanityTargets[5].referenceSaltTag"),
            "4626:DeploymentBatcher:v1.7.1-r2-lottery3f7",
            "batcher reference salt must match the current canonical epoch"
        );

        assertEq(vm.parseJsonString(json, ".derivedTargets[0].contractName"), "DeploymentBatcherPhase3Helper");
        assertEq(vm.parseJsonString(json, ".derivedTargets[0].parentContractName"), "DeploymentBatcher");
        assertEq(vm.parseJsonUint(json, ".derivedTargets[0].parentCreateNonce"), 1);
        assertFalse(
            vm.parseJsonBool(json, ".derivedTargets[0].suffixRequired"),
            "phase3 helper suffix cannot be required independently"
        );
        assertEq(vm.parseJsonString(json, ".derivedTargets[1].contractName"), "DeploymentBatcherUniV4Helper");
        assertEq(vm.parseJsonUint(json, ".derivedTargets[1].parentCreateNonce"), 2);
        assertFalse(
            vm.parseJsonBool(json, ".derivedTargets[1].suffixRequired"),
            "uniV4 helper suffix cannot be required independently"
        );

        assertEq(vm.parseJsonString(json, ".deferredTargets[0].contractName"), "VaultActivationBatcher");
        assertEq(vm.parseJsonString(json, ".deferredTargets[1].contractName"), "CreatorRegistry");
        assertEq(vm.parseJsonString(json, ".deferredTargets[2].contractName"), "CreatorLotteryManager");
        assertEq(vm.parseJsonString(json, ".deferredTargets[3].contractName"), "CreatorVRFConsumerV2_5");
        assertEq(vm.parseJsonString(json, ".deferredTargets[4].contractName"), "SolanaBridgeAdapter");
        assertEq(vm.parseJsonAddress(json, ".deferredTargets[1].currentAddress"), 0x888506B92181c57A2fD06516FFFb6F375b7A4626);
        assertEq(vm.parseJsonAddress(json, ".deferredTargets[2].currentAddress"), address(0));

        assertEq(vm.parseJsonString(json, ".namingTaxonomy[0].name"), "Factory");
        assertEq(vm.parseJsonString(json, ".namingTaxonomy[1].name"), "Deployer");
        assertEq(vm.parseJsonString(json, ".namingTaxonomy[2].name"), "Registry");
        assertEq(vm.parseJsonString(json, ".namingTaxonomy[3].name"), "Manager");
        assertEq(vm.parseJsonString(json, ".namingTaxonomy[4].name"), "Batcher");
        assertEq(vm.parseJsonString(json, ".namingTaxonomy[5].name"), "Adapter");
        assertEq(vm.parseJsonString(json, ".namingTaxonomy[6].name"), "Helper");
        assertEq(vm.parseJsonString(json, ".namingTaxonomy[7].name"), "Hub");

        assertEq(vm.parseJsonString(json, ".renameCandidates[0].contractName"), "CreatorOVaultFactory");
        assertEq(
            vm.parseJsonString(json, ".renameCandidates[0].recommendedName"),
            "LegacyCreatorOVaultDeploymentRegistry"
        );
        assertEq(vm.parseJsonString(json, ".renameCandidates[0].status"), "deferred");
        assertEq(
            vm.parseJsonString(json, ".renameCandidates[0].currentBehavior"),
            "Authorized legacy deployment registrar for script-deployed stacks; records addresses and mirrors them into CreatorRegistry but does not instantiate vault contracts itself."
        );
    }

    function testCatalogCapturesBatcherInputsForVanityPrediction() public view {
        string memory json = vm.readFile(CATALOG_PATH);

        assertEq(
            vm.parseJsonAddress(json, ".baseMainnetDefaults.create2Factory"),
            0x4e59b44847b379578588920cA78FbF26c0B4956C
        );
        assertEq(
            vm.parseJsonAddress(json, ".baseMainnetDefaults.registry"),
            0x888506B92181c57A2fD06516FFFb6F375b7A4626
        );
        assertEq(
            vm.parseJsonAddress(json, ".baseMainnetDefaults.vaultActivationBatcher"),
            0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB
        );
        assertEq(
            vm.parseJsonAddress(json, ".baseMainnetDefaults.lotteryManager"),
            address(0)
        );
        assertEq(
            vm.parseJsonAddress(json, ".baseMainnetDefaults.ajnaFactory"),
            0x214f62B5836D83f3D6c4f71F174209097B1A779C
        );
    }
}
