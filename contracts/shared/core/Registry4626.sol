// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Registry4626ViewLib} from "@4626/shared/core/Registry4626ViewLib.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

/**
 * @title Registry4626
 * @author 0xakita.eth
 * @notice Registry for 4626 deployments and configs (supports creator, agent, and future ecosystems).
 * @dev Used by factories, vaults, and OFTs to resolve per-lane addresses via vaultKind / token registration.
 */
contract Registry4626 is IRegistry4626, Ownable {
    // =================================
    // CONSTANTS
    // =================================

    uint256 public constant MAX_SUPPORTED_CHAINS = 99;
    uint256 public constant MAX_REGISTERED_TOKENS = 999999; // per-lane limit; agent and future ecosystems have their own caps if needed
    /// @notice Cap distinct remote-OFT EIDs per token so owner removal cannot be gas-bricked (ODA-430-F10).
    uint256 public constant MAX_REMOTE_OFT_CHAINS_PER_TOKEN = 64;

    // =================================
    // CREATOR COIN STORAGE
    // =================================

    /// @notice Lane token info (creator coins, agent tokens, future ecosystems) by token address
    mapping(address => TokenInfo) private tokenInfos; 

    /// @notice Reverse lookup: vault → token
    mapping(address => address) public vaultToToken;

    /// @notice Reverse lookup: shareOFT → token
    mapping(address => address) public shareOFTToToken;

    /// @notice Reverse lookup: wrapper → token
    mapping(address => address) public wrapperToToken;

    /// @notice Reverse lookup: oracle → token
    mapping(address => address) public oracleToToken;

    /// @notice Reverse lookup: gaugeController → token
    mapping(address => address) public gaugeControllerToToken;

    /// @notice Reverse lookup: canonicalWallet → token
    mapping(address => address) public canonicalWalletToToken;

    /// @notice All registered token addresses (across creator, agent, future lanes)
    address[] private registeredTokens;

    /// @notice Authorized factories that can register tokens for lanes
    mapping(address => bool) public authorizedFactories;
    /// @dev FIX: AUDIT-2026-07-01-M17 — optional codehash pin for authorized factories.
    mapping(address => bytes32) public approvedFactoryCodehashes;

    error FactoryCodehashMismatch(address factory, bytes32 expected, bytes32 actual);

    /// @notice When false (default), per-token vault/shareOFT/wrapper/oracle/gauge bindings
    ///         are one-shot: first non-zero set sticks. Owner may enable rebind for emergency
    ///         migration only (audit M-08).
    bool public liveRebindEnabled;

    // =================================
    // REMOTE OFT PEER TRACKING (Hub-Centric)
    // =================================

    /// @notice Remote OFT addresses per token per chain EID
    /// @dev token → chainEid → remoteOFTAddress
    mapping(address => mapping(uint32 => address)) public remoteOFTPeers;

    /// @notice All chain EIDs that have a remote OFT for a given token
    mapping(address => uint32[]) private remoteOFTChains;

    /// @notice Reverse lookup: remote OFT address → token (for cross-chain lookups)
    /// @dev Used when a remote OFT sends a lottery entry and we need to identify the creator
    mapping(address => address) public remoteOFTToToken;

    /// @notice Remote OFT peers for non-EVM chains keyed by bytes32 identity (e.g., Solana pubkey)
    /// @dev token → chainEid → remoteOFTBytes32
    mapping(address => mapping(uint32 => bytes32)) public remoteOFTPeersBytes32;

    /// @notice Chain EIDs that have bytes32 peers for a given token
    mapping(address => uint32[]) private remoteOFTChainsBytes32;

    /// @notice Reverse lookup: remote bytes32 peer → token
    mapping(bytes32 => address) public remoteOFTBytes32ToToken;

    /// @notice Per-token Solana OVault mesh metadata.
    mapping(address => OmnichainVaultMeshConfig) private omnichainVaultMeshConfigs;
    mapping(address => bool) private omnichainVaultMeshSet;

    /// @notice Agent lane integration metadata keyed by underlying token
    mapping(address => AgentIntegrationMeta) private agentIntegrationMetas;

    /// @notice One-shot latch for `setAgentIntegrationMeta` (SCAN-M3).
    /// @dev Creator-kind meta can be all-zero (VaultKind.Creator == 0), so we
    ///      cannot detect "already written" from the struct alone.
    mapping(address => bool) private agentIntegrationMetaSet;

    // =================================
    // CHAIN CONFIGURATION
    // =================================

    /// @notice Chain config by chain ID
    mapping(uint256 => ChainConfig) private chainConfigs;

    /// @notice All supported chains
    uint256[] private supportedChains;

    /// @notice Current chain ID
    uint256 private currentChainId;

    // =================================
    // LAYERZERO CONFIGURATION
    // =================================

    /// @notice LayerZero endpoints by chain
    mapping(uint256 => address) public layerZeroEndpoints;

    /// @notice Chain ID to LZ EID mapping
    mapping(uint256 => uint32) public chainIdToEid;
    mapping(uint32 => uint256) public eidToChainId;

    /// @notice LZ config per chain
    mapping(uint256 => LzConfig) public lzConfigs;

    /// @notice Default LZ config for standard chains
    LzConfig public defaultLzConfig;

    /// @notice Common LZ endpoint (fallback)
    address public immutable layerZeroCommonEndpoint;

    // =================================
    // ECOSYSTEM CONTRACTS
    // =================================

    /// @notice Lottery managers by chain
    mapping(uint256 => address) public lotteryManagers;

    /// @notice Gauge controllers by chain
    mapping(uint256 => address) public gaugeControllers;

    /// @notice Gas reserves by chain
    mapping(uint256 => address) public gasReserves;

    /// @notice Hub chain configuration
    uint256 public hubChainId = 8453; // Base
    uint32 public hubChainEid = 30184;

    // =================================
    // ADDITIONAL EVENTS
    // =================================

    event FactoryAuthorized(address indexed factory, bool status);
    event HubChainSet(uint256 chainId, uint32 eid);
    event LiveRebindEnabledUpdated(bool enabled);
    event TokenBindingUpdated(address indexed token, bytes32 indexed field, address oldValue, address newValue);
    event CreatorUpdated(address indexed token, address indexed previous, address indexed next);

    // =================================
    // ERRORS
    // =================================

    error ChainAlreadyRegistered(uint256 chainId);
    error ChainNotRegistered(uint256 chainId);
    error TokenAlreadyRegistered(address token);
    error TokenNotRegistered(address token);
    error TooManyChains();
    error TooManyTokens();
    error CanonicalWalletAlreadyInUse(address wallet, address token);
    error ZeroAddress();
    error ZeroBytes32();
    error NotAuthorized();
    /// @notice Existing non-zero binding cannot be replaced while live rebind is disabled.
    error BindingAlreadySet(address token, address existing);
    /// @notice Live rebind of token bindings is owner-only when enabled.
    error LiveRebindOwnerOnly();
    /// @notice Reverse map already points at another token (M-NEW-03).
    error ReverseMappingConflict(address entity, address existingToken, address attemptedToken);
    /// @notice Non-EVM reverse map already points at another token.
    error ReverseMappingBytes32Conflict(bytes32 entity, address existingToken, address attemptedToken);
    error InvalidChainEid();
    error EidAlreadyMapped(uint32 eid, uint256 existingChainId, uint256 attemptedChainId);
    error TooManyRemoteOftChains();
    error OwnershipRenounceDisabled();

    // =================================
    // MODIFIERS
    // =================================

    enum BindingKind {
        Vault,
        ShareOFT,
        Wrapper,
        Oracle,
        GaugeController
    }

    enum EcosystemContractKind {
        LotteryManager,
        GaugeController,
        GasReserve
    }

    modifier onlyAuthorizedOrOwner() {
        if (msg.sender != owner()) {
            if (!authorizedFactories[msg.sender]) revert NotAuthorized();
            // ODA-465-6: re-check codehash pin at call time (not only at authorization).
            _requireFactoryCodehash(msg.sender);
        }
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(address _initialOwner) Ownable(_initialOwner) {
        if (_initialOwner == address(0)) revert ZeroAddress();

        currentChainId = block.chainid;

        // Common LayerZero endpoint address
        layerZeroCommonEndpoint = address(bytes20(hex"1a44076050125825900e736c501f859c50fe728c"));

        // Pre-configure Base (hub chain)
        layerZeroEndpoints[8453] = layerZeroCommonEndpoint;
        chainIdToEid[8453] = 30184;
        eidToChainId[30184] = 8453;

        emit CurrentChainSet(currentChainId);
    }

    // =================================
    // FACTORY AUTHORIZATION
    // =================================

    /**
     * @notice Authorize a factory to register tokens
     */
    function setAuthorizedFactory(address _factory, bool _authorized) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        // ODA-495-M02: pin-check only when granting. A factory whose live bytecode has
        // diverged from its pin is exactly the one that must stay revocable, so enforcing
        // the check on de-authorization would block its own removal.
        if (_authorized) _requireFactoryCodehash(_factory);
        authorizedFactories[_factory] = _authorized;
        emit FactoryAuthorized(_factory, _authorized);
    }

    function approveFactoryCodehash(address factory, bytes32 codehash) external onlyOwner {
        if (factory == address(0)) revert ZeroAddress();
        approvedFactoryCodehashes[factory] = codehash;
    }

    // =================================
    // CREATOR COIN MANAGEMENT
    // =================================

    /**
     * @notice Register a new lane token
     */
    function registerToken(
        address _token,
        string calldata _name,
        string calldata _symbol,
        address _creator,
        address _pool,
        uint24 _poolFee
    ) external override onlyAuthorizedOrOwner {
        if (_token == address(0)) revert ZeroAddress();
        if (_creator == address(0)) revert ZeroAddress();
        if (tokenInfos[_token].token != address(0)) revert TokenAlreadyRegistered(_token);
        if (registeredTokens.length >= MAX_REGISTERED_TOKENS) revert TooManyTokens();

        tokenInfos[_token] = TokenInfo({
            token: _token,
            name: _name,
            symbol: _symbol,
            vault: address(0),
            shareOFT: address(0),
            wrapper: address(0),
            oracle: address(0),
            gaugeController: address(0),
            creator: _creator,
            canonicalWallet: address(0),
            pool: _pool,
            poolFee: _poolFee,
            primaryChainId: currentChainId,
            isActive: true,
            registeredAt: block.timestamp
        });

        registeredTokens.push(_token);

        emit TokenRegistered(_token, _name, _symbol, _creator, address(0), address(0), address(0));
    }

    /**
     * @notice Owner correction for a token's immutable-by-default `creator` authority (ODA-430-F3).
     * @dev Factories supply `creator` at registration with no signature check; this recovers from
     *      front-run / mis-registration without requiring a global live rebind.
     */
    function setCreator(address _token, address _creator) external override onlyOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_creator == address(0)) revert ZeroAddress();

        address previous = tokenInfos[_token].creator;
        if (previous == _creator) return;

        // ODA-465-5: clearing creator authority must also clear the old canonical wallet
        // and its reverse map so the previous wallet cannot keep attribution.
        address oldWallet = tokenInfos[_token].canonicalWallet;
        if (oldWallet != address(0)) {
            if (canonicalWalletToToken[oldWallet] == _token) {
                delete canonicalWalletToToken[oldWallet];
            }
            tokenInfos[_token].canonicalWallet = address(0);
            emit CanonicalWalletSet(_token, address(0));
        }

        tokenInfos[_token].creator = _creator;
        emit CreatorUpdated(_token, previous, _creator);
        emit TokenUpdated(_token);
    }

    /// @notice Disabled — renouncing would brick all factory/auth administration (ODA-430-F14).
    function renounceOwnership() public pure override {
        revert OwnershipRenounceDisabled();
    }

    /**
     * @notice Enable/disable live rebind of per-token core bindings (M-08).
     * @dev Default false. When true, only the owner may replace an already-set binding.
     */
    function setLiveRebindEnabled(bool enabled) external onlyOwner {
        liveRebindEnabled = enabled;
        emit LiveRebindEnabledUpdated(enabled);
    }

    /// @dev First set is always allowed. Replacing a non-zero binding requires owner + liveRebindEnabled.
    function _requireBindingWritable(address token, address existing, address next) internal view {
        if (existing == address(0) || existing == next) return;
        if (!liveRebindEnabled) revert BindingAlreadySet(token, existing);
        if (msg.sender != owner()) revert LiveRebindOwnerOnly();
    }

    /**
     * @notice Set vault address for a token
     */
    function setVault(address _token, address _vault) external override onlyAuthorizedOrOwner {
        _setTokenBinding(_token, _vault, BindingKind.Vault);
    }

    /**
     * @notice Set ShareOFT address for a token
     */
    function setShareOFTForToken(address _token, address _shareOFT) external override onlyAuthorizedOrOwner {
        _setTokenBinding(_token, _shareOFT, BindingKind.ShareOFT);
    }

    /**
     * @notice Set wrapper address for a token
     */
    function setWrapperForToken(address _token, address _wrapper) external override onlyAuthorizedOrOwner {
        _setTokenBinding(_token, _wrapper, BindingKind.Wrapper);
    }

    /**
     * @notice Set oracle address for a token
     */
    function setOracleForToken(address _token, address _oracle) external override onlyAuthorizedOrOwner {
        _setTokenBinding(_token, _oracle, BindingKind.Oracle);
    }

    /**
     * @notice Set gauge controller address for a token
     */
    function setGaugeControllerForToken(address _token, address _gaugeController)
        external
        override
        onlyAuthorizedOrOwner
    {
        _setTokenBinding(_token, _gaugeController, BindingKind.GaugeController);
    }

    /**
     * @notice Set active status for a token
     */
    function setTokenStatus(address _token, bool _isActive) external override onlyOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);

        tokenInfos[_token].isActive = _isActive;

        emit TokenStatusChanged(_token, _isActive);
    }

    /**
     * @notice Set the canonical smart wallet (ERC-4337) for a creator
     * @dev This wallet serves as the creator's unified on-chain identity:
     *      - ERC-4337 account (UserOp sender, gas sponsorship via paymaster)
     *      - ERC-8004 agent identity (on-chain agent registration)
     *      - Vault owner and primary asset holder
     *      - Lottery prize recipient
     *      Auth (ODA-495-H01 / ODA-465-3):
     *      - Registry owner may set or override any wallet.
     *      - Otherwise only the token `creator` may set, and only as a self-bind
     *        (`msg.sender == creator && msg.sender == _wallet`). Creators cannot bind
     *        an arbitrary third-party wallet; strangers cannot claim a token by being `_wallet`.
     *      - Replacing a different non-zero binding requires `liveRebindEnabled` and owner
     *        (same one-shot latch as other token bindings).
     */
    function setCanonicalWallet(address _token, address _wallet) external override {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_wallet == address(0)) revert ZeroAddress();

        address creator = tokenInfos[_token].creator;
        if (msg.sender != owner()) {
            // Creator self-bind only — not "any wallet claims itself for any token".
            if (msg.sender != creator || msg.sender != _wallet) revert NotAuthorized();
        }

        address oldWallet = tokenInfos[_token].canonicalWallet;
        _requireBindingWritable(_token, oldWallet, _wallet);

        // Enforce a 1:1 canonical wallet reverse mapping.
        // Without this check, a creator could "claim" another creator's wallet and hijack attribution.
        address existing = canonicalWalletToToken[_wallet];
        if (existing != address(0) && existing != _token) {
            revert CanonicalWalletAlreadyInUse(_wallet, existing);
        }

        // Clear old reverse mapping if exists
        if (oldWallet != address(0) && oldWallet != _wallet) {
            // Defensive: only delete if the reverse mapping still points to this token.
            // (If state is already inconsistent from older deployments, don't clobber another token.)
            if (canonicalWalletToToken[oldWallet] == _token) {
                delete canonicalWalletToToken[oldWallet];
            }
        }

        tokenInfos[_token].canonicalWallet = _wallet;
        canonicalWalletToToken[_wallet] = _token;

        emit CanonicalWalletSet(_token, _wallet);
    }

    /**
     * @notice Configure Solana OVault mesh metadata for a creator coin.
     * @dev Enabled configs must be fully populated.
     */
    function setOmnichainVaultMesh(address _token, OmnichainVaultMeshConfig calldata _cfg)
        external
        override
        onlyAuthorizedOrOwner
    {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);

        if (_cfg.enabled) {
            if (
                _cfg.solanaEid == 0 || _cfg.hubComposer == address(0) || _cfg.assetMeshToken == address(0)
                    || _cfg.shareMeshToken == address(0)
            ) {
                revert ZeroAddress();
            }
            if (_cfg.solanaAssetMint == bytes32(0)) revert ZeroBytes32();
        }

        if (omnichainVaultMeshSet[_token]) {
            OmnichainVaultMeshConfig memory current = omnichainVaultMeshConfigs[_token];
            bool alreadyMatches = current.solanaEid == _cfg.solanaEid && current.hubComposer == _cfg.hubComposer
                && current.assetMeshToken == _cfg.assetMeshToken && current.shareMeshToken == _cfg.shareMeshToken
                && current.solanaAssetMint == _cfg.solanaAssetMint && current.enabled == _cfg.enabled;
            if (!alreadyMatches) {
                if (!liveRebindEnabled) revert BindingAlreadySet(_token, current.hubComposer);
                if (msg.sender != owner()) revert LiveRebindOwnerOnly();
            }
        }

        omnichainVaultMeshConfigs[_token] = _cfg;
        omnichainVaultMeshSet[_token] = true;

        emit OmnichainVaultMeshConfigured(
            _token,
            _cfg.solanaEid,
            _cfg.hubComposer,
            _cfg.assetMeshToken,
            _cfg.shareMeshToken,
            _cfg.solanaAssetMint,
            _cfg.enabled
        );
    }

    /**
     * @notice Update token pool info
     */
    function setPoolForToken(address _token, address _pool, uint24 _poolFee) external onlyOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);

        tokenInfos[_token].pool = _pool;
        tokenInfos[_token].poolFee = _poolFee;

        emit TokenUpdated(_token);
    }

    // =================================
    // REMOTE OFT PEER MANAGEMENT (Hub-Centric)
    // =================================

    /**
     * @notice Register a remote OFT deployment for a creator coin
     * @dev Called when a CreatorShareOFT is deployed on a remote chain.
     *      This maps the creator coin to its remote OFT address on a given chain.
     * @param _token Creator coin address (hub chain)
     * @param _chainEid LayerZero EID of the remote chain
     * @param _remoteOFT Address of the CreatorShareOFT on the remote chain
     */
    function setRemoteOFTPeer(address _token, uint32 _chainEid, address _remoteOFT)
        external
        override
        onlyAuthorizedOrOwner
    {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_chainEid == 0) revert InvalidChainEid();
        if (_remoteOFT == address(0)) revert ZeroAddress();

        address oldRemoteOFT = remoteOFTPeers[_token][_chainEid];
        // ODA-430-F8 / 422-F3: one-shot peer per (token, eid); owner+liveRebind to replace.
        _requireBindingWritable(_token, oldRemoteOFT, _remoteOFT);
        if (oldRemoteOFT == _remoteOFT) return;

        // Clear old reverse mapping if exists
        if (oldRemoteOFT != address(0)) {
            // FIX: F-11 — only delete reverse mapping if it points to the expected token,
            // and no other EID for this token still references it (ODA-430-F2 / 422-F4).
            if (remoteOFTToToken[oldRemoteOFT] == _token && !_remoteOFTStillReferenced(_token, oldRemoteOFT, _chainEid))
            {
                delete remoteOFTToToken[oldRemoteOFT];
            }
        } else {
            // New chain — track it
            _trackRemoteOFTChain(remoteOFTChains[_token], _chainEid);
        }

        // M-NEW-03: reverse map is single-valued — block remapping to a different token.
        address reverseOwner = remoteOFTToToken[_remoteOFT];
        if (reverseOwner != address(0) && reverseOwner != _token) {
            revert ReverseMappingConflict(_remoteOFT, reverseOwner, _token);
        }


        remoteOFTPeers[_token][_chainEid] = _remoteOFT;
        remoteOFTToToken[_remoteOFT] = _token;

        emit RemoteOFTPeerSet(_token, _chainEid, _remoteOFT);
    }

    /**
     * @notice Remove a remote OFT peer for a creator coin
     */
    function removeRemoteOFTPeer(address _token, uint32 _chainEid) external override onlyOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);

        address remoteOFT = remoteOFTPeers[_token][_chainEid];
        if (remoteOFT == address(0)) return;

        delete remoteOFTPeers[_token][_chainEid];

        // Remove from chain list (swap-and-pop)
        _untrackRemoteOFTChain(remoteOFTChains[_token], _chainEid);

        // ODA-430-F2 / 422-F4: keep reverse map when another EID still points at this OFT.
        if (!_remoteOFTStillReferenced(_token, remoteOFT, 0)) {
            delete remoteOFTToToken[remoteOFT];
        }

        emit RemoteOFTPeerRemoved(_token, _chainEid);
    }

    /**
     * @notice Get the remote OFT address for a creator coin on a specific chain
     */
    function getRemoteOFTPeer(address _token, uint32 _chainEid) external view override returns (address) {
        return remoteOFTPeers[_token][_chainEid];
    }

    /**
     * @notice Get all remote chain EIDs that have a deployed OFT for a creator coin
     */
    function getRemoteOFTChains(address _token) external view override returns (uint32[] memory) {
        return remoteOFTChains[_token];
    }

    /**
     * @notice Get all remote OFT peers for a creator coin
     * @return eids Array of chain EIDs
     * @return ofts Array of remote OFT addresses (parallel with eids)
     */
    function getAllRemoteOFTPeers(address _token)
        external
        view
        override
        returns (uint32[] memory eids, address[] memory ofts)
    {
        return Registry4626ViewLib.getAllRemoteOFTPeers(address(this), _token);
    }

    /**
     * @notice Get the creator coin for a remote OFT address (reverse lookup)
     * @dev Used when a remote OFT sends a lottery entry to identify the creator
     */
    function getTokenForRemoteOFT(address _remoteOFT) external view override returns (address) {
        return remoteOFTToToken[_remoteOFT];
    }

    /**
     * @notice Sets non-EVM remote OFT peer mapping for a registered creator coin.
     * @dev Uses bytes32 remote identity so Solana pubkeys can be represented losslessly.
     */
    function setRemoteOFTPeerBytes32(address _token, uint32 _chainEid, bytes32 _remoteOFT)
        external
        override
        onlyAuthorizedOrOwner
    {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_chainEid == 0) revert InvalidChainEid();
        if (_remoteOFT == bytes32(0)) revert ZeroBytes32();

        bytes32 oldPeer = remoteOFTPeersBytes32[_token][_chainEid];
        // ODA-430-F8 / 422-F3: one-shot peer per (token, eid); owner+liveRebind to replace.
        if (oldPeer != bytes32(0) && oldPeer != _remoteOFT) {
            if (!liveRebindEnabled) {
                revert BindingAlreadySet(_token, address(uint160(uint256(oldPeer))));
            }
            if (msg.sender != owner()) revert LiveRebindOwnerOnly();
        }
        if (oldPeer == _remoteOFT) return;

        if (oldPeer == bytes32(0)) {
            _trackRemoteOFTChain(remoteOFTChainsBytes32[_token], _chainEid);
        } else if (
            remoteOFTBytes32ToToken[oldPeer] == _token
                && !_remoteOFTBytes32StillReferenced(_token, oldPeer, _chainEid)
        ) {
            delete remoteOFTBytes32ToToken[oldPeer];
        }

        address reverseOwner = remoteOFTBytes32ToToken[_remoteOFT];
        if (reverseOwner != address(0) && reverseOwner != _token) {
            revert ReverseMappingBytes32Conflict(_remoteOFT, reverseOwner, _token);
        }


        remoteOFTPeersBytes32[_token][_chainEid] = _remoteOFT;
        remoteOFTBytes32ToToken[_remoteOFT] = _token;
        emit RemoteOFTPeerBytes32Set(_token, _chainEid, _remoteOFT);
    }

    /**
     * @notice Removes non-EVM remote OFT peer mapping.
     */
    function removeRemoteOFTPeerBytes32(address _token, uint32 _chainEid) external override onlyOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_chainEid == 0) revert InvalidChainEid();

        bytes32 oldPeer = remoteOFTPeersBytes32[_token][_chainEid];
        if (oldPeer == bytes32(0)) return;

        delete remoteOFTPeersBytes32[_token][_chainEid];

        _untrackRemoteOFTChain(remoteOFTChainsBytes32[_token], _chainEid);

        if (!_remoteOFTBytes32StillReferenced(_token, oldPeer, 0)) {
            delete remoteOFTBytes32ToToken[oldPeer];
        }

        emit RemoteOFTPeerBytes32Removed(_token, _chainEid);
    }

    /**
     * @notice Returns bytes32 peer identity for token + EID.
     */
    function getRemoteOFTPeerBytes32(address _token, uint32 _chainEid) external view override returns (bytes32) {
        return remoteOFTPeersBytes32[_token][_chainEid];
    }

    /**
     * @notice Returns all EIDs with bytes32 peers for token.
     */
    function getRemoteOFTChainsBytes32(address _token) external view override returns (uint32[] memory) {
        return remoteOFTChainsBytes32[_token];
    }

    /**
     * @notice Returns all bytes32 peers for token.
     */
    function getAllRemoteOFTPeersBytes32(address _token)
        external
        view
        override
        returns (uint32[] memory eids, bytes32[] memory peers)
    {
        return Registry4626ViewLib.getAllRemoteOFTPeersBytes32(address(this), _token);
    }

    /**
     * @notice Reverse lookup for bytes32 remote OFT identity.
     */
    function getTokenForRemoteOFTBytes32(bytes32 _remoteOFT) external view override returns (address) {
        return remoteOFTBytes32ToToken[_remoteOFT];
    }

    // =================================
    // CREATOR COIN GETTERS
    // =================================

    function getTokenInfo(address _token) external view override returns (TokenInfo memory) {
        return tokenInfos[_token];
    }

    function getVaultForToken(address _token) external view override returns (address) {
        return tokenInfos[_token].vault;
    }

    function getShareOFTForToken(address _token) external view override returns (address) {
        return tokenInfos[_token].shareOFT;
    }

    function getWrapperForToken(address _token) external view override returns (address) {
        return tokenInfos[_token].wrapper;
    }

    function getOracleForToken(address _token) external view override returns (address) {
        return tokenInfos[_token].oracle;
    }

    function getGaugeControllerForToken(address _token) external view override returns (address) {
        return tokenInfos[_token].gaugeController;
    }

    /// @dev FIX: F-25 — WARNING: this function returns an unbounded array. It will revert
    /// when `registeredTokens` grows large enough to exceed the block gas limit for on-chain
    /// callers. Use `getTokensPaginated` for bounded access.
    function getAllTokens() external view override returns (address[] memory) {
        return registeredTokens;
    }

    // FIX: F-25 — paginated access for large registries; prevents block gas limit DoS
    function getTokensPaginated(uint256 offset, uint256 limit) external view returns (address[] memory result) {
        return Registry4626ViewLib.getTokensPaginated(address(this), offset, limit);
    }

    function isTokenRegistered(address _token) external view override returns (bool) {
        return tokenInfos[_token].token != address(0);
    }

    function isTokenActive(address _token) external view override returns (bool) {
        return tokenInfos[_token].token != address(0) && tokenInfos[_token].isActive;
    }

    function getTokenCount() external view returns (uint256) {
        return registeredTokens.length;
    }

    function getRegisteredTokenAt(uint256 index) external view returns (address) {
        return registeredTokens[index];
    }

    /**
     * @notice Get token address from vault
     */
    function getTokenForVault(address _vault) external view returns (address) {
        return vaultToToken[_vault];
    }

    /**
     * @notice Compatibility helper for gauge voting registry-gates
     * @dev A vault is considered "registered" once it's mapped to a registered token.
     */
    function isRegisteredVault(address _vault) external view returns (bool) {
        return vaultToToken[_vault] != address(0);
    }

    /**
     * @notice Get token address from ShareOFT
     */
    function getTokenForShareOFT(address _shareOFT) external view returns (address) {
        return shareOFTToToken[_shareOFT];
    }

    /**
     * @notice Get the canonical smart wallet for a creator
     * @param _token Lane token address
     * @return The creator's canonical ERC-4337 smart wallet (address(0) if not set)
     */
    function getCanonicalWallet(address _token) external view override returns (address) {
        return tokenInfos[_token].canonicalWallet;
    }

    /**
     * @notice Get the token for a canonical wallet (reverse lookup)
     * @param _wallet Canonical smart wallet address
     * @return The creator coin address (address(0) if not found)
     */
    function getTokenForCanonicalWallet(address _wallet) external view override returns (address) {
        return canonicalWalletToToken[_wallet];
    }

    function getOmnichainVaultMesh(address _token) external view override returns (OmnichainVaultMeshConfig memory) {
        return omnichainVaultMeshConfigs[_token];
    }

    function isSolanaDepositEligible(address _token) external view override returns (bool) {
        return Registry4626ViewLib.isSolanaDepositEligible(address(this), _token);
    }

    function getSolanaAssetMint(address _token) external view override returns (bytes32) {
        return omnichainVaultMeshConfigs[_token].solanaAssetMint;
    }

    // =================================
    // CHAIN CONFIGURATION
    // =================================

    function registerChain(uint256 _chainId, string calldata _chainName, address _wrappedNativeToken, bool _isActive)
        external
        override
        onlyOwner
    {
        if (_wrappedNativeToken == address(0)) revert ZeroAddress();
        if (chainConfigs[_chainId].chainId != 0) revert ChainAlreadyRegistered(_chainId);
        if (supportedChains.length >= MAX_SUPPORTED_CHAINS) revert TooManyChains();

        chainConfigs[_chainId] = ChainConfig({
            chainId: _chainId,
            chainName: _chainName,
            wrappedNativeToken: _wrappedNativeToken,
            wrappedNativeSymbol: _getDefaultWrappedNativeSymbol(_chainId),
            poolManager: address(0),
            swapRouter: address(0),
            positionManager: address(0),
            quoter: address(0),
            chainlinkNativeFeed: address(0),
            isActive: _isActive
        });

        supportedChains.push(_chainId);

        emit ChainRegistered(_chainId, _chainName);
    }

    function setDexInfrastructure(
        uint256 _chainId,
        address _poolManager,
        address _swapRouter,
        address _positionManager,
        address _quoter
    ) external override onlyOwner {
        if (chainConfigs[_chainId].chainId == 0) revert ChainNotRegistered(_chainId);

        chainConfigs[_chainId].poolManager = _poolManager;
        chainConfigs[_chainId].swapRouter = _swapRouter;
        chainConfigs[_chainId].positionManager = _positionManager;
        chainConfigs[_chainId].quoter = _quoter;

        emit ChainUpdated(_chainId);
    }

    function setChainStatus(uint256 _chainId, bool _isActive) external override onlyOwner {
        if (chainConfigs[_chainId].chainId == 0) revert ChainNotRegistered(_chainId);

        chainConfigs[_chainId].isActive = _isActive;

        emit ChainStatusChanged(_chainId, _isActive);
    }

    function getChainConfig(uint256 _chainId) external view override returns (ChainConfig memory) {
        return chainConfigs[_chainId];
    }

    function getSupportedChains() external view override returns (uint256[] memory) {
        return supportedChains;
    }

    function getCurrentChainId() external view override returns (uint256) {
        return currentChainId;
    }

    function isChainSupported(uint256 _chainId) external view override returns (bool) {
        return chainConfigs[_chainId].isActive && chainConfigs[_chainId].chainId != 0;
    }

    // =================================
    // LAYERZERO CONFIGURATION
    // =================================

    function setLayerZeroEndpoint(uint256 _chainId, address _endpoint) external override onlyOwner {
        if (_endpoint == address(0)) revert ZeroAddress();

        layerZeroEndpoints[_chainId] = _endpoint;

        emit LayerZeroEndpointUpdated(_chainId, _endpoint);
    }

    function getLayerZeroEndpoint(uint256 _chainId) external view override returns (address) {
        return _getLayerZeroEndpointOrCommon(_chainId);
    }

    function setChainIdToEid(uint256 _chainId, uint32 _eid) external override onlyOwner {
        _setChainEidMapping(_chainId, _eid);
        emit ChainIdToEidUpdated(_chainId, _eid);
    }

    function getEidForChainId(uint256 _chainId) external view override returns (uint32) {
        return chainIdToEid[_chainId];
    }

    function getChainIdForEid(uint32 _eid) external view override returns (uint256) {
        return eidToChainId[_eid];
    }

    function getLzConfig(uint256 _chainId) external view override returns (LzConfig memory) {
        return lzConfigs[_chainId];
    }

    function getEffectiveLzConfig(uint256 _chainId) external view override returns (LzConfig memory) {
        LzConfig memory config = lzConfigs[_chainId];

        if (!(config.useCustomOApp || config.isConfigured)) {
            config = defaultLzConfig;
        }

        // ODA-465-4: always overlay live chainIdToEid + layerZeroEndpoints, even when isConfigured.
        config.eid = chainIdToEid[_chainId];
        config.endpoint = _getLayerZeroEndpointOrCommon(_chainId);
        // ODA-430-F13: unmapped chains must not report configured with eid=0.
        if (config.eid == 0) {
            config.isConfigured = false;
        }
        return config;
    }

    /**
     * @notice Set full LZ config for a chain
     */
    // FIX: I-3 (audit `docs/audits/aristotle/oracle`) — `_chainId` was narrowed to
    // `uint16` while `lzConfigs`, `chainIdToEid`, etc. are keyed by `uint256`
    // everywhere else, making chains with id > 65535 unconfigurable via this function.
    function setLzConfig(
        uint256 _chainId,
        address _endpoint,
        uint32 _eid,
        address _sendLib,
        address _receiveLib,
        address _executor,
        address _dvn,
        address _lzReadDvn,
        uint64 _confirmations,
        bool _useCustomOApp
    ) external onlyOwner {
        if (_endpoint == address(0)) revert ZeroAddress();

        lzConfigs[_chainId] = LzConfig({
            endpoint: _endpoint,
            eid: _eid,
            sendLib: _sendLib,
            receiveLib: _receiveLib,
            executor: _executor,
            dvn: _dvn,
            lzReadDvn: _lzReadDvn,
            optionalDvns: new address[](0),
            confirmations: _confirmations,
            isConfigured: true,
            useCustomOApp: _useCustomOApp
        });

        layerZeroEndpoints[_chainId] = _endpoint;
        _setChainEidMapping(_chainId, _eid);

        emit LzConfigUpdated(_chainId);
    }

    /**
     * @notice Set default LZ config for standard chains
     */
    function setDefaultLzConfig(
        address _endpoint,
        address _sendLib,
        address _receiveLib,
        address _executor,
        address _dvn,
        address _lzReadDvn,
        uint64 _confirmations
    ) external onlyOwner {
        defaultLzConfig = LzConfig({
            endpoint: _endpoint,
            eid: 0,
            sendLib: _sendLib,
            receiveLib: _receiveLib,
            executor: _executor,
            dvn: _dvn,
            lzReadDvn: _lzReadDvn,
            optionalDvns: new address[](0),
            confirmations: _confirmations,
            isConfigured: true,
            useCustomOApp: false
        });
    }

    // =================================
    // ECOSYSTEM CONTRACTS
    // =================================

    function setLotteryManager(uint256 _chainId, address _manager) external override onlyOwner {
        _setEcosystemContract(_chainId, _manager, EcosystemContractKind.LotteryManager);
    }

    function getLotteryManager(uint256 _chainId) external view override returns (address) {
        return lotteryManagers[_chainId];
    }

    function setGaugeController(uint256 _chainId, address _controller) external override onlyOwner {
        _setEcosystemContract(_chainId, _controller, EcosystemContractKind.GaugeController);
    }

    function getGaugeController(uint256 _chainId) external view override returns (address) {
        return gaugeControllers[_chainId];
    }

    function setGasReserve(uint256 _chainId, address _reserve) external override onlyOwner {
        _setEcosystemContract(_chainId, _reserve, EcosystemContractKind.GasReserve);
    }

    function getGasReserve(uint256 _chainId) external view override returns (address) {
        return gasReserves[_chainId];
    }

    /**
     * @notice Set hub chain
     */
    function setHubChain(uint256 _chainId, uint32 _eid) external onlyOwner {
        hubChainId = _chainId;
        hubChainEid = _eid;
        emit HubChainSet(_chainId, _eid);
    }

    function isHubChain() external view override returns (bool) {
        return block.chainid == hubChainId;
    }

    // =================================
    // CHAIN LOOKUPS
    // =================================

    function getWrappedNativeToken(uint256 _chainId) external view override returns (address) {
        return chainConfigs[_chainId].wrappedNativeToken;
    }

    function getPoolManager(uint256 _chainId) external view override returns (address) {
        return chainConfigs[_chainId].poolManager;
    }

    function getSwapRouter(uint256 _chainId) external view override returns (address) {
        return chainConfigs[_chainId].swapRouter;
    }

    /**
     * @notice Get position manager for a chain
     */
    function getPositionManager(uint256 _chainId) external view returns (address) {
        return chainConfigs[_chainId].positionManager;
    }

    /**
     * @notice Get quoter for a chain
     */
    function getQuoter(uint256 _chainId) external view returns (address) {
        return chainConfigs[_chainId].quoter;
    }

    // =================================
    // AGENT INTEGRATION METADATA (lane meta — historical name)
    // =================================
    // `AgentIntegrationMeta` stores product-lane metadata for any VaultKind (creator or agent).
    // Rename to LaneIntegrationMeta only on a future registry epoch.
    // Auth matches `registerToken`: authorized factories (e.g. DeploymentBatcher) or owner.

    function setAgentIntegrationMeta(address token, AgentIntegrationMeta calldata meta)
        external
        onlyAuthorizedOrOwner
    {
        if (token == address(0)) revert ZeroAddress();
        // ODA-430-F5: require prior registerToken (deploy paths register before meta).
        if (tokenInfos[token].token == address(0)) revert TokenNotRegistered(token);
        // SCAN-M3: one-shot like vault/shareOFT bindings — Phase2 must not overwrite
        // vaultKind / nativeAgentVault for a live token while core bindings stay put.
        // First write always allowed; replace requires owner + liveRebindEnabled.
        if (agentIntegrationMetaSet[token]) {
            if (!liveRebindEnabled) {
                address existingMarker = agentIntegrationMetas[token].nativeAgentVault;
                if (existingMarker == address(0)) existingMarker = address(uint160(1));
                revert BindingAlreadySet(token, existingMarker);
            }
            if (msg.sender != owner()) revert LiveRebindOwnerOnly();
        }
        agentIntegrationMetas[token] = meta;
        agentIntegrationMetaSet[token] = true;
        emit AgentIntegrationMetaSet(token, meta.vaultKind);
    }

    function getAgentIntegrationMeta(address token) external view returns (AgentIntegrationMeta memory) {
        return agentIntegrationMetas[token];
    }

    function getVaultKind(address token) external view returns (VaultKind) {
        AgentIntegrationMeta memory meta = agentIntegrationMetas[token];
        if (meta.vaultKind == VaultKind.Agent) return VaultKind.Agent;
        return VaultKind.Creator;
    }

    // =================================
    // INTERNAL HELPERS
    // =================================

    /// @dev True if any EID for `_token` (other than `skipEid`) still maps to `_remoteOFT`.
    ///      Pass `skipEid = 0` to consider every remaining entry (0 is never a valid EID).
    function _remoteOFTStillReferenced(address _token, address _remoteOFT, uint32 skipEid)
        internal
        view
        returns (bool)
    {
        uint32[] storage chains = remoteOFTChains[_token];
        for (uint256 i; i < chains.length;) {
            uint32 eid = chains[i];
            if (eid != skipEid && remoteOFTPeers[_token][eid] == _remoteOFT) {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _remoteOFTBytes32StillReferenced(address _token, bytes32 _remoteOFT, uint32 skipEid)
        internal
        view
        returns (bool)
    {
        uint32[] storage chains = remoteOFTChainsBytes32[_token];
        for (uint256 i; i < chains.length;) {
            uint32 eid = chains[i];
            if (eid != skipEid && remoteOFTPeersBytes32[_token][eid] == _remoteOFT) {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _requireFactoryCodehash(address factory) internal view {
        bytes32 expected = approvedFactoryCodehashes[factory];
        if (expected == bytes32(0)) return;

        bytes32 actual;
        assembly {
            actual := extcodehash(factory)
        }
        if (actual != expected) revert FactoryCodehashMismatch(factory, expected, actual);
    }

    function _setTokenBinding(address token, address next, BindingKind kind) internal {
        TokenInfo storage info = tokenInfos[token];
        if (info.token == address(0)) revert TokenNotRegistered(token);
        if (next == address(0)) revert ZeroAddress();

        address previous;
        address reverseOwner;
        bytes32 field;

        if (kind == BindingKind.Vault) {
            previous = info.vault;
            field = "vault";
        } else if (kind == BindingKind.ShareOFT) {
            previous = info.shareOFT;
            field = "shareOFT";
        } else if (kind == BindingKind.Wrapper) {
            previous = info.wrapper;
            field = "wrapper";
        } else if (kind == BindingKind.Oracle) {
            previous = info.oracle;
            field = "oracle";
        } else {
            previous = info.gaugeController;
            field = "gaugeController";
        }

        _requireBindingWritable(token, previous, next);
        if (previous == next) return;

        if (kind == BindingKind.Vault) {
            reverseOwner = vaultToToken[next];
        } else if (kind == BindingKind.ShareOFT) {
            reverseOwner = shareOFTToToken[next];
        } else if (kind == BindingKind.Wrapper) {
            reverseOwner = wrapperToToken[next];
        } else if (kind == BindingKind.Oracle) {
            reverseOwner = oracleToToken[next];
        } else {
            reverseOwner = gaugeControllerToToken[next];
        }
        if (reverseOwner != address(0) && reverseOwner != token) {
            revert ReverseMappingConflict(next, reverseOwner, token);
        }

        if (previous != address(0)) {
            if (kind == BindingKind.Vault) {
                delete vaultToToken[previous];
            } else if (kind == BindingKind.ShareOFT) {
                delete shareOFTToToken[previous];
            } else if (kind == BindingKind.Wrapper) {
                delete wrapperToToken[previous];
            } else if (kind == BindingKind.Oracle) {
                delete oracleToToken[previous];
            } else {
                delete gaugeControllerToToken[previous];
            }
        }

        if (kind == BindingKind.Vault) {
            info.vault = next;
            vaultToToken[next] = token;
        } else if (kind == BindingKind.ShareOFT) {
            info.shareOFT = next;
            shareOFTToToken[next] = token;
        } else if (kind == BindingKind.Wrapper) {
            info.wrapper = next;
            wrapperToToken[next] = token;
        } else if (kind == BindingKind.Oracle) {
            info.oracle = next;
            oracleToToken[next] = token;
        } else {
            info.gaugeController = next;
            gaugeControllerToToken[next] = token;
        }

        emit TokenBindingUpdated(token, field, previous, next);
        emit TokenUpdated(token);
    }

    function _trackRemoteOFTChain(uint32[] storage chains, uint32 chainEid) internal {
        if (chains.length >= MAX_REMOTE_OFT_CHAINS_PER_TOKEN) revert TooManyRemoteOftChains();
        chains.push(chainEid);
    }

    function _untrackRemoteOFTChain(uint32[] storage chains, uint32 chainEid) internal {
        for (uint256 i; i < chains.length;) {
            if (chains[i] == chainEid) {
                chains[i] = chains[chains.length - 1];
                chains.pop();
                break;
            }
            unchecked {
                ++i;
            }
        }
    }

    function _getLayerZeroEndpointOrCommon(uint256 chainId) internal view returns (address endpoint) {
        endpoint = layerZeroEndpoints[chainId];
        if (endpoint == address(0)) endpoint = layerZeroCommonEndpoint;
    }

    function _setChainEidMapping(uint256 chainId, uint32 eid) internal {
        if (eid == 0) revert InvalidChainEid();

        uint256 existingChain = eidToChainId[eid];
        if (existingChain != 0 && existingChain != chainId) {
            revert EidAlreadyMapped(eid, existingChain, chainId);
        }

        uint32 previousEid = chainIdToEid[chainId];
        if (previousEid != 0 && previousEid != eid && eidToChainId[previousEid] == chainId) {
            delete eidToChainId[previousEid];
        }

        chainIdToEid[chainId] = eid;
        eidToChainId[eid] = chainId;
    }

    function _setEcosystemContract(uint256 chainId, address next, EcosystemContractKind kind) internal {
        if (next == address(0)) revert ZeroAddress();

        if (kind == EcosystemContractKind.LotteryManager) {
            lotteryManagers[chainId] = next;
            emit EcosystemContractSet(chainId, "LotteryManager", next);
        } else if (kind == EcosystemContractKind.GaugeController) {
            gaugeControllers[chainId] = next;
            emit EcosystemContractSet(chainId, "GaugeController", next);
        } else {
            gasReserves[chainId] = next;
            emit EcosystemContractSet(chainId, "GasReserve", next);
        }
    }

    function _getDefaultWrappedNativeSymbol(uint256 _chainId) internal pure returns (string memory) {
        if (_chainId == 146) return "WS"; // Sonic
        if (_chainId == 43114) return "WAVAX"; // Avalanche
        if (_chainId == 250) return "WFTM"; // Fantom
        if (_chainId == 137) return "WMATIC"; // Polygon
        if (_chainId == 56) return "WBNB"; // BSC
        if (_chainId == 999) return "WHYPE"; // HyperEVM
        if (_chainId == 10143) return "WMONAD"; // Monad
        return "WETH";
    }

    // =================================
    // EVENTS FOR MISSING INTERFACE EVENTS
    // =================================

    event CurrentChainSet(uint256 indexed chainId);
    event ChainIdToEidUpdated(uint256 indexed chainId, uint32 eid);
}
