// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessSource} from "./IRandomnessSource.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RandomnessRouter
/// @notice Per-creator-coin randomness source selector. Sits beside
///         `CreatorLotteryManager` (NOT inside it — that contract is large,
///         audited, and uses a delegate-call admin module that makes inline
///         changes risky during a hackathon).
///
/// @dev    Wiring model
///         ------------
///         The lottery manager continues to use Chainlink VRF as the default
///         settlement source for every existing creator coin. New creators
///         (and existing creators who opt in via governance) can be tagged
///         here with a custom source — typically `DrandRandomnessSource` for
///         lower latency or `ChainlinkVRFAdapter` for an explicit per-coin
///         override.
///
///         A separate keeper service queries this router after every entry
///         and feeds the chosen source's randomness back into the lottery
///         manager via the existing `onRandomWordsCallback` path. That keeps
///         the diff to audited code zero.
///
/// @dev    Mode mismatch handling
///         ----------------------
///         Sources can be REQUEST (Chainlink VRF) or PULL (drand). The
///         router's `acquire` function picks the right shape per source so
///         the keeper has a single call site to spin entropy for any coin.

contract RandomnessRouter is ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    address public owner;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Default source used when a creator coin has no override.
    IRandomnessSource public defaultSource;

    /// @notice Per-creator override.
    mapping(address => IRandomnessSource) public sourceOf;

    // -------------------------------------------------------------------------
    // Events / Errors
    // -------------------------------------------------------------------------

    event OwnerUpdated(address indexed previous, address indexed current);
    event DefaultSourceUpdated(address indexed previous, address indexed current);
    event SourceOverrideSet(address indexed creatorCoin, address indexed source);
    event RandomnessAcquired(
        address indexed creatorCoin,
        address indexed source,
        IRandomnessSource.SourceMode mode,
        uint256 key
    );

    error NotOwner();
    error ZeroAddress();
    error NoSource();
    error UnsupportedMode();
    error NotReady();

    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    constructor(address _owner, IRandomnessSource _defaultSource) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        defaultSource = _defaultSource;
        emit OwnerUpdated(address(0), _owner);
        emit DefaultSourceUpdated(address(0), address(_defaultSource));
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setOwner(address _owner) external onlyOwner {
        if (_owner == address(0)) revert ZeroAddress();
        emit OwnerUpdated(owner, _owner);
        owner = _owner;
    }

    function setDefaultSource(IRandomnessSource _source) external onlyOwner {
        emit DefaultSourceUpdated(address(defaultSource), address(_source));
        defaultSource = _source;
    }

    function setSourceFor(address creatorCoin, IRandomnessSource _source) external onlyOwner {
        if (creatorCoin == address(0)) revert ZeroAddress();
        sourceOf[creatorCoin] = _source;
        emit SourceOverrideSet(creatorCoin, address(_source));
    }

    function clearSourceFor(address creatorCoin) external onlyOwner {
        delete sourceOf[creatorCoin];
        emit SourceOverrideSet(creatorCoin, address(0));
    }

    // -------------------------------------------------------------------------
    // Resolution
    // -------------------------------------------------------------------------

    /// @notice Resolve which source serves `creatorCoin`. Reverts if neither
    ///         a per-coin override nor a default is set.
    function resolve(address creatorCoin) public view returns (IRandomnessSource src) {
        src = sourceOf[creatorCoin];
        if (address(src) == address(0)) src = defaultSource;
        if (address(src) == address(0)) revert NoSource();
    }

    // -------------------------------------------------------------------------
    // Acquire (called by the lottery keeper)
    // -------------------------------------------------------------------------

    /// @notice REQUEST-mode acquisition. Caller is the keeper / lottery manager
    ///         hook. The returned `key` is what the keeper later uses to read
    ///         the random word.
    /// @dev    For PULL-mode sources (e.g. drand), use `currentPullKey` to read
    ///         the active round directly without going through this function.
    /// @dev Defense-in-depth: `acquireRequest` makes a low-level call into
    /// `src.request()` and emits the `RandomnessAcquired` log only after
    /// the call returns. Sources are admin-curated via `setSourceFor`
    /// (see audit §4.1, finding `reentrancy-events`), but a future or
    /// mis-configured source must not be able to re-enter the router and
    /// observe inconsistent log ordering. The OpenZeppelin `nonReentrant`
    /// modifier closes that surface unconditionally.
    function acquireRequest(address creatorCoin)
        external
        nonReentrant
        returns (address sourceAddr, IRandomnessSource.SourceMode m, uint256 key)
    {
        IRandomnessSource src = resolve(creatorCoin);
        m = src.mode();
        if (m != IRandomnessSource.SourceMode.REQUEST) revert UnsupportedMode();
        // The router itself doesn't know the concrete REQUEST function name,
        // so it asks the source's adapter (e.g. ChainlinkVRFAdapter.request)
        // via low-level call. We require sources to expose a parameterless
        // `request()` that returns uint256.
        (bool ok, bytes memory ret) = address(src).call(abi.encodeWithSignature("request()"));
        require(ok && ret.length == 32, "request() failed");
        key = abi.decode(ret, (uint256));
        sourceAddr = address(src);
        emit RandomnessAcquired(creatorCoin, sourceAddr, m, key);
    }

    /// @notice PULL-mode read. `key` is typically the current drand round
    ///         (caller derives it via `DrandRandomnessSource.roundAt`).
    function readPull(address creatorCoin, uint256 key) external view returns (uint256) {
        IRandomnessSource src = resolve(creatorCoin);
        if (src.mode() != IRandomnessSource.SourceMode.PULL) revert UnsupportedMode();
        if (!src.isReady(key)) revert NotReady();
        return src.randomWord(key);
    }
}
