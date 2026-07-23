// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

/**
 * @notice Minimal interface for the ve(3,3) bribes factory (renamed `BribesFactory4626`
 *         once that governance stack is actually deployed). Kept local so this contract
 *         has no hard compile-time dependency on the bribes/ve4626 subsystem.
 */
interface IBribesFactory4626 {
    function getOrCreateBribeDepot(address vault) external returns (address depot);
}

interface IBribesFactory4626View {
    function bribeDepotOf(address vault) external view returns (address depot);
}

/**
 * @title RegistryBootstrap4626
 * @author 0xakita.eth
 * @notice Owner-gated helper that batches `Registry4626` registration + all per-token
 *         setters (+ optional Solana omnichain mesh config + optional bribe depot wiring)
 *         into a single idempotent transaction.
 * @dev Purpose-built for ad hoc / manual registry writes — the standard `DeploymentBatcher`
 *      phase-2 finalize path already does this atomically for normal vault deploys. This
 *      contract exists for registering a token outside the standard batcher flow, or filling
 *      in a still-missing field on an already-registered token, without falling back to N
 *      separate `cast send` calls.
 *
 *      IMPORTANT: this helper is meant to be deployed as an *authorized factory*
 *      (`Registry4626.setAuthorizedFactory(address(this), true)`), not as the registry
 *      owner. `Registry4626._requireBindingWritable` unconditionally blocks any non-owner
 *      caller from overwriting a field that already has a non-zero value (an intentional,
 *      audited control against a compromised factory hijacking an existing token's config).
 *      That means this contract can only set a field the *first* time (zero -> value); it
 *      can never "patch" an existing non-zero binding to a different value. Correcting an
 *      already-set field always requires the registry owner acting directly (with
 *      `liveRebindEnabled`), never this helper.
 *
 *      Every sub-write is skipped when the target value already matches (or is already
 *      non-zero, for the plain per-token setters), so re-running `bootstrapToken` with the
 *      same params is a safe no-op. Must be authorized via
 *      `Registry4626.setAuthorizedFactory(address(this), true)` by the registry owner
 *      before any writes will succeed — `Registry4626.onlyAuthorizedOrOwner` requires the
 *      *immediate* caller to be authorized.
 */
