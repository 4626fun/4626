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

interface IWrapperUnwrap {
    function unwrap(uint256 amount) external returns (uint256 amountOut);
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
 * @title CreatorPayoutRouter
 * @author 0xakita.eth
 * @notice Receives creatorCoinPayoutRecipient (external earnings lane) revenue and routes value
 *         into the vault via an enforceable burn stream (VaultShareBurnStream).
 *
 * @dev Routing policy:
 * - Creator coin payouts: deposit directly into the vault and queue minted shares for burn.
 * - All other payout tokens: swap into ShareOFT (■), unwrap to vault shares (▢), then queue burn.
 *   This biases external-revenue buy pressure toward share holders instead of creator coin.
 *
 * @dev Notes:
 * - The burn stream MUST be configured on the vault (one-time) so it can burn its own shares.
 * - The payout router MUST be whitelisted on the wrapper so unwrap can run atomically after swaps.
 */
contract CreatorPayoutRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant EMERGENCY_WITHDRAW_DELAY = 1 days;

    struct ExternalSwapParams {
        address tokenIn;
        uint256 amountIn;
        uint256 minOut;
        address spender;
        address swapTarget;
        bytes swapCallData;
    }

    struct KeeperSpendCap {
        uint256 cap;
        uint64 window;
        uint64 windowStart;
        uint256 spentInWindow;
    }

    struct BatchAction {
        // kind=0 => convertAndQueue (v3 path / direct creator coin)
        // kind=1 => convertViaExternalAndQueue (allowlisted external swap target/spender)
        uint8 kind;
        address tokenIn;
        uint256 amountIn;
        uint256 minOut;
        address spender;
        address swapTarget;
        bytes swapCallData;
    }

    // ================================
    // IMMUTABLES
    // ================================

    IERC20 public immutable creatorCoin;
    IERC20 public immutable shareOFT;
    address public immutable vault;
    address public immutable wrapper;
    address public immutable burnStream;
    address public immutable swapRouter;
    address public immutable weth;
    address public constant DEFAULT_PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B;
    address public immutable protocolRewards;

    // ================================
    // CONFIG
    // ================================

    address public keeper;
    uint256 public swapDeadlineBuffer = 15 minutes;

    /// @notice Per-token keeper spend caps for external swap calls.
    /// @dev Caps apply only to `keeper` (owner is exempt).
    mapping(address => KeeperSpendCap) public keeperExternalSpendCaps;

    address public pendingEmergencyWithdrawToken;
    uint256 public pendingEmergencyWithdrawAmount;
    address public pendingEmergencyWithdrawTo;
    uint256 public pendingEmergencyWithdrawAt;

    /// @notice tokenIn => Uniswap V3 encoded path ending in `shareOFT`.
    mapping(address => bytes) public swapPathToShareOFT;

    mapping(address => bool) public approvedExternalSwapTargets;
    mapping(address => bool) public approvedExternalSwapSpenders;

    // ================================
    // EVENTS
    // ================================

    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event SwapPathSet(address indexed tokenIn, bytes path);
    event ConvertedAndQueued(address indexed tokenIn, uint256 amountIn, uint256 tokenOut, uint256 vaultSharesQueued);
    event ExternalSwapTargetApprovalSet(address indexed target, bool approved);
    event ExternalSwapSpenderApprovalSet(address indexed spender, bool approved);
    event ExternalSwapAndQueued(
        address indexed tokenIn,
        address indexed swapTarget,
        address indexed spender,
        uint256 amountIn,
        uint256 tokenOut,
        uint256 vaultSharesQueued
    );
    event BatchProcessed(uint256 actionCount, uint256 totalTokenOut, uint256 totalSharesQueued);
    event ProtocolRewardsClaimed(address indexed claimer, uint256 amount);
    event KeeperExternalSpendCapUpdated(address indexed tokenIn, uint256 cap, uint64 windowSeconds);
    event KeeperExternalSpendTracked(
        address indexed tokenIn, uint256 amountIn, uint256 spentInWindow, uint256 cap, uint256 windowResetsAt
    );
    event EmergencyWithdrawQueued(address indexed token, uint256 amount, address indexed to, uint256 executeAfter);
    event EmergencyWithdrawCancelled(address indexed token, uint256 amount, address indexed to);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    event ShareOftSwept(uint256 shareOftAmount, uint256 vaultSharesQueued);

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
    error MinOutNotMet(uint256 minExpected, uint256 actualOut);
    error InvalidBatchAction(uint8 kind);
    error ExternalSwapCallFailed();
    error ExternalSwapEthChanged();
    error ProtocolRewardsClaimFailed();
    error ProtocolRewardsHasNoCode(address candidate);
    error ProtectedPayoutAsset(address token);
    // FIX: L-3 (audit `docs/audits/aristotle/oracle`) — reject allowlisting a
    // self-referential/custody address as an external swap target or spender.
    error InvalidExternalSwapAddress(address addr);
    error InvalidKeeperSpendWindow(uint64 windowSeconds);
    error KeeperExternalSpendCapExceeded(
        address tokenIn, uint256 amountIn, uint256 spentInWindow, uint256 cap, uint256 windowResetsAt
    );
    error NoPendingEmergencyWithdraw();
    error EmergencyWithdrawTooEarly(uint256 executeAfter);
    error NoShareOftToSweep();

