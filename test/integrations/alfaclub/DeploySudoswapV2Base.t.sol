// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {DeploySudoswapV2Base} from "alfaclub/contracts/script/DeploySudoswapV2Base.s.sol";

contract MockFactoryOwnerSafe {
    function marker() external pure returns (bytes4) {
        return this.marker.selector;
    }
}

contract DeploySudoswapV2BaseTest is Test {
    uint256 private constant DEPLOYER_KEY = 0xA11CE;

    DeploySudoswapV2Base private script;
    MockFactoryOwnerSafe private factoryOwnerSafe;

    function setUp() public {
        script = new DeploySudoswapV2Base();
        factoryOwnerSafe = new MockFactoryOwnerSafe();
        vm.setEnv("PRIVATE_KEY", vm.toString(bytes32(DEPLOYER_KEY)));
        vm.setEnv("FACTORY_OWNER", vm.toString(address(factoryOwnerSafe)));
        vm.setEnv("ALLOW_NON_BASE", "0");
    }

    function testRejectsNonBaseBeforeDeployment() public {
        vm.chainId(1);

        vm.expectRevert(abi.encodeWithSelector(DeploySudoswapV2Base.RefusingNonBaseDeployment.selector, 1));
        script.run();
    }

    function testRejectsEoaFactoryOwnerOnBase() public {
        vm.chainId(8453);
        vm.etch(address(factoryOwnerSafe), bytes(""));

        vm.expectRevert(abi.encodeWithSelector(DeploySudoswapV2Base.InvalidAddress.selector, "FACTORY_OWNER code"));
        script.run();
    }

    function testRejectsDuplicateWhenOfficialBaseFactoryExists() public {
        vm.chainId(8453);
        vm.etch(script.OFFICIAL_BASE_FACTORY(), hex"00");

        vm.expectRevert(
            abi.encodeWithSelector(
                DeploySudoswapV2Base.OfficialBaseDeploymentAlreadyExists.selector, script.OFFICIAL_BASE_FACTORY()
            )
        );
        script.run();
    }

    function testRejectsMissingBaseRoyaltyRegistryCode() public {
        vm.chainId(8453);
        vm.etch(script.BASE_MANIFOLD_ROYALTY_REGISTRY(), bytes(""));

        vm.expectRevert(
            abi.encodeWithSelector(DeploySudoswapV2Base.InvalidAddress.selector, "Base Manifold Royalty Registry code")
        );
        script.run();
    }

    function testRejectsContractAtDeploymentEoa() public {
        vm.chainId(8453);
        vm.etch(vm.addr(DEPLOYER_KEY), hex"60006000f3");

        vm.expectRevert(abi.encodeWithSelector(DeploySudoswapV2Base.InvalidAddress.selector, "deployer EOA"));
        script.run();
    }
}
