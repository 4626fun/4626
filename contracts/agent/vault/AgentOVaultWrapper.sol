// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IShareOFT is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

interface IQueueAwareVault {
    function largeWithdrawalThreshold() external view returns (uint256);
}

/**
 * @title AgentOVaultWrapper
 * @author 0xakita.eth
 * @notice All-in-one wrapper for agent lane: Agent token ↔ ShareOFT (◆/◇ symbols).
 *
 * @dev Normalizes the vault's 10^3 offset for clean 1:1 UX.
 *      Integrated with shared ShareOFT, cooldowns, and revenue paths.
 *      Chain-specific config post-deploy.
 */
contract AgentOVaultWrapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    /**
     * @notice Normalization factor to offset the vault's 10^3 decimals offset
     * @dev The vault uses _decimalsOffset() = 3, meaning:
     *      - 1 agent token deposited → ~1000 ◇ shares
     *
     *      We normalize this in wrap/unwrap:
     *      - Wrap: ◆ = ◇ / 1000
     *      - Unwrap: ◇ = ◆ * 1000
     *
     *      Result: 1 agent token ≈ 1 ◆ share (clean UX!)
     */
    uint256 public constant NORMALIZATION_FACTOR = 1000; // 10^3

    // ================================
    // IMMUTABLES
    // ================================

    /// @notice Agent token (e.g., the AgentTokenV4) - the underlying asset
    IERC20 public immutable agentToken;

    /// @notice AgentOVault (ERC-4626) - converts Agent token to vault shares
    IERC4626 public immutable vault;

    // ================================
    // MUTABLE STATE
    // ================================

    /// @notice ShareOFT token (e.g., ◆ATIKA) - set post-deploy
    IShareOFT public shareOFT;

    /// @notice Tracking for wrap/unwrap accounting
    uint256 public totalLocked; // Vault shares locked
    uint256 public totalMinted; // ShareOFT minted
    uint256 public totalUserDustShares; // Sum of user-attributed remainder shares
    mapping(address => uint256) public userDustShares;

    // FIX: M-01 — per-user flash loan protection (wrapper-level cooldown)
    mapping(address => uint256) public lastWrapperDepositBlock;
    uint256 public wrapperWithdrawDelayBlocks = 1;

    /// @notice Fees (basis points) - 0 by default for simplicity
    uint256 public wrapFee;
    uint256 public unwrapFee;
    uint256 public constant MAX_FEE = 1000; // 10% max
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Fee recipient (defaults to owner)
    address public feeRecipient;

    /// @notice Whitelist (no fees)
    mapping(address => bool) public isWhitelisted;
    /// @notice Trusted callers allowed to attribute fee/dust accounting to a third-party beneficiary.
    mapping(address => bool) public isBeneficiaryOperator;

    /// @notice Fee statistics
    uint256 public totalWrapFees;
    uint256 public totalUnwrapFees;

    // ================================
    // EVENTS
    // ================================

    // User-facing events
    event Deposited(address indexed user, uint256 agentTokenIn, uint256 shareOFTOut);
    event Withdrawn(address indexed user, uint256 shareOFTIn, uint256 agentTokenOut);

    // Internal wrap/unwrap events
    event Wrapped(address indexed user, uint256 vaultSharesIn, uint256 shareOFTOut, uint256 fee);
    event Unwrapped(address indexed user, uint256 shareOFTIn, uint256 vaultSharesOut, uint256 fee);

    // Admin events
    event ShareOFTSet(address indexed shareOFT);
    event WhitelistUpdated(address indexed user, bool status);
    event FeesUpdated(uint256 wrapFee, uint256 unwrapFee);
    event FeeRecipientUpdated(address indexed recipient);
    event BeneficiaryOperatorUpdated(address indexed operator, bool status);

    // FIX: M-08 — cooldown propagation on ShareOFT transfer
    event CooldownPropagated(address indexed from, address indexed to, uint256 propagatedBlock);

    // ================================
    // ERRORS
    // ================================

    error ZeroAmount();
    error ZeroAddress();
    error ShareOFTNotSet();
    error ShareOFTAlreadySet();
    error ShareOFTNotContract(address shareOFT);
    error ShareOFTInvalidERC20(address shareOFT);
    error ShareOFTMintBalanceMismatch(
        address user, uint256 beforeBalance, uint256 afterBalance, uint256 expectedIncrease
    );
    error ShareOFTBurnBalanceMismatch(
        address user, uint256 beforeBalance, uint256 afterBalance, uint256 expectedDecrease
    );
    error BurnExceedsTotalMinted(uint256 totalMinted, uint256 burnAmount);
    error InsufficientLocked();
    error FeeExceedsLimit();
    error SlippageExceeded();
    error AmountTooSmallToNormalize(); // < 1 normalized share after fees + user dust
    error WrapperWithdrawTooSoon(uint256 currentBlock, uint256 requiredBlock);
    // FIX: M-08 — cooldown propagation hook restricted to the registered ShareOFT
    error CooldownHookUnauthorizedCaller(address caller);
    error UnauthorizedBeneficiaryOperator(address operator, address beneficiary);
    error AsyncRedemptionRequired(uint256 assets, uint256 threshold);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy wrapper (same address possible on all chains)
     * @param _agentToken Agent token address (e.g. the AgentTokenV4)
     * @param _vault AgentOVault address (ERC-4626)
     * @param _owner Owner address
     */
    constructor(address _agentToken, address _vault, address _owner) Ownable(_owner) {
        require(_agentToken != address(0), "Zero agentToken");
        require(_vault != address(0), "Zero vault");

        agentToken = IERC20(_agentToken);
        vault = IERC4626(_vault);
        feeRecipient = _owner;
        isWhitelisted[_owner] = true;
        isBeneficiaryOperator[_owner] = true;

        // Infinite approval for vault deposits
        IERC20(_agentToken).approve(_vault, type(uint256).max);
    }

    // ================================
    // ADMIN - POST-DEPLOY CONFIG
    // ================================

    /**
     * @notice Set the chain-specific ShareOFT (called after deploy)
     * @param _shareOFT AgentShareOFT address (e.g., ◆ATIKA)
     */
    function setShareOFT(address _shareOFT) external onlyOwner {
        if (_shareOFT == address(0)) revert ZeroAddress();
        if (address(shareOFT) != address(0)) revert ShareOFTAlreadySet();
        if (_shareOFT.code.length == 0) revert ShareOFTNotContract(_shareOFT);

        // Sanity check: ensure the target behaves like an ERC20 for balance reads.
        // This prevents one-time misconfiguration to a non-ERC20 contract.
        try IERC20(_shareOFT).totalSupply() returns (
            uint256
        ) {
        // ok
        }
        catch {
            revert ShareOFTInvalidERC20(_shareOFT);
        }
        try IERC20(_shareOFT).balanceOf(address(this)) returns (
            uint256
        ) {
        // ok
        }
        catch {
            revert ShareOFTInvalidERC20(_shareOFT);
        }

        shareOFT = IShareOFT(_shareOFT);
        emit ShareOFTSet(_shareOFT);
    }

    function setFees(uint256 _wrapFee, uint256 _unwrapFee) external onlyOwner {
        if (_wrapFee > MAX_FEE || _unwrapFee > MAX_FEE) revert FeeExceedsLimit();
        wrapFee = _wrapFee;
        unwrapFee = _unwrapFee;
        emit FeesUpdated(_wrapFee, _unwrapFee);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    function setWhitelist(address user, bool status) external onlyOwner {
        isWhitelisted[user] = status;
        emit WhitelistUpdated(user, status);
    }

    function batchWhitelist(address[] calldata users, bool status) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            isWhitelisted[users[i]] = status;
            emit WhitelistUpdated(users[i], status);
        }
    }

    function setBeneficiaryOperator(address operator, bool status) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        isBeneficiaryOperator[operator] = status;
        emit BeneficiaryOperatorUpdated(operator, status);
    }

    // ================================
    // USER-FACING: DEPOSIT & WITHDRAW
    // ================================

    /**
     * @notice Deposit Agent token and receive ShareOFT in ONE transaction
     *
     * @dev USER SEES: agentToken → ◆ share
     *
     * @dev INTERNAL FLOW:
     *      1. Take Agent token from user
     *      2. Deposit to vault → get vault shares
     *      3. Lock vault shares, mint ShareOFT
     *      4. Send ShareOFT to user
     *
     * @param amount Amount of Agent token to deposit
     * @param minOut Minimum ShareOFT to receive (slippage protection)
     * @return shareOFTOut Amount of ShareOFT received
     */
    function deposit(uint256 amount, uint256 minOut) external nonReentrant returns (uint256 shareOFTOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();

        // 1. Take Agent token from user
        agentToken.safeTransferFrom(msg.sender, address(this), amount);

        // 2. Deposit to vault → get vault shares
        uint256 vaultShares = vault.deposit(amount, address(this));

        // 3. Wrap vault shares → ShareOFT (internal, no extra transfer)
        shareOFTOut = _wrapInternal(vaultShares, msg.sender, msg.sender);

        // 4. Check slippage
        if (shareOFTOut < minOut) revert SlippageExceeded();

        // FIX: M-01 — track per-user deposit block for wrapper-level flash loan protection
        lastWrapperDepositBlock[msg.sender] = block.number;

        emit Deposited(msg.sender, amount, shareOFTOut);
    }

    /**
     * @notice Deposit with zero slippage protection (convenience)
     */
    function deposit(uint256 amount) external nonReentrant returns (uint256 shareOFTOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();

        agentToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 vaultShares = vault.deposit(amount, address(this));
        shareOFTOut = _wrapInternal(vaultShares, msg.sender, msg.sender);

        // FIX: M-01 — track per-user deposit block for wrapper-level flash loan protection
        lastWrapperDepositBlock[msg.sender] = block.number;

        emit Deposited(msg.sender, amount, shareOFTOut);
    }

    /**
     * @notice Deposit Agent token and attribute fee/dust accounting to `beneficiary`.
     * @dev Beneficiary attribution to third parties is restricted to trusted operators (e.g. hub composer).
     *      Minted ShareOFT is always credited to `msg.sender`.
     */
    function depositFor(uint256 amount, uint256 minOut, address beneficiary)
        external
        nonReentrant
        returns (uint256 shareOFTOut)
    {
        if (beneficiary == address(0)) revert ZeroAddress();
        _requireBeneficiaryOperator(beneficiary);
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();

        agentToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 vaultShares = vault.deposit(amount, address(this));
        shareOFTOut = _wrapInternal(vaultShares, beneficiary, msg.sender);
        if (shareOFTOut < minOut) revert SlippageExceeded();

        // FIX: M-01 — track per-user deposit block for wrapper-level flash loan protection
        lastWrapperDepositBlock[msg.sender] = block.number;

        emit Deposited(beneficiary, amount, shareOFTOut);
    }

    /**
     * @notice Withdraw ShareOFT and receive Agent token in ONE transaction
     *
     * @dev USER SEES: ◆ share → agentToken
     *
     * @dev INTERNAL FLOW:
     *      1. Burn ShareOFT from user
     *      2. Release vault shares
     *      3. Redeem vault shares → Agent token
     *      4. Send Agent token to user
     *
     * @param amount Amount of ShareOFT to withdraw
     * @param minOut Minimum Agent token to receive (slippage protection)
     * @return agentTokenOut Amount of Agent token received
     */
    function withdraw(uint256 amount, uint256 minOut) external nonReentrant returns (uint256 agentTokenOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        // FIX: M-01 — enforce per-user cooldown
        _requireWrapperCooldown(msg.sender);

        // 1-2. Unwrap: burn ShareOFT, get vault shares (internal)
        uint256 vaultShares = _unwrapInternal(amount, msg.sender, msg.sender);
        _requireSynchronousRedemption(vaultShares);

        // 3. Redeem vault shares → Agent token (sent directly to user)
        agentTokenOut = vault.redeem(vaultShares, msg.sender, address(this));

        // 4. Check slippage
        if (agentTokenOut < minOut) revert SlippageExceeded();

        emit Withdrawn(msg.sender, amount, agentTokenOut);
    }

    /**
     * @notice Withdraw with zero slippage protection (convenience)
     */
    function withdraw(uint256 amount) external nonReentrant returns (uint256 agentTokenOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        // FIX: M-01 — enforce per-user cooldown
        _requireWrapperCooldown(msg.sender);

        uint256 vaultShares = _unwrapInternal(amount, msg.sender, msg.sender);
        _requireSynchronousRedemption(vaultShares);
        agentTokenOut = vault.redeem(vaultShares, msg.sender, address(this));

        emit Withdrawn(msg.sender, amount, agentTokenOut);
    }

    /**
     * @notice Withdraw Agent token and attribute fee/dust accounting to `beneficiary`.
     * @dev Beneficiary attribution to third parties is restricted to trusted operators (e.g. hub composer).
     *      Agent token output is always redeemed to `msg.sender`.
     */
    function withdrawFor(uint256 amount, uint256 minOut, address beneficiary)
        external
        nonReentrant
        returns (uint256 agentTokenOut)
    {
        if (beneficiary == address(0)) revert ZeroAddress();
        _requireBeneficiaryOperator(beneficiary);
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        // FIX: M-01 — enforce per-user cooldown
        _requireWrapperCooldown(msg.sender);

        uint256 vaultShares = _unwrapInternal(amount, beneficiary, msg.sender);
        _requireSynchronousRedemption(vaultShares);
        agentTokenOut = vault.redeem(vaultShares, msg.sender, address(this));
        if (agentTokenOut < minOut) revert SlippageExceeded();

        emit Withdrawn(beneficiary, amount, agentTokenOut);
    }

    // ================================
    // ADVANCED: WRAP & UNWRAP
    // (For integrations that already have vault shares)
    // ================================

    /**
     * @notice Wrap vault shares → ShareOFT tokens
     * @dev For advanced users who already have vault shares (◇ATIKA)
     * @param amount Amount of vault shares to wrap
     * @return amountOut Amount of ShareOFT tokens minted
     */
    function wrap(uint256 amount) external nonReentrant returns (uint256 amountOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();

        // Take vault shares from user
        IERC20(address(vault)).safeTransferFrom(msg.sender, address(this), amount);

        // Wrap internally
        amountOut = _wrapInternal(amount, msg.sender, msg.sender);

        // FIX: M-08 — advanced wrap mints ShareOFT and must participate in
        // the same wrapper-level cooldown as deposit paths.
        lastWrapperDepositBlock[msg.sender] = block.number;
    }

    /**
     * @notice Unwrap ShareOFT tokens → vault shares
     * @dev For advanced users who want vault shares (◇ATIKA) directly
     * @param amount Amount of ShareOFT tokens to unwrap
     * @return amountOut Amount of vault shares released
     */
    function unwrap(uint256 amount) external nonReentrant returns (uint256 amountOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        // FIX: M-08 — advanced unwrap releases vault shares directly and must
        // enforce the same cooldown as withdraw paths.
        _requireWrapperCooldown(msg.sender);

        // Unwrap internally (burns from user)
        amountOut = _unwrapInternal(amount, msg.sender, msg.sender);

        // Transfer vault shares to user
        IERC20(address(vault)).safeTransfer(msg.sender, amountOut);
    }

    // ================================
    // INTERNAL WRAP/UNWRAP
    // ================================

    /**
     * @dev Internal wrap: locks vault shares, mints NORMALIZED ShareOFT
     * @param vaultSharesIn Vault shares to lock (already in this contract)
     * @param accountingUser User used for fee/dust accounting and whitelist checks
     * @param mintTo Recipient that receives newly minted ShareOFT
     * @return shareOFTOut Normalized share token amount (◆ATIKA = vaultShares / 1000)
     *
     * @dev NORMALIZATION:
     *      1000 ◇ATIKA → 1 ◆ATIKA
     *      This makes: 1 agentToken ≈ 1 ◆ share (clean UX!)
     */
    function _wrapInternal(uint256 vaultSharesIn, address accountingUser, address mintTo)
        internal
        returns (uint256 shareOFTOut)
    {
        uint256 fee = 0;
        uint256 vaultSharesAfterFee = vaultSharesIn;

        if (!isWhitelisted[accountingUser] && wrapFee > 0) {
            fee = (vaultSharesIn * wrapFee) / BASIS_POINTS;
            vaultSharesAfterFee = vaultSharesIn - fee;
            totalWrapFees += fee;

            // Send fee (in vault shares)
            if (fee > 0) {
                IERC20(address(vault)).safeTransfer(feeRecipient, fee);
            }
        }

        // Include user dust so normalization never destroys value.
        uint256 priorDust = userDustShares[accountingUser];
        uint256 normalizedInput = vaultSharesAfterFee + priorDust;

        // NORMALIZE: Divide by 1000 to get share token amount
        // 1000 ◇ATIKA → 1 ◆ATIKA
        shareOFTOut = normalizedInput / NORMALIZATION_FACTOR;
        if (shareOFTOut == 0) revert AmountTooSmallToNormalize();

        uint256 newDust = normalizedInput - (shareOFTOut * NORMALIZATION_FACTOR);
        userDustShares[accountingUser] = newDust;
        totalUserDustShares = totalUserDustShares - priorDust + newDust;

        // Track locked shares (minus fee)
        totalLocked += vaultSharesAfterFee;

        // Mint normalized share token to user
        uint256 beforeBalance = shareOFT.balanceOf(mintTo);
        shareOFT.mint(mintTo, shareOFTOut);
        uint256 afterBalance = shareOFT.balanceOf(mintTo);
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != shareOFTOut) {
            revert ShareOFTMintBalanceMismatch(mintTo, beforeBalance, afterBalance, shareOFTOut);
        }
        totalMinted += shareOFTOut;

        emit Wrapped(accountingUser, vaultSharesIn, shareOFTOut, fee);
    }

    /**
     * @dev Internal unwrap: burns ShareOFT, releases DENORMALIZED vault shares
     * @param shareOFTIn Normalized share token amount (◆ATIKA) to burn
     * @param accountingUser User used for fee/dust accounting and whitelist checks
     * @param burnFrom Account that provides ShareOFT for burn
     * @return vaultSharesOut Denormalized vault shares (◇ATIKA = ◆ATIKA * 1000)
     *
     * @dev DENORMALIZATION:
     *      1 ◆ATIKA → 1000 ◇ATIKA
     *      This makes: 1 ◆ share ≈ 1 agentToken (clean UX!)
     */
    function _unwrapInternal(uint256 shareOFTIn, address accountingUser, address burnFrom)
        internal
        returns (uint256 vaultSharesOut)
    {
        // DENORMALIZE: Multiply by 1000 and include user's accumulated dust.
        // 1 ◆ATIKA → 1000 ◇ATIKA (+ user dust remainder)
        uint256 userDust = userDustShares[accountingUser];
        uint256 vaultSharesBeforeFee = shareOFTIn * NORMALIZATION_FACTOR + userDust;

        uint256 fee = 0;
        vaultSharesOut = vaultSharesBeforeFee;

        if (!isWhitelisted[accountingUser] && unwrapFee > 0) {
            fee = (vaultSharesBeforeFee * unwrapFee) / BASIS_POINTS;
            vaultSharesOut = vaultSharesBeforeFee - fee;
            totalUnwrapFees += fee;
        }

        if (totalLocked < vaultSharesBeforeFee) revert InsufficientLocked();
        if (shareOFTIn > totalMinted) revert BurnExceedsTotalMinted(totalMinted, shareOFTIn);

        // Burn normalized share token from user
        uint256 beforeBalance = shareOFT.balanceOf(burnFrom);
        shareOFT.burn(burnFrom, shareOFTIn);
        uint256 afterBalance = shareOFT.balanceOf(burnFrom);
        if (beforeBalance < shareOFTIn || afterBalance > beforeBalance || beforeBalance - afterBalance != shareOFTIn) {
            revert ShareOFTBurnBalanceMismatch(burnFrom, beforeBalance, afterBalance, shareOFTIn);
        }
        totalMinted -= shareOFTIn;

        if (userDust > 0) {
            userDustShares[accountingUser] = 0;
            totalUserDustShares -= userDust;
        }

        // Release vault shares (denormalized)
        totalLocked -= vaultSharesBeforeFee;

        // Send fee (in vault shares)
        if (fee > 0) {
            IERC20(address(vault)).safeTransfer(feeRecipient, fee);
        }

        emit Unwrapped(accountingUser, shareOFTIn, vaultSharesOut, fee);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Preview how much ShareOFT you'll get for depositing Agent token
     */
    function previewDeposit(uint256 agentTokenAmount) external view returns (uint256) {
        uint256 vaultShares = vault.previewDeposit(agentTokenAmount);
        return _previewWrap(vaultShares, msg.sender);
    }

    /**
     * @notice Preview how much Agent token you'll get for withdrawing ShareOFT
     */
    function previewWithdraw(uint256 shareOFTAmount) external view returns (uint256) {
        uint256 vaultShares = _previewUnwrap(shareOFTAmount, msg.sender);
        return vault.previewRedeem(vaultShares);
    }

    /**
     * @notice Preview wrap output (vaultShares → ShareOFT)
     */
    function previewWrap(uint256 amount, address user) external view returns (uint256) {
        return _previewWrap(amount, user);
    }

    /**
     * @notice Preview unwrap output (ShareOFT → vaultShares)
     */
    function previewUnwrap(uint256 amount, address user) external view returns (uint256) {
        return _previewUnwrap(amount, user);
    }

    /**
     * @dev Preview wrap with normalization: vaultShares → share token (◆ATIKA)
     */
    function _previewWrap(uint256 vaultShares, address user) internal view returns (uint256 shareOFTAmount) {
        uint256 afterFee = vaultShares;
        if (!isWhitelisted[user] && wrapFee > 0) {
            afterFee = vaultShares - (vaultShares * wrapFee) / BASIS_POINTS;
        }
        uint256 normalizedInput = afterFee + userDustShares[user];
        // NORMALIZE: ÷1000
        shareOFTAmount = normalizedInput / NORMALIZATION_FACTOR;
    }

    /**
     * @dev Preview unwrap with denormalization: share token (◆ATIKA) → vaultShares
     */
    function _previewUnwrap(uint256 shareOFTAmount, address user) internal view returns (uint256 vaultShares) {
        // DENORMALIZE: ×1000 (+ user dust)
        uint256 vaultSharesBeforeFee = shareOFTAmount * NORMALIZATION_FACTOR + userDustShares[user];

        if (isWhitelisted[user] || unwrapFee == 0) return vaultSharesBeforeFee;
        return vaultSharesBeforeFee - (vaultSharesBeforeFee * unwrapFee) / BASIS_POINTS;
    }

    /**
     * @notice Get the current price per share (1e18 scale)
     */
    function pricePerShare() external view returns (uint256) {
        uint256 totalAssets = vault.totalAssets();
        uint256 totalSupply = vault.totalSupply();
        if (totalSupply == 0) return 1e18;
        return (totalAssets * 1e18) / totalSupply;
    }

    /**
     * @notice Check if wrapper is ready
     */
    function isReady() external view returns (bool) {
        return address(shareOFT) != address(0);
    }

    /**
     * @notice Check if wrapper is balanced against required share backing
     * @dev required backing = minted * 1000 + user-attributed dust
     */
    function isBalanced() external view returns (bool) {
        return totalLocked == _requiredLockedBacking();
    }

    /**
     * @notice Get wrapper reserves
     * @return locked Vault shares locked (◇ATIKA, NOT normalized)
     * @return minted ShareOFT minted (◆ATIKA, normalized)
     * @dev Note: locked = minted * 1000 + dust when balanced
     */
    function getReserves() external view returns (uint256 locked, uint256 minted) {
        return (totalLocked, totalMinted);
    }

    /**
     * @notice Get the total vault-share backing required by minted supply and user dust
     */
    function requiredLockedBacking() external view returns (uint256) {
        return _requiredLockedBacking();
    }

    /**
     * @notice Get fee statistics
     */
    function getFeeStats() external view returns (uint256 wrapFeesCollected, uint256 unwrapFeesCollected) {
        return (totalWrapFees, totalUnwrapFees);
    }

    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (uint256 totalAssets, uint256 totalSupply, uint256 _pricePerShare) {
        totalAssets = vault.totalAssets();
        totalSupply = vault.totalSupply();
        _pricePerShare = totalSupply > 0 ? (totalAssets * 1e18) / totalSupply : 1e18;
    }

    /**
     * @notice Get all contract addresses
     */
    function getContracts() external view returns (address _agentToken, address _vault, address _shareOFT) {
        return (address(agentToken), address(vault), address(shareOFT));
    }

    /**
     * @notice Vault shares token address
     */
    function vaultToken() external view returns (address) {
        return address(vault);
    }

    /**
     * @notice ShareOFT token address
     */
    function oftToken() external view returns (address) {
        return address(shareOFT);
    }

    /**
     * @notice Emergency verify - check balances match accounting
     * @dev Uses >= instead of == to tolerate rounding dust or direct vault-share
     *      transfers (e.g. selfdestruct, coinbase) that can push the real balance
     *      above the bookkeeping value.
     */
    function verify() external view returns (bool) {
        uint256 actualLocked = IERC20(address(vault)).balanceOf(address(this));
        uint256 requiredBacking = _requiredLockedBacking();
        return actualLocked >= totalLocked && totalLocked >= requiredBacking;
    }

    // ================================
    // EMERGENCY
    // ================================

    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        // Prevent unauthorized withdrawal of user-backed vault shares.
        // Only excess shares above required backing are emergency-withdrawable.
        if (token == address(vault)) {
            uint256 actualLocked = IERC20(address(vault)).balanceOf(address(this));
            uint256 requiredLocked = _requiredLockedBacking();
            if (actualLocked <= requiredLocked) revert InsufficientLocked();
            if (amount > actualLocked - requiredLocked) revert InsufficientLocked();
        }

        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Refresh vault approval if needed
     */
    function refreshApproval() external onlyOwner {
        agentToken.approve(address(vault), type(uint256).max);
    }

    function _requiredLockedBacking() internal view returns (uint256) {
        return totalMinted * NORMALIZATION_FACTOR + totalUserDustShares;
    }

    function _requireBeneficiaryOperator(address beneficiary) internal view {
        if (beneficiary == msg.sender) return;
        if (!isBeneficiaryOperator[msg.sender]) {
            revert UnauthorizedBeneficiaryOperator(msg.sender, beneficiary);
        }
    }

    // FIX: M-01 — enforce per-user cooldown at the wrapper level
    function _requireWrapperCooldown(address user) internal view {
        if (isWhitelisted[user] || isBeneficiaryOperator[user]) return;
        uint256 requiredBlock = lastWrapperDepositBlock[user] + wrapperWithdrawDelayBlocks;
        if (block.number < requiredBlock) revert WrapperWithdrawTooSoon(block.number, requiredBlock);
    }

    /**
     * @notice FIX: M-08 — propagate the wrapper cooldown on ShareOFT transfers.
     * @dev Called by AgentShareOFT._update on every non-mint/non-burn ERC20 movement
     *      (including LayerZero credit/debit via the OFT transfer hooks). Propagates
     *      `lastWrapperDepositBlock[from]` forward to `to` so a user cannot deposit,
     *      transfer the resulting ShareOFT to a fresh address, and withdraw in the
     *      same block.
     *
     *      Only the registered `shareOFT` may call this function. The hook is a
     *      monotonically-increasing max-propagator: it never decreases an existing
     *      cooldown on the recipient, so stacking deposits from multiple sources
     *      behaves correctly.
     *
     *      Mint (from == 0) and burn (to == 0) are skipped: deposit paths in this
     *      contract already record `lastWrapperDepositBlock[msg.sender] = block.number`
     *      on the original depositor, and burns have no recipient.
     */
    function propagateCooldownOnTransfer(address from, address to) external {
        if (msg.sender != address(shareOFT)) revert CooldownHookUnauthorizedCaller(msg.sender);
        // Mints and burns are no-ops here. Deposits record the cooldown on the
        // original depositor; burns have no recipient to propagate to.
        if (from == address(0) || to == address(0)) return;
        if (from == to) return;

        uint256 fromBlock = lastWrapperDepositBlock[from];
        if (fromBlock == 0) return;

        uint256 toBlock = lastWrapperDepositBlock[to];
        if (fromBlock > toBlock) {
            lastWrapperDepositBlock[to] = fromBlock;
            emit CooldownPropagated(from, to, fromBlock);
        }
    }

    function _requireSynchronousRedemption(uint256 vaultShares) internal view {
        (bool success, bytes memory data) = address(vault).staticcall(
            abi.encodeWithSelector(IQueueAwareVault.largeWithdrawalThreshold.selector)
        );
        if (!success || data.length < 32) {
            return;
        }

        uint256 threshold = abi.decode(data, (uint256));
        if (threshold == 0) return;

        uint256 previewAssets = vault.previewRedeem(vaultShares);
        if (previewAssets >= threshold) {
            revert AsyncRedemptionRequired(previewAssets, threshold);
        }
    }
}
