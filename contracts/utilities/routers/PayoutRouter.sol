// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICreatorOVaultDeposit {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

interface IVaultShareBurnStream {
    function queueShares(uint256 shares) external;
}

interface IWETH {
    function deposit() external payable;
}

interface ISwapRouterV3 {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

interface IProtocolRewards {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PayoutRouter
 * @author 0xakita.eth
 * @notice Receives external revenue and routes value into the vault via an enforceable burn stream.
 *
 * @dev Design goals:
 * - Safe CreatorCoin payoutRecipient path: never reverts on ERC20 transfers (no hooks needed).
 * - Can accept ETH: wraps to WETH (kept until processed).
 * - Converts payout tokens → creator coin via Uniswap V3 (exactInput path), deposits into the vault,
 *   and queues the minted vault shares into a burn stream (dripped/burned over time).
 * - Owner/keeper-gated processing to prevent griefing via bad swap params.
 *
 * @dev Notes:
 * - The burn stream MUST be configured on the vault (one-time) so it can burn its own shares.
 * - Vault shares minted to the burn stream are not withdrawable (no owner escape hatch), satisfying
 *   "not trust me bro" enforceability.
 */
contract PayoutRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct ExternalSwapParams {
        address tokenIn;
        uint256 amountIn;
        uint256 minCreatorOut;
        address spender;
        address swapTarget;
        bytes swapCallData;
    }

    struct BatchAction {
        // kind=0 => convertAndQueue (v3 path/direct creator coin)
        // kind=1 => convertViaExternalAndQueue (allowlisted external swap target/spender)
        uint8 kind;
        address tokenIn;
        uint256 amountIn;
        uint256 minCreatorOut;
        address spender;
        address swapTarget;
        bytes swapCallData;
    }

    // ================================
    // IMMUTABLES
    // ================================

    IERC20 public immutable creatorCoin;
    address public immutable vault;
    address public immutable burnStream;
    address public immutable swapRouter;
    address public immutable weth;
    /// @notice Default Zora Protocol Rewards address on Base mainnet. Used as
    ///         the default value for the `protocolRewards` immutable when the
    ///         deployer passes `address(0)` to the constructor. Kept as a
    ///         public constant so existing tooling that reads it continues to
    ///         work.
    address public constant DEFAULT_PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B;
    /// @notice Address of the protocol rewards contract this router claims
    ///         from. M-04 (audit 2026-04-25): previously a hardcoded constant
    ///         that, when deployed to a chain where the address has no code,
    ///         would silently no-op (`(bool ok,) = addr.call(...)` returns
    ///         `(true, "")` for an EOA). Now an immutable parameter, with a
    ///         constructor-time `code.length > 0` guard so a chain mismatch
    ///         is caught at deploy time rather than corrupting routing state.
    address public immutable protocolRewards;

    // ================================
    // CONFIG
    // ================================

    /// @notice Optional keeper (bot/operator) allowed to process swaps.
    address public keeper;

    // FIX: PR-02 — configurable swap deadline buffer (default 15 minutes)
    uint256 public swapDeadlineBuffer = 15 minutes;

    /// @notice tokenIn => Uniswap V3 encoded path ending in `creatorCoin`.
    /// @dev Path encoding: tokenIn (20) + fee (3) + tokenMid (20) [+ fee (3) + tokenOut (20) ...]
    mapping(address => bytes) public swapPathToCreator;

    /// @notice Optional allowlist of external swap executors (e.g. universal routers).
    mapping(address => bool) public approvedExternalSwapTargets;

    /// @notice Optional allowlist of spenders approved for tokenIn transferFrom.
    mapping(address => bool) public approvedExternalSwapSpenders;

