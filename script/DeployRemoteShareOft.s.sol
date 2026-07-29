// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";
import {UniversalBytecodeStore} from "@4626/shared/deploy/infra/UniversalBytecodeStore.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

interface IRemoteShareOftHubView {
    function isHub() external view returns (bool);
    function hubEid() external view returns (uint32);
    function hubGaugeReceiver() external view returns (address);
    function setHubConfig(bool _isHub, uint32 _hubEid, address _hubGaugeReceiver) external;
    function setHubLotteryPeer(uint32 _hubEid, bytes32 _hubLotteryPeer) external;
}

interface IOFTPeerConfig {
    function setPeer(uint32 _eid, bytes32 _peer) external;
    function peers(uint32 _eid) external view returns (bytes32);
}

/**
 * @title DeployRemoteShareOft
 * @notice Deploy remote-mode CreatorShareOFT on an EVM spoke via CREATE2 store.
 *
 * @dev Current CreatorShareOFT ctor: `(name, symbol, registry, owner)`.
 *      Registry must already have local LZ endpoint + hubChainEid (EnsureSpokeRegistry).
 *
 * @dev Required env:
 *      - PRIVATE_KEY, CREATE2_DEPLOYER, SHARE_OFT_SALT, SHARE_OFT_CODE_ID
 *      - SHARE_NAME, SHARE_SYMBOL, REGISTRY
 *      - HUB_SHARE_OFT, HUB_GAUGE_RECEIVER, HUB_LOTTERY_PEER
 *
 * @dev Optional:
 *      - SHARE_OFT_CONSTRUCTOR_OWNER (default AKITA phase-1 batcher 0xa18169…)
 *      - BYTECODE_STORE, HUB_EID (30184), EXPECTED_CHAIN_ID
 *      - ENFORCE_ADDRESS_PARITY=1 (default 0 — hub AKITA used purged historical codeId)
 *
 * @dev Pins: `pnpm -C frontend ops:deploy-akita-cca-spokes --print-commands`
 */
contract DeployRemoteShareOft is Script {
    uint32 internal constant DEFAULT_HUB_EID = 30184;
    uint256 internal constant DEFAULT_ROBINHOOD_CHAIN_ID = 4663;
    address internal constant DEFAULT_DEPLOYMENT_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;

    function run() external returns (address shareOft) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address create2Deployer = vm.envAddress("CREATE2_DEPLOYER");
        bytes32 shareOftSalt = vm.envBytes32("SHARE_OFT_SALT");
        bytes32 shareOftCodeId = vm.envBytes32("SHARE_OFT_CODE_ID");
        string memory shareName = vm.envString("SHARE_NAME");
        string memory shareSymbol = vm.envString("SHARE_SYMBOL");
        address registry = vm.envAddress("REGISTRY");
        address hubGaugeReceiver = vm.envAddress("HUB_GAUGE_RECEIVER");
        address hubShareOft = vm.envAddress("HUB_SHARE_OFT");
        bytes32 hubLotteryPeer = vm.envBytes32("HUB_LOTTERY_PEER");
        uint32 hubEid = uint32(vm.envOr("HUB_EID", uint256(DEFAULT_HUB_EID)));
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", DEFAULT_ROBINHOOD_CHAIN_ID);
        bool enforceParity = vm.envOr("ENFORCE_ADDRESS_PARITY", uint256(0)) != 0;

        address constructorOwner = vm.envOr("SHARE_OFT_CONSTRUCTOR_OWNER", DEFAULT_DEPLOYMENT_BATCHER);
        address bytecodeStoreAddr =
            vm.envOr("BYTECODE_STORE", address(UniversalCreate2DeployerFromStore(create2Deployer).store()));

        require(block.chainid == expectedChainId, "Unexpected chain id for remote ShareOFT deploy");
        require(create2Deployer != address(0), "CREATE2_DEPLOYER required");
        require(shareOftSalt != bytes32(0), "SHARE_OFT_SALT required");
        require(shareOftCodeId != bytes32(0), "SHARE_OFT_CODE_ID required");
        require(registry != address(0), "REGISTRY required");
        require(IRegistry4626(registry).getLayerZeroEndpoint(block.chainid) != address(0), "Registry LZ unset");
        require(IRegistry4626(registry).hubChainEid() != 0, "Registry hubChainEid unset");

        console.log("Chain ID:              ", block.chainid);
        console.log("CREATE2 deployer:      ", create2Deployer);
        console.log("Registry:              ", registry);
        console.log("Constructor owner:     ", constructorOwner);
        console.log("Hub ShareOFT (target): ", hubShareOft);
        console.log("Hub EID:               ", hubEid);

        bytes memory shareOftArgs = abi.encode(shareName, shareSymbol, registry, constructorOwner);
        bytes32 shareOftInitCodeHash = _initCodeHash(bytecodeStoreAddr, shareOftCodeId, shareOftArgs);
        address predictedShareOft =
            UniversalCreate2DeployerFromStore(create2Deployer).computeAddress(shareOftSalt, shareOftInitCodeHash);

        console.log("Predicted ShareOFT:    ", predictedShareOft);

        if (enforceParity) {
            require(predictedShareOft == hubShareOft, "Predicted ShareOFT != HUB_SHARE_OFT");
        }

        vm.startBroadcast(privateKey);

        if (predictedShareOft.code.length == 0) {
            shareOft = UniversalCreate2DeployerFromStore(create2Deployer).deploy(shareOftSalt, shareOftCodeId, shareOftArgs);
        } else {
            shareOft = predictedShareOft;
            console.log("ShareOFT already deployed at predicted address");
        }

        IRemoteShareOftHubView(shareOft).setHubConfig(false, hubEid, hubGaugeReceiver);
        IRemoteShareOftHubView(shareOft).setHubLotteryPeer(hubEid, hubLotteryPeer);
        IOFTPeerConfig(shareOft).setPeer(hubEid, bytes32(uint256(uint160(hubShareOft))));

        vm.stopBroadcast();

        console.log("CreatorShareOFT:       ", shareOft);

        if (enforceParity) {
            require(shareOft == hubShareOft, "Deployed ShareOFT != HUB_SHARE_OFT");
        }

        require(!IRemoteShareOftHubView(shareOft).isHub(), "Remote ShareOFT must not be hub");
        require(IRemoteShareOftHubView(shareOft).hubEid() == hubEid, "hubEid mismatch");
        require(IRemoteShareOftHubView(shareOft).hubGaugeReceiver() == hubGaugeReceiver, "hubGaugeReceiver mismatch");
        require(IOFTPeerConfig(shareOft).peers(hubEid) == bytes32(uint256(uint160(hubShareOft))), "hub peer mismatch");
    }

    function _initCodeHash(address bytecodeStoreAddr, bytes32 codeId, bytes memory constructorArgs)
        internal
        view
        returns (bytes32)
    {
        bytes memory creationCode = UniversalBytecodeStore(bytecodeStoreAddr).get(codeId);
        require(creationCode.length > 0, "ShareOFT bytecode missing in store");
        return keccak256(bytes.concat(creationCode, constructorArgs));
    }
}
