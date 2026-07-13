// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {AgentOVaultCoreModule} from "@4626/agent/vault/modules/AgentOVaultCoreModule.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";
import {DeploymentBatcher} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {VaultActivationBatcher} from "@4626/shared/deploy/batchers/VaultActivationBatcher.sol";
import {OVaultFactory4626} from "@4626/shared/deploy/factories/OVaultFactory4626.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";
import {AgentOvaultLane} from "@4626/shared/deploy/lanes/AgentOvaultLane.sol";
import {CreatorOvaultLane} from "@4626/shared/deploy/lanes/CreatorOvaultLane.sol";
import {IOvaultLane} from "@4626/shared/deploy/lanes/IOvaultLane.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {LotteryManager4626PricingLib} from "@4626/shared/lottery/manager/LotteryManager4626PricingLib.sol";

interface IVrfConsumerV1190 {
    function authorizedLocalCallers(address caller) external view returns (bool);
    function setLocalCallerAuthorization(address caller, bool authorized) external;
}

/**
 * @title DeployV1190RegistrationPlane
 * @notice Deterministically deploys the bounded v1.19 registration-plane refresh.
 * @dev Reuses the live bytecode store, CREATE2-from-store deployer, VRF consumer,
 *      and LayerZero ShareOFT deployment path.
 *
 * Run twice around phased-infra deployment:
 * 1. without NEW_DEPLOYMENT_BATCHER to deploy/configure shared registration contracts;
 * 2. with NEW_DEPLOYMENT_BATCHER to bind/authorize the newly deployed batcher.
 */
