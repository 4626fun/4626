// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

/**
 * @title OperationalWiring
 * @author 0xakita.eth
 * @notice Wires deployed contracts together:
 *         - VRF Consumer authorizes LotteryManager as a local caller
 *         - VRF Consumer gets subscriptionId + keyHash config
 *         - LotteryManager authorizes SolanaBridgeAdapter as swap contract
 *         - Registry points to LotteryManager
 *
 * @dev This script is idempotent — safe to re-run.
 *
 * @dev RUN COMMAND:
 *      forge script script/OperationalWiring.s.sol:OperationalWiring \
 *          --rpc-url base \
 *          --broadcast \
 *          -vvvv
 */

// Minimal interfaces for the calls we need
interface IVRFConsumer {
    function owner() external view returns (address);
    function authorizedLocalCallers(address) external view returns (bool);
    function setLocalCallerAuthorization(address caller, bool authorized) external;
    function setVRFConfig(
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint16 requestConfirmations
    ) external;
    function setVRFCoordinator(address coordinator) external;
}

interface ILotteryManager {
    function owner() external view returns (address);
    function authorizedSwapContracts(address) external view returns (bool);
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
    function setLocalVRFConsumer(address consumer) external;
    function setUseLocalVRF(bool useLocal) external;
}

interface IRegistry {
    function owner() external view returns (address);
    function setAuthorizedFactory(address factory, bool authorized) external;
}

