// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";
import {UniversalBytecodeStore} from "@4626/shared/deploy/infra/UniversalBytecodeStore.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

interface ICreatorOracleRemote {
    function setPeer(uint32 _eid, bytes32 _peer) external;
    function peers(uint32 _eid) external view returns (bytes32);
    function setChainlinkFeed(address _feed) external;
    function setSequencerUptimeFeed(address _feed) external;
    function chainlinkFeed() external view returns (address);
    function owner() external view returns (address);
    function BASE_EID() external view returns (uint32);
}

/**
 * @title DeployRemoteCreatorOracle
 * @notice Deploy thin spoke CreatorOracle (Base → spoke price cache) via CREATE2 store.
 *
 * @dev Spoke-minimal CCA path: oracle receives `broadcastAssetPriceWithFees` from Base.
 *      Launch pricing still needs a local Chainlink ETH/USD feed (and sequencer feed on L2s).
 *
 * @dev Prerequisites per spoke:
 *      1. Universal bytecode infra + CreatorOracle (+ QuoteLib) seeded in store
 *      2. Registry4626 at REGISTRY with local `getLayerZeroEndpoint(chainId)` + `hubChainEid()`
 *         (run SeedRegistry4626 on the spoke after registry deploy)
 *      3. DeployCreatorOracleQuoteLib if linked library is missing at Foundry address
 *
 * @dev Required env:
 *      - PRIVATE_KEY
 *      - CREATE2_DEPLOYER
 *      - ORACLE_SALT
 *      - ORACLE_CODE_ID
 *      - REGISTRY
 *      - ASSET_SYMBOL (e.g. "akita" — must match hub for CREATE2 parity)
 *      - EXPECTED_CHAIN_ID
 *
 * @dev Optional env:
 *      - ORACLE_OWNER (default: broadcaster)
 *      - CHAINLINK_ETH_USD_CTOR (default: address(0) — preferred for multi-chain CREATE2 parity)
 *      - SET_CHAINLINK_ETH_USD (post-deploy setChainlinkFeed; recommended = local feed)
 *      - SET_SEQUENCER_UPTIME_FEED (post-deploy; L2 only)
 *      - HUB_ORACLE (wire spoke→hub peer)
 *      - HUB_EID (default 30184)
 *      - BYTECODE_STORE
 *      - ENFORCE_ADDRESS_PARITY=1 + HUB_ORACLE to require predicted == hub address
 *
 * @dev Usage:
 *      forge script script/DeployRemoteCreatorOracle.s.sol:DeployRemoteCreatorOracle \
 *          --rpc-url $ARBITRUM_RPC_URL --broadcast -vvvv
 */