    // ================================
    // EVENTS
    // ================================

    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event SwapPathSet(address indexed tokenIn, bytes path);
    event ConvertedAndQueued(address indexed tokenIn, uint256 amountIn, uint256 creatorOut, uint256 vaultSharesQueued);
    event ExternalSwapTargetApprovalSet(address indexed target, bool approved);
    event ExternalSwapSpenderApprovalSet(address indexed spender, bool approved);
    event ExternalSwapAndQueued(
        address indexed tokenIn,
        address indexed swapTarget,
        address indexed spender,
        uint256 amountIn,
        uint256 creatorOut,
        uint256 vaultSharesQueued
    );
    event BatchProcessed(uint256 actionCount, uint256 totalCreatorOut, uint256 totalSharesQueued);
    event ProtocolRewardsClaimed(address indexed claimer, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error NotAuthorized();
    error ZeroAmount();
    error PathNotSet(address tokenIn);
    error InvalidPath(address tokenIn);
    error ExternalSwapTargetNotApproved(address target);
    error ExternalSwapSpenderNotApproved(address spender);
    error ExternalSwapOverspent(address tokenIn, uint256 spent, uint256 maxAmountIn);
    error MinCreatorOutNotMet(uint256 minExpected, uint256 actualOut);
    error InvalidBatchAction(uint8 kind);
    error ExternalSwapCallFailed();
    error ProtocolRewardsClaimFailed();
    /// @notice M-04 (audit 2026-04-25): the constructor-supplied
    ///         `_protocolRewards` (or its default fallback) had no code at
    ///         deploy time. Without code, `.call(...)` to an EOA succeeds
    ///         silently (returns `(true, "")`) and the claim path no-ops
    ///         while `claimProtocolRewards()` reports success. Failing the
    ///         deploy is the correct response.
    error ProtocolRewardsHasNoCode(address candidate);

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyOwnerOrKeeper() {
        if (msg.sender != owner() && msg.sender != keeper) revert NotAuthorized();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _creatorCoin,
        address _vault,
        address _burnStream,
        address _owner,
        address _swapRouter,
        address _weth,
        address _protocolRewards
    ) Ownable(_owner) {
        if (
            _creatorCoin == address(0) || _vault == address(0) || _burnStream == address(0) || _owner == address(0)
                || _swapRouter == address(0) || _weth == address(0)
        ) {
            revert ZeroAddress();
        }

        creatorCoin = IERC20(_creatorCoin);
        vault = _vault;
        burnStream = _burnStream;
        swapRouter = _swapRouter;
        weth = _weth;

        // M-04 (audit 2026-04-25): the protocol rewards address is now an
        // immutable constructor parameter. Passing `address(0)` selects the
        // mainnet default (Zora Protocol Rewards on Base), preserving
        // backwards compatibility for existing deploy scripts. We then
        // require that the resolved address has bytecode at construction
        // time so a chain-mismatch (e.g. deploying to a chain where the
        // address is empty) fails the deploy instead of silently no-opping
        // every claim call afterwards.
        address rewards = _protocolRewards == address(0) ? DEFAULT_PROTOCOL_REWARDS : _protocolRewards;
        if (rewards.code.length == 0) revert ProtocolRewardsHasNoCode(rewards);
        protocolRewards = rewards;

        // Allow this router to deposit creatorCoin without repeated approvals.
        IERC20(_creatorCoin).forceApprove(_vault, type(uint256).max);
    }

    // ================================
    // RECEIVE
    // ================================

    // FIX: PR-04 — documented: receive() is intentionally state-modifying (wraps ETH to WETH).
    // Safe because WETH is an immutable trusted contract. No reentrancy guard needed here
    // as WETH.deposit() does not call back into this contract.
    receive() external payable {
        // If ETH is sent, wrap to WETH and hold until processed.
        if (msg.value > 0) {
            IWETH(weth).deposit{value: msg.value}();
        }
    }

    // ================================
    // ADMIN
    // ================================

    // FIX: PR-05 — prevent setting keeper to address(0) accidentally; use removeKeeper() instead
    function setKeeper(address newKeeper) external onlyOwner {
        if (newKeeper == address(0)) revert ZeroAddress();
        address old = keeper;
        keeper = newKeeper;
        emit KeeperUpdated(old, newKeeper);
    }

    function removeKeeper() external onlyOwner {
        address old = keeper;
        keeper = address(0);
        emit KeeperUpdated(old, address(0));
    }

    // FIX: PR-02 — allow owner to configure swap deadline buffer
    function setSwapDeadlineBuffer(uint256 _buffer) external onlyOwner {
        require(_buffer >= 1 minutes && _buffer <= 1 hours, "Invalid buffer");
        swapDeadlineBuffer = _buffer;
    }

    /**
     * @notice Set the Uniswap V3 swap path for a payout token.
     * @dev This also pre-approves the router to spend tokenIn.
     */
    function setSwapPath(address tokenIn, bytes calldata path) external onlyOwner {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (tokenIn == address(creatorCoin)) revert InvalidPath(tokenIn);
        if (path.length < 43) revert InvalidPath(tokenIn); // 20 + 3 + 20

        // Validate path starts with tokenIn and ends with creatorCoin.
        address start = _readAddress(path, 0);
        address end = _readAddress(path, path.length - 20);
        if (start != tokenIn || end != address(creatorCoin)) revert InvalidPath(tokenIn);

        swapPathToCreator[tokenIn] = path;

        // Approve swap router once (best-effort; SafeERC20 handles non-standard tokens).
        IERC20(tokenIn).forceApprove(swapRouter, type(uint256).max);

        emit SwapPathSet(tokenIn, path);
    }

    /**
     * @notice Approve or revoke an external swap execution target.
     */
    function setExternalSwapTargetApproval(address target, bool approved) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        approvedExternalSwapTargets[target] = approved;
        emit ExternalSwapTargetApprovalSet(target, approved);
    }

