// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {AlfaCreatorKeyPool} from "./AlfaCreatorKeyPool.sol";

interface IAlfaFriendKey {
    function creatorByTokenId(uint256 tokenId) external view returns (address);
}

/**
 * @title AlfaCreatorKeyLPFactory
 * @notice Deploys 4626-owned secondary-market LP pools for Creator Coin / AlfaClub key pairs.
 */
contract AlfaCreatorKeyLPFactory is Ownable {
    using SafeERC20 for IERC20;

    address public constant BASE_ALFA_CLUB_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address public immutable friendKey;

    mapping(address => bool) public poolCreatorAllowed;
    mapping(address => mapping(uint256 => bool)) public pairAllowed;
    mapping(address => mapping(uint256 => address)) public getPool;
    address[] public allPools;

    event PoolCreatorAllowedSet(address indexed account, bool allowed);
    event PairAllowedSet(address indexed creatorCoin, uint256 indexed tokenId, bool allowed);
    event PoolCreated(
        address indexed creatorCoin,
        uint256 indexed tokenId,
        address indexed pool,
        address creator,
        uint256 keyAmount,
        uint256 creatorCoinAmount,
        address recipient
    );

    error ZeroAddress();
    error ZeroAmount();
    error PoolCreatorNotAllowed(address caller);
    error PairNotAllowed(address creatorCoin, uint256 tokenId);
    error PoolAlreadyExists(address creatorCoin, uint256 tokenId);
    error FriendKeyCreatorMissing(uint256 tokenId);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        friendKey = BASE_ALFA_CLUB_FRIEND_KEY;
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    function setPoolCreatorAllowed(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        poolCreatorAllowed[account] = allowed;
        emit PoolCreatorAllowedSet(account, allowed);
    }

    function setPairAllowed(address creatorCoin, uint256 tokenId, bool allowed) external onlyOwner {
        if (creatorCoin == address(0)) revert ZeroAddress();
        pairAllowed[creatorCoin][tokenId] = allowed;
        emit PairAllowedSet(creatorCoin, tokenId, allowed);
    }

    function createPoolWithInitialLiquidity(
        address creatorCoin,
        uint256 tokenId,
        uint256 keyAmount,
        uint256 creatorCoinAmount,
        address recipient
    ) external returns (address pool) {
        if (!poolCreatorAllowed[msg.sender]) revert PoolCreatorNotAllowed(msg.sender);
        if (creatorCoin == address(0) || recipient == address(0)) revert ZeroAddress();
        if (keyAmount == 0 || creatorCoinAmount == 0) revert ZeroAmount();
        if (!pairAllowed[creatorCoin][tokenId]) revert PairNotAllowed(creatorCoin, tokenId);
        if (getPool[creatorCoin][tokenId] != address(0)) revert PoolAlreadyExists(creatorCoin, tokenId);

        address creator = IAlfaFriendKey(friendKey).creatorByTokenId(tokenId);
        if (creator == address(0)) revert FriendKeyCreatorMissing(tokenId);

        pool = address(new AlfaCreatorKeyPool(friendKey, creatorCoin, tokenId));
        getPool[creatorCoin][tokenId] = pool;
        allPools.push(pool);

        IERC20(creatorCoin).safeTransferFrom(msg.sender, pool, creatorCoinAmount);
        IERC1155(friendKey).safeTransferFrom(msg.sender, pool, tokenId, keyAmount, "");
        AlfaCreatorKeyPool(pool).mintInitialLiquidity(keyAmount, creatorCoinAmount, recipient);

        emit PoolCreated(creatorCoin, tokenId, pool, creator, keyAmount, creatorCoinAmount, recipient);
    }
}