contract DeployRemoteCreatorOracle is Script {
    uint32 internal constant DEFAULT_HUB_EID = 30184;

    function run() external returns (address oracle) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address create2Deployer = vm.envAddress("CREATE2_DEPLOYER");
        bytes32 oracleSalt = vm.envBytes32("ORACLE_SALT");
        bytes32 oracleCodeId = vm.envBytes32("ORACLE_CODE_ID");
        address registry = vm.envAddress("REGISTRY");
        string memory assetSymbol = vm.envString("ASSET_SYMBOL");
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");

        address owner = vm.envOr("ORACLE_OWNER", vm.addr(privateKey));
        address chainlinkCtor = vm.envOr("CHAINLINK_ETH_USD_CTOR", address(0));
        address setChainlink = vm.envOr("SET_CHAINLINK_ETH_USD", address(0));
        address setSequencer = vm.envOr("SET_SEQUENCER_UPTIME_FEED", address(0));
        address hubOracle = vm.envOr("HUB_ORACLE", address(0));
        uint32 hubEid = uint32(vm.envOr("HUB_EID", uint256(DEFAULT_HUB_EID)));
        bool enforceParity = vm.envOr("ENFORCE_ADDRESS_PARITY", uint256(0)) != 0;

        address bytecodeStoreAddr =
            vm.envOr("BYTECODE_STORE", address(UniversalCreate2DeployerFromStore(create2Deployer).store()));

        require(block.chainid == expectedChainId, "Unexpected chain id for remote CreatorOracle deploy");
        require(create2Deployer != address(0), "CREATE2_DEPLOYER required");
        require(oracleSalt != bytes32(0), "ORACLE_SALT required");
        require(oracleCodeId != bytes32(0), "ORACLE_CODE_ID required");
        require(registry != address(0), "REGISTRY required");
        require(bytes(assetSymbol).length > 0, "ASSET_SYMBOL required");
        require(owner != address(0), "ORACLE_OWNER required");

        address lzEndpoint = IRegistry4626(registry).getLayerZeroEndpoint(block.chainid);
        require(lzEndpoint != address(0), "Registry missing local LZ endpoint - SeedRegistry on spoke");
        require(IRegistry4626(registry).hubChainEid() != 0, "Registry hubChainEid unset");

        bytes memory oracleArgs = abi.encode(registry, chainlinkCtor, assetSymbol, owner);
        bytes32 initCodeHash = _initCodeHash(bytecodeStoreAddr, oracleCodeId, oracleArgs);
        address predicted =
            UniversalCreate2DeployerFromStore(create2Deployer).computeAddress(oracleSalt, initCodeHash);

        console.log("Chain ID:           ", block.chainid);
        console.log("CREATE2 deployer:   ", create2Deployer);
        console.log("Registry:           ", registry);
        console.log("LZ endpoint:        ", lzEndpoint);
        console.log("Oracle owner:       ", owner);
        console.log("Ctor Chainlink:     ", chainlinkCtor);
        console.log("Predicted oracle:   ", predicted);

        if (enforceParity) {
            require(hubOracle != address(0), "HUB_ORACLE required when ENFORCE_ADDRESS_PARITY=1");
            require(predicted == hubOracle, "Predicted oracle != HUB_ORACLE");
        }

        vm.startBroadcast(privateKey);

        if (predicted.code.length == 0) {
            oracle = UniversalCreate2DeployerFromStore(create2Deployer).deploy(oracleSalt, oracleCodeId, oracleArgs);
        } else {
            oracle = predicted;
            console.log("CreatorOracle already deployed at predicted address");
        }

        ICreatorOracleRemote o = ICreatorOracleRemote(oracle);

        if (setChainlink != address(0) && o.chainlinkFeed() != setChainlink) {
            o.setChainlinkFeed(setChainlink);
            console.log("setChainlinkFeed:   ", setChainlink);
        }
        if (setSequencer != address(0)) {
            o.setSequencerUptimeFeed(setSequencer);
            console.log("setSequencerUptimeFeed:", setSequencer);
        }
        if (hubOracle != address(0)) {
            o.setPeer(hubEid, bytes32(uint256(uint160(hubOracle))));
            console.log("Spoke peer hubEid:  ", hubEid);
            console.log("Spoke peer hub:     ", hubOracle);
        }

        vm.stopBroadcast();

        require(oracle.code.length > 0, "Oracle deploy failed");
        if (enforceParity) {
            require(oracle == hubOracle, "Deployed oracle != HUB_ORACLE");
        }
        require(o.BASE_EID() == hubEid || hubOracle == address(0), "BASE_EID mismatch vs HUB_EID");
        if (hubOracle != address(0)) {
            require(o.peers(hubEid) == bytes32(uint256(uint160(hubOracle))), "hub peer mismatch");
        }

        console.log("CreatorOracle:      ", oracle);
    }

    function _initCodeHash(address bytecodeStoreAddr, bytes32 codeId, bytes memory constructorArgs)
        internal
        view
        returns (bytes32)
    {
        bytes memory creationCode = UniversalBytecodeStore(bytecodeStoreAddr).get(codeId);
        require(creationCode.length > 0, "CreatorOracle bytecode missing in store");
        return keccak256(bytes.concat(creationCode, constructorArgs));
    }
}
