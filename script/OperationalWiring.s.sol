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
 *         - (Optional) Registry sets Solana registry key <-> EID + bytes32 remote OFT peer
 *         - (Optional) Registry sets per-creator OVault mesh metadata
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
    function setVRFConfig(uint256 subscriptionId, bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations)
        external;
    function setVRFCoordinator(address coordinator) external;
    function setRemotePriceReportingEnabled(bool enabled) external;
}

interface ILotteryManager {
    function owner() external view returns (address);
    function authorizedSwapContracts(address) external view returns (bool);
    function setAuthorizedSwapContract(address swapContract, bool authorized) external;
    function setLocalVRFConsumer(address consumer) external;
    function setUseLocalVRF(bool useLocal) external;
    function setSponsoredVrfMinSwapAmountUSD(uint256 minSwapAmountUSD) external;
    function setVrfSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external;
    function setCallbackSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external;

    function setSponsorshipRateLimits(
        uint32 vrfMaxPerBuyerPerEpoch,
        uint32 vrfMaxPerOriginPerEpoch,
        uint32 callbackMaxPerBuyerPerEpoch,
        uint32 callbackMaxPerOriginPerEpoch
    ) external;
}

interface IRegistry {
    struct OmnichainVaultMeshConfig {
        uint32 solanaEid;
        address hubComposer;
        address assetMeshToken;
        address shareMeshToken;
        bytes32 solanaAssetMint;
        bool enabled;
    }

    function owner() external view returns (address);
    function setAuthorizedFactory(address factory, bool authorized) external;
    function setChainIdToEid(uint256 chainId, uint32 eid) external;
    function getEidForChainId(uint256 chainId) external view returns (uint32);
    function setRemoteOFTPeerBytes32(address token, uint32 chainEid, bytes32 remoteOFT) external;
    function getRemoteOFTPeerBytes32(address token, uint32 chainEid) external view returns (bytes32);
    function setOmnichainVaultMesh(address token, OmnichainVaultMeshConfig calldata cfg) external;
    function getOmnichainVaultMesh(address token) external view returns (OmnichainVaultMeshConfig memory);
}