    /**
     * @notice Approve or revoke an external swap spender (token allowance receiver).
     */
    function setExternalSwapSpenderApproval(address spender, bool approved) external onlyOwner {
        if (spender == address(0)) revert ZeroAddress();
        approvedExternalSwapSpenders[spender] = approved;
        emit ExternalSwapSpenderApprovalSet(spender, approved);
    }

    // ================================
    // PROCESSING
    // ================================

    /**
     * @notice Convert external-revenue token into creatorCoin and inject into the vault (PPS-only).
     * @param tokenIn Payout token to convert (e.g. USDC, WETH, ZORA). Use creatorCoin to inject directly.
     * @param amountIn Amount of tokenIn to convert/inject (must already be held by this router).
     * @param minCreatorOut Minimum creatorCoin received from swap (slippage guard). Ignored when tokenIn==creatorCoin.
     */
    function convertAndQueue(address tokenIn, uint256 amountIn, uint256 minCreatorOut)
        external
        nonReentrant
        onlyOwnerOrKeeper
        returns (uint256 creatorOut, uint256 sharesQueued)
    {
        return _convertAndQueueViaV3OrDirect(tokenIn, amountIn, minCreatorOut);
    }

    /**
     * @notice Convert via allowlisted external swap target, then queue creatorCoin into the vault.
     * @dev This is intended for aggregated routing flows (e.g. offchain quote + encoded calldata).
     */
    function convertViaExternalAndQueue(ExternalSwapParams calldata params)
        external
        nonReentrant
        onlyOwnerOrKeeper
        returns (uint256 creatorOut, uint256 sharesQueued)
    {
        return _convertViaExternalAndQueue(
            params.tokenIn,
            params.amountIn,
            params.minCreatorOut,
            params.spender,
            params.swapTarget,
            params.swapCallData
        );
    }

