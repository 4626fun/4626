// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaultActivationBatcher
 * @author 0xakita.eth
 * @notice Batches vault activation actions.
 * @dev Used by deployment flows to activate vaults in one call.
 */
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

// ================================
// INTERFACES
// ================================

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

interface IWrapper {
    function wrap(uint256 amount) external returns (uint256 shareTokens);
    function shareOFT() external view returns (address);
}

interface ICCAStrategy {
    function launchAuctionSimple(uint256 amount, uint128 requiredRaise) external returns (address auction);
    function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
        external
        returns (address auction);
    function defaultFloorPrice() external view returns (uint256);
}

interface IOwnable {
    function owner() external view returns (address);
}

interface IOperatorAuthorizableVault {
    function isAuthorizedOperator(address exec, uint256 perm) external view returns (bool);
}

// FIX: F-07 — registry interface for validating operator-supplied wrapper/vault
interface ICreatorRegistryLookup {
    function getVaultForToken(address token) external view returns (address);
    function getWrapperForToken(address token) external view returns (address);
}

contract VaultActivationBatcher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Bitmask permission (must match `CreatorOVault.OP_ACTIVATE`)
    uint256 private constant OP_ACTIVATE = 1 << 2;

    /// @notice Permit2 contract used for signature-based transfers
    address public immutable permit2;
    // FIX: F-07 — registry for validating operator-supplied wrapper/vault against canonical records
    ICreatorRegistryLookup public immutable registry;

    constructor(address _permit2, address _registry) {
        if (_permit2 == address(0) || _registry == address(0)) revert ZeroAddress();
        permit2 = _permit2;
        registry = ICreatorRegistryLookup(_registry);
    }

    // ================================
    // EVENTS
    // ================================

    event BatchActivation(
        address indexed user, address indexed vault, uint256 depositAmount, uint256 auctionAmount, address auction
    );

    event BatchActivationFor(
        address indexed operator,
        address indexed identity,
        address indexed vault,
        uint256 depositAmount,
        uint256 auctionAmount,
        address auction
    );

    /// @notice Emitted when a portion of ■TOKENs is reserved for creator/team (e.g. vesting escrow).
    event CreatorReserveAllocated(
        address indexed identity,
        address indexed recipient,
        address indexed shareToken,
        uint256 amount,
        uint8 reservePercent
    );

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPercent();
    error InvalidReserve();
    error NotVaultOwner(address expectedOwner, address actualOwner);
    error NotAuthorizedOperator();
    error PermitTokenMismatch();
    error PermitAmountTooLow();
    error InvalidReserveRecipient(address expectedRecipient, address actualRecipient);
    // FIX: F-07 — errors for registry validation of operator-supplied addresses
    error VaultRegistryMismatch(address expected, address actual);
    error WrapperRegistryMismatch(address expected, address actual);

    // ================================
    // INTERNAL SHARED LOGIC
    // ================================

    /// @dev FIX: AUDIT-2026-07-01-M16 — every activation path must route through
    ///      the registry's canonical vault/wrapper for `creatorToken`.
    function _validateRegistryRouting(address creatorToken, address vault, address wrapper) internal view {
        address expectedVault = registry.getVaultForToken(creatorToken);
        if (expectedVault != vault) revert VaultRegistryMismatch(expectedVault, vault);
        address expectedWrapper = registry.getWrapperForToken(creatorToken);
        if (expectedWrapper != wrapper) revert WrapperRegistryMismatch(expectedWrapper, wrapper);
    }

    function _executeActivateAndLaunch(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReservePercent,
        address creatorReserveRecipient,
        uint128 requiredRaise
    ) internal returns (address auction, uint256 auctionAmount, uint256 reserveAmount, address shareToken) {
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();
        if (creatorReservePercent > 100) revert InvalidReserve();
        if (uint256(auctionPercent) + uint256(creatorReservePercent) > 100) revert InvalidReserve();
        if (creatorReservePercent > 0 && creatorReserveRecipient == address(0)) revert ZeroAddress();
        if (creatorReservePercent > 0 && creatorReserveRecipient != identity) {
            revert InvalidReserveRecipient(identity, creatorReserveRecipient);
        }

        _validateRegistryRouting(creatorToken, vault, wrapper);

        // ============ STEP 2: Deposit to vault (creatorToken → ▢TOKEN) ============
        IERC20(creatorToken).forceApprove(vault, depositAmount);
        uint256 shares = IVault(vault).deposit(depositAmount, address(this));

        // ============ STEP 3: Wrap vault shares to ■TOKEN (▢TOKEN → ■TOKEN) ============
        address vaultTokenAddress = vault; // ERC-4626 vault IS the share token
        IERC20(vaultTokenAddress).forceApprove(wrapper, shares);
        uint256 shareTokens = IWrapper(wrapper).wrap(shares);

        // Get ■TOKEN (ShareOFT) address from wrapper
        shareToken = IWrapper(wrapper).shareOFT();

        // ============ STEP 4: Launch auction ============
        auctionAmount = 0;
        if (auctionPercent > 0) {
            auctionAmount = (shareTokens * auctionPercent) / 100;
            IERC20(shareToken).forceApprove(ccaStrategy, auctionAmount);
            uint256 floorPrice = ICCAStrategy(ccaStrategy).defaultFloorPrice();
            auction = ICCAStrategy(ccaStrategy).launchAuction(auctionAmount, floorPrice, requiredRaise, bytes(""));
        }

        // Reserve portion (creator/team allocation, e.g. vesting escrow)
        reserveAmount = 0;
        if (creatorReservePercent > 0) {
            reserveAmount = (shareTokens * creatorReservePercent) / 100;
            if (reserveAmount > 0) {
                IERC20(shareToken).safeTransfer(creatorReserveRecipient, reserveAmount);
                emit CreatorReserveAllocated(
                    identity, creatorReserveRecipient, shareToken, reserveAmount, creatorReservePercent
                );
            }
        }

        // Remaining ■TOKENs go back to identity
        uint256 remainingShareTokens = shareTokens - auctionAmount - reserveAmount;
        if (remainingShareTokens > 0) {
            IERC20(shareToken).safeTransfer(identity, remainingShareTokens);
        }
    }

    // ================================
    // MAIN FUNCTION
    // ================================

    /**
     * @notice Batch activate vault and launch auction in one transaction
     * @param creatorToken The creator token to deposit
     * @param vault The vault contract
     * @param wrapper The wrapper contract
     * @param ccaStrategy The CCA strategy contract
     * @param depositAmount Amount of creator tokens to deposit
     * @param auctionPercent Percent of ■TOKEN to auction (0-100)
     * @param requiredRaise Minimum ETH to raise in auction
     * @return auction The auction contract address
     *
     * @dev User must approve this contract to spend depositAmount of creatorToken first
     */
    function batchActivate(
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise
    ) external nonReentrant returns (address auction) {
        // Validate inputs
        if (creatorToken == address(0) || vault == address(0) || wrapper == address(0) || ccaStrategy == address(0)) {
            revert ZeroAddress();
        }

        // ============ STEP 1: Pull creator tokens ============
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), depositAmount);

        // Default behavior: no creator reserve; leftover goes back to msg.sender
        uint256 auctionAmount;
        uint256 reserveAmount;
        address shareToken;
        (auction, auctionAmount, reserveAmount, shareToken) = _executeActivateAndLaunch(
            msg.sender,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            0,
            address(0),
            requiredRaise
        );

        emit BatchActivation(msg.sender, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // silence unused warning (reserved is always 0 in this entrypoint)
        shareToken; // silence unused warning
    }

    /**
     * @notice Batch activate with an explicit creator/team reserve allocation.
     * @dev `auctionPercent + creatorReservePercent` must be <= 100.
     *      The remainder (if any) is returned to `msg.sender`.
     */
    function batchActivateWithReserve(
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReservePercent,
        address creatorReserveRecipient,
        uint128 requiredRaise
    ) external nonReentrant returns (address auction) {
        if (creatorToken == address(0) || vault == address(0) || wrapper == address(0) || ccaStrategy == address(0)) {
            revert ZeroAddress();
        }

        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), depositAmount);

        uint256 auctionAmount;
        uint256 reserveAmount;
        address shareToken;
        (auction, auctionAmount, reserveAmount, shareToken) = _executeActivateAndLaunch(
            msg.sender,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            creatorReservePercent,
            creatorReserveRecipient,
            requiredRaise
        );

        emit BatchActivation(msg.sender, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // emitted via CreatorReserveAllocated
        shareToken; // emitted via CreatorReserveAllocated
    }

    /**
     * @notice Batch activate on behalf of a canonical identity wallet (identity-funded via Permit2).
     * @dev Caller must be `identity` or an authorized operator on the vault (OP_ACTIVATE).
     *      Remaining share tokens are always returned to `identity` (never `msg.sender`).
     */
    function batchActivateWithPermit2For(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        // Validate inputs
        if (
            identity == address(0) || creatorToken == address(0) || vault == address(0) || wrapper == address(0)
                || ccaStrategy == address(0)
        ) revert ZeroAddress();
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);

        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) {
                revert NotAuthorizedOperator();
            }
        }

        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        // ============ STEP 1: Pull creator tokens from identity via Permit2 ============
        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, identity, signature);

        // Default behavior: no creator reserve; leftover goes back to identity
        uint256 auctionAmount;
        uint256 reserveAmount;
        address shareToken;
        (auction, auctionAmount, reserveAmount, shareToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            0,
            address(0),
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // silence unused warning
        shareToken; // silence unused warning
    }

    /**
     * @notice Permit2 (identity-funded) activate with creator/team reserve allocation.
     * @dev Remaining ■TOKENs are returned to `identity` (never msg.sender).
     */
    function batchActivateWithPermit2ForWithReserve(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReservePercent,
        address creatorReserveRecipient,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        if (
            identity == address(0) || creatorToken == address(0) || vault == address(0) || wrapper == address(0)
                || ccaStrategy == address(0)
        ) {
            revert ZeroAddress();
        }
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);
        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) {
                revert NotAuthorizedOperator();
            }
        }
        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, identity, signature);

        uint256 auctionAmount;
        uint256 reserveAmount;
        address shareToken;
        (auction, auctionAmount, reserveAmount, shareToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            creatorReservePercent,
            creatorReserveRecipient,
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount;
        shareToken;
    }

    /**
     * @notice Batch activate on behalf of a canonical identity wallet (operator-funded via Permit2).
     * @dev Caller must be `identity` or an authorized operator on the vault (OP_ACTIVATE).
     *      Remaining share tokens are always returned to `identity` (never `msg.sender`).
     */
    function batchActivateWithPermit2FromOperator(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        // Validate inputs
        if (
            identity == address(0) || creatorToken == address(0) || vault == address(0) || wrapper == address(0)
                || ccaStrategy == address(0)
        ) revert ZeroAddress();
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);

        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) {
                revert NotAuthorizedOperator();
            }
        }

        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        // ============ STEP 1: Pull creator tokens from operator via Permit2 ============
        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, msg.sender, signature);

        // Default behavior: no creator reserve; leftover goes back to identity
        uint256 auctionAmount;
        uint256 reserveAmount;
        address shareToken;
        (auction, auctionAmount, reserveAmount, shareToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            0,
            address(0),
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // silence unused warning
        shareToken; // silence unused warning
    }

    /**
     * @notice Permit2 (operator-funded) activate with creator/team reserve allocation.
     * @dev Remaining ■TOKENs are returned to `identity` (never msg.sender).
     */
    function batchActivateWithPermit2FromOperatorWithReserve(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReservePercent,
        address creatorReserveRecipient,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        if (
            identity == address(0) || creatorToken == address(0) || vault == address(0) || wrapper == address(0)
                || ccaStrategy == address(0)
        ) {
            revert ZeroAddress();
        }
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);
        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) {
                revert NotAuthorizedOperator();
            }
        }
        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, msg.sender, signature);

        uint256 auctionAmount;
        uint256 reserveAmount;
        address shareToken;
        (auction, auctionAmount, reserveAmount, shareToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            creatorReservePercent,
            creatorReserveRecipient,
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount;
        shareToken;
    }
}
