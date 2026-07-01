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
 * @title PayoutRouter
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
contract PayoutRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct ExternalSwapParams {
        address tokenIn;
        uint256 amountIn;
        uint256 minOut;
        address spender;
        address swapTarget;
        bytes swapCallData;
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
    error MinOutNotMet(uint256 minExpected, uint256 actualOut);
    error InvalidBatchAction(uint8 kind);
    error ExternalSwapCallFailed();
    error ProtocolRewardsClaimFailed();
    error ProtocolRewardsHasNoCode(address candidate);

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
     */
    function setSwapPath(address tokenIn, bytes calldata path) external onlyOwner {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (tokenIn == address(creatorCoin) || tokenIn == address(shareOFT)) revert InvalidPath(tokenIn);
        if (path.length < 43) revert InvalidPath(tokenIn);

        address start = _readAddress(path, 0);
        address end = _readAddress(path, path.length - 20);
        if (start != tokenIn || end != address(shareOFT)) revert InvalidPath(tokenIn);

        swapPathToShareOFT[tokenIn] = path;
        IERC20(tokenIn).forceApprove(swapRouter, type(uint256).max);

        emit SwapPathSet(tokenIn, path);
    }

    function setExternalSwapTargetApproval(address target, bool approved) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        approvedExternalSwapTargets[target] = approved;
        emit ExternalSwapTargetApprovalSet(target, approved);
    }

    function setExternalSwapSpenderApproval(address spender, bool approved) external onlyOwner {
        if (spender == address(0)) revert ZeroAddress();
        approvedExternalSwapSpenders[spender] = approved;
        emit ExternalSwapSpenderApprovalSet(spender, approved);
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

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

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

    function _convertAndQueue(address tokenIn, uint256 amountIn, uint256 minOut)
        internal
        returns (uint256 tokenOut, uint256 sharesQueued)
    {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroAmount();

        if (tokenIn == address(creatorCoin)) {
            tokenOut = amountIn;
            sharesQueued = _queueCreatorCoinDeposit(tokenOut);
            emit ConvertedAndQueued(tokenIn, amountIn, tokenOut, sharesQueued);
            return (tokenOut, sharesQueued);
        }

        bytes memory path = swapPathToShareOFT[tokenIn];
        if (path.length == 0) revert PathNotSet(tokenIn);

        IERC20 inToken = IERC20(tokenIn);
        if (inToken.balanceOf(address(this)) < amountIn) revert ZeroAmount();

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

        IERC20 inToken = IERC20(tokenIn);
        uint256 tokenInBefore = inToken.balanceOf(address(this));
        if (tokenInBefore < amountIn) revert ZeroAmount();
        uint256 shareBefore = shareOFT.balanceOf(address(this));

        inToken.forceApprove(spender, 0);
        inToken.forceApprove(spender, amountIn);

        (bool ok, bytes memory returnData) = swapTarget.call(swapCallData);
        inToken.forceApprove(spender, 0);
        if (!ok) _revertWithBytes(returnData);

        uint256 tokenInAfter = inToken.balanceOf(address(this));
        if (tokenInBefore - tokenInAfter > amountIn) {
            revert ExternalSwapOverspent(tokenIn, tokenInBefore - tokenInAfter, amountIn);
        }

        uint256 shareAfter = shareOFT.balanceOf(address(this));
        tokenOut = shareAfter - shareBefore;
        if (tokenOut < minOut) revert MinOutNotMet(minOut, tokenOut);

        sharesQueued = _unwrapShareOftAndQueue(tokenOut);
        emit ExternalSwapAndQueued(tokenIn, swapTarget, spender, amountIn, tokenOut, sharesQueued);
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
        (bool ok,) = protocolRewards.call(abi.encodeWithSelector(bytes4(0xf3fef3a3), address(this), amount));
        if (!ok) {
            (ok,) =
                protocolRewards.call(abi.encodeWithSelector(bytes4(0x9f1d9267), address(this), address(this), amount));
        }
        if (!ok) revert ProtocolRewardsClaimFailed();
    }
}
