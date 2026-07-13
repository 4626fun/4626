// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {LotteryManager4626PricingLib} from "@4626/shared/lottery/manager/LotteryManager4626PricingLib.sol";

/**
 * @title DeployLotteryManagerCreate2V1180
 * @notice CREATE2 deploy + wire LotteryManager4626 for v1.18.0-greenfield Base.
 * @dev Replaces stale DeployLotteryManagerCreate2{,V2} constants (wrong registry/VRF).
 *
 * Targets:
 * - Registry4626  0xDb8570… (v1.18.0)
 * - Owner / VRF / Bridge from docs/reference/addresses.md
 * - PricingLib at Foundry create2_library_salt 0 (EIP-2470)
 *
 * Idempotent: skips CREATE2 if code already present; re-applies wiring.
 */
interface IRegistry4626LotteryManager {
    function owner() external view returns (address);
    function getLotteryManager(uint256 chainId) external view returns (address);
    function setLotteryManager(uint256 chainId, address manager) external;
    function getAllTokens() external view returns (address[] memory);
    function getShareOFTForToken(address token) external view returns (address);
}

interface IVRFConsumer4626Auth {
    function authorizedLocalCallers(address caller) external view returns (bool);
    function setLocalCallerAuthorization(address caller, bool authorized) external;
}

interface IAmoeRouter {
    function manager() external view returns (address);
    function setManager(address manager) external;
}

contract DeployLotteryManagerCreate2V1180 is Script {
    address constant DETERMINISTIC_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 constant LIBRARY_SALT = bytes32(0);

    // v1.18.0-greenfield
    address constant REGISTRY = 0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0;
    address constant OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;
    address constant VRF_CONSUMER = 0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36;
    address constant AMOE_ROUTER = 0x18D1806cfe044de1eb4652ab30Bf6937f8dfc0A7;
    uint256 constant BASE_CHAIN_ID = 8453;

    // Clone of live LM 0xbE87… config (2026-07-11 probe).
    uint256 constant MIN_SWAP = 1_000_000;
    uint256 constant REWARD_PCT = 6900;
    uint256 constant BASE_WIN = 40;
    uint256 constant MAX_WIN = 150_000;
    uint256 constant USD_MULT_BPS = 10_500;
    uint256 constant BASE_CEILING_PPM = 40_000;
    uint256 constant ORACLE_STALENESS = 2 hours;
    uint256 constant ORACLE_MAX_DEV_BPS = 2000;
    uint256 constant ORACLE_DEV_WINDOW = 30 minutes;

    /// @dev Non-vanity salt; remine if you need 0x777…4626 aesthetics.
    bytes32 constant SALT = keccak256("4626:LotteryManager4626:v1.18.0-remediation:2026-07-11");

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function _ensurePricingLib() internal returns (address lib) {
        bytes memory libInit = type(LotteryManager4626PricingLib).creationCode;
        lib = _create2(DETERMINISTIC_DEPLOYER, LIBRARY_SALT, keccak256(libInit));
        uint256 libSize;
        assembly {
            libSize := extcodesize(lib)
        }
        if (libSize == 0) {
            (bool ok,) = DETERMINISTIC_DEPLOYER.call(abi.encodePacked(LIBRARY_SALT, libInit));
            require(ok, "PricingLib CREATE2 failed");
            console.log("Deployed PricingLib:", lib);
        } else {
            console.log("PricingLib already at:", lib);
        }
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        require(broadcaster == OWNER, "broadcaster must be protocol owner EOA");

        bytes memory initcode = abi.encodePacked(type(LotteryManager4626).creationCode, abi.encode(REGISTRY, OWNER));
        bytes32 initCodeHash = keccak256(initcode);
        address predicted = _create2(DETERMINISTIC_DEPLOYER, SALT, initCodeHash);

        console.log("DeployLotteryManagerCreate2V1180");
        console.log("Broadcaster:", broadcaster);
        console.log("Registry:   ", REGISTRY);
        console.log("Predicted:  ", predicted);
        console.log("InitHash:   ", vm.toString(initCodeHash));
        console.log("Salt:       ", vm.toString(SALT));

        uint256 codeSize;
        assembly {
            codeSize := extcodesize(predicted)
        }

        vm.startBroadcast(pk);

        _ensurePricingLib();

        if (codeSize == 0) {
            (bool ok,) = DETERMINISTIC_DEPLOYER.call(abi.encodePacked(SALT, initcode));
            require(ok, "LM CREATE2 failed");
            console.log("Deployed LotteryManager4626:", predicted);
        } else {
            console.log("Already deployed:", predicted);
        }

        LotteryManager4626 lottery = LotteryManager4626(payable(predicted));
        require(lottery.owner() == OWNER, "owner mismatch");
        require(address(lottery.registry()) == REGISTRY, "registry mismatch");

        // Keep boost sources fail-closed (Phase 0).
        require(address(lottery.boostManager()) == address(0), "boostManager must stay 0");
        require(address(lottery.ve4626GaugeVoting()) == address(0), "ve4626GaugeVoting must stay 0");

        // VRF
        if (address(lottery.localVRFConsumer()) != VRF_CONSUMER) {
            lottery.setLocalVRFConsumer(VRF_CONSUMER);
        }
        if (!lottery.useLocalVRF()) {
            lottery.setUseLocalVRF(true);
        }

        // Oracle + odds config (match live canary)
        lottery.setOracleMaxStaleness(ORACLE_STALENESS);
        lottery.setOracleDeviationGuard(ORACLE_MAX_DEV_BPS, ORACLE_DEV_WINDOW);
        lottery.setBaseCeilingPPM(BASE_CEILING_PPM);
        lottery.setLotteryConfig(MIN_SWAP, REWARD_PCT, true, BASE_WIN, MAX_WIN, USD_MULT_BPS);

        IRegistry4626LotteryManager registry = IRegistry4626LotteryManager(REGISTRY);
        address[] memory tokens = registry.getAllTokens();
        for (uint256 i; i < tokens.length; i++) {
            address shareOFT = registry.getShareOFTForToken(tokens[i]);
            if (shareOFT == address(0)) continue;
            if (!lottery.authorizedSwapContracts(shareOFT)) {
                lottery.setAuthorizedSwapContract(shareOFT, true);
                console.log("authorized ShareOFT:", shareOFT);
            }
        }

        // AMOE
        lottery.setAuthorizedAmoeRelayer(AMOE_ROUTER);
        IAmoeRouter(AMOE_ROUTER).setManager(predicted);

        // VRF consumer can callback new LM
        IVRFConsumer4626Auth vrf = IVRFConsumer4626Auth(VRF_CONSUMER);
        if (!vrf.authorizedLocalCallers(predicted)) {
            vrf.setLocalCallerAuthorization(predicted, true);
        }

        // Point registry (cutover)
        if (registry.getLotteryManager(BASE_CHAIN_ID) != predicted) {
            registry.setLotteryManager(BASE_CHAIN_ID, predicted);
            console.log("registry.setLotteryManager ->", predicted);
        }

        vm.stopBroadcast();

        // Post-checks (view)
        require(lottery.singleVaultJackpotOnly(), "singleVaultJackpotOnly false");
        require(address(lottery.boostManager()) == address(0), "boost manager nonzero");
        console.log("LOTTERY_MANAGER=", predicted);
        console.log("deferredVrfQueueLength=", lottery.deferredVrfQueueLength());
    }
}