    /**
     * @notice Structured batch processing for swap/deposit actions in one transaction.
     * @dev kind=0 => convertAndQueue path; kind=1 => external swap path.
     */
    function processBatch(BatchAction[] calldata actions)
        external
        nonReentrant
        onlyOwnerOrKeeper
        returns (uint256 totalCreatorOut, uint256 totalSharesQueued)
    {
        if (actions.length == 0) revert ZeroAmount();

        uint256 len = actions.length;
        for (uint256 i = 0; i < len; i++) {
            BatchAction calldata action = actions[i];
            uint256 creatorOut;
            uint256 sharesQueued;

            if (action.kind == 0) {
                (creatorOut, sharesQueued) = _convertAndQueueViaV3OrDirect(
                    action.tokenIn, action.amountIn, action.minCreatorOut
                );
            } else if (action.kind == 1) {
                (creatorOut, sharesQueued) = _convertViaExternalAndQueue(
                    action.tokenIn,
                    action.amountIn,
                    action.minCreatorOut,
                    action.spender,
                    action.swapTarget,
                    action.swapCallData
                );
            } else {
                revert InvalidBatchAction(action.kind);
            }

            totalCreatorOut += creatorOut;
            totalSharesQueued += sharesQueued;
        }

        emit BatchProcessed(actions.length, totalCreatorOut, totalSharesQueued);
    }

    /**
     * @notice Emergency withdraw any token (including payouts) to a safe address.
     * @dev Intended for safety; does not attempt to preserve PPS semantics.
     * FIX: PR-06 — NOTE: This is an intentional admin override that bypasses enforceability.
     * It can drain WETH/creatorCoin held for pending processing. Use only for genuine emergencies.
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        if (token == address(0)) {
            // ETH withdraw
            (bool ok,) = to.call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, to, amount);
    }

    /**
     * @notice Return claimable protocol rewards assigned to this router.
     */
    function protocolRewardsClaimable() external view returns (uint256) {
        return IProtocolRewards(protocolRewards).balanceOf(address(this));
    }

    /**
     * @notice Claim an explicit amount of protocol rewards into this router.
     * @dev Claimed ETH is wrapped to WETH by `receive()`.
     */
    function claimProtocolRewards(uint256 amount) external onlyOwnerOrKeeper nonReentrant returns (uint256 claimed) {
        if (amount == 0) revert ZeroAmount();
        _claimProtocolRewards(amount);
        emit ProtocolRewardsClaimed(msg.sender, amount);
        return amount;
    }

    /**
     * @notice Claim all currently claimable protocol rewards into this router.
     * @dev Claimed ETH is wrapped to WETH by `receive()`.
     */
    function claimAllProtocolRewards() external onlyOwnerOrKeeper nonReentrant returns (uint256 claimed) {
        uint256 claimable = IProtocolRewards(protocolRewards).balanceOf(address(this));
        if (claimable == 0) revert ZeroAmount();
        _claimProtocolRewards(claimable);
        emit ProtocolRewardsClaimed(msg.sender, claimable);
        return claimable;
    }

    // ================================
    // INTERNAL HELPERS
    // ================================

    function _convertAndQueueViaV3OrDirect(address tokenIn, uint256 amountIn, uint256 minCreatorOut)
        internal
        returns (uint256 creatorOut, uint256 sharesQueued)
    {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroAmount();

        if (tokenIn == address(creatorCoin)) {
            // Inject already-held creatorCoin (no swap).
            creatorOut = amountIn;
        } else {
            bytes memory path = swapPathToCreator[tokenIn];
            if (path.length == 0) revert PathNotSet(tokenIn);

            // Swap using funds already held in this router.
            IERC20 inToken = IERC20(tokenIn);
            uint256 bal = inToken.balanceOf(address(this));
            if (bal < amountIn) revert ZeroAmount();

            // FIX: PR-02 — use deadline with buffer to prevent stale mempool execution
            creatorOut = ISwapRouterV3(swapRouter).exactInput(
                ISwapRouterV3.ExactInputParams({
                    path: path,
                    recipient: address(this),
                    deadline: block.timestamp + swapDeadlineBuffer,
                    amountIn: amountIn,
                    amountOutMinimum: minCreatorOut
                })
            );
        }

        sharesQueued = _queueCreatorOut(creatorOut);
        emit ConvertedAndQueued(tokenIn, amountIn, creatorOut, sharesQueued);
    }

