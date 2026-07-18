// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {IAlfaClubSudoswapAdapter} from "./interfaces/IAlfaClubSudoswapAdapter.sol";

import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {ILSSVMPairFactoryLike} from "sudoswap/ILSSVMPairFactoryLike.sol";
import {ICurve} from "sudoswap/bonding-curves/ICurve.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";

import {IAllowanceTransfer} from "../../../../lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";
import {ERC20} from "../../../../lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";
import {SafeTransferLib} from "../../../../lib/sudoswap-lssvm2/lib/solmate/src/utils/SafeTransferLib.sol";
import {IERC721} from "../../../../lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {
    IERC1155
} from "../../../../lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {
    ERC1155Holder
} from "../../../../lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @notice Executes AlfaClub ERC-1155/Creator Coin swaps against unmodified,
/// factory-authenticated Sudoswap v2 pairs.
/// @dev Creator Coin inputs are pulled from the explicit payer through the
/// pinned Permit2 contract; keys are pulled through ERC-1155 operator approval.
/// If the factory has allowlisted this adapter, swaps use Sudoswap's optimized
/// router callbacks. Otherwise the adapter stages assets for the duration of
/// the transaction and invokes the same official pair in direct-call mode.
contract AlfaClubSudoswapAdapter is IAlfaClubSudoswapAdapter, ERC1155Holder {
    using SafeTransferLib for ERC20;
    enum Direction {
        NONE,
        BUY,
        SELL
    }

    struct Market {
        address creatorCoin;
        uint256 tokenId;
        bool allowed;
    }

    struct SwapContext {
        Direction direction;
        address pair;
        address payer;
        address token;
        address nft;
        uint256 tokenId;
        uint256 budget;
        uint256 quantity;
        uint256 creatorCoinSpent;
        uint256 keysTransferred;
    }

    error UnauthorizedRouter(address caller);
    error UnauthorizedOwner(address caller);
    error ZeroAddress();
    error InvalidDependency(address dependency);
    error InvalidPair(address pair);
    error InvalidPairVariant(address pair);
    error InvalidPairFactory(address pair, address actualFactory);
    error InvalidPoolType(address pair);
    error InvalidBondingCurve(address pair, address actualCurve);
    error InvalidFriendKey(address pair, address actualNft);
    error InvalidCreatorCoin(address pair, address actualToken);
    error InvalidTokenId(address pair, uint256 actualTokenId);
    error RouterNotAllowed();
    error MarketNotAllowed(address pair);
    error SwapAlreadyActive();
    error InvalidSwapParticipant(address participant);
    error ZeroKeyAmount();
    error CreatorCoinLimitTooLarge(uint256 limit);
    error InactiveCallback();
    error UnexpectedCallback(Direction expected, Direction actual);
    error InvalidCallbackCaller(address caller, address expectedPair);
    error InvalidCallbackToken(address actual, address expected);
    error InvalidCallbackNft(address actual, address expected);
    error InvalidCallbackPayer(address actual, address expected);
    error InvalidCallbackRecipient(address actual, address expected);
    error InvalidCallbackArrays();
    error InvalidCallbackTokenId(uint256 actual, uint256 expected);
    error InvalidCallbackQuantity(uint256 actual, uint256 expected);
    error CreatorCoinBudgetExceeded(uint256 requested, uint256 budget);
    error CreatorCoinSpendMismatch(uint256 reported, uint256 transferred);
    error KeyTransferMismatch(uint256 expected, uint256 transferred);
    error AssetBalanceMismatch(address asset, uint256 balanceBefore, uint256 balanceAfter);
    error UnsupportedCallback();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MarketSet(address indexed pair, address indexed creatorCoin, uint256 indexed tokenId, bool allowed);
    event KeysBought(
        address indexed pair, address indexed payer, address indexed recipient, uint256 keyAmount, uint256 creatorCoinIn
    );
    event KeysSold(
        address indexed pair,
        address indexed payer,
        address indexed recipient,
        uint256 keyAmount,
        uint256 creatorCoinOut
    );

    address public immutable universalRouter;
    LSSVMPairFactory public immutable factory;
    IAllowanceTransfer public immutable permit2;
    IERC1155 public immutable friendKey;
    ICurve public immutable xykCurve;

    address public owner;
    mapping(address pair => Market market) public markets;

    SwapContext private _context;

    modifier onlyUniversalRouter() {
        if (msg.sender != universalRouter) revert UnauthorizedRouter(msg.sender);
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedOwner(msg.sender);
        _;
    }

    constructor(
        address universalRouter_,
        address initialOwner_,
        LSSVMPairFactory factory_,
        IAllowanceTransfer permit2_,
        IERC1155 friendKey_,
        ICurve xykCurve_
    ) {
        // The router may be its predicted CREATE address during atomic
        // adapter/router deployment, so it is intentionally checked for zero
        // here and authenticated by exact address at runtime.
        if (universalRouter_ == address(0) || initialOwner_ == address(0)) {
            revert ZeroAddress();
        }
        if (address(factory_).code.length == 0) revert InvalidDependency(address(factory_));
        if (address(permit2_).code.length == 0) revert InvalidDependency(address(permit2_));
        if (address(friendKey_).code.length == 0) revert InvalidDependency(address(friendKey_));
        if (address(xykCurve_).code.length == 0) revert InvalidDependency(address(xykCurve_));

        universalRouter = universalRouter_;
        owner = initialOwner_;
        factory = factory_;
        permit2 = permit2_;
        friendKey = friendKey_;
        xykCurve = xykCurve_;

        emit OwnershipTransferred(address(0), initialOwner_);
    }

    /// @notice Transfers allowlist administration to a new owner (normally the
    /// protocol Safe).
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Binds a specific official pair to its Creator Coin and FriendKey
    /// token ID. Enabling revalidates the complete live Sudoswap configuration.
    function setMarket(address pair, address creatorCoin, uint256 tokenId, bool allowed) external onlyOwner {
        if (pair == address(0)) revert ZeroAddress();
        if (allowed) {
            if (creatorCoin == address(0)) revert ZeroAddress();
            _validatePairConfiguration(pair, creatorCoin, tokenId);
        }

        markets[pair] = Market({creatorCoin: creatorCoin, tokenId: tokenId, allowed: allowed});
        emit MarketSet(pair, creatorCoin, tokenId, allowed);
    }

    /// @inheritdoc IAlfaClubSudoswapAdapter
    function buy(address pair, address recipient, uint256 keyAmount, uint256 maxCreatorCoinIn, address payer)
        external
        override
        onlyUniversalRouter
        returns (uint256 creatorCoinIn)
    {
        _validateSwapParticipants(payer, recipient);
        if (keyAmount == 0) revert ZeroKeyAmount();
        if (maxCreatorCoinIn > type(uint160).max) revert CreatorCoinLimitTooLarge(maxCreatorCoinIn);
        if (_context.direction != Direction.NONE) revert SwapAlreadyActive();

        Market memory market = _validatedMarket(pair);
        (bool routerAllowed,) = factory.routerStatus(LSSVMRouter(payable(address(this))));
        if (!routerAllowed) {
            creatorCoinIn = _buyDirect(pair, market.creatorCoin, recipient, keyAmount, maxCreatorCoinIn, payer);
            emit KeysBought(pair, payer, recipient, keyAmount, creatorCoinIn);
            return creatorCoinIn;
        }

        _context = SwapContext({
            direction: Direction.BUY,
            pair: pair,
            payer: payer,
            token: market.creatorCoin,
            nft: address(friendKey),
            tokenId: market.tokenId,
            budget: maxCreatorCoinIn,
            quantity: keyAmount,
            creatorCoinSpent: 0,
            keysTransferred: 0
        });

        uint256[] memory quantities = new uint256[](1);
        quantities[0] = keyAmount;
        creatorCoinIn = LSSVMPairERC1155ERC20(payable(pair))
            .swapTokenForSpecificNFTs(quantities, maxCreatorCoinIn, recipient, true, payer);

        uint256 transferred = _context.creatorCoinSpent;
        if (transferred != creatorCoinIn) revert CreatorCoinSpendMismatch(creatorCoinIn, transferred);
        delete _context;

        emit KeysBought(pair, payer, recipient, keyAmount, creatorCoinIn);
    }

    /// @inheritdoc IAlfaClubSudoswapAdapter
    function sell(address pair, address recipient, uint256 keyAmount, uint256 minCreatorCoinOut, address payer)
        external
        override
        onlyUniversalRouter
        returns (uint256 creatorCoinOut)
    {
        _validateSwapParticipants(payer, recipient);
        if (keyAmount == 0) revert ZeroKeyAmount();
        if (_context.direction != Direction.NONE) revert SwapAlreadyActive();

        Market memory market = _validatedMarket(pair);
        (bool routerAllowed,) = factory.routerStatus(LSSVMRouter(payable(address(this))));
        if (!routerAllowed) {
            creatorCoinOut = _sellDirect(pair, recipient, keyAmount, minCreatorCoinOut, payer);
            emit KeysSold(pair, payer, recipient, keyAmount, creatorCoinOut);
            return creatorCoinOut;
        }

        _context = SwapContext({
            direction: Direction.SELL,
            pair: pair,
            payer: payer,
            token: market.creatorCoin,
            nft: address(friendKey),
            tokenId: market.tokenId,
            budget: 0,
            quantity: keyAmount,
            creatorCoinSpent: 0,
            keysTransferred: 0
        });

        uint256[] memory quantities = new uint256[](1);
        quantities[0] = keyAmount;
        creatorCoinOut = LSSVMPairERC1155ERC20(payable(pair))
            .swapNFTsForToken(quantities, minCreatorCoinOut, payable(recipient), true, payer);

        uint256 transferred = _context.keysTransferred;
        if (transferred != keyAmount) revert KeyTransferMismatch(keyAmount, transferred);
        delete _context;

        emit KeysSold(pair, payer, recipient, keyAmount, creatorCoinOut);
    }

    /// @notice Official Sudoswap ERC-20 router callback. A buy can legitimately
    /// split payment among the pair, royalty recipients, and the factory, so the
    /// adapter constrains the cumulative Permit2 pull rather than one recipient.
    function pairTransferERC20From(ERC20 token, address from, address to, uint256 amount) external {
        SwapContext storage context = _activeContext(Direction.BUY);
        if (address(token) != context.token) revert InvalidCallbackToken(address(token), context.token);
        if (from != context.payer) revert InvalidCallbackPayer(from, context.payer);

        uint256 newSpend = context.creatorCoinSpent + amount;
        if (newSpend > context.budget) revert CreatorCoinBudgetExceeded(newSpend, context.budget);
        context.creatorCoinSpent = newSpend;

        // Safe because the cumulative spend (and therefore each component) is
        // bounded by the uint160-compatible limit checked in buy().
        // forge-lint: disable-next-line(unsafe-typecast)
        permit2.transferFrom(from, to, uint160(amount), address(token));
    }

    /// @notice Official Sudoswap ERC-1155 router callback. AlfaClub markets
    /// accept exactly one quantity entry for the allowlisted FriendKey token ID.
    function pairTransferERC1155From(
        IERC1155 nft,
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        SwapContext storage context = _activeContext(Direction.SELL);
        if (address(nft) != context.nft) revert InvalidCallbackNft(address(nft), context.nft);
        if (from != context.payer) revert InvalidCallbackPayer(from, context.payer);
        if (to != context.pair) revert InvalidCallbackRecipient(to, context.pair);
        if (ids.length != 1 || amounts.length != 1) revert InvalidCallbackArrays();
        if (ids[0] != context.tokenId) revert InvalidCallbackTokenId(ids[0], context.tokenId);
        if (amounts[0] != context.quantity) {
            revert InvalidCallbackQuantity(amounts[0], context.quantity);
        }
        if (context.keysTransferred != 0) revert InvalidCallbackQuantity(amounts[0], 0);

        context.keysTransferred = amounts[0];
        nft.safeBatchTransferFrom(from, to, ids, amounts, bytes(""));
    }

    /// @notice ERC-721 callbacks are outside the AlfaClub ERC-1155-only scope.
    function pairTransferNFTFrom(IERC721, address, address, uint256) external pure {
        revert UnsupportedCallback();
    }

    function _validatedMarket(address pair) private view returns (Market memory market) {
        market = markets[pair];
        if (!market.allowed) revert MarketNotAllowed(pair);
        _validatePairConfiguration(pair, market.creatorCoin, market.tokenId);
    }

    function _validatePairConfiguration(address pair, address creatorCoin, uint256 tokenId) private view {
        if (pair.code.length == 0) revert InvalidPair(pair);

        bool validPair;
        try factory.isValidPair(pair) returns (bool valid) {
            validPair = valid;
        } catch {
            revert InvalidPair(pair);
        }
        if (!validPair) revert InvalidPair(pair);

        LSSVMPairERC1155ERC20 sudoswapPair = LSSVMPairERC1155ERC20(payable(pair));
        if (
            sudoswapPair.pairVariant() != ILSSVMPairFactoryLike.PairVariant.ERC1155_ERC20
                || factory.getPairNFTType(pair) != ILSSVMPairFactoryLike.PairNFTType.ERC1155
                || factory.getPairTokenType(pair) != ILSSVMPairFactoryLike.PairTokenType.ERC20
        ) {
            revert InvalidPairVariant(pair);
        }
        if (address(sudoswapPair.factory()) != address(factory)) {
            revert InvalidPairFactory(pair, address(sudoswapPair.factory()));
        }
        if (sudoswapPair.poolType() != LSSVMPair.PoolType.TRADE) revert InvalidPoolType(pair);
        if (address(sudoswapPair.bondingCurve()) != address(xykCurve)) {
            revert InvalidBondingCurve(pair, address(sudoswapPair.bondingCurve()));
        }
        if (sudoswapPair.nft() != address(friendKey)) {
            revert InvalidFriendKey(pair, sudoswapPair.nft());
        }
        if (address(sudoswapPair.token()) != creatorCoin) {
            revert InvalidCreatorCoin(pair, address(sudoswapPair.token()));
        }
        if (sudoswapPair.nftId() != tokenId) revert InvalidTokenId(pair, sudoswapPair.nftId());
    }

    function _buyDirect(
        address pair,
        address creatorCoin,
        address recipient,
        uint256 keyAmount,
        uint256 maxCreatorCoinIn,
        address payer
    ) private returns (uint256 creatorCoinIn) {
        ERC20 token = ERC20(creatorCoin);
        uint256 balanceBefore = token.balanceOf(address(this));

        // maxCreatorCoinIn is uint160-compatible by the caller's validation.
        // forge-lint: disable-next-line(unsafe-typecast)
        permit2.transferFrom(payer, address(this), uint160(maxCreatorCoinIn), creatorCoin);
        token.safeApprove(pair, maxCreatorCoinIn);

        uint256[] memory quantities = new uint256[](1);
        quantities[0] = keyAmount;
        creatorCoinIn = LSSVMPairERC1155ERC20(payable(pair))
            .swapTokenForSpecificNFTs(quantities, maxCreatorCoinIn, recipient, false, address(0));

        token.safeApprove(pair, 0);
        token.safeTransfer(payer, maxCreatorCoinIn - creatorCoinIn);
        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter != balanceBefore) revert AssetBalanceMismatch(creatorCoin, balanceBefore, balanceAfter);
    }

    function _sellDirect(address pair, address recipient, uint256 keyAmount, uint256 minCreatorCoinOut, address payer)
        private
        returns (uint256 creatorCoinOut)
    {
        Market memory market = markets[pair];
        uint256 balanceBefore = friendKey.balanceOf(address(this), market.tokenId);

        friendKey.safeTransferFrom(payer, address(this), market.tokenId, keyAmount, bytes(""));
        friendKey.setApprovalForAll(pair, true);

        uint256[] memory quantities = new uint256[](1);
        quantities[0] = keyAmount;
        creatorCoinOut = LSSVMPairERC1155ERC20(payable(pair))
            .swapNFTsForToken(quantities, minCreatorCoinOut, payable(recipient), false, address(0));

        friendKey.setApprovalForAll(pair, false);
        uint256 balanceAfter = friendKey.balanceOf(address(this), market.tokenId);
        if (balanceAfter != balanceBefore) {
            revert AssetBalanceMismatch(address(friendKey), balanceBefore, balanceAfter);
        }
    }

    function _validateSwapParticipants(address payer, address recipient) private view {
        if (payer == address(0) || recipient == address(0)) revert ZeroAddress();
        if (payer == universalRouter || payer == address(this)) revert InvalidSwapParticipant(payer);
        if (recipient == universalRouter || recipient == address(this)) {
            revert InvalidSwapParticipant(recipient);
        }
    }

    function _activeContext(Direction expected) private view returns (SwapContext storage context) {
        context = _context;
        if (context.direction == Direction.NONE) revert InactiveCallback();
        if (context.direction != expected) revert UnexpectedCallback(expected, context.direction);
        if (msg.sender != context.pair) revert InvalidCallbackCaller(msg.sender, context.pair);
    }
}