    modifier onlyOwnerOrKeeper() {
        if (msg.sender != owner() && msg.sender != keeper) revert NotAuthorized();
        _;
    }

    constructor(
        address _creatorCoin,
        address _vault,
        address _burnStream,
        address _shareOFT,
        address _wrapper,
        address _owner,
        address _swapRouter,
        address _weth,
        address _protocolRewards
    ) Ownable(_owner) {
        if (
            _creatorCoin == address(0) || _vault == address(0) || _burnStream == address(0) || _shareOFT == address(0)
                || _wrapper == address(0) || _owner == address(0) || _swapRouter == address(0) || _weth == address(0)
        ) {
            revert ZeroAddress();
        }

        creatorCoin = IERC20(_creatorCoin);
        shareOFT = IERC20(_shareOFT);
        vault = _vault;
        wrapper = _wrapper;
        burnStream = _burnStream;
        swapRouter = _swapRouter;
        weth = _weth;

        address rewards = _protocolRewards == address(0) ? DEFAULT_PROTOCOL_REWARDS : _protocolRewards;
        if (rewards.code.length == 0) revert ProtocolRewardsHasNoCode(rewards);
        protocolRewards = rewards;

        IERC20(_creatorCoin).forceApprove(_vault, type(uint256).max);
        IERC20(_shareOFT).forceApprove(_wrapper, type(uint256).max);
    }

    receive() external payable {
        if (msg.value > 0) {
            IWETH(weth).deposit{value: msg.value}();
        }
    }

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

    function setSwapDeadlineBuffer(uint256 _buffer) external onlyOwner {
        require(_buffer >= 1 minutes && _buffer <= 1 hours, "Invalid buffer");
        swapDeadlineBuffer = _buffer;
    }

    /**
     * @notice Set the Uniswap V3 swap path for a non-creator-coin payout token into ShareOFT.
     * @dev FIX ODA-520-H2/M4 — do not grant a standing unlimited `swapRouter` allowance.
     *      `_convertAndQueue` approves exactly `amountIn` per call and resets to 0 after.
     */
    function setSwapPath(address tokenIn, bytes calldata path) external onlyOwner {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (tokenIn == address(creatorCoin) || tokenIn == address(shareOFT)) revert InvalidPath(tokenIn);
        // Uniswap V3 path: token(20) + N*(fee(3)+token(20)) => length = 20 + 23*hops, hops >= 1.
        if (path.length < 43 || (path.length - 20) % 23 != 0) revert InvalidPath(tokenIn);

        address start = _readAddress(path, 0);
        address end = _readAddress(path, path.length - 20);
        if (start != tokenIn || end != address(shareOFT)) revert InvalidPath(tokenIn);

        swapPathToShareOFT[tokenIn] = path;

        emit SwapPathSet(tokenIn, path);
    }