    function _convertViaExternalAndQueue(
        address tokenIn,
        uint256 amountIn,
        uint256 minCreatorOut,
        address spender,
        address swapTarget,
        bytes calldata swapCallData
    ) internal returns (uint256 creatorOut, uint256 sharesQueued) {
        if (tokenIn == address(0) || spender == address(0) || swapTarget == address(0)) revert ZeroAddress();
        if (tokenIn == address(creatorCoin)) revert InvalidPath(tokenIn);
        if (amountIn == 0) revert ZeroAmount();
        // FIX: PR-01 — require minCreatorOut > 0 to prevent opaque calldata from draining without detection
        if (minCreatorOut == 0) revert ZeroAmount();
        if (!approvedExternalSwapTargets[swapTarget]) revert ExternalSwapTargetNotApproved(swapTarget);
        if (!approvedExternalSwapSpenders[spender]) revert ExternalSwapSpenderNotApproved(spender);

        IERC20 inToken = IERC20(tokenIn);
        uint256 tokenInBefore = inToken.balanceOf(address(this));
        if (tokenInBefore < amountIn) revert ZeroAmount();
        uint256 creatorBefore = creatorCoin.balanceOf(address(this));

        // Scope allowance to this call only.
        inToken.forceApprove(spender, 0);
        inToken.forceApprove(spender, amountIn);

        (bool ok, bytes memory returnData) = swapTarget.call(swapCallData);
        inToken.forceApprove(spender, 0);
        if (!ok) _revertWithBytes(returnData);

        uint256 tokenInAfter = inToken.balanceOf(address(this));
        // FIX: PR-03 — rewrite to subtraction form to avoid potential addition overflow
        if (tokenInBefore - tokenInAfter > amountIn) {
            revert ExternalSwapOverspent(tokenIn, tokenInBefore - tokenInAfter, amountIn);
        }

        uint256 creatorAfter = creatorCoin.balanceOf(address(this));
        creatorOut = creatorAfter - creatorBefore;
        if (creatorOut < minCreatorOut) revert MinCreatorOutNotMet(minCreatorOut, creatorOut);

        sharesQueued = _queueCreatorOut(creatorOut);
        emit ExternalSwapAndQueued(tokenIn, swapTarget, spender, amountIn, creatorOut, sharesQueued);
    }

    function _queueCreatorOut(uint256 creatorOut) internal returns (uint256 sharesQueued) {
        if (creatorOut == 0) revert ZeroAmount();
        sharesQueued = ICreatorOVaultDeposit(vault).deposit(creatorOut, burnStream);
        if (sharesQueued == 0) revert ZeroAmount();

        // Queue minted vault shares for NEXT epoch drip/burn.
        // Anyone can call `checkpoint()` later to start/drip when the epoch begins.
        IVaultShareBurnStream(burnStream).queueShares(sharesQueued);
    }

    function _readAddress(bytes memory data, uint256 offset) internal pure returns (address addr) {
        // Read 20 bytes from `data` at `offset`.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addr := shr(96, mload(add(add(data, 0x20), offset)))
        }
    }

    function _revertWithBytes(bytes memory revertData) internal pure {
        if (revertData.length == 0) revert ExternalSwapCallFailed();
        assembly {
            revert(add(revertData, 0x20), mload(revertData))
        }
    }

    function _claimProtocolRewards(uint256 amount) internal {
        // Primary ABI: withdraw(address to, uint256 amount)
        (bool ok,) = protocolRewards.call(abi.encodeWithSelector(bytes4(0xf3fef3a3), address(this), amount));

        // Compatibility ABI: withdrawFor(address from, address to, uint256 amount)
        if (!ok) {
            (ok,) = protocolRewards.call(abi.encodeWithSelector(bytes4(0x9f1d9267), address(this), address(this), amount));
        }

        if (!ok) revert ProtocolRewardsClaimFailed();
    }
}