contract RegistryBootstrap4626 is Ownable {
    // =================================
    // ERRORS
    // =================================

    error ZeroAddress();
    error BribesFactoryNotConfigured();

    // =================================
    // EVENTS
    // =================================

    event TokenBootstrapped(address indexed token);
    event BribeDepotWired(address indexed token, address indexed vault, address indexed depot);
    event RegistrySet(address indexed registry);
    event BribesFactorySet(address indexed bribesFactory);

    // =================================
    // STORAGE
    // =================================

    /// @notice The Registry4626 instance this helper writes to. Repointable across epochs.
    IRegistry4626 public registry;

    /// @notice Optional ve(3,3) bribes factory. Left unset (address(0)) until that
    ///         governance stack is deployed and wired against the current registry —
    ///         `createBribeDepot: true` reverts loudly instead of silently skipping.
    address public bribesFactory;

    // =================================
    // PARAMS
    // =================================

    struct BootstrapParams {
        address token;
        // Only used if `token` is not yet registered:
        string name;
        string symbol;
        address creator;
        address pool;
        uint24 poolFee;
        // Per-token setters — each only applies while the registry's current value is
        // still zero (first-time bind); a non-zero existing value is left untouched.
        // Registry4626._requireBindingWritable blocks any non-owner (authorized factory,
        // which is how this helper is meant to be deployed) from overwriting an existing
        // non-zero binding — rebinding an already-set field always requires the registry
        // owner acting directly, never this helper. See `_requireBindingWritable` in
        // Registry4626.sol.
        address vault;
        address wrapper;
        address shareOFT;
        address oracle;
        address gaugeController;
        // Optional Solana omnichain mesh config (Registry4626.OmnichainVaultMeshConfig):
        bool setOmnichainMesh;
        IRegistry4626.OmnichainVaultMeshConfig omnichainMesh;
        // Optional Solana ShareOFT peer (bytes32 — Solana pubkeys don't fit `address`):
        bool setSolanaShareOFTPeer;
        uint32 solanaEid;
        bytes32 solanaShareOFTPeer;
        // Optional ve(3,3) bribe depot wiring — requires `bribesFactory` to be configured:
        bool createBribeDepot;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress();
        registry = IRegistry4626(_registry);
    }

    // =================================
    // ADMIN
    // =================================

    /// @notice Repoint this helper at a different Registry4626 (e.g. a new greenfield epoch).
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = IRegistry4626(_registry);
        emit RegistrySet(_registry);
    }

    /// @notice Configure the ve(3,3) bribes factory once that stack is deployed. Leave unset
    ///         (default) to keep `createBribeDepot` requests reverting instead of silently
    ///         no-op'ing.
    function setBribesFactory(address _bribesFactory) external onlyOwner {
        bribesFactory = _bribesFactory;
        emit BribesFactorySet(_bribesFactory);
    }

    // =================================
    // CORE
    // =================================

    /**
     * @notice Register (if needed) and/or patch a token's Registry4626 entry, and optionally
     *         wire its Solana omnichain mesh config / Solana ShareOFT peer / bribe depot, all
     *         in one transaction. Idempotent — safe to re-run with the same params.
     */
    function bootstrapToken(BootstrapParams calldata p) external onlyOwner returns (address bribeDepot) {
        IRegistry4626.TokenInfo memory info = registry.getTokenInfo(p.token);
        if (info.token == address(0)) {
            registry.registerToken(p.token, p.name, p.symbol, p.creator, p.pool, p.poolFee);
            info = registry.getTokenInfo(p.token);
        }

        if (p.vault != address(0) && info.vault != p.vault) {
            registry.setVault(p.token, p.vault);
        }
        if (p.wrapper != address(0) && info.wrapper != p.wrapper) {
            registry.setWrapperForToken(p.token, p.wrapper);
        }
        if (p.shareOFT != address(0) && info.shareOFT != p.shareOFT) {
            registry.setShareOFTForToken(p.token, p.shareOFT);
        }
        if (p.oracle != address(0) && info.oracle != p.oracle) {
            registry.setOracleForToken(p.token, p.oracle);
        }
        if (p.gaugeController != address(0) && info.gaugeController != p.gaugeController) {
            registry.setGaugeControllerForToken(p.token, p.gaugeController);
        }

        if (p.setOmnichainMesh) {
            _reconcileOmnichainMesh(p.token, p.omnichainMesh);
        }

        if (p.setSolanaShareOFTPeer) {
            _reconcileSolanaShareOFTPeer(p.token, p.solanaEid, p.solanaShareOFTPeer);
        }

        if (p.createBribeDepot) {
            if (bribesFactory == address(0)) revert BribesFactoryNotConfigured();
            address vaultForDepot = p.vault != address(0) ? p.vault : info.vault;
            if (vaultForDepot == address(0)) revert ZeroAddress();
            bribeDepot = IBribesFactory4626(bribesFactory).getOrCreateBribeDepot(vaultForDepot);
            if (bribeDepot == address(0)) revert ZeroAddress();
            emit BribeDepotWired(p.token, vaultForDepot, bribeDepot);
        }

        emit TokenBootstrapped(p.token);
    }

    // =================================
    // VIEWS
    // =================================

    /// @notice Convenience lookup alongside a token's registry data. Returns address(0) if the
    ///         bribes factory isn't configured or no depot has been created for the vault yet.
    function getBribeDepot(address vault) external view returns (address) {
        if (bribesFactory == address(0) || vault == address(0)) return address(0);
        return IBribesFactory4626View(bribesFactory).bribeDepotOf(vault);
    }

    // =================================
    // INTERNAL
    // =================================

    function _reconcileOmnichainMesh(address token, IRegistry4626.OmnichainVaultMeshConfig calldata cfg) internal {
        IRegistry4626.OmnichainVaultMeshConfig memory current = registry.getOmnichainVaultMesh(token);
        bool alreadyMatches = current.solanaEid == cfg.solanaEid && current.hubComposer == cfg.hubComposer
            && current.assetMeshToken == cfg.assetMeshToken && current.shareMeshToken == cfg.shareMeshToken
            && current.solanaAssetMint == cfg.solanaAssetMint && current.enabled == cfg.enabled;
        if (!alreadyMatches && !_hasNonZeroOmnichainMesh(current)) {
            registry.setOmnichainVaultMesh(token, cfg);
        }
    }

    function _reconcileSolanaShareOFTPeer(address token, uint32 solanaEid, bytes32 peer) internal {
        if (registry.getRemoteOFTPeerBytes32(token, solanaEid) != peer) {
            registry.setRemoteOFTPeerBytes32(token, solanaEid, peer);
        }
    }

    function _hasNonZeroOmnichainMesh(IRegistry4626.OmnichainVaultMeshConfig memory cfg) internal pure returns (bool) {
        return cfg.solanaEid != 0 || cfg.hubComposer != address(0) || cfg.assetMeshToken != address(0)
            || cfg.shareMeshToken != address(0) || cfg.solanaAssetMint != bytes32(0) || cfg.enabled;
    }
}
