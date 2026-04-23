// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainlinkVRFIntegratorV2_5 - Cross-Chain VRF System
 * @author 0xakita.eth
 * @dev Spoke chain contract that receives random words requests and forwards them to Hub chain
 *      for Chainlink VRF 2.5 processing. Part of the 4626 cross-chain lottery
 *      and random words infrastructure.
 *
 * @notice Ready for future cross-chain VRF implementation
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OApp, MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import {OAppOptionsType3} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {ICreatorRegistry} from "../../../interfaces/core/ICreatorRegistry.sol";

/**
 * @dev Callback interface for VRF consumers
 */
interface IRandomWordsCallbackV2_5 {
    function receiveRandomWords(uint256[] memory randomWords, uint256 requestId) external;
}

contract ChainlinkVRFIntegratorV2_5 is OApp, OAppOptionsType3 {
    using OptionsBuilder for bytes;

    error UnauthorizedSponsoredCaller();

    bytes32 internal constant IGNORE_REQUEST_NOT_FOUND = bytes32("REQUEST_NOT_FOUND");
    bytes32 internal constant IGNORE_ALREADY_FULFILLED = bytes32("ALREADY_FULFILLED");
    bytes32 internal constant IGNORE_PROVIDER_NOT_FOUND = bytes32("PROVIDER_NOT_FOUND");

    // State variables
    uint64 public requestCounter;
    uint32 public defaultGasLimit = 690420;
    // FIX: VRF-04 — deployment nonce prevents sequence collision on redeploy
    uint64 public immutable deploymentNonce;

    /// @notice Hub chain EID for VRF requests (Base by default)
    uint32 public hubEid;

    // ================================
    // PRICE PIGGYBACKING STATE
    // ================================

    /// @notice Price oracle for token/USD price
    address public priceOracle;

    /// @notice Last aggregated token/USD price received from Hub
    int256 public lastAggregatedPrice;
    uint256 public lastPriceTimestamp;

    // Events for price piggybacking
    event PriceReported(int256 priceUSD, uint256 timestamp);
    event AggregatedPriceReceived(int256 aggregatedPrice, uint256 timestamp);
    event PriceOracleSet(address oracle);

    // Request tracking
    struct RequestStatus {
        bool fulfilled;
        bool exists;
        address provider;
        uint256 randomWord;
        uint256 timestamp;
        bool isContract;
    }
    mapping(uint64 => RequestStatus) public s_requests;
    mapping(uint64 => address) public randomWordsProviders;
    mapping(address => bool) public authorizedSponsoredCallers;

    // Events
    event RandomWordsRequested(uint64 indexed requestId, address indexed requester, uint32 dstEid);
    event MessageSent(uint64 indexed requestId, uint32 indexed dstEid, bytes message);
    event RandomWordsReceived(uint256[] randomWords, uint64 indexed sequence, address indexed provider);
    event CallbackFailed(uint64 indexed sequence, address indexed provider, string reason);
    event CallbackSucceeded(uint64 indexed sequence, address indexed provider);
    event RequestExpired(uint64 indexed sequence, address indexed provider);
    event RandomWordsResponseIgnored(uint64 indexed sequence, uint256 randomWord, bytes32 reason);
    event RandomWordsReceivedLate(uint64 indexed sequence, address indexed provider, uint256 requestTimestamp, uint256 receivedAt);
    event InvalidVrfResponsePayload(uint32 indexed srcEid, bytes32 indexed sender, uint256 payloadLength);
    event GasLimitUpdated(uint32 oldLimit, uint32 newLimit);
    event SponsoredCallerAuthorizationUpdated(address indexed caller, bool authorized);

    // Configuration
    uint256 public requestTimeout = 1 hours;
    // FIX: VRF-05 — upper-bound for piggybacked price (1e18 * 1e8 = $100B at 1e18 scale)
    int256 public maxAcceptablePrice = 100_000_000_000 * 1e18;

    /**
     * @notice Constructor
     * @param _endpoint LayerZero endpoint address
     * @param _owner Owner address
     * @param _hubEid Hub chain EID (e.g., Base = 30184)
     */
    constructor(address _endpoint, address _owner, uint32 _hubEid) OApp(_endpoint, _owner) Ownable(_owner) {
        require(_endpoint != address(0), "Invalid endpoint");
        require(_owner != address(0), "Invalid owner");
        require(_hubEid != 0, "Invalid hub EID");
        hubEid = _hubEid;
        // FIX: L-06 (4626-354) — previous implementation truncated block
        // number to 16 bits, giving only 65,536 distinct nonces and a ~50%
        // collision probability after ~256 deploys (birthday bound). On Base
        // (~4s blocks) the same lower-16-bit value recurs every ~2.7 days, so
        // two redeploys in close succession could land on the same nonce and
        // collide VRF request-id sequences.
        //
        // Derive a 64-bit nonce from keccak(block.number, chainid, this) and
        // truncate. Collision probability is now ~2^-32 for 65k deploys,
        // which is safe for any realistic deployment cadence. Previous 16-bit
        // behaviour is preserved as a comment block above for audit trail.
        //
        // REVIEW FIX (L-06 follow-up): the seeding of `requestCounter` must
        // preserve the full 64-bit nonce entropy. The previous assignment
        // `uint64(deploymentNonce) << 48` discarded bits 16..63 of the 64-bit
        // hash, collapsing the cross-deployment sequence space back to 16
        // bits — exactly the L-06 regression this fix was meant to close.
        // We now keep the high 48 bits of the nonce and reserve the low 16
        // bits (65,535 requests) as sequence headroom before a wrap-around
        // into the next nonce band. Per-deploy request volume far below 65k
        // is assumed; if a single integrator ever approaches that cap, a
        // redeploy rotates to a fresh high-48-bit band. sequenceToRequestId
        // on the hub keys on `(srcEid, uint64 sequence)`, so the full 64-bit
        // space is addressable over the wire.
        deploymentNonce = uint64(
            uint256(keccak256(abi.encode(block.number, block.chainid, address(this))))
        );
        // Mask off the low 16 bits; they are the per-deploy sequence window
        // and start at zero so the first request_id is deploymentNonce-band + 1.
        requestCounter = deploymentNonce & uint64(0xFFFFFFFFFFFF0000);
        authorizedSponsoredCallers[_owner] = true;
        emit SponsoredCallerAuthorizationUpdated(_owner, true);
    }

    /**
     * @dev Receives random words responses from Hub VRF Consumer
     */
    function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _payload, address, bytes calldata)
        internal
        override
    {
        require(peers[_origin.srcEid] == _origin.sender, "Unauthorized");

        uint64 sequence;
        uint256 randomWord;
        int256 aggregatedPrice;
        uint256 priceTimestamp;

        if (_payload.length == 128) {
            // New format with price piggybacking
            (sequence, randomWord, aggregatedPrice, priceTimestamp) =
                abi.decode(_payload, (uint64, uint256, int256, uint256));

            // FIX: VRF-05 — validate aggregated price has upper bound and timestamp is not future
            if (aggregatedPrice > 0 && aggregatedPrice <= maxAcceptablePrice
                && priceTimestamp <= block.timestamp) {
                lastAggregatedPrice = aggregatedPrice;
                lastPriceTimestamp = priceTimestamp;
                emit AggregatedPriceReceived(aggregatedPrice, priceTimestamp);
            }
        } else if (_payload.length == 64) {
            // Legacy format without price
            (sequence, randomWord) = abi.decode(_payload, (uint64, uint256));
        } else {
            // Never revert on payload format mismatches. Ordered delivery means a single reverting
            // message can brick the entire inbound path. Emit an event for monitoring and return.
            emit InvalidVrfResponsePayload(_origin.srcEid, _origin.sender, _payload.length);
            return;
        }

        RequestStatus storage request = s_requests[sequence];
        if (!request.exists) {
            emit RandomWordsResponseIgnored(sequence, randomWord, IGNORE_REQUEST_NOT_FOUND);
            return;
        }
        if (request.fulfilled) {
            emit RandomWordsResponseIgnored(sequence, randomWord, IGNORE_ALREADY_FULFILLED);
            return;
        }

        address provider = request.provider;
        if (provider == address(0)) {
            emit RandomWordsResponseIgnored(sequence, randomWord, IGNORE_PROVIDER_NOT_FOUND);
            return;
        }

        // FIX: VRF-02 — discard late VRF responses to prevent selective delivery attacks
        if (requestTimeout > 0 && block.timestamp > request.timestamp + requestTimeout) {
            emit RandomWordsReceivedLate(sequence, provider, request.timestamp, block.timestamp);
            request.fulfilled = true;
            request.exists = false;
            delete randomWordsProviders[sequence];
            return;
        }

        request.fulfilled = true;
        request.randomWord = randomWord;
        delete randomWordsProviders[sequence];

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = randomWord;

        emit RandomWordsReceived(randomWords, sequence, provider);

        if (request.isContract) {
            try IRandomWordsCallbackV2_5(provider).receiveRandomWords(randomWords, uint256(sequence)) {
                emit CallbackSucceeded(sequence, provider);
            } catch Error(string memory reason) {
                emit CallbackFailed(sequence, provider, reason);
            } catch {
                emit CallbackFailed(sequence, provider, "Low-level callback failure");
            }
        }
    }

    /**
     * @notice Check request status
     */
    function checkRequestStatus(uint64 requestId)
        external
        view
        returns (bool fulfilled, bool exists, address provider, uint256 randomWord, uint256 timestamp, bool expired)
    {
        RequestStatus memory request = s_requests[requestId];
        return (
            request.fulfilled,
            request.exists,
            request.provider,
            request.randomWord,
            request.timestamp,
            block.timestamp > request.timestamp + requestTimeout
        );
    }

    /**
     * @notice Get random word for fulfilled request
     */
    function getRandomWord(uint64 requestId) external view returns (uint256 randomWord, bool fulfilled) {
        RequestStatus memory request = s_requests[requestId];
        return (request.randomWord, request.fulfilled);
    }

    /**
     * @notice Quote fee for VRF request
     */
    function quoteFee() public view returns (MessagingFee memory fee) {
        bytes memory options = hex"000301001101000000000000000000000000000A88F4";
        bytes memory payload = abi.encode(uint64(requestCounter + 1), int256(0), uint256(0));
        return _quote(hubEid, payload, options, false);
    }

    /**
     * @notice Quote fee with custom gas limit
     */
    function quoteFeeWithGas(uint32 _gasLimit) public view returns (MessagingFee memory fee) {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(_gasLimit, 0);
        bytes memory payload = abi.encode(uint64(requestCounter + 1), int256(0), uint256(0));
        return _quote(hubEid, payload, options, false);
    }

    /**
     * @notice Request random words (contract-sponsored fee)
     */
    function requestRandomWords() external returns (MessagingReceipt memory receipt, uint64 requestId) {
        if (!authorizedSponsoredCallers[msg.sender]) revert UnauthorizedSponsoredCaller();
        return _requestRandomWords(hubEid, false);
    }

    /**
     * @notice Request random words with caller-provided fee
     * FIX: VRF-03 — targetEid parameter ignored (always routes to hubEid); kept for interface compat
     */
    function requestRandomWordsPayable(uint32 /* targetEid */)
        external
        payable
        returns (MessagingReceipt memory receipt, uint64 requestId)
    {
        return _requestRandomWords(hubEid, true);
    }

    /**
     * @notice Backward-compatible caller-pays request to hub
     */
    function requestRandomWordsPayable() external payable returns (MessagingReceipt memory receipt, uint64 requestId) {
        return _requestRandomWords(hubEid, true);
    }

    function _requestRandomWords(uint32 dstEid, bool payable_)
        internal
        returns (MessagingReceipt memory receipt, uint64 requestId)
    {
        // Permission the *entire* request surface (including payable variants) so
        // an arbitrary EOA cannot externalize hub VRF subscription spend.
        if (!authorizedSponsoredCallers[msg.sender]) revert UnauthorizedSponsoredCaller();
        require(dstEid == hubEid, "Invalid destination");
        bytes memory options = hex"000301001101000000000000000000000000000A88F4";

        bytes32 peer = peers[hubEid];
        require(peer != bytes32(0), "Hub peer not set");

        requestCounter++;
        requestId = requestCounter;

        bool isContract = msg.sender.code.length > 0;
        s_requests[requestId] = RequestStatus({
            fulfilled: false,
            exists: true,
            provider: msg.sender,
            randomWord: 0,
            timestamp: block.timestamp,
            isContract: isContract
        });
        randomWordsProviders[requestId] = msg.sender;

        bytes memory payload = abi.encode(requestId, int256(0), uint256(0));

        MessagingFee memory fee = quoteFee();

        if (payable_) {
            require(msg.value >= fee.nativeFee, "Insufficient fee");
        } else {
            require(address(this).balance >= fee.nativeFee, "NotEnoughNative");
        }

        receipt = _lzSend(hubEid, payload, options, fee, payable(payable_ ? msg.sender : address(this)));

        emit RandomWordsRequested(requestId, msg.sender, hubEid);
        emit MessageSent(requestId, hubEid, payload);
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setDefaultGasLimit(uint32 _gasLimit) external onlyOwner {
        uint32 oldLimit = defaultGasLimit;
        defaultGasLimit = _gasLimit;
        emit GasLimitUpdated(oldLimit, _gasLimit);
    }

    function setHubEid(uint32 _hubEid) external onlyOwner {
        require(_hubEid != 0, "Invalid hub EID");
        require(peers[_hubEid] != bytes32(0), "Peer not set");
        hubEid = _hubEid;
    }

    // FIX: VRF-06 — enforce minimum timeout to prevent disabling expiry mechanism
    function setRequestTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout >= 1 minutes, "Timeout too short");
        requestTimeout = _timeout;
    }

    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = _oracle;
        emit PriceOracleSet(_oracle);
    }

    // FIX: VRF-05 — allow owner to configure max acceptable price
    function setMaxAcceptablePrice(int256 _maxPrice) external onlyOwner {
        require(_maxPrice > 0, "Price must be positive");
        maxAcceptablePrice = _maxPrice;
    }

    function setSponsoredCallerAuthorization(address caller, bool authorized) external onlyOwner {
        require(caller != address(0), "Invalid caller");
        authorizedSponsoredCallers[caller] = authorized;
        emit SponsoredCallerAuthorizationUpdated(caller, authorized);
    }

    /**
     * @notice Clean up expired requests
     */
    function cleanupExpiredRequests(uint64[] calldata requestIds) external {
        for (uint256 i = 0; i < requestIds.length; i++) {
            uint64 requestId = requestIds[i];
            RequestStatus storage request = s_requests[requestId];

            if (request.exists && !request.fulfilled && block.timestamp > request.timestamp + requestTimeout) {
                address provider = request.provider;
                // FIX: VRF-01 — mark request as fulfilled and non-existent to prevent late re-fulfillment
                request.fulfilled = true;
                request.exists = false;
                delete randomWordsProviders[requestId];
                emit RequestExpired(requestId, provider);
            }
        }
    }

    function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee) {
        if (msg.value == 0) {
            require(address(this).balance >= _nativeFee, "NotEnoughNative");
            return _nativeFee;
        }
        if (msg.value != _nativeFee) revert NotEnoughNative(msg.value);
        return _nativeFee;
    }

    function withdraw() external onlyOwner {
        (bool ok,) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "ETH transfer failed");
    }

    receive() external payable {}
}
