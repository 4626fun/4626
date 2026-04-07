// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

contract VanityManifestV181Test is Test {
    string private constant MANIFEST_PATH = "./deployments/base/v1.8.1-vanity-manifest.json";

    function testManifestLocksFreshV181VanityPredictions() public view {
        string memory json = vm.readFile(MANIFEST_PATH);

        assertEq(vm.parseJsonString(json, ".epochTag"), "v1.8.1");
        assertEq(vm.parseJsonString(json, ".vanitySuffix"), "4626");

        assertEq(
            vm.parseJsonAddress(json, ".phase1.UniversalBytecodeStoreV2.predictedAddress"),
            0x58071d59d2f5E61A80b3f8770B6564289acD4626
        );
        assertEq(
            vm.parseJsonAddress(json, ".phase1.UniversalCreate2DeployerFromStore.predictedAddress"),
            0x1c1596090B0e0Bb35b2F7cd77e865FbeE3654626
        );
        assertEq(
            vm.parseJsonAddress(json, ".phase1.CreatorOVaultCoreModule.predictedAddress"),
            0x9379761d3680401f4d412048B3Ff6FE05dE04626
        );
        assertEq(
            vm.parseJsonAddress(json, ".phase1.CreatorOVaultStrategiesModule.predictedAddress"),
            0x8fd50C3695749F95801E8c867E264100c2C54626
        );
        assertEq(
            vm.parseJsonAddress(json, ".phase1.CreatorOVaultAdminModule.predictedAddress"),
            0x6De6c3F10291e87fAEB7590CE01E400571434626
        );
        assertEq(
            vm.parseJsonAddress(json, ".phase1.DeploymentBatcher.predictedAddress"),
            0xaE81C19c2A2E964e65cCacE89A6eb2309d6E4626
        );
    }

    function testManifestCapturesDerivedHelperDriftChecks() public view {
        string memory json = vm.readFile(MANIFEST_PATH);

        assertEq(
            vm.parseJsonAddress(json, ".derived.DeploymentBatcherPhase3Helper.predictedAddress"),
            0x625992eAdA5942192b029c2a0DF5cBECc65509FB
        );
        assertEq(
            vm.parseJsonAddress(json, ".derived.DeploymentBatcherUniV4Helper.predictedAddress"),
            0x871f51A8d72e44da4baa4a64b97818555453EAee
        );
        assertFalse(vm.parseJsonBool(json, ".derived.DeploymentBatcherPhase3Helper.suffixRequired"));
        assertFalse(vm.parseJsonBool(json, ".derived.DeploymentBatcherUniV4Helper.suffixRequired"));
    }
}
