// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {CreatorShareOFT} from "@4626/creator/messaging/CreatorShareOFT.sol";
import {OFTBootstrapRegistry} from "@4626/shared/deploy/infra/OFTBootstrapRegistry.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";
import {UniversalBytecodeStore} from "@4626/shared/deploy/infra/UniversalBytecodeStore.sol";

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
 * @notice Deploy remote-mode CreatorShareOFT on Robinhood Chain with **Base address parity**.
 *
 * @dev Cross-chain CREATE2 parity requires the same inputs as hub phase-1 finalize:
 *      - `UniversalCreate2DeployerFromStore` (same address on both chains)
 *      - `SHARE_OFT_SALT` from `deriveShareOftSalt(owner, shareSymbolLower, version)`
 *      - Constructor args `(shareName, shareSymbolUpper, oftBootstrapRegistry, deploymentBatcher)`
 *      - Matching bytecode store code ids / initCode for bootstrap + ShareOFT
 *
 * @dev Required env:
 *      - PRIVATE_KEY (protocol treasury on remote chain, or CREATE2 deployer owner)
 *      - CREATE2_DEPLOYER
 *      - SHARE_OFT_SALT
 *      - SHARE_OFT_CODE_ID
 *      - SHARE_NAME
 *      - SHARE_SYMBOL (uppercase ■SYMBOL recommended)
 *      - HUB_SHARE_OFT (Base hub ShareOFT — predicted address must match)
 *      - HUB_GAUGE_RECEIVER
 *      - HUB_LOTTERY_PEER
 *
 * @dev Optional env:
 *      - SHARE_OFT_CONSTRUCTOR_OWNER (default `0x17163e…` DeploymentBatcher on Base)
 *      - HUB_OFT_BOOTSTRAP_REGISTRY (skip bootstrap deploy; use hub bootstrap address)
 *      - OFT_BOOTSTRAP_CODE_ID (default keccak256(OFTBootstrapRegistry.creationCode))
 *      - BYTECODE_STORE (default: read from CREATE2_DEPLOYER.store())
 *      - HUB_EID (default 30184)
 *      - EXPECTED_CHAIN_ID (default 4663 Robinhood mainnet)
 *      - ENFORCE_ADDRESS_PARITY=0 to skip HUB_SHARE_OFT equality check (not recommended)
 *
 * @dev Seed Robinhood bytecode infra first:
 *      forge script script/DeployUniversalBytecodeInfra.s.sol:DeployUniversalBytecodeInfra \
 *          --rpc-url robinhood --broadcast
 */
contract DeployRemoteShareOft is Script {
    uint32 internal constant DEFAULT_HUB_EID = 30184;
    uint256 internal constant DEFAULT_ROBINHOOD_CHAIN_ID = 4663;
    bytes32 internal constant OFT_BOOTSTRAP_SALT = keccak256("4626:OFTBootstrapRegistry:v1");
    address internal constant DEFAULT_DEPLOYMENT_BATCHER = 0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33;

    function run() external returns (address shareOft, address bootstrapRegistry) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address create2Deployer = vm.envAddress("CREATE2_DEPLOYER");
        bytes32 shareOftSalt = vm.envBytes32("SHARE_OFT_SALT");
        bytes32 shareOftCodeId = vm.envBytes32("SHARE_OFT_CODE_ID");
        string memory shareName = vm.envString("SHARE_NAME");
        string memory shareSymbol = vm.envString("SHARE_SYMBOL");
        address hubGaugeReceiver = vm.envAddress("HUB_GAUGE_RECEIVER");
        address hubShareOft = vm.envAddress("HUB_SHARE_OFT");
        bytes32 hubLotteryPeer = vm.envBytes32("HUB_LOTTERY_PEER");
        uint32 hubEid = uint32(vm.envOr("HUB_EID", uint256(DEFAULT_HUB_EID)));
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", DEFAULT_ROBINHOOD_CHAIN_ID);
        bool enforceParity = vm.envOr("ENFORCE_ADDRESS_PARITY", uint256(1)) != 0;

        address constructorOwner = vm.envOr("SHARE_OFT_CONSTRUCTOR_OWNER", DEFAULT_DEPLOYMENT_BATCHER);
        address bytecodeStoreAddr =
            vm.envOr("BYTECODE_STORE", address(UniversalCreate2DeployerFromStore(create2Deployer).store()));
        bytes32 oftBootstrapCodeId = bytes32(
            vm.envOr("OFT_BOOTSTRAP_CODE_ID", uint256(keccak256(type(OFTBootstrapRegistry).creationCode)))
        );

        require(block.chainid == expectedChainId, "Unexpected chain id for remote ShareOFT deploy");
        require(create2Deployer != address(0), "CREATE2_DEPLOYER required");
        require(shareOftSalt != bytes32(0), "SHARE_OFT_SALT required");
        require(shareOftCodeId != bytes32(0), "SHARE_OFT_CODE_ID required");

        console.log("Chain ID:              ", block.chainid);
        console.log("CREATE2 deployer:      ", create2Deployer);
        console.log("Constructor owner:     ", constructorOwner);
        console.log("Hub ShareOFT (target): ", hubShareOft);
        console.log("Hub EID:               ", hubEid);

        bootstrapRegistry = vm.envOr("HUB_OFT_BOOTSTRAP_REGISTRY", address(0));
        if (bootstrapRegistry == address(0)) {
            bootstrapRegistry = _ensureBootstrapRegistry(create2Deployer, bytecodeStoreAddr, oftBootstrapCodeId);
        }
        console.log("OFTBootstrapRegistry:  ", bootstrapRegistry);

        bytes memory shareOftArgs = abi.encode(shareName, shareSymbol, bootstrapRegistry, constructorOwner);
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

    function _ensureBootstrapRegistry(address create2Deployer, address bytecodeStoreAddr, bytes32 oftBootstrapCodeId)
        internal
        returns (address addr)
    {
        bytes memory bootstrapCreation = UniversalBytecodeStore(bytecodeStoreAddr).get(oftBootstrapCodeId);
        require(bootstrapCreation.length > 0, "OFT bootstrap bytecode missing in store");
        bytes32 bootstrapInitCodeHash = keccak256(bootstrapCreation);
        addr = UniversalCreate2DeployerFromStore(create2Deployer).computeAddress(OFT_BOOTSTRAP_SALT, bootstrapInitCodeHash);
        if (addr.code.length > 0) {
            return addr;
        }
        UniversalCreate2DeployerFromStore(create2Deployer).deploy(OFT_BOOTSTRAP_SALT, oftBootstrapCodeId, bytes(""));
        require(addr.code.length > 0, "Bootstrap deploy failed");
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