contract OperationalWiring is Script {

    // ═══════════════════════════════════════════════════════════════════
    //                    DEPLOYED ADDRESSES
    // ═══════════════════════════════════════════════════════════════════

    address constant REGISTRY             = 0x888482d648D1fCa1A735268A9e579b44Bf644626;
    address constant LOTTERY_MANAGER      = 0x77740C44A3E1d8262e8bfAB6204A29B2cbeE4626;
    address constant VRF_CONSUMER         = 0x0265236984DE964CB0422BaeFbDb2de7C9d590F5;
    address constant SOLANA_BRIDGE_ADAPTER = 0x648A01f6e125A46c4695CA70D0EB455f053d36A2;
    address constant VRF_COORDINATOR      = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;

    // Uniswap V4 Tax Hook (processes swaps)
    address constant TAX_HOOK             = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    // Factories / Batchers
    address constant CREATOR_FACTORY      = 0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD;
    address constant VAULT_BATCHER        = 0xF80a991dF64207Ff9C7A04eD3339e404Bc11d1CE;
    address constant VAULT_ACT_BATCHER    = 0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB;

    // ═══════════════════════════════════════════════════════════════════
    //                    VRF CONFIG
    // ═══════════════════════════════════════════════════════════════════

    uint256 constant VRF_SUBSCRIPTION_ID = 47863839619354659993460736640231400533612753469382997188258012673937790980789;
    bytes32 constant VRF_KEYHASH         = 0x00b81b5a830cb0a4009fbd8904de511e28631e62ce5ad231373d3cdad373ccab;
    uint32  constant VRF_CALLBACK_GAS    = 500_000;
    uint16  constant VRF_CONFIRMATIONS   = 3;

    // ═══════════════════════════════════════════════════════════════════
    //                              MAIN
    // ═══════════════════════════════════════════════════════════════════

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║          Operational Wiring — Contract Authorization           ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("Deployer/Caller:", deployer);
        console.log("Chain ID:       ", block.chainid);
        console.log("");

        IVRFConsumer vrfConsumer = IVRFConsumer(VRF_CONSUMER);
        ILotteryManager lotteryManager = ILotteryManager(LOTTERY_MANAGER);
        IRegistry registry = IRegistry(REGISTRY);

        vm.startBroadcast(deployerPrivateKey);

        // ────────────────────────────────────────────────────────────────
        //  1. VRF Consumer: Authorize LotteryManager as local caller
        // ────────────────────────────────────────────────────────────────

        console.log("[1/6] VRF Consumer: Authorizing LotteryManager as local caller...");
        if (vrfConsumer.authorizedLocalCallers(LOTTERY_MANAGER)) {
            console.log(unicode"   [skip] Already authorized");
        } else {
            vrfConsumer.setLocalCallerAuthorization(LOTTERY_MANAGER, true);
            console.log(unicode"   ✓ setLocalCallerAuthorization(LotteryManager, true)");
        }

        // ────────────────────────────────────────────────────────────────
        //  2. VRF Consumer: Set VRF config (subscriptionId, keyHash, etc.)
        // ────────────────────────────────────────────────────────────────

        console.log("\n[2/6] VRF Consumer: Setting VRF config...");
        vrfConsumer.setVRFConfig(
            VRF_SUBSCRIPTION_ID,
            VRF_KEYHASH,
            VRF_CALLBACK_GAS,
            VRF_CONFIRMATIONS
        );
        console.log(unicode"   ✓ subscriptionId set");
        console.log(unicode"   ✓ keyHash set");
        console.log(unicode"   ✓ callbackGasLimit: 500,000");
        console.log(unicode"   ✓ requestConfirmations: 3");

        // ────────────────────────────────────────────────────────────────
        //  3. VRF Consumer: Set VRF Coordinator
        // ────────────────────────────────────────────────────────────────

        console.log("\n[3/6] VRF Consumer: Setting VRF Coordinator...");
        vrfConsumer.setVRFCoordinator(VRF_COORDINATOR);
        console.log(unicode"   ✓ VRF Coordinator:", VRF_COORDINATOR);

        // ────────────────────────────────────────────────────────────────
        //  4. LotteryManager: Set VRF Consumer + enable local VRF
        // ────────────────────────────────────────────────────────────────

        console.log("\n[4/6] LotteryManager: Setting VRF consumer + local mode...");
        lotteryManager.setLocalVRFConsumer(VRF_CONSUMER);
        console.log(unicode"   ✓ setLocalVRFConsumer:", VRF_CONSUMER);

        lotteryManager.setUseLocalVRF(true);
        console.log(unicode"   ✓ setUseLocalVRF: true");

        // ────────────────────────────────────────────────────────────────
        //  5. LotteryManager: Authorize swap contracts
        // ────────────────────────────────────────────────────────────────

        console.log("\n[5/6] LotteryManager: Authorizing swap contracts...");

        // SolanaBridgeAdapter (for Solana-originated lottery entries)
        if (lotteryManager.authorizedSwapContracts(SOLANA_BRIDGE_ADAPTER)) {
            console.log(unicode"   [skip] SolanaBridgeAdapter already authorized");
        } else {
            lotteryManager.setAuthorizedSwapContract(SOLANA_BRIDGE_ADAPTER, true);
            console.log(unicode"   ✓ SolanaBridgeAdapter authorized");
        }

        // TaxHook (for EVM-originated lottery entries via Uniswap V4 swaps)
        if (lotteryManager.authorizedSwapContracts(TAX_HOOK)) {
            console.log(unicode"   [skip] TaxHook already authorized");
        } else {
            lotteryManager.setAuthorizedSwapContract(TAX_HOOK, true);
            console.log(unicode"   ✓ TaxHook authorized");
        }

        // ────────────────────────────────────────────────────────────────
        //  6. Registry: Authorize factories (idempotent re-auth)
        // ────────────────────────────────────────────────────────────────

        console.log("\n[6/6] Registry: Re-confirming factory authorizations...");
        registry.setAuthorizedFactory(CREATOR_FACTORY, true);
        console.log(unicode"   ✓ CreatorOVaultFactory");

        registry.setAuthorizedFactory(VAULT_BATCHER, true);
        console.log(unicode"   ✓ CreatorVaultBatcher");

        registry.setAuthorizedFactory(VAULT_ACT_BATCHER, true);
        console.log(unicode"   ✓ VaultActivationBatcher");

        vm.stopBroadcast();

        // ────────────────────────────────────────────────────────────────
        //  SUMMARY
        // ────────────────────────────────────────────────────────────────

        console.log("");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║                    WIRING COMPLETE                             ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log(unicode"  ✓ VRF Consumer authorized LotteryManager as local caller");
        console.log(unicode"  ✓ VRF Config set (sub, keyHash, gas, confirmations)");
        console.log(unicode"  ✓ VRF Coordinator set");
        console.log(unicode"  ✓ LotteryManager -> VRF Consumer linked + local mode on");
        console.log(unicode"  ✓ LotteryManager authorized: SolanaBridgeAdapter, TaxHook");
        console.log(unicode"  ✓ Registry factories confirmed");
        console.log("");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  REMAINING MANUAL STEP (if not already done):                   │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log(unicode"│  Chainlink VRF dashboard: ensure VRF Consumer is added as a     │");
        console.log(unicode"│  consumer on subscription ID. (Already done if funded with LINK) │");
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        console.log("");
    }
}
