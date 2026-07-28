// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VRFConsumer4626
 * @author 0xakita.eth
 * @notice Multi-chain VRF Consumer for the 4626 lottery system (all lanes)
 * @dev Accepts requests from multiple chains AND direct local requests from Base.
 *      Sends randomness back to the originating chain or calls local callbacks.
 *      This acts as a VRF hub on Base using Chainlink VRF 2.5.
 *
 * @dev ARCHITECTURE:
 *      - Base (Hub): Chainlink VRF lives here
 *      - Remote chains: Send VRF requests via LayerZero
 *      - Hub processes VRF, sends randomness back
 *      - Local contracts can also request VRF directly
 *
 * @dev PRICE AGGREGATION:
 *      - Collects ■AKITA/USD prices from all chains
 *      - Returns aggregated average price with VRF responses
 *      - Ensures consistent pricing for lottery across all chains
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {OApp, MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

// Interface for local callbacks
interface IVRFCallbackReceiver {
    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

// Chainlink VRF V2.5 interface
interface IVRFCoordinatorV2Plus {
    function requestRandomWords(RandomWordsRequest calldata req) external returns (uint256 requestId);
}

struct RandomWordsRequest {
    bytes32 keyHash;
    uint256 subId;
    uint16 requestConfirmations;
    uint32 callbackGasLimit;
    uint32 numWords;
    bytes extraArgs;
}

contract VRFConsumer4626 is OApp, ReentrancyGuard {
    using OptionsBuilder for bytes;

    // ================================
    // STATE
    // ================================

    IVRFCoordinatorV2Plus public vrfCoordinator;
    IRegistry4626 public immutable registry;
    IOracle4626 public priceOracle;

    /// @notice Base EID (hub chain where VRF lives)
    uint32 public immutable BASE_EID;

    /// @notice Supported chains for cross-chain VRF
    mapping(uint32 => bool) public supportedChains;
    mapping(uint32 => uint32) public chainGasLimits;
    uint32[] public registeredChainEids;
    mapping(uint32 => string) public chainNames;

    /// @notice VRF configuration
    uint256 public subscriptionId;
    bytes32 public keyHash;
    uint32 public callbackGasLimit = 2500000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    bool public nativePayment = false;

    /// @notice VRF request tracking
    struct VRFRequest {
        uint64 sequence;
        uint32 sourceChainEid;
        bytes32 sourcePeer;
        address localRequester;
        bool isLocalRequest;
        uint256 randomWord;
        bool fulfilled;
        bool responseSent;
        bool callbackSent;
        uint256 timestamp;
    }

    mapping(uint256 => VRFRequest) public vrfRequests;
    /// @notice Cross-chain requests are uniquely keyed by (srcEid, sequence).
    /// @dev A global `sequence` key enables cross-chain collisions and DoS.
    mapping(uint32 => mapping(uint64 => uint256)) public sequenceToRequestId;
    mapping(uint32 => mapping(uint64 => bool)) public pendingResponses;
    mapping(address => bool) public authorizedRelayers;

    struct RateLimitState {
        uint64 windowStart;
        uint64 requestCount;
    }

    mapping(uint32 => RateLimitState) public chainRateLimits;
    mapping(uint32 => uint64) public chainMaxRequestsPerWindow;
    uint64 public rateLimitWindowSeconds = 60;
    // Conservative by default; raise per-chain explicitly if needed.
    uint64 public defaultMaxRequestsPerWindow = 10;
    bool public rateLimitingEnabled = true;

    /// @notice Local request tracking
    uint256 public localRequestCounter;
    mapping(address => uint256[]) public userLocalRequests;
    mapping(address => bool) public authorizedLocalCallers;

    /// @notice Gas configuration
    uint256 public minimumBalance = 0.005 ether;
    uint32 public defaultGasLimit = 2500000;

    // ================================
    // CROSS-CHAIN PRICE AGGREGATION
    // ================================

    /// @notice Price data from each chain
    struct ChainPriceData {
        int256 assetPriceUSD;
        uint256 timestamp;
        uint256 lastUpdated;
    }

    /// @notice Maximum number of distinct remote chains permitted to
    /// push price updates. Bounds the cost of
    /// `getAggregatedAssetPrice()` which iterates
    /// `priceReportingChains` in O(N).
    /// @dev FIX: L-09 (4626-357) — previously unbounded; a malicious
    /// set of LayerZero sources could register arbitrarily many EIDs
    /// and DoS the aggregation read path.
    uint256 public constant MAX_PRICE_REPORTING_CHAINS = 20;

    mapping(uint32 => ChainPriceData) public chainPrices;
    uint32[] public priceReportingChains;
    mapping(uint32 => bool) public hasPriceReported;

    /// @notice If false, ignore any remote price piggybacking in `_lzReceive`.
    /// @dev Safe-by-default: remote chains can otherwise push arbitrary values.
    bool public remotePriceReportingEnabled = false;

    /// @notice Local price from Base's oracle
    int256 public localAssetPriceUSD;
    uint256 public localPriceTimestamp;

    /// @notice TWAP period (ODA-461-8: default/minimum 30 minutes)
    uint32 public constant MIN_TWAP_PERIOD = 1800;
    uint32 public twapPeriod = MIN_TWAP_PERIOD;

    /// @notice Staleness threshold (2 hours)
    uint256 public constant PRICE_STALENESS = 7200;

    /// @notice Absolute cap for any price included in aggregation (ODA-461-7).
    /// @dev Matches spoke integrator scale ($100B at 1e18).
    int256 public maxAcceptablePrice = 100_000_000_000 * 1e18;

    // ================================
    // EVENTS
    // ================================

    event RandomWordsRequested(
        uint256 indexed requestId, uint32 indexed srcEid, bytes32 indexed requester, uint64 sequence, uint256 timestamp
    );
    event LocalRandomWordsRequested(uint256 indexed requestId, address indexed requester, uint256 timestamp);
    event VRFRequestSent(uint256 indexed originalRequestId, uint256 indexed vrfRequestId, uint32 sourceChain);
    event RandomnessFulfilled(uint256 indexed requestId, uint256[] randomWords, uint32 targetChain);
    event ResponseSentToChain(uint64 indexed sequence, uint256 randomWord, uint32 targetChain, uint256 fee);
    event ResponsePending(uint64 indexed sequence, uint256 indexed requestId, uint32 targetChain, string reason);
    event LocalCallbackSent(uint256 indexed requestId, address indexed requester, uint256 randomWord);
    event LocalCallbackFailed(uint256 indexed requestId, address indexed requester, string reason);
    event VRFConfigUpdated(
        uint256 subscriptionId, bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations
    );
    event ChainSupportUpdated(uint32 chainEid, bool supported, uint32 gasLimit);
    event ContractFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event LocalCallerAuthorized(address indexed caller, bool authorized);
    event RelayerAuthorizationUpdated(address indexed relayer, bool authorized);
    event ResponseQueuedForRelay(
        uint64 indexed sequence, uint256 indexed requestId, uint32 targetChain, uint256 quotedFee
    );
    event PendingResponseRelayed(
        uint64 indexed sequence, uint256 indexed requestId, address indexed relayer, uint256 feePaid
    );
    event ChainPriceReceived(uint32 indexed chainEid, int256 assetPriceUSD, uint256 timestamp);
    event LocalPriceUpdated(int256 assetPriceUSD, uint256 timestamp);
    event AggregatedPriceCalculated(int256 avgPrice, uint256 numChains, uint256 timestamp);
    event PriceOracleSet(address oracle);
    event RemotePriceReportingEnabled(bool enabled);
    event CrossChainRequestRateLimited(
        uint64 indexed sequence,
        uint32 indexed srcEid,
        bytes32 indexed sender,
        uint64 windowStart,
        uint64 requestCount,
        uint64 maxRequests
    );
    event RateLimitConfigUpdated(
        uint32 indexed chainEid, uint64 maxRequestsPerWindow, uint64 windowSeconds, bool enabled
    );

    /// @notice Emitted when a cross-chain request is intentionally ignored without reverting.
    /// @dev Reverting in `_lzReceive` can lock the LayerZero inbound lane for that srcEid.
    event CrossChainRequestIgnored(uint32 indexed srcEid, bytes32 indexed sender, uint64 indexed sequence, uint8 reason);

    uint8 private constant IGNORE_REASON_DUPLICATE_SEQUENCE = 1;
    uint8 private constant IGNORE_REASON_VRF_NOT_CONFIGURED = 2;
    uint8 private constant IGNORE_REASON_INVALID_PAYLOAD = 3;
    uint8 private constant IGNORE_REASON_RATE_LIMITED = 4;
    uint8 private constant IGNORE_REASON_UNSUPPORTED_CHAIN = 5;
    uint8 private constant IGNORE_REASON_INVALID_PEER = 6;

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error Unauthorized();
    error InvalidChain();
    error DuplicateSequence();
    error InsufficientBalance();
    error InvalidRequest();
    error UnauthorizedRelayer();
    error NotPendingResponse();
    error ResponseNotReady();
    error ResponseAlreadySent();
    error RelayFeeMismatch(uint256 provided, uint256 expected);
    error MissingLayerZeroEid(uint256 chainId);
    error InvalidRateLimitConfig();
    error CrossChainRateLimitExceeded(uint32 sourceChainEid, uint64 sequence);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor using registry for LZ endpoint
     * @param _registry Registry4626 address
     * @param _owner Owner address
     */
    constructor(address _registry, address _owner)
        OApp(IRegistry4626(_registry).getLayerZeroEndpoint(block.chainid), _owner)
        Ownable(_owner)
    {
        if (_registry == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();

        registry = IRegistry4626(_registry);
        uint32 baseEid = registry.getEidForChainId(block.chainid);
        if (baseEid == 0) revert MissingLayerZeroEid(block.chainid);
        BASE_EID = baseEid;

        // Enable owner for local requests
        authorizedLocalCallers[_owner] = true;
        authorizedRelayers[_owner] = true;
    }

    // ================================
    // VRF CONFIGURATION
    // ================================

    // FIX: VRFC-01 — add timelock to VRF coordinator changes to prevent instant manipulation
    address public pendingVrfCoordinator;
    uint256 public vrfCoordinatorTimelockExpiry;
    uint256 public constant VRF_COORDINATOR_TIMELOCK = 2 days;

    event VRFCoordinatorChangeQueued(address indexed newCoordinator, uint256 effectiveAt);
    event VRFCoordinatorChangeExecuted(address indexed newCoordinator);
    event PriceOracleChangeQueued(address indexed newOracle, uint256 effectiveAt);
    event PriceOracleChangeExecuted(address indexed newOracle);

    // ODA-461-13: timelock price-oracle rewires (same delay as VRF coordinator).
    address public pendingPriceOracle;
    uint256 public priceOracleTimelockExpiry;
    bool public priceOracleChangePending;

    function queueVRFCoordinatorChange(address _vrfCoordinator) external onlyOwner {
        if (_vrfCoordinator == address(0)) revert ZeroAddress();
        pendingVrfCoordinator = _vrfCoordinator;
        vrfCoordinatorTimelockExpiry = block.timestamp + VRF_COORDINATOR_TIMELOCK;
        emit VRFCoordinatorChangeQueued(_vrfCoordinator, vrfCoordinatorTimelockExpiry);
    }

    function executeVRFCoordinatorChange() external onlyOwner {
        require(pendingVrfCoordinator != address(0), "No pending change");
        require(block.timestamp >= vrfCoordinatorTimelockExpiry, "Timelock not expired");
        vrfCoordinator = IVRFCoordinatorV2Plus(pendingVrfCoordinator);
        emit VRFCoordinatorChangeExecuted(pendingVrfCoordinator);
        pendingVrfCoordinator = address(0);
        vrfCoordinatorTimelockExpiry = 0;
    }

    /// @dev Kept for initial setup only (when coordinator is zero)
    function setVRFCoordinator(address _vrfCoordinator) external onlyOwner {
        if (_vrfCoordinator == address(0)) revert ZeroAddress();
        // FIX: VRFC-01 — only allow direct set when coordinator not yet configured
        require(address(vrfCoordinator) == address(0), "Use timelock flow");
        vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
        emit VRFConfigUpdated(subscriptionId, keyHash, callbackGasLimit, requestConfirmations);
    }

    function setVRFConfig(
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations
    ) external onlyOwner {
        require(_subscriptionId > 0, "Invalid subscription");
        require(_keyHash != bytes32(0), "Invalid key hash");
        require(_callbackGasLimit >= 40000 && _callbackGasLimit <= 2500000, "Invalid gas limit");
        require(_requestConfirmations >= 3 && _requestConfirmations <= 200, "Invalid confirmations");

        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;

        emit VRFConfigUpdated(_subscriptionId, _keyHash, _callbackGasLimit, _requestConfirmations);
    }

    /// @dev Bootstrap-only while unset; thereafter use queue/execute timelock (ODA-461-13).
    function setPriceOracle(address _oracle) external onlyOwner {
        require(address(priceOracle) == address(0), "Use timelock flow");
        priceOracle = IOracle4626(_oracle);
        emit PriceOracleSet(_oracle);
    }

    function queuePriceOracleChange(address _oracle) external onlyOwner {
        pendingPriceOracle = _oracle;
        priceOracleTimelockExpiry = block.timestamp + VRF_COORDINATOR_TIMELOCK;
        priceOracleChangePending = true;
        emit PriceOracleChangeQueued(_oracle, priceOracleTimelockExpiry);
    }

    function executePriceOracleChange() external onlyOwner {
        require(priceOracleChangePending, "No pending change");
        require(block.timestamp >= priceOracleTimelockExpiry, "Timelock not expired");
        address next = pendingPriceOracle;
        priceOracle = IOracle4626(next);
        pendingPriceOracle = address(0);
        priceOracleTimelockExpiry = 0;
        priceOracleChangePending = false;
        emit PriceOracleChangeExecuted(next);
        emit PriceOracleSet(next);
    }

    function setRemotePriceReportingEnabled(bool enabled) external onlyOwner {
        remotePriceReportingEnabled = enabled;
        emit RemotePriceReportingEnabled(enabled);
    }

    // ================================
    // LAYERZERO RECEIVE
    // ================================

    /**
     * @notice Receive VRF request from remote chain
     * @dev Decodes piggybacked price data if present
     */
    function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _message, address, bytes calldata)
        internal
        override
    {
        // ODA-510-13: emit-and-return (match manager/integrator) — do not brick LZ lane.
        if (!supportedChains[_origin.srcEid]) {
            emit CrossChainRequestIgnored(_origin.srcEid, _origin.sender, 0, IGNORE_REASON_UNSUPPORTED_CHAIN);
            return;
        }
        if (peers[_origin.srcEid] != _origin.sender) {
            emit CrossChainRequestIgnored(_origin.srcEid, _origin.sender, 0, IGNORE_REASON_INVALID_PEER);
            return;
        }

        uint64 sequence;
        int256 reportedPrice;
        uint256 priceTimestamp;

        // Decode payload (supports legacy and new format)
        if (_message.length == 96) {
            // New format with price piggybacking
            (sequence, reportedPrice, priceTimestamp) = abi.decode(_message, (uint64, int256, uint256));

            if (
                remotePriceReportingEnabled && reportedPrice > 0 && priceTimestamp > 0
                    && priceTimestamp <= block.timestamp
            ) {
                _updateChainPrice(_origin.srcEid, reportedPrice, priceTimestamp);
            }
        } else if (_message.length == 32) {
            // Legacy format: abi.encode(uint64(sequence)) is 32 bytes.
            sequence = abi.decode(_message, (uint64));
        } else {
            emit CrossChainRequestIgnored(_origin.srcEid, _origin.sender, 0, IGNORE_REASON_INVALID_PAYLOAD);
            return;
        }

        // If VRF is not configured, do not revert (avoid blocking the LZ inbound lane).
        if (address(vrfCoordinator) == address(0) || subscriptionId == 0 || keyHash == bytes32(0)) {
            emit CrossChainRequestIgnored(_origin.srcEid, _origin.sender, sequence, IGNORE_REASON_VRF_NOT_CONFIGURED);
            return;
        }

        // Idempotent duplicate handling (avoid revert-based DoS).
        if (sequenceToRequestId[_origin.srcEid][sequence] != 0) {
            emit CrossChainRequestIgnored(_origin.srcEid, _origin.sender, sequence, IGNORE_REASON_DUPLICATE_SEQUENCE);
            return;
        }
        if (!_consumeRateLimit(_origin.srcEid, sequence, _origin.sender)) {
            emit CrossChainRequestIgnored(_origin.srcEid, _origin.sender, sequence, IGNORE_REASON_RATE_LIMITED);
            return;
        }

        // Request VRF
        uint256 requestId = vrfCoordinator.requestRandomWords(
            RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: ""
            })
        );

        vrfRequests[requestId] = VRFRequest({
            sequence: sequence,
            sourceChainEid: _origin.srcEid,
            sourcePeer: _origin.sender,
            localRequester: address(0),
            isLocalRequest: false,
            randomWord: 0,
            fulfilled: false,
            responseSent: false,
            callbackSent: false,
            timestamp: block.timestamp
        });

        sequenceToRequestId[_origin.srcEid][sequence] = requestId;

        emit VRFRequestSent(sequence, requestId, _origin.srcEid);
        emit RandomWordsRequested(requestId, _origin.srcEid, _origin.sender, sequence, block.timestamp);
    }

    // ================================
    // LOCAL VRF REQUESTS
    // ================================

    /**
     * @notice Request random words locally on Base
     * @return requestId The VRF request ID
     */
    function requestRandomWords() external returns (uint256 requestId) {
        return _requestRandomWordsLocal();
    }

    function requestRandomWordsLocal() external returns (uint256 requestId) {
        return _requestRandomWordsLocal();
    }

    function _requestRandomWordsLocal() internal returns (uint256 requestId) {
        require(address(vrfCoordinator) != address(0), "VRF not configured");
        if (!authorizedLocalCallers[msg.sender]) revert Unauthorized();

        requestId = vrfCoordinator.requestRandomWords(
            RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: ""
            })
        );

        localRequestCounter++;

        vrfRequests[requestId] = VRFRequest({
            sequence: 0,
            sourceChainEid: BASE_EID,
            sourcePeer: bytes32(0),
            localRequester: msg.sender,
            isLocalRequest: true,
            randomWord: 0,
            fulfilled: false,
            responseSent: false,
            callbackSent: false,
            timestamp: block.timestamp
        });

        userLocalRequests[msg.sender].push(requestId);

        emit LocalRandomWordsRequested(requestId, msg.sender, block.timestamp);
    }

    // ================================
    // VRF FULFILLMENT
    // ================================

    /**
     * @notice Callback from VRF Coordinator
     */
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        require(msg.sender == address(vrfCoordinator), "Only VRF Coordinator");
        // ODA-461-24: empty randomWords would OOG/panic on [0] and brick fulfillment.
        require(randomWords.length > 0, "No random words");

        VRFRequest storage request = vrfRequests[requestId];
        if (request.timestamp == 0) revert InvalidRequest();
        require(!request.fulfilled, "Already fulfilled");

        request.fulfilled = true;
        request.randomWord = randomWords[0];

        if (request.isLocalRequest) {
            _handleLocalCallback(requestId, request, randomWords);
        } else {
            _handleCrossChainResponse(requestId, request, randomWords);
        }

        emit RandomnessFulfilled(requestId, randomWords, request.sourceChainEid);
    }

    function _handleLocalCallback(uint256 requestId, VRFRequest storage request, uint256[] calldata randomWords)
        internal
    {
        address requester = request.localRequester;

        if (requester.code.length > 0) {
            try IVRFCallbackReceiver(requester).receiveRandomWords(requestId, randomWords) {
                request.callbackSent = true;
                emit LocalCallbackSent(requestId, requester, request.randomWord);
            } catch Error(string memory reason) {
                emit LocalCallbackFailed(requestId, requester, reason);
            } catch {
                emit LocalCallbackFailed(requestId, requester, "Unknown error");
            }
        }
    }

    /// @notice Retry a failed local lottery/VRF callback (M-11).
    /// @dev Permissionless after fulfill: keeps win processing recoverable when the first
    ///      callback reverts (e.g. temporary OOG / reentrancy in the lottery manager).
    function retryLocalCallback(uint256 requestId) external nonReentrant {
        VRFRequest storage request = vrfRequests[requestId];
        if (request.timestamp == 0) revert InvalidRequest();
        require(request.isLocalRequest, "Not local");
        require(request.fulfilled, "Not fulfilled");
        require(!request.callbackSent, "Callback already sent");

        address requester = request.localRequester;
        require(requester.code.length > 0, "No callback target");

        uint256[] memory words = new uint256[](1);
        words[0] = request.randomWord;

        try IVRFCallbackReceiver(requester).receiveRandomWords(requestId, words) {
            request.callbackSent = true;
            emit LocalCallbackSent(requestId, requester, request.randomWord);
        } catch Error(string memory reason) {
            emit LocalCallbackFailed(requestId, requester, reason);
            revert(reason);
        } catch {
            emit LocalCallbackFailed(requestId, requester, "Unknown error");
            revert("Local callback retry failed");
        }
    }

    function _handleCrossChainResponse(uint256 requestId, VRFRequest storage request, uint256[] calldata) internal {
        (MessagingFee memory fee,) = _quoteResponseFee(request);
        pendingResponses[request.sourceChainEid][request.sequence] = true;
        emit ResponseQueuedForRelay(request.sequence, requestId, request.sourceChainEid, fee.nativeFee);
        emit ResponsePending(request.sequence, requestId, request.sourceChainEid, "Awaiting relayer funding");
    }

    /// @notice Relay a fulfilled cross-chain VRF response (ODA-496-3: permissionless).
    /// @dev Anyone may pay the LZ fee. Removing the relayer-only gate prevents selective
    ///      censorship of winning results once `randomWord` is public on the hub.
    ///      `authorizedRelayers` remains for ops discovery / monitoring, not access control.
    function relayPendingResponse(uint32 srcEid, uint64 sequence) external payable nonReentrant {
        uint256 requestId = sequenceToRequestId[srcEid][sequence];
        if (requestId == 0) revert InvalidRequest();

        VRFRequest storage request = vrfRequests[requestId];
        if (request.timestamp == 0 || request.isLocalRequest) revert InvalidRequest();
        if (!request.fulfilled) revert ResponseNotReady();
        if (request.responseSent) revert ResponseAlreadySent();
        if (!pendingResponses[srcEid][sequence]) revert NotPendingResponse();

        (MessagingFee memory fee,) = _quoteResponseFee(request);
        // FIX: VRFC-02/VRFC-04 — accept >= nativeFee; ODA-461-10 routes excess via LZ refund to msg.sender.
        if (msg.value < fee.nativeFee) revert RelayFeeMismatch(msg.value, fee.nativeFee);

        _sendResponseToChain(request, fee);
        emit PendingResponseRelayed(sequence, requestId, msg.sender, fee.nativeFee);
    }

    /// @dev ODA-461-10: accept `msg.value >= fee` so the ~5% fee buffer is refundable to the relayer.
    function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee) {
        if (msg.value == 0) {
            if (address(this).balance < _nativeFee) revert NotEnoughNative(msg.value);
            return _nativeFee;
        }
        if (msg.value < _nativeFee) revert NotEnoughNative(msg.value);
        return msg.value;
    }

    function _quoteResponseFee(VRFRequest storage request)
        internal
        view
        returns (MessagingFee memory fee, uint32 targetGasLimit)
    {
        targetGasLimit = chainGasLimits[request.sourceChainEid];
        if (targetGasLimit == 0) targetGasLimit = defaultGasLimit;

        (int256 aggregatedPrice,) = getAggregatedAssetPrice();
        bytes memory payload = abi.encode(request.sequence, request.randomWord, aggregatedPrice, block.timestamp);
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);

        fee = _quote(request.sourceChainEid, payload, options, false);
        fee.nativeFee = (fee.nativeFee * 105) / 100;
    }

    function _sendResponseToChain(VRFRequest storage _request, MessagingFee memory _fee) internal {
        if (_request.responseSent) revert ResponseAlreadySent();

        uint32 targetGasLimit = chainGasLimits[_request.sourceChainEid];
        if (targetGasLimit == 0) targetGasLimit = defaultGasLimit;

        // Get aggregated price
        (int256 aggregatedPrice, uint256 numChains) = getAggregatedAssetPrice();

        // Extended payload with price
        bytes memory payload = abi.encode(_request.sequence, _request.randomWord, aggregatedPrice, block.timestamp);
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);

        _request.responseSent = true;

        // ODA-461-10: refund excess native fee to the paying relayer (not owner).
        _lzSend(_request.sourceChainEid, payload, options, _fee, payable(msg.sender));

        pendingResponses[_request.sourceChainEid][_request.sequence] = false;
        emit ResponseSentToChain(_request.sequence, _request.randomWord, _request.sourceChainEid, _fee.nativeFee);
        if (aggregatedPrice > 0) {
            emit AggregatedPriceCalculated(aggregatedPrice, numChains, block.timestamp);
        }
    }

    function _consumeRateLimit(uint32 sourceChainEid, uint64 sequence, bytes32 sender) internal returns (bool) {
        if (!rateLimitingEnabled) return true;

        uint64 maxRequests = getChainMaxRequestsPerWindow(sourceChainEid);
        if (maxRequests == 0) return true;

        RateLimitState storage state = chainRateLimits[sourceChainEid];
        uint64 nowTs = uint64(block.timestamp);

        if (state.windowStart == 0 || nowTs >= state.windowStart + rateLimitWindowSeconds) {
            state.windowStart = nowTs;
            state.requestCount = 0;
        }

        if (state.requestCount >= maxRequests) {
            emit CrossChainRequestRateLimited(
                sequence, sourceChainEid, sender, state.windowStart, state.requestCount, maxRequests
            );
            return false;
        }

        state.requestCount += 1;
        return true;
    }

    // ================================
    // PRICE AGGREGATION
    // ================================

    /// @notice Emitted when a new chain EID is refused registration
    /// because MAX_PRICE_REPORTING_CHAINS is already full.
    /// @dev FIX: L-09 (4626-357).
    event PriceReportingChainRejected(uint32 indexed chainEid);

    function _updateChainPrice(uint32 chainEid, int256 price, uint256 timestamp) internal {
        if (!hasPriceReported[chainEid]) {
            // FIX: L-09 (4626-357) — cap distinct reporting chains at
            // MAX_PRICE_REPORTING_CHAINS. Beyond the cap, silently drop
            // the registration (emit an event for observability). The
            // underlying chainPrices[] mapping still updates for
            // already-registered chains, so new EIDs are the only
            // path affected. An admin can widen the cap by deploying a
            // new contract with the constant bumped.
            if (priceReportingChains.length >= MAX_PRICE_REPORTING_CHAINS) {
                emit PriceReportingChainRejected(chainEid);
                return;
            }
            priceReportingChains.push(chainEid);
            hasPriceReported[chainEid] = true;
        }

        chainPrices[chainEid] =
            ChainPriceData({assetPriceUSD: price, timestamp: timestamp, lastUpdated: block.timestamp});

        emit ChainPriceReceived(chainEid, price, timestamp);
    }

    function updateLocalPrice() public {
        if (address(priceOracle) == address(0)) return;

        try priceOracle.getAssetPrice() returns (int256 assetUsd, uint256 timestamp) {
            if (assetUsd > 0) {
                localAssetPriceUSD = assetUsd;
                localPriceTimestamp = timestamp;
                emit LocalPriceUpdated(localAssetPriceUSD, localPriceTimestamp);
            }
        } catch {
            // Fallback: calculate from TWAP
            try priceOracle.getAssetEthTWAP(twapPeriod) returns (uint256 assetPerEth) {
                if (assetPerEth == 0) return;

                try priceOracle.getEthPrice() returns (int256 ethUsd, uint256) {
                    if (ethUsd <= 0) return;

                    // USD per CREATOR = (USD per ETH) / (CREATOR per ETH)
                    localAssetPriceUSD = int256(Math.mulDiv(uint256(ethUsd), 1e18, assetPerEth));
                    // ODA-461-8: TWAP observes a window ending now; stamp the window start so
                    // freshness is not overstated as a spot quote at block.timestamp.
                    localPriceTimestamp = block.timestamp > twapPeriod ? block.timestamp - twapPeriod : 0;
                    emit LocalPriceUpdated(localAssetPriceUSD, localPriceTimestamp);
                } catch {}
            } catch {}
        }
    }

    function getAggregatedAssetPrice() public view returns (int256 avgPrice, uint256 numChains) {
        int256 totalPrice;
        uint256 validChains;
        int256 localRef = localAssetPriceUSD;

        // Include local price
        if (
            localAssetPriceUSD > 0 && localPriceTimestamp > 0 && localPriceTimestamp <= block.timestamp
                && block.timestamp - localPriceTimestamp < PRICE_STALENESS
        ) {
            // ODA-461-7: bound before summing so a pathological reading cannot overflow int256.
            (bool ok, int256 capped) = _boundReportedPrice(localAssetPriceUSD, localRef);
            if (ok) {
                totalPrice += capped;
                validChains++;
            }
        }

        // Include remote prices
        uint256 priceChainsLen = priceReportingChains.length;
        for (uint256 i = 0; i < priceChainsLen; i++) {
            uint32 chainEid = priceReportingChains[i];
            ChainPriceData memory priceData = chainPrices[chainEid];

            // FIX: VRFC-03 — use lastUpdated (local receipt time) for staleness instead of
            // remote-reported timestamp, which can be spoofed to appear fresh
            if (
                priceData.assetPriceUSD > 0 && priceData.lastUpdated > 0
                    && block.timestamp - priceData.lastUpdated < PRICE_STALENESS
            ) {
                // ODA-461-7: skip non-positive / cap outliers before checked add.
                (bool ok, int256 capped) = _boundReportedPrice(priceData.assetPriceUSD, localRef);
                if (ok) {
                    totalPrice += capped;
                    validChains++;
                }
            }
        }

        if (validChains == 0) return (0, 0);

        avgPrice = totalPrice / int256(validChains);
        numChains = validChains;
    }

    /// @dev ODA-461-7: skip non-positive; cap each price to absolute max and 10× local ref.
    function _boundReportedPrice(int256 price, int256 localRef)
        internal
        view
        returns (bool ok, int256 capped)
    {
        if (price <= 0) return (false, 0);
        int256 cap = maxAcceptablePrice;
        if (cap <= 0) return (false, 0);
        if (localRef > 0 && localRef <= cap / 10) {
            // Relative outlier guard when a fresh local anchor exists.
            cap = localRef * 10;
        }
        capped = price > cap ? cap : price;
        return (true, capped);
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setLocalCallerAuthorization(address caller, bool authorized) external onlyOwner {
        authorizedLocalCallers[caller] = authorized;
        emit LocalCallerAuthorized(caller, authorized);
    }

    function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        if (relayer == address(0)) revert ZeroAddress();
        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorizationUpdated(relayer, authorized);
    }

    function setRateLimitDefaults(uint64 windowSeconds, uint64 maxRequestsPerWindow, bool enabled) external onlyOwner {
        // FIX: VRFC-06 — enforce minimum window of 60 seconds to prevent effective bypass
        if (windowSeconds < 60) revert InvalidRateLimitConfig();
        rateLimitWindowSeconds = windowSeconds;
        defaultMaxRequestsPerWindow = maxRequestsPerWindow;
        rateLimitingEnabled = enabled;
        emit RateLimitConfigUpdated(0, maxRequestsPerWindow, windowSeconds, enabled);
    }

    function setChainRateLimit(uint32 chainEid, uint64 maxRequestsPerWindow) external onlyOwner {
        chainMaxRequestsPerWindow[chainEid] = maxRequestsPerWindow;
        emit RateLimitConfigUpdated(chainEid, maxRequestsPerWindow, rateLimitWindowSeconds, rateLimitingEnabled);
    }

    function clearChainRateLimit(uint32 chainEid) external onlyOwner {
        delete chainMaxRequestsPerWindow[chainEid];
        emit RateLimitConfigUpdated(chainEid, defaultMaxRequestsPerWindow, rateLimitWindowSeconds, rateLimitingEnabled);
    }

    function setSupportedChain(uint32 chainEid, bool supported, uint32 gasLimit) external onlyOwner {
        supportedChains[chainEid] = supported;
        if (supported) {
            require(gasLimit >= 100000 && gasLimit <= 10000000, "Invalid gas limit");
            chainGasLimits[chainEid] = gasLimit;
        } else {
            chainGasLimits[chainEid] = 0;
        }
        emit ChainSupportUpdated(chainEid, supported, gasLimit);
    }

    function addNewChain(uint32 chainEid, string calldata chainName, uint32 gasLimit) external onlyOwner {
        require(!supportedChains[chainEid], "Already supported");
        require(bytes(chainName).length > 0, "Name required");

        bool found = false;
        uint256 registeredLen = registeredChainEids.length;
        for (uint256 i = 0; i < registeredLen; i++) {
            if (registeredChainEids[i] == chainEid) {
                found = true;
                break;
            }
        }
        if (!found) registeredChainEids.push(chainEid);

        chainNames[chainEid] = chainName;
        supportedChains[chainEid] = true;
        chainGasLimits[chainEid] = gasLimit;
        emit ChainSupportUpdated(chainEid, true, gasLimit);
    }

    function setDefaultGasLimit(uint32 _gasLimit) external onlyOwner {
        require(_gasLimit >= 100000 && _gasLimit <= 10000000, "Invalid");
        defaultGasLimit = _gasLimit;
    }

    function setTwapPeriod(uint32 _period) external onlyOwner {
        // ODA-461-8: enforce minimum TWAP window (default/min 1800s).
        require(_period >= MIN_TWAP_PERIOD, "TWAP period too short");
        twapPeriod = _period;
    }

    function setMaxAcceptablePrice(int256 _maxPrice) external onlyOwner {
        // ODA-461-7: operator-tunable absolute aggregation cap.
        require(_maxPrice > 0, "Price must be positive");
        maxAcceptablePrice = _maxPrice;
    }

    // FIX: VRFC-05 — add removal path for priceReportingChains to prevent unbounded growth
    function removePriceReportingChain(uint32 chainEid) external onlyOwner {
        if (!hasPriceReported[chainEid]) return;
        hasPriceReported[chainEid] = false;
        delete chainPrices[chainEid];

        uint256 len = priceReportingChains.length;
        for (uint256 i = 0; i < len; i++) {
            if (priceReportingChains[i] == chainEid) {
                priceReportingChains[i] = priceReportingChains[len - 1];
                priceReportingChains.pop();
                break;
            }
        }
    }

    function fundContract() external payable {
        require(msg.value > 0, "Send ETH");
        emit ContractFunded(msg.sender, msg.value, address(this).balance);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getChainMaxRequestsPerWindow(uint32 chainEid) public view returns (uint64) {
        uint64 overrideLimit = chainMaxRequestsPerWindow[chainEid];
        if (overrideLimit > 0) return overrideLimit;
        return defaultMaxRequestsPerWindow;
    }

    function quotePendingResponseFee(uint32 srcEid, uint64 sequence)
        external
        view
        returns (uint256 nativeFee, bool relayable)
    {
        uint256 requestId = sequenceToRequestId[srcEid][sequence];
        if (requestId == 0) return (0, false);

        VRFRequest storage request = vrfRequests[requestId];
        bool canRelay = pendingResponses[srcEid][sequence] && request.fulfilled && !request.responseSent
            && !request.isLocalRequest;
        if (!canRelay) return (0, false);

        (MessagingFee memory fee,) = _quoteResponseFee(request);
        return (fee.nativeFee, true);
    }

    function getPendingResponseStatus(uint32 srcEid, uint64 sequence)
        external
        view
        returns (
            uint256 requestId,
            bool pending,
            bool fulfilled,
            bool responseSent,
            uint32 sourceChainEid,
            uint256 quotedFee
        )
    {
        requestId = sequenceToRequestId[srcEid][sequence];
        if (requestId == 0) return (0, false, false, false, 0, 0);

        VRFRequest storage request = vrfRequests[requestId];
        pending = pendingResponses[srcEid][sequence];
        fulfilled = request.fulfilled;
        responseSent = request.responseSent;
        sourceChainEid = request.sourceChainEid;

        if (pending && fulfilled && !responseSent && !request.isLocalRequest) {
            (MessagingFee memory fee,) = _quoteResponseFee(request);
            quotedFee = fee.nativeFee;
        }
    }

    function getLocalRequest(uint256 requestId)
        external
        view
        returns (address requester, bool fulfilled, bool callbackSent, uint256 randomWord, uint256 timestamp)
    {
        VRFRequest storage request = vrfRequests[requestId];
        require(request.isLocalRequest, "Not local");
        return (request.localRequester, request.fulfilled, request.callbackSent, request.randomWord, request.timestamp);
    }

    function getUserLocalRequests(address user) external view returns (uint256[] memory) {
        return userLocalRequests[user];
    }

    function getRequestStats() external view returns (uint256 totalLocal, uint256 totalCrossChain) {
        return (localRequestCounter, 0);
    }

    function getAllChainPrices()
        external
        view
        returns (uint32[] memory chainEids, int256[] memory prices, uint256[] memory timestamps)
    {
        uint256 priceLen = priceReportingChains.length;
        chainEids = new uint32[](priceLen);
        prices = new int256[](priceLen);
        timestamps = new uint256[](priceLen);

        for (uint256 i = 0; i < priceLen; i++) {
            uint32 chainEid = priceReportingChains[i];
            chainEids[i] = chainEid;
            prices[i] = chainPrices[chainEid].assetPriceUSD;
            timestamps[i] = chainPrices[chainEid].lastUpdated;
        }
    }

    function getContractStatus()
        external
        view
        returns (
            uint256 balance,
            uint256 minBalance,
            bool canSendResponses,
            uint32 gasLimit,
            uint256 supportedChainsCount
        )
    {
        balance = address(this).balance;
        minBalance = minimumBalance;
        canSendResponses = balance >= minBalance;
        gasLimit = defaultGasLimit;

        uint256 count = 0;
        uint256 registeredCount = registeredChainEids.length;
        for (uint256 i = 0; i < registeredCount; i++) {
            if (supportedChains[registeredChainEids[i]]) count++;
        }
        supportedChainsCount = count;
    }

    // ================================
    // EMERGENCY
    // ================================

    /// @notice ODA-461-14: renouncing would brick owner-only recovery paths.
    function renounceOwnership() public pure override {
        revert Unauthorized();
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success,) = payable(owner()).call{value: balance}("");
        require(success, "Failed");
    }

    receive() external payable {}
}
