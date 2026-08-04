// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IAlfaFriendKey} from "@4626/interfaces/IAlfaFriendKey.sol";
import {IFriendKeyOERC1155} from "@4626/interfaces/IFriendKeyOERC1155.sol";
import {FriendKeySellSinkFactory} from "@4626/across/FriendKeySellSinkFactory.sol";
import {FriendKeySellSink} from "@4626/across/FriendKeySellSink.sol";

interface IAcrossSpokePoolV3 {
    function depositV3(
        address depositor,
        address recipient,
        address inputToken,
        address outputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 destinationChainId,
        address exclusiveRelayer,
        uint32 quoteTimestamp,
        uint32 fillDeadline,
        uint32 exclusivityDeadline,
        bytes calldata message
    ) external payable;
}

/**
 * @title FriendKeySellExecutor
 * @notice Base sell path for allowlisted FriendKey ids → Across USDC→USDG on Robinhood.
 *
 * Seamless (one RH signature):
 *   1. Ensure `factory.deploySink(user)` once on Base.
 *   2. On Robinhood: `wrap.send(BaseEid, factory.sinkOf(user), tokenId, amount, …)`.
 *   3. Hub unlocks keys into the sink → `sellFromSink` sells + Across to `user`.
 */
contract FriendKeySellExecutor is Ownable, ReentrancyGuard, ERC1155Holder {
    using SafeERC20 for IERC20;

    uint256 public constant ROBINHOOD_CHAIN_ID = 4663;
    uint16 public constant BPS = 10_000;

    address public immutable spokePool;
    IERC20 public immutable usdc;
    address public immutable usdgRobinhood;
    IAlfaFriendKey public immutable friendKey;
    IFriendKeyOERC1155 public immutable wrap;

    FriendKeySellSinkFactory public sinkFactory;

    uint16 public acrossOutputBps = 9_850;
    uint32 public fillDeadlineSeconds = 6 hours;
    uint16 public sellSlippageBps = 9_900;

    error ZeroAddress();
    error InvalidAmount();
    error InsufficientKeys();
    error InsufficientProceeds();
    error OnlySink();
    error OnlyUser();
    error FactoryAlreadySet();
    error InvalidBps();
    error UnderlyingMismatch();
    error TokenNotAllowed();

    event SinkFactorySet(address indexed factory);
    event SeamlessParamsUpdated(uint16 acrossOutputBps, uint32 fillDeadlineSeconds, uint16 sellSlippageBps);
    event SoldAndBridged(
        address indexed user,
        address indexed usdgRecipient,
        uint256 indexed tokenId,
        uint256 keyAmount,
        uint256 usdcProceeds,
        uint256 acrossOutputAmount
    );
    event EthRescued(address indexed to, uint256 amount);
    event Erc20Rescued(address indexed token, address indexed to, uint256 amount);

    struct AcrossV3Quote {
        uint256 outputAmount;
        address exclusiveRelayer;
        uint32 quoteTimestamp;
        uint32 fillDeadline;
        uint32 exclusivityDeadline;
    }

    constructor(
        address spokePool_,
        address usdc_,
        address usdgRobinhood_,
        address friendKey_,
        address wrap_,
        address owner_
    ) Ownable(owner_) {
        if (
            spokePool_ == address(0) || usdc_ == address(0) || usdgRobinhood_ == address(0)
                || friendKey_ == address(0) || wrap_ == address(0) || owner_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (IFriendKeyOERC1155(wrap_).underlying() != friendKey_) revert UnderlyingMismatch();

        spokePool = spokePool_;
        usdc = IERC20(usdc_);
        usdgRobinhood = usdgRobinhood_;
        friendKey = IAlfaFriendKey(friendKey_);
        wrap = IFriendKeyOERC1155(wrap_);
    }

    function setSinkFactory(address factory_) external onlyOwner {
        if (address(sinkFactory) != address(0)) revert FactoryAlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        sinkFactory = FriendKeySellSinkFactory(factory_);
        emit SinkFactorySet(factory_);
    }

    function setSeamlessParams(uint16 acrossOutputBps_, uint32 fillDeadlineSeconds_, uint16 sellSlippageBps_)
        external
        onlyOwner
    {
        if (acrossOutputBps_ == 0 || acrossOutputBps_ > BPS) revert InvalidBps();
        if (sellSlippageBps_ == 0 || sellSlippageBps_ > BPS) revert InvalidBps();
        if (fillDeadlineSeconds_ < 30 minutes) revert InvalidAmount();
        acrossOutputBps = acrossOutputBps_;
        fillDeadlineSeconds = fillDeadlineSeconds_;
        sellSlippageBps = sellSlippageBps_;
        emit SeamlessParamsUpdated(acrossOutputBps_, fillDeadlineSeconds_, sellSlippageBps_);
    }

    function sellFromSink(uint256 tokenId, uint256 keyAmount) external nonReentrant {
        FriendKeySellSinkFactory factory = sinkFactory;
        if (address(factory) == address(0)) revert ZeroAddress();
        if (keyAmount == 0) revert InvalidAmount();
        if (!wrap.tokenAllowed(tokenId)) revert TokenNotAllowed();

        address expectedSink = factory.sinkOf(FriendKeySellSink(msg.sender).user());
        if (msg.sender != expectedSink || msg.sender.code.length == 0) revert OnlySink();

        address user = FriendKeySellSink(msg.sender).user();
        uint256 bal = friendKey.balanceOf(msg.sender, tokenId);
        if (bal < keyAmount) revert InsufficientKeys();

        friendKey.safeTransferFrom(msg.sender, address(this), tokenId, keyAmount, "");

        uint256 minUsdcOut = friendKey.getSellPriceAfterFee(tokenId, keyAmount) * sellSlippageBps / BPS;
        if (minUsdcOut == 0) revert InvalidAmount();

        uint256 usdcBefore = usdc.balanceOf(address(this));
        friendKey.sellShares(tokenId, keyAmount, minUsdcOut);
        uint256 proceeds = usdc.balanceOf(address(this)) - usdcBefore;
        if (proceeds < minUsdcOut) revert InsufficientProceeds();

        uint256 outputAmount = proceeds * acrossOutputBps / BPS;
        if (outputAmount == 0) revert InvalidAmount();

        AcrossV3Quote memory across = AcrossV3Quote({
            outputAmount: outputAmount,
            exclusiveRelayer: address(0),
            quoteTimestamp: uint32(block.timestamp),
            fillDeadline: uint32(block.timestamp + fillDeadlineSeconds),
            exclusivityDeadline: 0
        });

        _acrossDeposit(user, proceeds, across);
        emit SoldAndBridged(user, user, tokenId, keyAmount, proceeds, across.outputAmount);
    }

    function sellAndBridge(
        address user,
        address usdgRecipient,
        uint256 tokenId,
        uint256 keyAmount,
        uint256 minUsdcOut,
        AcrossV3Quote calldata across
    ) external nonReentrant {
        if (user == address(0) || usdgRecipient == address(0)) revert ZeroAddress();
        if (msg.sender != user) revert OnlyUser();
        if (keyAmount == 0 || minUsdcOut == 0 || across.outputAmount == 0) revert InvalidAmount();
        if (!wrap.tokenAllowed(tokenId)) revert TokenNotAllowed();

        uint256 userBal = friendKey.balanceOf(user, tokenId);
        if (userBal < keyAmount) revert InsufficientKeys();

        friendKey.safeTransferFrom(user, address(this), tokenId, keyAmount, "");

        uint256 usdcBefore = usdc.balanceOf(address(this));
        friendKey.sellShares(tokenId, keyAmount, minUsdcOut);
        uint256 proceeds = usdc.balanceOf(address(this)) - usdcBefore;
        if (proceeds < minUsdcOut) revert InsufficientProceeds();
        if (across.outputAmount > proceeds) revert InsufficientProceeds();

        _acrossDeposit(usdgRecipient, proceeds, across);
        emit SoldAndBridged(user, usdgRecipient, tokenId, keyAmount, proceeds, across.outputAmount);
    }

    function _acrossDeposit(address usdgRecipient, uint256 proceeds, AcrossV3Quote memory across) internal {
        usdc.forceApprove(spokePool, proceeds);
        IAcrossSpokePoolV3(spokePool).depositV3(
            address(this),
            usdgRecipient,
            address(usdc),
            usdgRobinhood,
            proceeds,
            across.outputAmount,
            ROBINHOOD_CHAIN_ID,
            across.exclusiveRelayer,
            across.quoteTimestamp,
            across.fillDeadline,
            across.exclusivityDeadline,
            bytes("")
        );
        usdc.forceApprove(spokePool, 0);
    }

    function rescueEth(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        require(ok, "ETH_TRANSFER");
        emit EthRescued(to, amount);
    }

    function rescueErc20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0) || token == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit Erc20Rescued(token, to, amount);
    }

    function rescueErc1155(address token, address to, uint256 id, uint256 amount) external onlyOwner {
        if (to == address(0) || token == address(0)) revert ZeroAddress();
        IERC1155(token).safeTransferFrom(address(this), to, id, amount, "");
    }
}