    /// @dev FIX: L-3 — a compromised keeper can route arbitrary calldata to any approved
    ///      target (`_convertViaExternalAndQueue` uses caller-controlled `swapCallData`).
    ///      Block owner-error/compromise from ever allowlisting this contract's own
    ///      custody surfaces (self, vault, wrapper, burn stream, managed tokens, WETH,
    ///      protocolRewards, or the canonical `swapRouter` that holds/receives approvals)
    ///      as a target/spender. Canonical third-party DEX aggregators only.
    /// @dev FIX ODA-520-H2 — omit `swapRouter`/`weth`/`protocolRewards` from the blocklist
    ///      previously enabled a cross-token drain via standing V3 allowances.
    function _requireSafeExternalSwapAddress(address addr) internal view {
        if (
            addr == address(this) || addr == vault || addr == wrapper || addr == burnStream
                || addr == address(creatorCoin) || addr == address(shareOFT) || addr == swapRouter || addr == weth
                || addr == protocolRewards
        ) {
            revert InvalidExternalSwapAddress(addr);
        }
    }

    function setExternalSwapTargetApproval(address target, bool approved) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        if (approved) _requireSafeExternalSwapAddress(target);
        approvedExternalSwapTargets[target] = approved;
        emit ExternalSwapTargetApprovalSet(target, approved);
    }

    function setExternalSwapSpenderApproval(address spender, bool approved) external onlyOwner {
        if (spender == address(0)) revert ZeroAddress();
        if (approved) _requireSafeExternalSwapAddress(spender);
        approvedExternalSwapSpenders[spender] = approved;
        emit ExternalSwapSpenderApprovalSet(spender, approved);
    }

    /// @dev FIX ODA-520-L5 — reconfiguration must not refund accrued keeper spend. Only
    ///      initialize the window on first configure (`windowStart == 0`). When spend is
    ///      already accrued, re-anchor `windowStart` so a shorter window cannot
    ///      idle-reset and clear the ledger under new parameters.
    function setKeeperExternalSpendCap(address tokenIn, uint256 cap, uint64 windowSeconds) external onlyOwner {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (cap > 0 && windowSeconds == 0) revert InvalidKeeperSpendWindow(windowSeconds);

        KeeperSpendCap storage spendCap = keeperExternalSpendCaps[tokenIn];
        if (spendCap.windowStart == 0) {
            spendCap.windowStart = uint64(block.timestamp);
            spendCap.spentInWindow = 0;
        } else if (spendCap.spentInWindow > 0) {
            spendCap.windowStart = uint64(block.timestamp);
        }
        spendCap.cap = cap;
        spendCap.window = windowSeconds;

        emit KeeperExternalSpendCapUpdated(tokenIn, cap, windowSeconds);
    }

    /**
     * @notice Convert payout revenue into queued vault-share burns.
     * @param tokenIn Creator coin is deposited directly; all other tokens swap to ShareOFT first.
     * @param minOut Slippage guard for swaps (ShareOFT out). Ignored for direct creator-coin deposits.
     */
    function convertAndQueue(address tokenIn, uint256 amountIn, uint256 minOut)
        external
        nonReentrant
        onlyOwnerOrKeeper
        returns (uint256 tokenOut, uint256 sharesQueued)
    {
        return _convertAndQueue(tokenIn, amountIn, minOut);
    }

    function convertViaExternalAndQueue(ExternalSwapParams calldata params)
        external
        nonReentrant
        onlyOwnerOrKeeper
        returns (uint256 tokenOut, uint256 sharesQueued)
    {
        return _convertViaExternalAndQueue(
            params.tokenIn,
            params.amountIn,
            params.minOut,
            params.spender,
            params.swapTarget,
            params.swapCallData
        );
    }

    function processBatch(BatchAction[] calldata actions)
        external
        nonReentrant
        onlyOwnerOrKeeper
        returns (uint256 totalTokenOut, uint256 totalSharesQueued)
    {
        if (actions.length == 0) revert ZeroAmount();

        uint256 len = actions.length;
        for (uint256 i = 0; i < len; i++) {
            BatchAction calldata action = actions[i];
            uint256 out;
            uint256 sharesQueued;

            if (action.kind == 0) {
                (out, sharesQueued) = _convertAndQueue(action.tokenIn, action.amountIn, action.minOut);
            } else if (action.kind == 1) {
                (out, sharesQueued) = _convertViaExternalAndQueue(
                    action.tokenIn,
                    action.amountIn,
                    action.minOut,
                    action.spender,
                    action.swapTarget,
                    action.swapCallData
                );
            } else {
                revert InvalidBatchAction(action.kind);
            }

            totalTokenOut += out;
            totalSharesQueued += sharesQueued;
        }

        emit BatchProcessed(actions.length, totalTokenOut, totalSharesQueued);
    }

    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        pendingEmergencyWithdrawToken = token;
        pendingEmergencyWithdrawAmount = amount;
        pendingEmergencyWithdrawTo = to;
        pendingEmergencyWithdrawAt = block.timestamp + EMERGENCY_WITHDRAW_DELAY;

        emit EmergencyWithdrawQueued(token, amount, to, pendingEmergencyWithdrawAt);
    }

    function cancelEmergencyWithdraw() external onlyOwner {
        address token = pendingEmergencyWithdrawToken;
        uint256 amount = pendingEmergencyWithdrawAmount;
        address to = pendingEmergencyWithdrawTo;
        if (to == address(0) || amount == 0) revert NoPendingEmergencyWithdraw();

        pendingEmergencyWithdrawToken = address(0);
        pendingEmergencyWithdrawAmount = 0;
        pendingEmergencyWithdrawTo = address(0);
        pendingEmergencyWithdrawAt = 0;

        emit EmergencyWithdrawCancelled(token, amount, to);
    }

    function executeEmergencyWithdraw() external onlyOwner nonReentrant {
        address token = pendingEmergencyWithdrawToken;
        uint256 amount = pendingEmergencyWithdrawAmount;
        address to = pendingEmergencyWithdrawTo;
        uint256 executeAfter = pendingEmergencyWithdrawAt;
        if (to == address(0) || amount == 0 || executeAfter == 0) revert NoPendingEmergencyWithdraw();
        if (block.timestamp < executeAfter) revert EmergencyWithdrawTooEarly(executeAfter);

        pendingEmergencyWithdrawToken = address(0);
        pendingEmergencyWithdrawAmount = 0;
        pendingEmergencyWithdrawTo = address(0);
        pendingEmergencyWithdrawAt = 0;

        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        // FIX: L-4 (audit `docs/audits/aristotle/oracle`) — WETH is an in-flight payout
        // asset too (native ETH sent to `receive()` is deposited to WETH pending
        // `convertAndQueue`/`convertViaExternalAndQueue`); protect it the same way as
        // the creator coin and ShareOFT so owner-drain centralization can't skim funds
        // mid-flight. Use `convertAndQueue`/`convertViaExternalAndQueue` for WETH instead.
        if (token == address(creatorCoin) || token == address(shareOFT) || token == weth) {
            revert ProtectedPayoutAsset(token);
        }

        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, to, amount);
    }

    function protocolRewardsClaimable() external view returns (uint256) {
        return IProtocolRewards(protocolRewards).balanceOf(address(this));
    }

    function claimProtocolRewards(uint256 amount) external onlyOwnerOrKeeper nonReentrant returns (uint256 claimed) {
        if (amount == 0) revert ZeroAmount();
        _claimProtocolRewards(amount);
        emit ProtocolRewardsClaimed(msg.sender, amount);
        return amount;
    }

    function claimAllProtocolRewards() external onlyOwnerOrKeeper nonReentrant returns (uint256 claimed) {
        uint256 claimable = IProtocolRewards(protocolRewards).balanceOf(address(this));
        if (claimable == 0) revert ZeroAmount();
        _claimProtocolRewards(claimable);
        emit ProtocolRewardsClaimed(msg.sender, claimable);
        return claimable;
    }

    /// @notice Queue any residual ShareOFT held outside a measured swap delta into the burn stream.
    /// @dev FIX ODA-520-L3 — ShareOFT arriving via dust/direct transfer had no exit path:
    ///      convert paths reject `tokenIn == shareOFT`, emergency withdraw protects it, and
    ///      unwrap only consumes measured swap deltas.
    function sweepShareOFT() external onlyOwnerOrKeeper nonReentrant returns (uint256 sharesQueued) {
        uint256 bal = shareOFT.balanceOf(address(this));
        if (bal == 0) revert NoShareOftToSweep();
        sharesQueued = _unwrapShareOftAndQueue(bal);
        emit ShareOftSwept(bal, sharesQueued);
    }

    function _convertAndQueue(address tokenIn, uint256 amountIn, uint256 minOut)
        internal
        returns (uint256 tokenOut, uint256 sharesQueued)
    {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroAmount();

        // FIX ODA-520-H1 — keeper spend cap must apply to the V3 / direct-deposit venue,
        // not only `convertViaExternalAndQueue`. Owner remains exempt.
        _consumeKeeperExternalSpend(tokenIn, amountIn);

        if (tokenIn == address(creatorCoin)) {
            // Direct deposit: minOut is unused (no swap).
            tokenOut = amountIn;
            sharesQueued = _queueCreatorCoinDeposit(tokenOut);
            emit ConvertedAndQueued(tokenIn, amountIn, tokenOut, sharesQueued);
            return (tokenOut, sharesQueued);
        }

        // M-NEW-01 / L2-03: swap path must set a non-zero slippage floor.
        if (minOut == 0) revert ZeroAmount();

        bytes memory path = swapPathToShareOFT[tokenIn];
        if (path.length == 0) revert PathNotSet(tokenIn);

        IERC20 inToken = IERC20(tokenIn);
        if (inToken.balanceOf(address(this)) < amountIn) revert ZeroAmount();

        // FIX ODA-520-H2/M4 — per-call allowance; never leave a standing max approve.
        inToken.forceApprove(swapRouter, 0);
        inToken.forceApprove(swapRouter, amountIn);

        uint256 shareBefore = shareOFT.balanceOf(address(this));
        ISwapRouterV3(swapRouter).exactInput(
            ISwapRouterV3.ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp + swapDeadlineBuffer,
                amountIn: amountIn,
                amountOutMinimum: minOut
            })
        );
        inToken.forceApprove(swapRouter, 0);

        tokenOut = shareOFT.balanceOf(address(this)) - shareBefore;
        if (tokenOut < minOut) revert MinOutNotMet(minOut, tokenOut);

        sharesQueued = _unwrapShareOftAndQueue(tokenOut);
        emit ConvertedAndQueued(tokenIn, amountIn, tokenOut, sharesQueued);
    }

    function _convertViaExternalAndQueue(
        address tokenIn,
        uint256 amountIn,
        uint256 minOut,
        address spender,
        address swapTarget,
        bytes calldata swapCallData
    ) internal returns (uint256 tokenOut, uint256 sharesQueued) {
        if (tokenIn == address(0) || spender == address(0) || swapTarget == address(0)) revert ZeroAddress();
        if (tokenIn == address(creatorCoin) || tokenIn == address(shareOFT)) revert InvalidPath(tokenIn);
        if (amountIn == 0 || minOut == 0) revert ZeroAmount();
        if (!approvedExternalSwapTargets[swapTarget]) revert ExternalSwapTargetNotApproved(swapTarget);
        if (!approvedExternalSwapSpenders[spender]) revert ExternalSwapSpenderNotApproved(spender);
        _consumeKeeperExternalSpend(tokenIn, amountIn);

        IERC20 inToken = IERC20(tokenIn);
        uint256 tokenInBefore = inToken.balanceOf(address(this));
        if (tokenInBefore < amountIn) revert ZeroAmount();
        uint256 shareBefore = shareOFT.balanceOf(address(this));

        // M-05: only call contracts with code; never attach native value (custody surface).
        if (swapTarget.code.length == 0) revert InvalidExternalSwapAddress(swapTarget);

        inToken.forceApprove(spender, 0);
        inToken.forceApprove(spender, amountIn);

        uint256 ethBefore = address(this).balance;
        (bool ok, bytes memory returnData) = swapTarget.call{value: 0}(swapCallData);
        inToken.forceApprove(spender, 0);
        if (!ok) _revertWithBytes(returnData);
        if (address(this).balance != ethBefore) revert ExternalSwapEthChanged();

        uint256 tokenInAfter = inToken.balanceOf(address(this));
        // Fail closed with a diagnosable error when tokenIn increases (refund/rebase) or
        // when spent exceeds the declared amountIn — avoid bare underflow panic.
        if (tokenInAfter < tokenInBefore) {
            uint256 spent = tokenInBefore - tokenInAfter;
            if (spent > amountIn) {
                revert ExternalSwapOverspent(tokenIn, spent, amountIn);
            }
        }

        uint256 shareAfter = shareOFT.balanceOf(address(this));
        tokenOut = shareAfter - shareBefore;
        if (tokenOut < minOut) revert MinOutNotMet(minOut, tokenOut);

        sharesQueued = _unwrapShareOftAndQueue(tokenOut);
        emit ExternalSwapAndQueued(tokenIn, swapTarget, spender, amountIn, tokenOut, sharesQueued);
    }

    /// @dev FIX ODA-520-L5 — idle-gated window. Accrued spend clears only after a full
    ///      `window` elapses since `windowStart`, and every successful spend slides
    ///      `windowStart` to `block.timestamp`. That blocks:
    ///      (1) the old fixed-boundary 2× burst (spend at windowEnd-1 and again at windowEnd), and
    ///      (2) leaky-bucket mid-window refill that could approach 2× cap inside one nominal window.
    ///      `windowResetsAt` is when the current accrual would idle-clear if no further spends occur.
    function _consumeKeeperExternalSpend(address tokenIn, uint256 amountIn) internal {
        if (msg.sender != keeper || keeper == address(0)) return;

        KeeperSpendCap storage spendCap = keeperExternalSpendCaps[tokenIn];
        uint256 cap = spendCap.cap;
        uint64 window = spendCap.window;
        if (cap == 0 || window == 0) {
            revert KeeperExternalSpendCapExceeded(tokenIn, amountIn, 0, cap, 0);
        }

        uint256 windowStart = spendCap.windowStart;
        uint256 spent = spendCap.spentInWindow;
        if (windowStart == 0 || block.timestamp >= windowStart + window) {
            spent = 0;
        }

        uint256 newSpent = spent + amountIn;
        if (newSpent > cap) {
            uint256 retryAt =
                (windowStart == 0 || block.timestamp >= windowStart + window)
                    ? block.timestamp + window
                    : windowStart + window;
            revert KeeperExternalSpendCapExceeded(tokenIn, amountIn, spent, cap, retryAt);
        }

        spendCap.spentInWindow = newSpent;
        spendCap.windowStart = uint64(block.timestamp);
        emit KeeperExternalSpendTracked(tokenIn, amountIn, newSpent, cap, block.timestamp + window);
    }

    function _queueCreatorCoinDeposit(uint256 creatorAmount) internal returns (uint256 sharesQueued) {
        if (creatorAmount == 0) revert ZeroAmount();
        sharesQueued = ICreatorOVaultDeposit(vault).deposit(creatorAmount, burnStream);
        if (sharesQueued == 0) revert ZeroAmount();
        IVaultShareBurnStream(burnStream).queueShares(sharesQueued);
    }

    function _unwrapShareOftAndQueue(uint256 shareOftAmount) internal returns (uint256 sharesQueued) {
        if (shareOftAmount == 0) revert ZeroAmount();
        sharesQueued = IWrapperUnwrap(wrapper).unwrap(shareOftAmount);
        if (sharesQueued == 0) revert ZeroAmount();

        IERC20(vault).safeTransfer(burnStream, sharesQueued);
        IVaultShareBurnStream(burnStream).queueShares(sharesQueued);
    }

    function _readAddress(bytes memory data, uint256 offset) internal pure returns (address addr) {
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
        // Primary: withdraw(address,uint256) = 0xf3fef3a3
        (bool ok,) = protocolRewards.call(abi.encodeWithSelector(bytes4(0xf3fef3a3), address(this), amount));
        if (!ok) {
            // Fallback: Zora ProtocolRewards withdrawFor(address,uint256) = 0xdb518db2
            // (previous 0x9f1d9267 was withdrawFor(address,address,uint256) — wrong arity).
            (ok,) = protocolRewards.call(abi.encodeWithSelector(bytes4(0xdb518db2), address(this), amount));
        }
        if (!ok) revert ProtocolRewardsClaimFailed();
    }
}
