// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAlfaFriendKey} from "@4626/other/alfaclub/interfaces/IAlfaFriendKey.sol";
import {IFriendKeyOERC1155} from "@4626/other/alfaclub/interfaces/IFriendKeyOERC1155.sol";

/**
 * @title FriendKeyBuyExecutor
 * @notice Across destination handler: USDC fill → buy allowlisted FriendKey id → LZ wrap to Robinhood.
 * @dev Only the Base Across SpokePool may call `handleV3AcrossMessage`.
 *      Prefund this contract with Base ETH for LayerZero wrap fees.
 *      Across message: abi.encode(address recipient, uint256 tokenId, uint256 keyAmount)
 */
contract FriendKeyBuyExecutor is Ownable, ReentrancyGuard, ERC1155Holder {
    using SafeERC20 for IERC20;

    address public immutable spokePool;
    IERC20 public immutable usdc;
    IAlfaFriendKey public immutable friendKey;
    IFriendKeyOERC1155 public immutable wrap;
    uint32 public immutable robinhoodEid;

    bytes public defaultLzOptions;

    error UnauthorizedCaller();
    error InvalidToken();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidMessage();
    error UnderlyingMismatch();
    error TokenNotAllowed();

    event PurchasedAndWrapped(
        address indexed recipient,
        uint256 indexed tokenId,
        uint256 keyAmount,
        uint256 usdcSpent,
        uint256 usdcRefunded,
        bytes32 guid
    );
    event DefaultLzOptionsUpdated(bytes options);
    event EthRescued(address indexed to, uint256 amount);
    event Erc20Rescued(address indexed token, address indexed to, uint256 amount);

    constructor(
        address spokePool_,
        address usdc_,
        address friendKey_,
        address wrap_,
        uint32 robinhoodEid_,
        address owner_,
        bytes memory defaultLzOptions_
    ) Ownable(owner_) {
        if (
            spokePool_ == address(0) || usdc_ == address(0) || friendKey_ == address(0) || wrap_ == address(0)
                || owner_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (robinhoodEid_ == 0) revert InvalidAmount();
        if (IFriendKeyOERC1155(wrap_).underlying() != friendKey_) revert UnderlyingMismatch();

        spokePool = spokePool_;
        usdc = IERC20(usdc_);
        friendKey = IAlfaFriendKey(friendKey_);
        wrap = IFriendKeyOERC1155(wrap_);
        robinhoodEid = robinhoodEid_;
        defaultLzOptions = defaultLzOptions_;
    }

    receive() external payable {}

    function setDefaultLzOptions(bytes calldata options_) external onlyOwner {
        defaultLzOptions = options_;
        emit DefaultLzOptionsUpdated(options_);
    }

    /**
     * @notice Across V3 destination hook.
     * @param tokenSent Must be Base USDC.
     * @param amount USDC delivered by Across (authoritative spend budget).
     * @param message abi.encode(address recipient, uint256 tokenId, uint256 keyAmount)
     */
    function handleV3AcrossMessage(address tokenSent, uint256 amount, address, /* relayer */ bytes memory message)
        external
        nonReentrant
    {
        if (msg.sender != spokePool) revert UnauthorizedCaller();
        if (tokenSent != address(usdc)) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (message.length < 96) revert InvalidMessage();

        (address recipient, uint256 tokenId, uint256 keyAmount) =
            abi.decode(message, (address, uint256, uint256));
        if (recipient == address(0) || keyAmount == 0) revert InvalidMessage();
        if (!wrap.tokenAllowed(tokenId)) revert TokenNotAllowed();

        // Across has already credited `amount`. Attribute only this fill for refunds so
        // residual USDC (dust / mistaken transfers) is not swept to the recipient.
        uint256 balBefore = usdc.balanceOf(address(this));
        uint256 preexisting = balBefore > amount ? balBefore - amount : 0;

        usdc.forceApprove(address(friendKey), amount);
        friendKey.buyShares(tokenId, keyAmount, amount);
        usdc.forceApprove(address(friendKey), 0);

        uint256 balAfter = usdc.balanceOf(address(this));
        uint256 refund = balAfter > preexisting ? balAfter - preexisting : 0;
        if (refund > amount) refund = amount;
        if (refund > 0) {
            usdc.safeTransfer(recipient, refund);
        }

        if (!friendKey.isApprovedForAll(address(this), address(wrap))) {
            friendKey.setApprovalForAll(address(wrap), true);
        }

        uint256 ethBefore = address(this).balance;
        bytes32 guid = wrap.send{value: ethBefore}(
            robinhoodEid, recipient, tokenId, keyAmount, defaultLzOptions, address(this)
        ).guid;

        emit PurchasedAndWrapped(recipient, tokenId, keyAmount, amount - refund, refund, guid);
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
}