contract DeployV1190RegistrationPlane is Script {
    address internal constant DETERMINISTIC_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 internal constant LIBRARY_SALT = bytes32(0);

    address internal constant DEFAULT_OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    address internal constant DEFAULT_VRF_CONSUMER = 0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36;
    address internal constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant DEFAULT_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant DEFAULT_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address internal constant DEFAULT_SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address internal constant DEFAULT_POSITION_MANAGER = address(0);
    address internal constant DEFAULT_QUOTER = address(0);

    uint256 internal constant BASE_CHAIN_ID = 8453;
    uint32 internal constant BASE_EID = 30184;

    struct Plane {
        Registry4626 registry;
        OVaultFactory4626 factory;
        CreatorOvaultLane creatorLane;
        AgentOvaultLane agentLane;
        AgentOVaultCoreModule agentVaultCoreModule;
        VaultActivationBatcher activationBatcher;
        LotteryManager4626 lotteryManager;
    }

    function _salt(string memory component) internal view returns (bytes32) {
        string memory epoch = vm.envOr("REGISTRATION_PLANE_EPOCH_TAG", string("v1.19.0-registration-plane"));
        return keccak256(bytes(string.concat("4626:", component, ":", epoch)));
    }

    function _predict(bytes32 salt, bytes memory initCode) internal pure returns (address) {
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), DETERMINISTIC_DEPLOYER, salt, keccak256(initCode))))
            )
        );
    }

    function _deploy(bytes32 salt, bytes memory initCode) internal returns (address deployed) {
        deployed = _predict(salt, initCode);
        if (deployed.code.length != 0) return deployed;
        (bool ok,) = DETERMINISTIC_DEPLOYER.call(abi.encodePacked(salt, initCode));
        require(ok, "registration-plane CREATE2 failed");
        require(deployed.code.length != 0, "registration-plane code missing");
    }

    function _ensurePricingLib() internal returns (address) {
        bytes memory initCode = type(LotteryManager4626PricingLib).creationCode;
        return _deploy(LIBRARY_SALT, initCode);
    }

    function _readLaneCodeIds(string memory prefix) internal view returns (IOvaultLane.CodeIds memory ids) {
        ids = IOvaultLane.CodeIds({
            vault: vm.envBytes32(string.concat(prefix, "_VAULT_CODE_ID")),
            wrapper: vm.envBytes32(string.concat(prefix, "_WRAPPER_CODE_ID")),
            shareOFT: vm.envBytes32(string.concat(prefix, "_SHARE_OFT_CODE_ID")),
            gauge: vm.envBytes32(string.concat(prefix, "_GAUGE_CODE_ID")),
            cca: vm.envBytes32(string.concat(prefix, "_CCA_CODE_ID")),
            oracle: vm.envBytes32(string.concat(prefix, "_ORACLE_CODE_ID")),
            oftBootstrap: vm.envBytes32("OFT_BOOTSTRAP_CODE_ID")
        });
    }

    function _deployPlane(address owner, address permit2) internal returns (Plane memory plane) {
        plane.registry = Registry4626(
            _deploy(_salt("Registry4626"), abi.encodePacked(type(Registry4626).creationCode, abi.encode(owner)))
        );
        plane.factory = OVaultFactory4626(
            _deploy(
                _salt("OVaultFactory4626"),
                abi.encodePacked(type(OVaultFactory4626).creationCode, abi.encode(address(plane.registry), owner))
            )
        );
        plane.creatorLane = CreatorOvaultLane(
            _deploy(
                _salt("CreatorOvaultLane"), abi.encodePacked(type(CreatorOvaultLane).creationCode, abi.encode(owner))
            )
        );
        plane.agentLane = AgentOvaultLane(
            _deploy(_salt("AgentOvaultLane"), abi.encodePacked(type(AgentOvaultLane).creationCode, abi.encode(owner)))
        );
        plane.agentVaultCoreModule =
            AgentOVaultCoreModule(_deploy(_salt("AgentOVaultCoreModule"), type(AgentOVaultCoreModule).creationCode));
        plane.activationBatcher = VaultActivationBatcher(
            _deploy(
                _salt("VaultActivationBatcher"),
                abi.encodePacked(
                    type(VaultActivationBatcher).creationCode, abi.encode(permit2, address(plane.registry))
                )
            )
        );

        _ensurePricingLib();
        plane.lotteryManager = LotteryManager4626(
            payable(_deploy(
                    _salt("LotteryManager4626"),
                    abi.encodePacked(type(LotteryManager4626).creationCode, abi.encode(address(plane.registry), owner))
                ))
        );
    }

    function _configureRegistry(Plane memory plane) internal {
        Registry4626 registry = plane.registry;
        if (!registry.isChainSupported(BASE_CHAIN_ID)) {
            registry.registerChain(BASE_CHAIN_ID, "Base", DEFAULT_WETH, true);
        }
        registry.setDexInfrastructure(
            BASE_CHAIN_ID,
            vm.envOr("POOL_MANAGER", DEFAULT_POOL_MANAGER),
            vm.envOr("SWAP_ROUTER", DEFAULT_SWAP_ROUTER),
            vm.envOr("POSITION_MANAGER", DEFAULT_POSITION_MANAGER),
            vm.envOr("QUOTER", DEFAULT_QUOTER)
        );
        registry.setLayerZeroEndpoint(BASE_CHAIN_ID, registry.layerZeroCommonEndpoint());
        registry.setChainIdToEid(BASE_CHAIN_ID, BASE_EID);
        registry.setHubChain(BASE_CHAIN_ID, BASE_EID);
        registry.setLotteryManager(BASE_CHAIN_ID, address(plane.lotteryManager));
        registry.setAuthorizedFactory(address(plane.factory), true);
        registry.setAuthorizedFactory(address(plane.activationBatcher), true);

        address batcher = vm.envOr("NEW_DEPLOYMENT_BATCHER", address(0));
        if (batcher != address(0)) {
            registry.setAuthorizedFactory(batcher, true);
            plane.factory.setDeploymentBatcher(batcher);
            address create2Deployer = vm.envAddress("UNIVERSAL_CREATE2_DEPLOYER");
            UniversalCreate2DeployerFromStore(create2Deployer).setAuthorizedDeployer(batcher, true);
        }
    }

    function _configureFactory(Plane memory plane) internal {
        plane.creatorLane.setCodeIds(_readLaneCodeIds("CREATOR"));
        plane.agentLane.setCodeIds(_readLaneCodeIds("AGENT"));
        plane.factory.setLane(IRegistry4626.VaultKind.Creator, address(plane.creatorLane));
        plane.factory.setLane(IRegistry4626.VaultKind.Agent, address(plane.agentLane));
    }

    function _configureLottery(Plane memory plane, address vrfConsumer) internal {
        LotteryManager4626 lottery = plane.lotteryManager;
        if (address(lottery.localVRFConsumer()) != vrfConsumer) lottery.setLocalVRFConsumer(vrfConsumer);
        if (!lottery.useLocalVRF()) lottery.setUseLocalVRF(true);
        lottery.setOracleMaxStaleness(2 hours);
        lottery.setOracleDeviationGuard(2000, 30 minutes);
        lottery.setBaseCeilingPPM(40_000);
        lottery.setLotteryConfig(1_000_000, 6900, true, 40, 150_000, 10_500);
        IVrfConsumerV1190 vrf = IVrfConsumerV1190(vrfConsumer);
        if (!vrf.authorizedLocalCallers(address(lottery))) {
            vrf.setLocalCallerAuthorization(address(lottery), true);
        }
    }

    function _verify(Plane memory plane, address owner, address vrfConsumer) internal view {
        require(plane.registry.owner() == owner, "registry owner mismatch");
        require(plane.factory.owner() == owner, "factory owner mismatch");
        require(address(plane.factory.registry()) == address(plane.registry), "factory registry mismatch");
        require(address(plane.lotteryManager.registry()) == address(plane.registry), "LM registry mismatch");
        require(address(plane.lotteryManager.localVRFConsumer()) == vrfConsumer, "LM VRF mismatch");
        require(address(plane.lotteryManager.boostManager()) == address(0), "boost manager must stay zero");
        require(address(plane.lotteryManager.ve4626GaugeVoting()) == address(0), "gauge voting must stay zero");
        require(plane.lotteryManager.singleVaultJackpotOnly(), "single-vault guard disabled");

        address batcher = vm.envOr("NEW_DEPLOYMENT_BATCHER", address(0));
        if (batcher != address(0)) {
            require(address(plane.factory.deploymentBatcher()) == batcher, "factory batcher mismatch");
            require(
                address(DeploymentBatcher(payable(batcher)).registry()) == address(plane.registry),
                "batcher registry mismatch"
            );
        }
    }

    function _printHandoff(Plane memory plane) internal pure {
        console2.log(string.concat("HANDOFF:REGISTRY_4626=", vm.toString(address(plane.registry))));
        console2.log(string.concat("HANDOFF:OVAULT_FACTORY=", vm.toString(address(plane.factory))));
        console2.log(string.concat("HANDOFF:CREATOR_OVAULT_LANE=", vm.toString(address(plane.creatorLane))));
        console2.log(string.concat("HANDOFF:AGENT_OVAULT_LANE=", vm.toString(address(plane.agentLane))));
        console2.log(
            string.concat("HANDOFF:AGENT_VAULT_CORE_MODULE=", vm.toString(address(plane.agentVaultCoreModule)))
        );
        console2.log(string.concat("HANDOFF:VAULT_ACTIVATION_BATCHER=", vm.toString(address(plane.activationBatcher))));
        console2.log(string.concat("HANDOFF:LOTTERY_MANAGER=", vm.toString(address(plane.lotteryManager))));
    }

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(privateKey);
        address owner = vm.envOr("REGISTRATION_PLANE_OWNER", DEFAULT_OWNER);
        address vrfConsumer = vm.envOr("VRF_CONSUMER", DEFAULT_VRF_CONSUMER);
        address permit2 = vm.envOr("PERMIT2", DEFAULT_PERMIT2);

        require(broadcaster == owner, "broadcaster must equal registration-plane owner");
        require(block.chainid == BASE_CHAIN_ID, "Base only");

        vm.startBroadcast(privateKey);
        Plane memory plane = _deployPlane(owner, permit2);
        _configureRegistry(plane);
        _configureFactory(plane);
        _configureLottery(plane, vrfConsumer);
        vm.stopBroadcast();

        _verify(plane, owner, vrfConsumer);
        _printHandoff(plane);
    }
}
