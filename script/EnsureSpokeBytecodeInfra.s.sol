// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {CreatorOracle} from "@4626/creator/oracles/CreatorOracle.sol";
import {CreatorOracleQuoteLib} from "@4626/creator/oracles/CreatorOracleQuoteLib.sol";
import {CreatorShareOFT} from "@4626/creator/vault/CreatorShareOFT.sol";
import {OFTBootstrapRegistry} from "@4626/shared/deploy/infra/OFTBootstrapRegistry.sol";
import {UniversalBytecodeStoreV2} from "@4626/shared/deploy/infra/UniversalBytecodeStoreV2.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";

/**
 * @title EnsureSpokeBytecodeInfra
 * @notice Deploy UniversalBytecodeStoreV2 + UniversalCreate2DeployerFromStore at the
 *         fixed spoke epoch `cca-spoke-v1` CREATE2 addresses, then seed ShareOFT / Oracle / QuoteLib.
 *
 * @dev Live Base store/deployer (0x8599... / 0xdffB...) use older bytecode and cannot be
 *      reproduced with current artifacts. Spokes use epoch `cca-spoke-v1` so all expansion
 *      chains share one CREATE2 deployer/store pair. Do not use DeployUniversalBytecodeInfra
 *      (its v1 salts are a third, unrelated address set).
 *
 * Required env:
 * - PRIVATE_KEY
 *
 * Optional:
 * - DEPLOYMENT_EPOCH_TAG (default cca-spoke-v1)
 * - CREATE2_FROM_STORE_OWNER (default 0xB05C... for address parity across spokes)
 * - EXPECTED_STORE / EXPECTED_DEPLOYER (defaults = predicted cca-spoke-v1 addresses)
 * - SKIP_SEED=1
 *
 * Usage:
 *   forge script script/EnsureSpokeBytecodeInfra.s.sol:EnsureSpokeBytecodeInfra \
 *     --rpc-url $ARBITRUM_RPC_URL --broadcast -vvvv
 */
contract EnsureSpokeBytecodeInfra is Script {
    address constant EIP2470 = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address constant DEFAULT_STORE = 0x75FA60e7e01CACda736952E9AC8D5c30B61F117E;
    address constant DEFAULT_DEPLOYER = 0x7E3898Eb0Aee0DCAC5C0ccCd88ab94575f48a2D6;
    /// @dev Fixed CREATE2 deployer owner (baked into deployer initcode for cross-spoke parity).
    address constant DEFAULT_CREATE2_OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    string constant DEFAULT_EPOCH = "cca-spoke-v1";

    function run() external returns (address storeAddr, address deployerAddr) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("CREATE2_FROM_STORE_OWNER", DEFAULT_CREATE2_OWNER);
        string memory epoch = vm.envOr("DEPLOYMENT_EPOCH_TAG", DEFAULT_EPOCH);
        address expectedStore = vm.envOr("EXPECTED_STORE", DEFAULT_STORE);
        address expectedDeployer = vm.envOr("EXPECTED_DEPLOYER", DEFAULT_DEPLOYER);
        bool skipSeed = vm.envOr("SKIP_SEED", uint256(0)) != 0;

        bytes32 storeSalt = keccak256(bytes(string.concat("base-release:UniversalBytecodeStore:", epoch)));
        bytes32 deployerSalt =
            keccak256(bytes(string.concat("base-release:UniversalCreate2DeployerFromStore:", epoch)));

        bytes memory storeInit = type(UniversalBytecodeStoreV2).creationCode;
        storeAddr = _compute(EIP2470, storeSalt, keccak256(storeInit));

        bytes memory deployerInit =
            abi.encodePacked(type(UniversalCreate2DeployerFromStore).creationCode, abi.encode(storeAddr, owner));
        deployerAddr = _compute(EIP2470, deployerSalt, keccak256(deployerInit));

        console.log("Epoch:              ", epoch);
        console.log("CREATE2 owner:      ", owner);
        console.log("Predicted store:    ", storeAddr);
        console.log("Predicted deployer: ", deployerAddr);

        require(storeAddr == expectedStore, "Store CREATE2 mismatch - wrong epoch/bytecode");
        require(deployerAddr == expectedDeployer, "Deployer CREATE2 mismatch - wrong owner/epoch/bytecode");

        vm.startBroadcast(pk);

        if (storeAddr.code.length == 0) {
            (bool ok,) = EIP2470.call(abi.encodePacked(storeSalt, storeInit));
            require(ok && storeAddr.code.length > 0, "store deploy failed");
            console.log("Deployed UniversalBytecodeStoreV2");
        } else {
            console.log("Store already live");
        }

        if (deployerAddr.code.length == 0) {
            (bool ok,) = EIP2470.call(abi.encodePacked(deployerSalt, deployerInit));
            require(ok && deployerAddr.code.length > 0, "deployer deploy failed");
            console.log("Deployed UniversalCreate2DeployerFromStore");
        } else {
            console.log("Deployer already live");
        }

        if (!skipSeed) {
            _ensureQuoteLib();
            UniversalBytecodeStoreV2 store = UniversalBytecodeStoreV2(storeAddr);
            _storeIfMissing(store, type(OFTBootstrapRegistry).creationCode, "OFTBootstrapRegistry");
            _storeIfMissing(store, type(CreatorShareOFT).creationCode, "CreatorShareOFT");
            _storeIfMissing(store, type(CreatorOracleQuoteLib).creationCode, "CreatorOracleQuoteLib");
            _storeIfMissing(store, type(CreatorOracle).creationCode, "CreatorOracle");
        }

        vm.stopBroadcast();

        require(address(UniversalCreate2DeployerFromStore(deployerAddr).store()) == storeAddr, "deployer.store mismatch");
        console.log("Spoke bytecode infra ready.");
        console.log("BYTECODE_STORE=", storeAddr);
        console.log("CREATE2_DEPLOYER=", deployerAddr);
    }

    function _ensureQuoteLib() internal {
        bytes memory initCode = type(CreatorOracleQuoteLib).creationCode;
        address lib = _compute(EIP2470, bytes32(0), keccak256(initCode));
        if (lib.code.length == 0) {
            (bool ok,) = EIP2470.call(abi.encodePacked(bytes32(0), initCode));
            require(ok && lib.code.length > 0, "QuoteLib deploy failed");
            console.log("Deployed CreatorOracleQuoteLib", lib);
        } else {
            console.log("CreatorOracleQuoteLib already at", lib);
        }
    }

    function _storeIfMissing(UniversalBytecodeStoreV2 store, bytes memory creationCode, string memory label) internal {
        bytes32 codeId = keccak256(creationCode);
        if (store.pointers(codeId) != address(0)) {
            console.log("Already seeded", label);
            console.logBytes32(codeId);
            return;
        }
        store.store(creationCode);
        console.log("Seeded", label);
        console.logBytes32(codeId);
    }

    function _compute(address factory, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), factory, salt, initCodeHash)))));
    }
}
