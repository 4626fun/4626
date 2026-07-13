// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
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

    /// @notice Agent lane integration metadata keyed by underlying token
    mapping(address => AgentIntegrationMeta) private agentIntegrationMetas;

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

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyAuthorizedOrOwner() {
        if (msg.sender != owner() && !authorizedFactories[msg.sender]) {
            revert NotAuthorized();
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
        bytes32 expected = approvedFactoryCodehashes[_factory];
        if (expected != bytes32(0)) {
            bytes32 actual;
            assembly {
                actual := extcodehash(_factory)
            }
            if (actual != expected) revert FactoryCodehashMismatch(_factory, expected, actual);
        }
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
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_vault == address(0)) revert ZeroAddress();

        address previous = tokenInfos[_token].vault;
        _requireBindingWritable(_token, previous, _vault);
        if (previous == _vault) return;

        // Clear old reverse mapping if exists
        if (previous != address(0)) {
            delete vaultToToken[previous];
        }

        tokenInfos[_token].vault = _vault;
        vaultToToken[_vault] = _token;

        emit TokenBindingUpdated(_token, "vault", previous, _vault);
        emit TokenUpdated(_token);
    }

    /**
     * @notice Set ShareOFT address for a token
     */
    function setShareOFTForToken(address _token, address _shareOFT) external override onlyAuthorizedOrOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_shareOFT == address(0)) revert ZeroAddress();

        address previous = tokenInfos[_token].shareOFT;
        _requireBindingWritable(_token, previous, _shareOFT);
        if (previous == _shareOFT) return;

        // M-NEW-03: refuse to steal another token's reverse ShareOFT mapping.
        address reverseOwner = shareOFTToToken[_shareOFT];
        if (reverseOwner != address(0) && reverseOwner != _token) {
            revert ReverseMappingConflict(_shareOFT, reverseOwner, _token);
        }

        if (previous != address(0)) {
            delete shareOFTToToken[previous];
        }

        tokenInfos[_token].shareOFT = _shareOFT;
        shareOFTToToken[_shareOFT] = _token;

        emit TokenBindingUpdated(_token, "shareOFT", previous, _shareOFT);
        emit TokenUpdated(_token);
    }

    /**
     * @notice Set wrapper address for a token
     */
    function setWrapperForToken(address _token, address _wrapper) external override onlyAuthorizedOrOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_wrapper == address(0)) revert ZeroAddress();

        address previous = tokenInfos[_token].wrapper;
        _requireBindingWritable(_token, previous, _wrapper);
        if (previous == _wrapper) return;

        if (previous != address(0)) {
            delete wrapperToToken[previous];
        }

        tokenInfos[_token].wrapper = _wrapper;
        wrapperToToken[_wrapper] = _token;

        emit TokenBindingUpdated(_token, "wrapper", previous, _wrapper);
        emit TokenUpdated(_token);
    }

    /**
     * @notice Set oracle address for a token
     */
    function setOracleForToken(address _token, address _oracle) external override onlyAuthorizedOrOwner {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_oracle == address(0)) revert ZeroAddress();

        address previous = tokenInfos[_token].oracle;
        _requireBindingWritable(_token, previous, _oracle);
        if (previous == _oracle) return;

        if (previous != address(0)) {
            delete oracleToToken[previous];
        }

        tokenInfos[_token].oracle = _oracle;
        oracleToToken[_oracle] = _token;

        emit TokenBindingUpdated(_token, "oracle", previous, _oracle);
        emit TokenUpdated(_token);
    }

    /**
     * @notice Set gauge controller address for a token
     */
    function setGaugeControllerForToken(address _token, address _gaugeController)
        external
        override
        onlyAuthorizedOrOwner
    {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_gaugeController == address(0)) revert ZeroAddress();

        address previous = tokenInfos[_token].gaugeController;
        _requireBindingWritable(_token, previous, _gaugeController);
        if (previous == _gaugeController) return;

        if (previous != address(0)) {
            delete gaugeControllerToToken[previous];
        }

        tokenInfos[_token].gaugeController = _gaugeController;
        gaugeControllerToToken[_gaugeController] = _token;

        emit TokenBindingUpdated(_token, "gaugeController", previous, _gaugeController);
        emit TokenUpdated(_token);
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
     *      Only the registry owner or the creator themselves can set this.
     */
    function setCanonicalWallet(address _token, address _wallet) external override {
        if (tokenInfos[_token].token == address(0)) revert TokenNotRegistered(_token);
        if (_wallet == address(0)) revert ZeroAddress();

        // Only owner or the creator can set the canonical wallet
        address creator = tokenInfos[_token].creator;
        if (msg.sender != owner() && msg.sender != creator) revert NotAuthorized();

        // Enforce a 1:1 canonical wallet reverse mapping.
        // Without this check, a creator could "claim" another creator's wallet and hijack attribution.
        address existing = canonicalWalletToToken[_wallet];
        if (existing != address(0) && existing != _token) {
            revert CanonicalWalletAlreadyInUse(_wallet, existing);
        }

        // Clear old reverse mapping if exists
        address oldWallet = tokenInfos[_token].canonicalWallet;
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

        omnichainVaultMeshConfigs[_token] = _cfg;

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
        if (_remoteOFT == address(0)) revert ZeroAddress();

        // Clear old reverse mapping if exists
        address oldRemoteOFT = remoteOFTPeers[_token][_chainEid];
        if (oldRemoteOFT != address(0)) {
            // FIX: F-11 — only delete reverse mapping if it points to the expected token,
            // preventing corruption of another token's mapping on address reuse
            if (remoteOFTToToken[oldRemoteOFT] == _token) {
                delete remoteOFTToToken[oldRemoteOFT];
            }
        } else {
            // New chain — track it
            remoteOFTChains[_token].push(_chainEid);
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
        delete remoteOFTToToken[remoteOFT];

        // Remove from chain list (swap-and-pop)
        uint32[] storage chains = remoteOFTChains[_token];
        for (uint256 i; i < chains.length;) {
            if (chains[i] == _chainEid) {
                chains[i] = chains[chains.length - 1];
                chains.pop();
                break;
            }
            unchecked {
                ++i;
            }
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
        eids = remoteOFTChains[_token];
        ofts = new address[](eids.length);
        for (uint256 i; i < eids.length;) {
            ofts[i] = remoteOFTPeers[_token][eids[i]];
            unchecked {
                ++i;
            }
        }
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
        require(tokenInfos[_token].token != address(0), "Token not registered");
        require(_chainEid != 0, "Invalid chain EID");
        if (_remoteOFT == bytes32(0)) revert ZeroBytes32();

        bytes32 oldPeer = remoteOFTPeersBytes32[_token][_chainEid];
        if (oldPeer == bytes32(0)) {
            remoteOFTChainsBytes32[_token].push(_chainEid);
        } else {
            if (remoteOFTBytes32ToToken[oldPeer] == _token) {
                delete remoteOFTBytes32ToToken[oldPeer];
            }
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
        require(_chainEid != 0, "Invalid chain EID");

        bytes32 oldPeer = remoteOFTPeersBytes32[_token][_chainEid];
        require(oldPeer != bytes32(0), "Peer not set");

        delete remoteOFTPeersBytes32[_token][_chainEid];
        delete remoteOFTBytes32ToToken[oldPeer];

        uint32[] storage chains = remoteOFTChainsBytes32[_token];
        for (uint256 i = 0; i < chains.length; i++) {
            if (chains[i] == _chainEid) {
                chains[i] = chains[chains.length - 1];
                chains.pop();
                break;
            }
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
        uint32[] memory chains = remoteOFTChainsBytes32[_token];
        eids = chains;
        peers = new bytes32[](chains.length);
        for (uint256 i = 0; i < chains.length; i++) {
            peers[i] = remoteOFTPeersBytes32[_token][chains[i]];
        }
        return (eids, peers);
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
        uint256 total = registeredTokens.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = registeredTokens[i];
        }
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
        TokenInfo storage info = tokenInfos[_token];
        if (info.token == address(0) || !info.isActive) return false;

        OmnichainVaultMeshConfig storage cfg = omnichainVaultMeshConfigs[_token];
        if (!cfg.enabled) return false;
        if (
            cfg.solanaEid == 0 || cfg.hubComposer == address(0) || cfg.assetMeshToken == address(0)
                || cfg.shareMeshToken == address(0) || cfg.solanaAssetMint == bytes32(0)
        ) {
            return false;
        }
        if (info.vault == address(0) || info.wrapper == address(0) || info.shareOFT == address(0)) return false;
        return true;
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
        address ep = layerZeroEndpoints[_chainId];
        return ep == address(0) ? layerZeroCommonEndpoint : ep;
    }

    function setChainIdToEid(uint256 _chainId, uint32 _eid) external override onlyOwner {
        chainIdToEid[_chainId] = _eid;
        eidToChainId[_eid] = _chainId;

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

        if (config.useCustomOApp || config.isConfigured) {
            return config;
        }

        // Use default config with chain-specific EID and endpoint
        LzConfig memory effective = defaultLzConfig;
        effective.eid = chainIdToEid[_chainId];
        effective.endpoint =
            layerZeroEndpoints[_chainId] != address(0) ? layerZeroEndpoints[_chainId] : layerZeroCommonEndpoint;
        return effective;
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
        chainIdToEid[_chainId] = _eid;
        eidToChainId[_eid] = _chainId;

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
        lotteryManagers[_chainId] = _manager;
        emit EcosystemContractSet(_chainId, "LotteryManager", _manager);
    }

    function getLotteryManager(uint256 _chainId) external view override returns (address) {
        return lotteryManagers[_chainId];
    }

    function setGaugeController(uint256 _chainId, address _controller) external override onlyOwner {
        gaugeControllers[_chainId] = _controller;
        emit EcosystemContractSet(_chainId, "GaugeController", _controller);
    }

    function getGaugeController(uint256 _chainId) external view override returns (address) {
        return gaugeControllers[_chainId];
    }

    function setGasReserve(uint256 _chainId, address _reserve) external override onlyOwner {
        gasReserves[_chainId] = _reserve;
        emit EcosystemContractSet(_chainId, "GasReserve", _reserve);
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
        agentIntegrationMetas[token] = meta;
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