contract OperationalWiring is Script {
    // ═══════════════════════════════════════════════════════════════════
    //                    DEPLOYED ADDRESSES
    // ═══════════════════════════════════════════════════════════════════

    address constant REGISTRY = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;
    address constant LOTTERY_MANAGER = 0x77705A2f173dd52F28300447506Dc35086c34626;
    address constant VRF_CONSUMER = 0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304;
    address constant SOLANA_BRIDGE_ADAPTER = 0x2414b595c4f18532A5836B6e2E6d536832c572e8;
    address constant VRF_COORDINATOR = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;

    // Uniswap V4 Tax Hook (processes swaps)
    address constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    // Legacy registrar / batchers
    address constant CREATOR_FACTORY = 0x90D25129072059ed5AfF321434f36d40B4556Cfc;
    address constant VAULT_BATCHER = 0x32403a647e73e04ae42b02bdd1ade9c88698fd0c;
    address constant VAULT_ACT_BATCHER = 0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB;

    // ═══════════════════════════════════════════════════════════════════
    //                    VRF CONFIG
    // ═══════════════════════════════════════════════════════════════════

    uint256 constant VRF_SUBSCRIPTION_ID =
        47863839619354659993460736640231400533612753469382997188258012673937790980789;
    bytes32 constant VRF_KEYHASH = 0x00b81b5a830cb0a4009fbd8904de511e28631e62ce5ad231373d3cdad373ccab;
    uint32 constant VRF_CALLBACK_GAS = 500_000;
    uint16 constant VRF_CONFIRMATIONS = 3;

    // Lottery sponsorship guardrails (hybrid model defaults)
    uint256 constant SPONSORED_MIN_SWAP_USD = 10_000_000; // $10 (1e6)
    uint256 constant SPONSOR_EPOCH_DURATION = 1 hours;
    uint256 constant VRF_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 constant VRF_SPONSOR_BUDGET = 0.25 ether;
    uint256 constant CALLBACK_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 constant CALLBACK_SPONSOR_BUDGET = 0.1 ether;

    // ═══════════════════════════════════════════════════════════════════
    //                              MAIN
    // ═══════════════════════════════════════════════════════════════════

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        uint256 solanaRegistryKey = vm.envOr("SOLANA_REGISTRY_KEY", uint256(0));
        uint32 solanaEid = uint32(vm.envOr("SOLANA_EID", uint256(0)));
        address solanaCreatorToken = vm.envOr("SOLANA_CREATOR_TOKEN", address(0));
        bytes32 solanaRemoteOftPeer = vm.envOr("SOLANA_REMOTE_OFT_PEER_BYTES32", bytes32(0));
        address ovaultHubComposer = vm.envOr("OVAULT_HUB_COMPOSER", address(0));
        address ovaultAssetMeshToken = vm.envOr("OVAULT_ASSET_MESH_TOKEN", address(0));
        address ovaultShareMeshToken = vm.envOr("OVAULT_SHARE_MESH_TOKEN", address(0));
        bytes32 ovaultSolanaAssetMint = vm.envOr("OVAULT_SOLANA_ASSET_MINT", bytes32(0));
        bool ovaultMeshEnabled = vm.envOr("OVAULT_MESH_ENABLED", uint256(1)) == 1;
        bool wantsSolanaRegistryMapping = solanaRegistryKey > 0;
        bool wantsSolanaPeerWiring = solanaCreatorToken != address(0) || solanaRemoteOftPeer != bytes32(0);
        bool wantsOvaultMeshWiring = ovaultHubComposer != address(0) || ovaultAssetMeshToken != address(0)
            || ovaultShareMeshToken != address(0) || ovaultSolanaAssetMint != bytes32(0);
        if (wantsSolanaRegistryMapping || wantsSolanaPeerWiring || wantsOvaultMeshWiring) {
            require(solanaEid != 0, "SOLANA_EID required when wiring Solana registry config");
        }
        if (wantsSolanaPeerWiring) {
            require(solanaCreatorToken != address(0), "SOLANA_CREATOR_TOKEN required");
            require(solanaRemoteOftPeer != bytes32(0), "SOLANA_REMOTE_OFT_PEER_BYTES32 required");
        }
        if (wantsOvaultMeshWiring) {
            require(solanaCreatorToken != address(0), "SOLANA_CREATOR_TOKEN required for OVAULT mesh wiring");
            require(ovaultHubComposer != address(0), "OVAULT_HUB_COMPOSER required");
            require(ovaultAssetMeshToken != address(0), "OVAULT_ASSET_MESH_TOKEN required");
            require(ovaultShareMeshToken != address(0), "OVAULT_SHARE_MESH_TOKEN required");
            require(ovaultSolanaAssetMint != bytes32(0), "OVAULT_SOLANA_ASSET_MINT required");
        }

        console.log("");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║          Operational Wiring — Contract Authorization           ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
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

        console.log("[1/8] VRF Consumer: Authorizing LotteryManager as local caller...");
        if (vrfConsumer.authorizedLocalCallers(LOTTERY_MANAGER)) {
            console.log(unicode"   [skip] Already authorized");
        } else {
            vrfConsumer.setLocalCallerAuthorization(LOTTERY_MANAGER, true);
            console.log(unicode"   ✓ setLocalCallerAuthorization(LotteryManager, true)");
        }

        // ────────────────────────────────────────────────────────────────
        //  2. VRF Consumer: Set VRF config (subscriptionId, keyHash, etc.)
        // ────────────────────────────────────────────────────────────────

        console.log("\n[2/8] VRF Consumer: Setting VRF config...");
        vrfConsumer.setVRFConfig(VRF_SUBSCRIPTION_ID, VRF_KEYHASH, VRF_CALLBACK_GAS, VRF_CONFIRMATIONS);
        console.log(unicode"   ✓ subscriptionId set");
        console.log(unicode"   ✓ keyHash set");
        console.log(unicode"   ✓ callbackGasLimit: 500,000");
        console.log(unicode"   ✓ requestConfirmations: 3");

        // ────────────────────────────────────────────────────────────────
        //  3. VRF Consumer: Set VRF Coordinator
        // ────────────────────────────────────────────────────────────────

        console.log("\n[3/8] VRF Consumer: Setting VRF Coordinator...");
        vrfConsumer.setVRFCoordinator(VRF_COORDINATOR);
        console.log(unicode"   ✓ VRF Coordinator:", VRF_COORDINATOR);

        // Safety default: ignore any remote price piggybacking unless explicitly enabled.
        vrfConsumer.setRemotePriceReportingEnabled(false);
        console.log(unicode"   ✓ setRemotePriceReportingEnabled: false");

        // ────────────────────────────────────────────────────────────────
        //  4. LotteryManager: Set VRF Consumer + enable local VRF
        // ────────────────────────────────────────────────────────────────

        console.log("\n[4/8] LotteryManager: Setting VRF consumer + local mode...");
        lotteryManager.setLocalVRFConsumer(VRF_CONSUMER);
        console.log(unicode"   ✓ setLocalVRFConsumer:", VRF_CONSUMER);

        lotteryManager.setUseLocalVRF(true);
        console.log(unicode"   ✓ setUseLocalVRF: true");

        // ────────────────────────────────────────────────────────────────
        //  5. LotteryManager: Configure sponsorship guardrails
        // ────────────────────────────────────────────────────────────────

        console.log("\n[5/8] LotteryManager: Configuring sponsorship guardrails...");
        lotteryManager.setSponsoredVrfMinSwapAmountUSD(SPONSORED_MIN_SWAP_USD);
        console.log(unicode"   ✓ setSponsoredVrfMinSwapAmountUSD: $10");

        lotteryManager.setSponsorshipRateLimits(2, 10, 1, 10);
        console.log(unicode"   ✓ setSponsorshipRateLimits: vrfBuyer=2, vrfOrigin=10, cbBuyer=1, cbOrigin=10");

        lotteryManager.setVrfSponsorshipPolicy(true, VRF_SPONSOR_MAX_FEE, VRF_SPONSOR_BUDGET, SPONSOR_EPOCH_DURATION);
        console.log(unicode"   ✓ VRF sponsorship policy set (maxFee=0.01 ETH, budget=0.25 ETH/hr)");

        lotteryManager.setCallbackSponsorshipPolicy(
            true, CALLBACK_SPONSOR_MAX_FEE, CALLBACK_SPONSOR_BUDGET, SPONSOR_EPOCH_DURATION
        );
        console.log(unicode"   ✓ callback sponsorship policy set (maxFee=0.01 ETH, budget=0.10 ETH/hr)");

        // ────────────────────────────────────────────────────────────────
        //  6. LotteryManager: Authorize swap contracts
        // ────────────────────────────────────────────────────────────────

        console.log("\n[6/8] LotteryManager: Authorizing swap contracts...");

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
        //  7. Registry: Authorize legacy registrar + batchers (idempotent re-auth)
        // ────────────────────────────────────────────────────────────────

        console.log("\n[7/8] Registry: Re-confirming registrar/batcher authorizations...");
        registry.setAuthorizedFactory(CREATOR_FACTORY, true);
        console.log(unicode"   ✓ CreatorOVaultFactory (legacy registrar)");

        registry.setAuthorizedFactory(VAULT_BATCHER, true);
        console.log(unicode"   ✓ DeploymentBatcher");

        registry.setAuthorizedFactory(VAULT_ACT_BATCHER, true);
        console.log(unicode"   ✓ VaultActivationBatcher");

        // ────────────────────────────────────────────────────────────────
        //  8. Registry: Optional Solana registry key <-> EID + bytes32 peer wiring
        // ────────────────────────────────────────────────────────────────

        console.log("\n[8/8] Registry: Optional Solana bytes32 peer wiring...");
        if (!wantsSolanaRegistryMapping && !wantsSolanaPeerWiring && !wantsOvaultMeshWiring) {
            console.log(unicode"   [skip] No SOLANA_* / OVAULT_* wiring env provided");
        } else {
            if (wantsSolanaRegistryMapping) {
                uint32 currentEid = registry.getEidForChainId(solanaRegistryKey);
                if (currentEid == solanaEid) {
                    console.log(unicode"   [skip] registry key <-> EID already mapped");
                } else {
                    registry.setChainIdToEid(solanaRegistryKey, solanaEid);
                    console.log(unicode"   ✓ setChainIdToEid for Solana registry key");
                }
            }

            if (wantsSolanaPeerWiring) {
                bytes32 currentPeer = registry.getRemoteOFTPeerBytes32(solanaCreatorToken, solanaEid);
                if (currentPeer == solanaRemoteOftPeer) {
                    console.log(unicode"   [skip] remote bytes32 OFT peer already configured");
                } else {
                    registry.setRemoteOFTPeerBytes32(solanaCreatorToken, solanaEid, solanaRemoteOftPeer);
                    console.log(unicode"   ✓ setRemoteOFTPeerBytes32 configured");
                }
            }

            if (wantsOvaultMeshWiring) {
                IRegistry.OmnichainVaultMeshConfig memory desiredCfg = IRegistry.OmnichainVaultMeshConfig({
                    solanaEid: solanaEid,
                    hubComposer: ovaultHubComposer,
                    assetMeshToken: ovaultAssetMeshToken,
                    shareMeshToken: ovaultShareMeshToken,
                    solanaAssetMint: ovaultSolanaAssetMint,
                    enabled: ovaultMeshEnabled
                });
                IRegistry.OmnichainVaultMeshConfig memory currentCfg = registry.getOmnichainVaultMesh(solanaCreatorToken);
                bool sameCfg = currentCfg.solanaEid == desiredCfg.solanaEid && currentCfg.hubComposer == desiredCfg.hubComposer
                    && currentCfg.assetMeshToken == desiredCfg.assetMeshToken
                    && currentCfg.shareMeshToken == desiredCfg.shareMeshToken
                    && currentCfg.solanaAssetMint == desiredCfg.solanaAssetMint && currentCfg.enabled == desiredCfg.enabled;
                if (sameCfg) {
                    console.log(unicode"   [skip] Omnichain OVault mesh already configured");
                } else {
                    registry.setOmnichainVaultMesh(solanaCreatorToken, desiredCfg);
                    console.log(unicode"   ✓ setOmnichainVaultMesh configured");
                }
            }
        }

        vm.stopBroadcast();

        // ────────────────────────────────────────────────────────────────
        //  SUMMARY
        // ────────────────────────────────────────────────────────────────

        console.log("");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║                    WIRING COMPLETE                             ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("");
        console.log(unicode"  ✓ VRF Consumer authorized LotteryManager as local caller");
        console.log(unicode"  ✓ VRF Config set (sub, keyHash, gas, confirmations)");
        console.log(unicode"  ✓ VRF Coordinator set");
        console.log(unicode"  ✓ LotteryManager -> VRF Consumer linked + local mode on");
        console.log(unicode"  ✓ LotteryManager sponsorship guardrails configured");
        console.log(unicode"  ✓ LotteryManager authorized: SolanaBridgeAdapter, TaxHook");
        console.log(unicode"  ✓ Registry factories confirmed");
        console.log(unicode"  ✓ Optional Solana bytes32 peer + OVault mesh wiring applied when envs are set");
        console.log("");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  REMAINING MANUAL STEP (if not already done):                   │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log(unicode"│  Chainlink VRF dashboard: ensure VRF Consumer is added as a     │");
        console.log(unicode"│  consumer on subscription ID. (Already done if funded with LINK) │");
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );
        console.log("");
    }
}
