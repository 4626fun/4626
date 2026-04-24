// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title AlfaCreatorKeyPool
 * @notice Constant-product secondary AMM for one Creator Coin and one AlfaClub FriendKey tokenId.
 */
contract AlfaCreatorKeyPool is ERC20, IERC1155Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BPS = 690;
    uint256 public constant BPS = 10_000;

    address public immutable factory;
    address public immutable friendKey;
    address public immutable creatorCoin;
    uint256 public immutable keyTokenId;

    event LiquidityAdded(
        address indexed provider,
        address indexed recipient,
        uint256 keyAmount,
        uint256 creatorCoinAmount,
        uint256 lpShares
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed recipient,
        uint256 keyAmount,
        uint256 creatorCoinAmount,
        uint256 lpShares
    );
    event KeysBought(address indexed buyer, address indexed recipient, uint256 keyAmount, uint256 creatorCoinAmountIn);
    event KeysSold(address indexed seller, address indexed recipient, uint256 keyAmount, uint256 creatorCoinAmountOut);

    error ZeroAddress();
    error ZeroAmount();
    error NotFactory();
    error AlreadyInitialized();
    error InsufficientLiquidityMinted();
    error InsufficientReserves();
    error SlippageExceeded();
    error WrongFriendKey();
    error WrongTokenId(uint256 tokenId);
    error BatchTransfersUnsupported();
    error FeeOnTransferUnsupported();

    constructor(address _friendKey, address _creatorCoin, uint256 _keyTokenId) ERC20("4626 AlfaClub Key LP", "akLP") {
        if (_friendKey == address(0) || _creatorCoin == address(0)) revert ZeroAddress();
        factory = msg.sender;
        friendKey = _friendKey;
        creatorCoin = _creatorCoin;
        keyTokenId = _keyTokenId;
    }

    function getReserves() public view returns (uint256 creatorCoinReserve, uint256 keyReserve) {
        creatorCoinReserve = IERC20(creatorCoin).balanceOf(address(this));
        keyReserve = IERC1155(friendKey).balanceOf(address(this), keyTokenId);
    }

    function mintInitialLiquidity(uint256 keyAmount, uint256 creatorCoinAmount, address recipient)
        external
        nonReentrant
        returns (uint256 lpShares)
    {
        if (msg.sender != factory) revert NotFactory();
        if (recipient == address(0)) revert ZeroAddress();
        if (totalSupply() != 0) revert AlreadyInitialized();
        if (keyAmount == 0 || creatorCoinAmount == 0) revert ZeroAmount();

        (uint256 creatorCoinReserve, uint256 keyReserve) = getReserves();
        if (creatorCoinReserve < creatorCoinAmount || keyReserve < keyAmount) revert InsufficientReserves();

        lpShares = _sqrt(creatorCoinAmount * keyAmount);
        if (lpShares == 0) revert InsufficientLiquidityMinted();

        _mint(recipient, lpShares);
        emit LiquidityAdded(msg.sender, recipient, keyAmount, creatorCoinAmount, lpShares);
    }

    function quoteAddLiquidity(uint256 keyAmount) public view returns (uint256 creatorCoinAmount, uint256 lpShares) {
        if (keyAmount == 0) revert ZeroAmount();
        (uint256 creatorCoinReserve, uint256 keyReserve) = getReserves();
        uint256 supply = totalSupply();
        if (creatorCoinReserve == 0 || keyReserve == 0 || supply == 0) revert InsufficientReserves();

        creatorCoinAmount = _ceilDiv(keyAmount * creatorCoinReserve, keyReserve);
        uint256 lpFromKeys = (keyAmount * supply) / keyReserve;
        uint256 lpFromCoin = (creatorCoinAmount * supply) / creatorCoinReserve;
        lpShares = lpFromKeys < lpFromCoin ? lpFromKeys : lpFromCoin;
        if (lpShares == 0) revert InsufficientLiquidityMinted();
    }

    function addLiquidity(uint256 keyAmount, uint256 maxCreatorCoinAmount, uint256 minLpShares, address recipient)
        external
        nonReentrant
        returns (uint256 creatorCoinAmount, uint256 lpShares)
    {
        if (recipient == address(0)) revert ZeroAddress();
        (creatorCoinAmount, lpShares) = quoteAddLiquidity(keyAmount);
        if (creatorCoinAmount > maxCreatorCoinAmount || lpShares < minLpShares) revert SlippageExceeded();

        _pullExactCreatorCoin(msg.sender, creatorCoinAmount);
        IERC1155(friendKey).safeTransferFrom(msg.sender, address(this), keyTokenId, keyAmount, "");
        _mint(recipient, lpShares);

        emit LiquidityAdded(msg.sender, recipient, keyAmount, creatorCoinAmount, lpShares);
    }

    function removeLiquidity(uint256 lpShares, uint256 minCreatorCoinAmount, uint256 minKeyAmount, address recipient)
        external
        nonReentrant
        returns (uint256 creatorCoinAmount, uint256 keyAmount)
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (lpShares == 0) revert ZeroAmount();

        uint256 supply = totalSupply();
        (uint256 creatorCoinReserve, uint256 keyReserve) = getReserves();
        if (supply == 0 || creatorCoinReserve == 0 || keyReserve == 0) revert InsufficientReserves();

        creatorCoinAmount = (creatorCoinReserve * lpShares) / supply;
        keyAmount = (keyReserve * lpShares) / supply;
        if (creatorCoinAmount == 0 || keyAmount == 0) revert InsufficientLiquidityMinted();
        if (creatorCoinAmount < minCreatorCoinAmount || keyAmount < minKeyAmount) revert SlippageExceeded();

        _burn(msg.sender, lpShares);
        IERC20(creatorCoin).safeTransfer(recipient, creatorCoinAmount);
        IERC1155(friendKey).safeTransferFrom(address(this), recipient, keyTokenId, keyAmount, "");

        emit LiquidityRemoved(msg.sender, recipient, keyAmount, creatorCoinAmount, lpShares);
    }

    function quoteBuyKeys(uint256 keyAmount) public view returns (uint256 creatorCoinAmountIn) {
        if (keyAmount == 0) revert ZeroAmount();
        (uint256 creatorCoinReserve, uint256 keyReserve) = getReserves();
        if (creatorCoinReserve == 0 || keyReserve == 0 || keyAmount >= keyReserve) revert InsufficientReserves();

        uint256 creatorCoinInAfterFee = _ceilDiv(creatorCoinReserve * keyAmount, keyReserve - keyAmount);
        creatorCoinAmountIn = _ceilDiv(creatorCoinInAfterFee * BPS, BPS - FEE_BPS);
    }

    function buyKeys(uint256 keyAmount, uint256 maxCreatorCoinAmount, address recipient)
        external
        nonReentrant
        returns (uint256 creatorCoinAmountIn)
    {
        if (recipient == address(0)) revert ZeroAddress();
        creatorCoinAmountIn = quoteBuyKeys(keyAmount);
        if (creatorCoinAmountIn > maxCreatorCoinAmount) revert SlippageExceeded();

        _pullExactCreatorCoin(msg.sender, creatorCoinAmountIn);
        IERC1155(friendKey).safeTransferFrom(address(this), recipient, keyTokenId, keyAmount, "");

        emit KeysBought(msg.sender, recipient, keyAmount, creatorCoinAmountIn);
    }

    function quoteSellKeys(uint256 keyAmount) public view returns (uint256 creatorCoinAmountOut) {
        if (keyAmount == 0) revert ZeroAmount();
        (uint256 creatorCoinReserve, uint256 keyReserve) = getReserves();
        if (creatorCoinReserve == 0 || keyReserve == 0) revert InsufficientReserves();

        uint256 grossOut = (creatorCoinReserve * keyAmount) / (keyReserve + keyAmount);
        uint256 fee = (grossOut * FEE_BPS) / BPS;
        creatorCoinAmountOut = grossOut - fee;
        if (creatorCoinAmountOut == 0) revert InsufficientReserves();
    }

    function sellKeys(uint256 keyAmount, uint256 minCreatorCoinAmount, address recipient)
        external
        nonReentrant
        returns (uint256 creatorCoinAmountOut)
    {
        if (recipient == address(0)) revert ZeroAddress();
        creatorCoinAmountOut = quoteSellKeys(keyAmount);
        if (creatorCoinAmountOut < minCreatorCoinAmount) revert SlippageExceeded();

        IERC1155(friendKey).safeTransferFrom(msg.sender, address(this), keyTokenId, keyAmount, "");
        IERC20(creatorCoin).safeTransfer(recipient, creatorCoinAmountOut);

        emit KeysSold(msg.sender, recipient, keyAmount, creatorCoinAmountOut);
    }

    function onERC1155Received(address, address, uint256 id, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != friendKey) revert WrongFriendKey();
        if (id != keyTokenId) revert WrongTokenId(id);
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert BatchTransfersUnsupported();
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _pullExactCreatorCoin(address from, uint256 amount) internal {
        uint256 beforeBalance = IERC20(creatorCoin).balanceOf(address(this));
        IERC20(creatorCoin).safeTransferFrom(from, address(this), amount);
        uint256 received = IERC20(creatorCoin).balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert FeeOnTransferUnsupported();
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : ((a - 1) / b) + 1;
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = (y / 2) + 1;
            while (x < z) {
                z = x;
                x = ((y / x) + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
