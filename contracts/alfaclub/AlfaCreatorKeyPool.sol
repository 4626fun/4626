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
 * @notice Constant-product AMM whose priced pair is exactly:
 *           asset A: ERC20 `creatorCoin`
 *           asset B: ERC1155 `friendKey` for a single `keyTokenId`
 *         LP shares (`akLP`, this contract's own ERC20) are *receipts* representing
 *         pro-rata ownership of the (A, B) pair only. They are not an asset in the
 *         pair, are never priced against A or B, and never enter `getReserves()`.
 *
 *         All swap/mint/burn math reads from internal stored reserves
 *         (`_creatorCoinReserve`, `_keyReserve`), never from live ERC20/ERC1155
 *         balances. This makes the pool donation-resistant: tokens sent directly
 *         to the contract are not credited to any LP and cannot dilute later
 *         entrants. The same guarantee implies: anyone transferring akLP shares
 *         to the pool itself does NOT change the priced pair — LP shares are not
 *         a reserve asset.
 */
contract AlfaCreatorKeyPool is ERC20, IERC1155Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BPS = 690;
    uint256 public constant BPS = 10_000;

    address public immutable factory;
    address public immutable friendKey;
    address public immutable creatorCoin;
    uint256 public immutable keyTokenId;

    // -------------------------------------------------------------------------
    // Pair reserves (the AMM's two priced assets)
    // -------------------------------------------------------------------------
    // These are the ONLY values that participate in pricing and LP-share math.
    // They are written exclusively through `_settleReserves` after a legitimate
    // pool action (initial mint, add, remove, buy, sell). Live balances may
    // diverge upward via donation; that excess sits in the contract but is
    // never credited to LPs and is invisible to quotes.
    uint256 private _creatorCoinReserve;
    uint256 private _keyReserve;

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
    event Sync(uint256 creatorCoinReserve, uint256 keyReserve);

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

    /// @notice The two priced reserves of the AMM pair. LP shares are NOT included.
    function getReserves() public view returns (uint256 creatorCoinReserve, uint256 keyReserve) {
        creatorCoinReserve = _creatorCoinReserve;
        keyReserve = _keyReserve;
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

        // Initial seed: factory has already pre-transferred the pair assets to
        // this contract before calling. Verify the pool actually holds at least
        // the claimed amounts before we credit them as the starting reserves.
        uint256 liveCreatorCoin = IERC20(creatorCoin).balanceOf(address(this));
        uint256 liveKeys = IERC1155(friendKey).balanceOf(address(this), keyTokenId);
        if (liveCreatorCoin < creatorCoinAmount || liveKeys < keyAmount) revert InsufficientReserves();

        lpShares = _sqrt(creatorCoinAmount * keyAmount);
        if (lpShares == 0) revert InsufficientLiquidityMinted();

        _mint(recipient, lpShares);
        _settleReserves(creatorCoinAmount, keyAmount);
        emit LiquidityAdded(msg.sender, recipient, keyAmount, creatorCoinAmount, lpShares);
    }

    function quoteAddLiquidity(uint256 keyAmount) public view returns (uint256 creatorCoinAmount, uint256 lpShares) {
        if (keyAmount == 0) revert ZeroAmount();
        (uint256 creatorCoinReserve, uint256 keyReserve) = getReserves();
        uint256 supply = totalSupply();
        if (creatorCoinReserve == 0 || keyReserve == 0 || supply == 0) revert InsufficientReserves();

        // Required creator coin to keep the pair ratio constant after adding `keyAmount`.
        creatorCoinAmount = _ceilDiv(keyAmount * creatorCoinReserve, keyReserve);

        // Pro-rata LP shares: take the conservative side so the new LP can
        // never receive more shares than either deposit leg is worth.
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

        // Pull the pair assets in, then mint receipt shares.
        _pullExactCreatorCoin(msg.sender, creatorCoinAmount);
        IERC1155(friendKey).safeTransferFrom(msg.sender, address(this), keyTokenId, keyAmount, "");
        _mint(recipient, lpShares);
        _settleReserves(_creatorCoinReserve + creatorCoinAmount, _keyReserve + keyAmount);

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

        // LP share -> pro-rata claim on the priced pair only.
        creatorCoinAmount = (creatorCoinReserve * lpShares) / supply;
        keyAmount = (keyReserve * lpShares) / supply;
        if (creatorCoinAmount == 0 || keyAmount == 0) revert InsufficientLiquidityMinted();
        if (creatorCoinAmount < minCreatorCoinAmount || keyAmount < minKeyAmount) revert SlippageExceeded();

        // Burn shares and update internal reserves *before* the outflow so any
        // revert in the transfer leg leaves stored reserves consistent (they
        // reflect what the pool still owes, not what was attempted).
        _burn(msg.sender, lpShares);
        _settleReserves(creatorCoinReserve - creatorCoinAmount, keyReserve - keyAmount);
        _pushExactCreatorCoin(recipient, creatorCoinAmount);
        IERC1155(friendKey).safeTransferFrom(address(this), recipient, keyTokenId, keyAmount, "");

        emit LiquidityRemoved(msg.sender, recipient, keyAmount, creatorCoinAmount, lpShares);
    }

    function quoteBuyKeys(uint256 keyAmount) public view returns (uint256 creatorCoinAmountIn) {
        if (keyAmount == 0) revert ZeroAmount();
        (uint256 creatorCoinReserve, uint256 keyReserve) = getReserves();
        if (creatorCoinReserve == 0 || keyReserve == 0 || keyAmount >= keyReserve) revert InsufficientReserves();

        // x*y=k on the pair reserves; fee taken on the input leg in creator coin.
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
        _settleReserves(_creatorCoinReserve + creatorCoinAmountIn, _keyReserve - keyAmount);
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
        _settleReserves(_creatorCoinReserve - creatorCoinAmountOut, _keyReserve + keyAmount);
        _pushExactCreatorCoin(recipient, creatorCoinAmountOut);

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

    // -------------------------------------------------------------------------
    // Exact-delivery transfer helpers
    // -------------------------------------------------------------------------
    // The pool is meant for "vanilla" creator coins. A fee-on-transfer / rebase /
    // burn token would silently break either reserve accounting (incoming) or
    // the slippage-checked quote (outgoing). Both directions are guarded with
    // a balance-delta check so any deviation reverts.

    function _pullExactCreatorCoin(address from, uint256 amount) internal {
        uint256 beforeBalance = IERC20(creatorCoin).balanceOf(address(this));
        IERC20(creatorCoin).safeTransferFrom(from, address(this), amount);
        uint256 received = IERC20(creatorCoin).balanceOf(address(this)) - beforeBalance;
        if (received != amount) revert FeeOnTransferUnsupported();
    }

    function _pushExactCreatorCoin(address to, uint256 amount) internal {
        // Guard BOTH legs of the transfer:
        //   - recipient credit must be exactly `amount` (catches recipient-side
        //     fee/burn tokens that would silently underdeliver vs. the slippage
        //     quote), and
        //   - pool debit must be exactly `amount` (catches sender-side fee/burn
        //     tokens where the recipient still gets `amount` but the pool loses
        //     `amount + fee`, which would otherwise leave stored reserves
        //     overstated relative to the live balance and mis-price later
        //     quotes / brick later sells & LP withdrawals).
        uint256 poolBefore = IERC20(creatorCoin).balanceOf(address(this));
        uint256 recipientBefore = IERC20(creatorCoin).balanceOf(to);
        IERC20(creatorCoin).safeTransfer(to, amount);
        uint256 received = IERC20(creatorCoin).balanceOf(to) - recipientBefore;
        uint256 sent = poolBefore - IERC20(creatorCoin).balanceOf(address(this));
        if (received != amount || sent != amount) revert FeeOnTransferUnsupported();
    }

    /// @dev Single write-point for the pair reserves. Every state-changing
    ///      pool action ends here, and only here. Donations bypass it by
    ///      construction.
    function _settleReserves(uint256 creatorCoinReserve, uint256 keyReserve) internal {
        _creatorCoinReserve = creatorCoinReserve;
        _keyReserve = keyReserve;
        emit Sync(creatorCoinReserve, keyReserve);
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
