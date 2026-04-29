// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {SendParam} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import {MessagingFee, MessagingReceipt} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OFTMsgCodec} from "@layerzerolabs/oft-evm/contracts/libs/OFTMsgCodec.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ICreatorGaugeController} from "../../interfaces/core/ICreatorGaugeController.sol";
import {ICreatorOVault} from "../../interfaces/core/ICreatorOVault.sol";
import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";

/// @dev Hub-only: interface for local lottery manager calls on Base
interface ICreatorLotteryManager {
    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn) external payable returns (uint256);
    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256 buyerCurrentShareBalance)
        external
        payable
        returns (uint256);
}

/**
 * @title ILotteryBeneficiary
 * @notice Interface for aggregators/multicall contracts to specify lottery beneficiary
 * @dev Implement this on aggregator contracts to ensure users get lottery entries
 *      when swapping through your protocol.
 */
interface ILotteryBeneficiary {
    /**
     * @notice Returns the actual user who should receive lottery entries
     * @return beneficiary The address that should receive lottery entries
     *         Return address(0) to use the contract itself as beneficiary
     */
    function getLotteryBeneficiary() external view returns (address beneficiary);
}

/**
 * @title ISimpleSellTaxHook
 * @notice Interface for the V4 tax hook that requires token owner to configure
 * @dev Hook at 0xca975B9dAF772C71161f3648437c3616E5Be0088 on Base (hub-only)
 */
interface ISimpleSellTaxHook {
    function setTaxConfig(
        address token_,
        address counterAsset_,
        address recipient_,
        uint256 taxRate_,
        bool counterIsEth,
        bool enabled_,
        bool lock_
    ) external;
}

// FIX: M-08 — wrapper-side cooldown propagation hook
interface IWrapperCooldownHook {
    function propagateCooldownOnTransfer(address from, address to) external;
}

/**
 * @title CreatorShareOFT
 * @author 0xakita.eth
 * @notice OFT receipt token for CreatorOVault with buy fee, lottery, and hub-centric architecture
 *
 * @dev ARCHITECTURE:
 *      This contract operates in two modes controlled by `isHub`:
 *
 *      HUB MODE (Base):
 *      - Fees sent to local GaugeController via receiveFees()
 *      - Lottery entries processed by local CreatorLotteryManager
 *      - Full vault/wrapper/gauge stack available
 *
 *      REMOTE MODE (Arbitrum, etc.):
 *      - Fees accumulated internally, bridged back to Base via flushFees()
 *      - Lottery entries sent as LayerZero messages to Base hub
 *      - Winner callbacks received from hub, emitted as local events
 *      - No vault, wrapper, gauge, or lottery manager deployed
 *
 * @dev FEE MECHANISM:
 *      - Register DEX pools/routers as SwapOnly
 *      - Buys (from SwapOnly → user) = 6.9% fee
 *      - Hub: fee → GaugeController → unwrap → distribute (21.39% burn, 69% lottery, 9.61% voter rewards)
 *      - Remote: fee → pendingFees → flushFees() bridges OFT back to Base gauge
 *      - Sells: can be taxed by a Base V4 hook when hook config is explicitly activated
 *
 * @dev BUILDS ON TOP OF ZORAS CREATOR COINS
 *      Each creator deploys their own ShareOFT (e.g., ■AKITA for AKITA vault)
 */
contract CreatorShareOFT is OFT, ReentrancyGuard {
    using OptionsBuilder for bytes;
    using OFTMsgCodec for bytes;
    using OFTMsgCodec for bytes32;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant BASIS_POINTS = 10000;
    uint16 public constant MAX_FEE_BPS = 1000; // 10% max

    /// @notice Custom LayerZero message types (extends OFT SEND=1, SEND_AND_CALL=2)
    uint16 public constant MSG_TYPE_LOTTERY_ENTRY = 3;
    uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4;

    /// @notice Default gas limit for cross-chain lottery entry messages
    uint128 public constant DEFAULT_LOTTERY_GAS_LIMIT = 300_000;

    /// @notice Default gas limit for fee flush (OFT send)
    uint128 public constant DEFAULT_FLUSH_GAS_LIMIT = 200_000;

    // ================================
    // TYPES
    // ================================

    /// @notice Address classification for fee detection
    enum OperationType {
        Unknown, // Normal transfer - no fees
        SwapOnly, // Trading venue - buys = fee
        NoFees // Exempt from all fees
    }

    // ================================
    // STATE - CORE
    // ================================

    /// @notice CreatorRegistry for ecosystem contracts
    ICreatorRegistry public registry;

    /// @notice Chain EID for this deployment
    uint32 public immutable chainEid;

    /// @notice Whether this is the hub chain (Base). Controls fee routing and lottery behavior.
    bool public isHub;

    /// @notice Associated vault (hub-only, address(0) on remote chains)
    address public vault;

    /// @notice All fees go here on hub chain (address(0) on remote chains)
    address public gaugeController;

    /// @notice Buy fee in basis points (690 = 6.9%)
    uint16 public buyFeeBps = 690;

    /// @notice Feature toggles
    bool public feesEnabled = true;
    bool public lotteryEnabled = true;

    /// @notice Address classification mapping
    mapping(address => OperationType) public addressType;

    /// @notice Minter permissions (for wrapper integration)
    mapping(address => bool) public isMinter;

    // FIX: M-08 — registered wrapper that receives transfer notifications so it can
    // propagate its per-user deposit cooldown forward on ShareOFT transfers. When
    // unset (address(0)) the hook is disabled and behaviour matches the pre-fix
    // code path exactly.
    address public wrapper;

    /// @notice Dedup set for winner-callback messages to prevent replay
    /// @dev FIX: H-14 — LayerZero delivers each message with a unique _guid.
    ///      The OFT base-class nonce tracker handles replay for token transfers,
    ///      but the custom winner-callback branch short-circuits before that,
    ///      so we track consumed guids explicitly here.
    mapping(bytes32 => bool) public usedReportIds;

    /// @notice Allowlist of contracts trusted to return a lottery beneficiary
    /// @dev FIX: H-04 — only addresses on this allowlist are consulted via
    ///      ILotteryBeneficiary.getLotteryBeneficiary(). Any other contract
    ///      recipient falls through to itself as the beneficiary. This prevents
    ///      an arbitrary malicious contract-recipient from redirecting lottery
    ///      entries to an attacker-controlled EOA.
    mapping(address => bool) public isLotteryResolver;

    /// @notice Tax config delegate (hub-only, for future custom hooks)
    address public taxConfigDelegate;

    /// @notice ERC-7572 contract-level metadata URI
    /// @dev Returns a URL to JSON metadata including token image, description, etc.
    string private _contractURI;

    // ================================
    // STATE - REMOTE CHAIN FEE FORWARDING
    // ================================

    /// @notice Accumulated OFT fees on remote chains, waiting to be flushed to Base
    uint256 public pendingFees;

    /// @notice Minimum fees before auto-flush triggers (configurable)
    uint256 public flushThreshold = 100e18; // 100 OFT tokens

    /// @notice Address on Base that receives bridged fees (the hub GaugeController)
    address public hubGaugeReceiver;

    /// @notice LayerZero EID for the hub chain (Base)
    uint32 public hubEid;

    /// @notice Total fees flushed to hub (lifetime, remote only)
    uint256 public totalFeesFlushed;

    // ================================
    // STATE - REMOTE CHAIN LOTTERY ENTRY
    // ================================

    struct PendingLotteryEntry {
        address buyer;
        uint256 amount;
    }

    /// @notice LayerZero peer for the hub LotteryManager (bytes32-encoded address)
    bytes32 public hubLotteryPeer;

    /// @notice Gas limit for lottery entry messages to hub
    uint128 public lotteryEntryGasLimit = DEFAULT_LOTTERY_GAS_LIMIT;

    /// @notice Next id for pending remote lottery entries
    uint256 public nextPendingLotteryEntryId = 1;

    /// @notice Pending remote lottery entries keyed by entry id
    mapping(uint256 => PendingLotteryEntry) public pendingLotteryEntries;

    /// @notice Number of pending remote entries per buyer
    mapping(address => uint256) public pendingLotteryEntryCount;

    /// @notice Total lottery entries sent to hub (lifetime, remote only)
    uint256 public totalLotteryEntriesSent;

    // ================================
    // EVENTS
    // ================================

    event VaultSet(address indexed vault);
    event RegistrySet(address indexed registry);
    /// @notice FIX: H-04 — allowlist change event
    event LotteryResolverSet(address indexed resolver, bool allowed);
    /// @notice FIX: H-14 — duplicate callback observed and rejected
    event WinnerCallbackReplayRejected(bytes32 indexed reportId);
    event SharesMinted(address indexed to, uint256 amount);
    event SharesBurned(address indexed from, uint256 amount);
    event BuyFee(address indexed from, address indexed to, uint256 amount, uint256 fee);
    event FeeCollected(address indexed gaugeController, uint256 amount);
    event LotteryTriggered(address indexed buyer, uint256 amount, uint256 requestId);
    event AddressTypeSet(address indexed addr, OperationType opType);
    event GaugeControllerSet(address indexed controller);
    event BuyFeeUpdated(uint16 oldFee, uint16 newFee);
    event MinterUpdated(address indexed minter, bool status);
    // FIX: M-08
    event WrapperSet(address indexed wrapper);
    event WrapperCooldownHookFailed(address indexed wrapper, address indexed from, address indexed to, bytes revertData);
    event TaxConfigDelegateSet(address indexed delegate);
    event TaxHookConfigured(address indexed hook, address recipient, uint256 taxRate);

    /// @notice ERC-7572: Emitted when contract URI is updated
    event ContractURIUpdated();

    /// @notice Emitted when fees are accumulated on a remote chain
    event FeesAccumulated(uint256 amount, uint256 totalPending);

    /// @notice Emitted when accumulated fees are flushed (bridged) back to the hub
    event FeesFlushed(uint256 amount, address indexed hubReceiver, uint32 indexed hubEid);

    /// @notice Emitted when a lottery entry is sent to the hub from a remote chain
    event LotteryEntrySent(address indexed buyer, uint256 amount, uint32 indexed hubEid);

    /// @notice Emitted when a remote buy creates a pending lottery entry
    event PendingLotteryEntryQueued(
        uint256 indexed entryId, address indexed buyer, uint256 amount, uint32 indexed hubEid
    );

    /// @notice Emitted when a pending remote lottery entry is submitted
    event PendingLotteryEntrySubmitted(
        uint256 indexed entryId, address indexed buyer, uint256 amount, uint256 nativeFeePaid, uint32 indexed hubEid
    );

    /// @notice Emitted on remote chain when the hub notifies of a lottery win
    event LotteryWinnerNotification(
        address indexed winner, address indexed creatorCoin, uint256 totalSharesPaid, uint32 indexed sourceHubEid
    );

    /// @notice Hub config updated
    event HubConfigUpdated(bool isHub, uint32 hubEid, address hubGaugeReceiver);
    event HubLotteryPeerSet(uint32 indexed hubEid, bytes32 hubLotteryPeer);
    event FlushThresholdUpdated(uint256 newThreshold);
    event LotteryEntryGasLimitUpdated(uint128 newGasLimit);

    // ================================
    // ERRORS
    // ================================

    error OnlyVaultOrMinter();
    error ZeroAddress();
    error FeeTooHigh();
    error NotMinter();
    error NothingToFlush();
    error HubNotConfigured();
    error NotHub();
    error InvalidCallback();
    error MissingLayerZeroEid(uint256 chainId);
    error PendingLotteryEntryNotFound();
    error NotPendingLotteryEntryOwner();
    error InvalidLotteryEntryFee(uint256 provided, uint256 required);

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyVaultOrMinter() {
        if (msg.sender != vault && !isMinter[msg.sender] && msg.sender != owner()) {
            revert OnlyVaultOrMinter();
        }
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy chain-specific share token
     * @param _name Token name (e.g., "AKITA Shares")
     * @param _symbol Token symbol (e.g., "■AKITA")
     * @param _registry CreatorRegistry address (same on all chains for deterministic addresses)
     * @param _owner Owner address
     *
     * @dev DETERMINISTIC DEPLOYMENT:
     *      Registry address is same on all chains via CREATE2.
     *      LayerZero endpoint is looked up from registry at construction.
     *      This allows same constructor args → same CREATE2 address on all chains.
     *
     *      After deployment, call setHubConfig() to set hub vs remote mode.
     */
    constructor(string memory _name, string memory _symbol, address _registry, address _owner)
        OFT(_name, _symbol, ICreatorRegistry(_registry).getLayerZeroEndpoint(block.chainid), _owner)
        Ownable(_owner)
    {
        if (_registry == address(0)) revert ZeroAddress();

        registry = ICreatorRegistry(_registry);
        uint32 resolvedChainEid = ICreatorRegistry(_registry).getEidForChainId(block.chainid);
        if (resolvedChainEid == 0) revert MissingLayerZeroEid(block.chainid);
        chainEid = resolvedChainEid;
        addressType[address(this)] = OperationType.NoFees;
    }

    // ================================
    // VAULT FUNCTIONS
    // ================================

    /**
     * @notice Set the vault that can mint/burn shares (hub-only)
     * @param _vault CreatorOVault address
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        addressType[_vault] = OperationType.NoFees;
        emit VaultSet(_vault);
    }

    /**
     * @notice Set the registry for ecosystem lookups
     * @param _registry CreatorRegistry address
     */
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = ICreatorRegistry(_registry);
        emit RegistrySet(_registry);
    }

    /**
     * @notice Set minter permission (for wrapper integration)
     * @param minter Address to grant/revoke minting
     * @param status True to grant, false to revoke
     */
    function setMinter(address minter, bool status) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        isMinter[minter] = status;
        emit MinterUpdated(minter, status);
    }

    /**
     * @notice FIX: M-08 — register the CreatorOVaultWrapper so its per-user wrapper
     *         cooldown (`lastWrapperDepositBlock`) is propagated on ShareOFT transfers.
     *         Passing address(0) disables the hook. Exempts the wrapper from fees since
     *         wrap/unwrap should not be treated as a fee-bearing trade.
     */
    function setWrapper(address _wrapper) external onlyOwner {
        wrapper = _wrapper;
        if (_wrapper != address(0)) {
            addressType[_wrapper] = OperationType.NoFees;
        }
        emit WrapperSet(_wrapper);
    }

    /**
     * @notice Mint shares (vault/minter only)
     * @param _to Recipient
     * @param _amount Amount to mint
     */
    function mint(address _to, uint256 _amount) external onlyVaultOrMinter {
        _mint(_to, _amount);
        emit SharesMinted(_to, _amount);
    }

    /**
     * @notice Burn shares (vault/minter only)
     * @param _from Address to burn from
     * @param _amount Amount to burn
     */
    function burn(address _from, uint256 _amount) external onlyVaultOrMinter {
        // FIX: H-3 — require allowance when a minter burns from an arbitrary address;
        // vault and owner are trusted and exempt, but minters must have approval
        if (msg.sender != vault && msg.sender != owner()) {
            _spendAllowance(_from, msg.sender, _amount);
        }
        _burn(_from, _amount);
        emit SharesBurned(_from, _amount);
    }

    // ================================
    // TRANSFERS WITH FEES
    // ================================

    /**
     * @notice Transfer shares with fee detection
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        return _transferWithFees(_msgSender(), to, amount);
    }

    /**
     * @notice Transfer shares from another account with fee detection
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, _msgSender(), amount);
        return _transferWithFees(from, to, amount);
    }

    /**
     * @dev Internal transfer with fee logic
     */
    function _transferWithFees(address from, address to, uint256 amount) internal returns (bool) {
        if (from == address(0) || to == address(0)) revert ZeroAddress();

        OperationType fromType = addressType[from];
        OperationType toType = addressType[to];

        // Skip fees if either side is exempt
        if (fromType == OperationType.NoFees || toType == OperationType.NoFees) {
            _transfer(from, to, amount);
            return true;
        }

        // BUY = from trading venue to non-venue
        if (fromType == OperationType.SwapOnly && toType != OperationType.SwapOnly) {
            return _processBuy(from, to, amount);
        }

        // All else = no fees
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Process buy with fees. Follows CEI pattern.
     *
     * @notice FEE FLOW:
     *         1. Fee is collected in OFT tokens (■AKITA)
     *         2. Hub: sent to GaugeController via receiveFees()
     *            Remote: accumulated in pendingFees, bridged via flushFees()
     *         3. GaugeController on Base distributes:
     *            - 21.39% burned → increases PPS for all vault holders (ve(3,3) accrual)
     *            - 69% lottery → jackpot reserve for buyers
     *            - 9.61% voter rewards → ve4626 voters
     */
    function _processBuy(address from, address to, uint256 amount) internal nonReentrant returns (bool) {
        // Cache storage reads
        uint16 _buyFeeBps = buyFeeBps;
        bool _feesEnabled = feesEnabled;

        if (!_feesEnabled || _buyFeeBps == 0) {
            _transfer(from, to, amount);
            return true;
        }

        // Calculate fee
        uint256 feeAmount = (amount * _buyFeeBps) / BASIS_POINTS;
        uint256 transferAmount = amount - feeAmount;

        // CEI: Effects - transfer fee to this contract first, then to buyer
        _transfer(from, address(this), feeAmount);
        _transfer(from, to, transferAmount);

        emit BuyFee(from, to, amount, feeAmount);

        // Interactions: Route fees based on hub vs remote
        _routeFees(feeAmount);

        // Trigger lottery for buyer
        _triggerLottery(to, transferAmount);

        return true;
    }

    /**
     * @dev FIX: M-08 — hook every ERC20 balance change (mints, burns, transfers,
     *      LayerZero credit/debit via the OFT base _credit/_debit which ultimately
     *      call _update) to propagate the wrapper’s per-user flash-loan cooldown.
     *
     *      The hook is a no-op when no wrapper is registered (setWrapper(0)), for
     *      mints (`from == 0`), burns (`to == 0`), and self-transfers. The wrapper
     *      call is wrapped in try/catch: a revert in the hook must NOT freeze token
     *      transfers. Failures are surfaced via `WrapperCooldownHookFailed` so
     *      operators can page on persistent hook regressions.
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        super._update(from, to, value);

        address _wrapper = wrapper;
        if (_wrapper == address(0)) return;
        if (from == address(0) || to == address(0)) return;
        if (from == to) return;

        try IWrapperCooldownHook(_wrapper).propagateCooldownOnTransfer(from, to) {
            // ok
        } catch (bytes memory revertData) {
            emit WrapperCooldownHookFailed(_wrapper, from, to, revertData);
        }
    }

    // ================================
    // FEE ROUTING (HUB vs REMOTE)
    // ================================

    /**
     * @dev Route collected fees based on chain mode
     *      Hub: send directly to local GaugeController
     *      Remote: accumulate internally for batch bridging
     */
    function _routeFees(uint256 amount) internal {
        if (amount == 0) return;

        if (isHub) {
            _sendFeesToGauge(amount);
        } else {
            // Accumulate fees for batch bridging back to hub
            pendingFees += amount;
            emit FeesAccumulated(amount, pendingFees);
        }
    }

    /**
     * @dev Send fees to local gauge controller (hub-only path)
     */
    function _sendFeesToGauge(uint256 amount) internal {
        address _gaugeController = gaugeController;
        if (_gaugeController == address(0)) return;

        // Approve gauge controller to pull tokens
        _approve(address(this), _gaugeController, amount);

        // FIX: H-6 — remove fallback direct transfer that bypassed gauge accounting;
        // accumulate fees locally on failure instead of breaking gauge bookkeeping
        try ICreatorGaugeController(_gaugeController).receiveFees(amount) {
            emit FeeCollected(_gaugeController, amount);
        } catch {
            // FIX: M-03 (4626-312) — revoke the self-approval granted above before
            // accumulating. If receiveFees reverts, the allowance remains at `amount`
            // and would let a replaced/compromised gaugeController address pull the
            // balance without going through the accounting path. Zeroing the approval
            // forces a fresh approval on the next successful dispatch.
            _approve(address(this), _gaugeController, 0);
            // Accumulate instead of bypassing gauge accounting
            pendingFees += amount;
            emit FeesAccumulated(amount, pendingFees);
        }
    }

    /**
     * @notice Bridge accumulated fees back to the hub chain GaugeController
     * @dev Permissionless — anyone can trigger this (keeper, user, protocol)
     *      Uses OFT send() to burn tokens on this chain and mint on Base,
     *      delivered to the hubGaugeReceiver address.
     *
     *      Caller must pass the SendParam and MessagingFee externally.
     *      Use quoteFlushFees() to build the correct SendParam and get the fee quote.
     *
     * @param _sendParam The OFT SendParam (use buildFlushSendParam() to construct)
     * @param _fee The LayerZero messaging fee (use quoteFlushFees() to quote)
     */
    function flushFees(SendParam calldata _sendParam, MessagingFee calldata _fee) external payable nonReentrant {
        if (isHub) revert NotHub();
        if (pendingFees == 0) revert NothingToFlush();
        if (hubGaugeReceiver == address(0) || hubEid == 0) revert HubNotConfigured();

        uint256 amount = pendingFees;
        pendingFees = 0;
        totalFeesFlushed += amount;

        // Validate the send param matches our state
        require(_sendParam.dstEid == hubEid, "Invalid dstEid");
        require(_sendParam.to == bytes32(uint256(uint160(hubGaugeReceiver))), "Invalid receiver");
        require(_sendParam.amountLD == amount, "Amount mismatch");

        // Execute the OFT send (burns on this chain, mints on Base to hubGaugeReceiver)
        _send(_sendParam, _fee, payable(msg.sender));

        emit FeesFlushed(amount, hubGaugeReceiver, hubEid);
    }

    /**
     * @notice Build the SendParam for flushing fees (helper for off-chain callers)
     * @return sendParam The SendParam to pass to flushFees()
     */
    function buildFlushSendParam() external view returns (SendParam memory sendParam) {
        // FIX: M-4 — use _removeDust on minAmountLD to account for OFT shared-decimals
        // trimming; previously minAmountLD == pendingFees could be unreachable after
        // dust trimming, permanently blocking fee flushes
        sendParam = SendParam({
            dstEid: hubEid,
            to: bytes32(uint256(uint160(hubGaugeReceiver))),
            amountLD: pendingFees,
            minAmountLD: _removeDust(pendingFees),
            extraOptions: OptionsBuilder.newOptions().addExecutorLzReceiveOption(DEFAULT_FLUSH_GAS_LIMIT, 0),
            composeMsg: "",
            oftCmd: ""
        });
    }

    /**
     * @notice Quote the LayerZero fee for flushing pending fees to hub
     * @dev Call buildFlushSendParam() first, then pass it to quoteSend()
     *      Or use this convenience function which does both.
     * @return nativeFee The native gas fee required for the flush
     */
    function quoteFlushFees() external view returns (uint256 nativeFee) {
        if (pendingFees == 0 || hubGaugeReceiver == address(0) || hubEid == 0) {
            return 0;
        }

        // Build the message internally for quoting
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(DEFAULT_FLUSH_GAS_LIMIT, 0);

        // Use the internal _quote which accepts memory params
        MessagingFee memory fee = _quote(
            hubEid,
            abi.encodePacked(
                bytes32(uint256(uint160(hubGaugeReceiver))),
                uint64(pendingFees) // amountSD approximation for quote
            ),
            options,
            false
        );

        nativeFee = fee.nativeFee;
    }

    // ================================
    // LOTTERY (HUB vs REMOTE)
    // ================================

    /**
     * @dev Trigger lottery entry for buyer
     * @param recipient The actual recipient of the swap (buyer's wallet)
     * @param amount Amount of tokens bought
     *
     * @notice Hub mode: calls local CreatorLotteryManager.processSwapLottery()
     *         Remote mode: queues a pending entry that the buyer submits with native gas
     *
     * @notice Uses the actual transfer recipient address to support:
     *         - EOA wallets (traditional)
     *         - Smart contract wallets (Coinbase Smart Wallet, Safe, etc.)
     *         - ERC-4337 account abstraction (where tx.origin is the bundler)
     *         - DEX aggregators (via ILotteryBeneficiary callback)
     */
    function _triggerLottery(address recipient, uint256 amount) internal {
        if (!lotteryEnabled) return;
        if (recipient == address(0)) return;

        // Determine the actual lottery beneficiary
        address buyer = _resolveLotteryBeneficiary(recipient);
        if (buyer == address(0)) return;

        if (isHub) {
            _triggerLotteryLocal(buyer, amount);
        } else {
            _queuePendingLotteryEntry(buyer, amount);
        }
    }

    /**
     * @dev Hub-only: call local lottery manager
     */
    function _triggerLotteryLocal(address buyer, uint256 amount) internal {
        if (address(registry) == address(0)) return;

        address mgr = registry.getLotteryManager(block.chainid);
        if (mgr == address(0)) return;

        // External call wrapped in try-catch to prevent lottery issues from blocking transfers
        uint256 buyerCurrentShareBalance = balanceOf(buyer);
        try ICreatorLotteryManager(mgr).processSwapLottery(
            buyer, address(this), amount, buyerCurrentShareBalance
        ) returns (uint256 id) {
            if (id > 0) emit LotteryTriggered(buyer, amount, id);
        } catch {
            // Lottery failure should not block the transfer
        }
    }

    /**
     * @dev Queue a pending remote lottery entry for explicit buyer-paid submission.
     */
    function _queuePendingLotteryEntry(address buyer, uint256 amount) internal {
        if (amount == 0) return;

        uint256 entryId = nextPendingLotteryEntryId;
        nextPendingLotteryEntryId = entryId + 1;

        pendingLotteryEntries[entryId] = PendingLotteryEntry({buyer: buyer, amount: amount});
        pendingLotteryEntryCount[buyer] += 1;

        emit PendingLotteryEntryQueued(entryId, buyer, amount, hubEid);
    }

    /**
     * @notice Submit a previously queued remote lottery entry and pay LayerZero native fee.
     * @dev Remote-only path. Keeps transfer flow ERC20-compatible by moving fee payment to an explicit call.
     */
    function submitPendingLotteryEntry(uint256 entryId) external payable nonReentrant {
        if (isHub) revert NotHub();

        PendingLotteryEntry memory entry = pendingLotteryEntries[entryId];
        if (entry.buyer == address(0)) revert PendingLotteryEntryNotFound();
        if (entry.buyer != _msgSender()) revert NotPendingLotteryEntryOwner();
        if (hubLotteryPeer == bytes32(0) || hubEid == 0 || peers[hubEid] == bytes32(0)) revert HubNotConfigured();

        (bytes memory payload, bytes memory options, MessagingFee memory fee) =
            _prepareLotteryEntryMessage(entry.buyer, entry.amount);

        if (msg.value != fee.nativeFee) {
            revert InvalidLotteryEntryFee(msg.value, fee.nativeFee);
        }

        // CEI: clear state before external call. Revert restores state if send fails.
        delete pendingLotteryEntries[entryId];
        pendingLotteryEntryCount[entry.buyer] -= 1;

        _lzSend(hubEid, payload, options, fee, payable(_msgSender()));
        totalLotteryEntriesSent++;

        emit LotteryEntrySent(entry.buyer, entry.amount, hubEid);
        emit PendingLotteryEntrySubmitted(entryId, entry.buyer, entry.amount, fee.nativeFee, hubEid);
    }

    /**
     * @notice Quote the LayerZero fee for a lottery entry message
     * @param amount The trade amount
     * @return fee The native gas fee required
     */
    function quoteLotteryEntry(uint256 amount) external view returns (MessagingFee memory fee) {
        if (hubLotteryPeer == bytes32(0) || hubEid == 0 || peers[hubEid] == bytes32(0)) {
            return MessagingFee(0, 0);
        }

        (,, fee) = _prepareLotteryEntryMessage(address(0), amount);
    }

    /**
     * @notice Quote the LayerZero fee for a queued remote lottery entry.
     * @param entryId Pending entry id
     * @return fee LayerZero native/lzToken fee quote (zeroed if entry/config missing)
     */
    function quotePendingLotteryEntry(uint256 entryId) external view returns (MessagingFee memory fee) {
        PendingLotteryEntry memory entry = pendingLotteryEntries[entryId];
        if (entry.buyer == address(0)) return MessagingFee(0, 0);
        if (hubLotteryPeer == bytes32(0) || hubEid == 0 || peers[hubEid] == bytes32(0)) return MessagingFee(0, 0);

        (,, fee) = _prepareLotteryEntryMessage(entry.buyer, entry.amount);
    }

    function _prepareLotteryEntryMessage(address buyer, uint256 amount)
        internal
        view
        returns (bytes memory payload, bytes memory options, MessagingFee memory fee)
    {
        uint256 buyerCurrentShareBalance = buyer == address(0) ? 0 : balanceOf(buyer);
        payload = abi.encode(
            MSG_TYPE_LOTTERY_ENTRY,
            buyer,
            address(this), // tokenIn (this ShareOFT)
            amount,
            uint32(block.chainid), // sourceChainId metadata (callback routing uses _origin.srcEid on hub)
            buyerCurrentShareBalance // coverage input on the hub lottery manager
        );

        options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(lotteryEntryGasLimit, 0);
        fee = _quote(hubEid, payload, options, false);
    }

    /**
     * @dev Resolve the actual lottery beneficiary from a recipient address
     * @param recipient The transfer recipient
     * @return buyer The address that should receive lottery entries
     *
     * @notice Resolution order:
     *         1. If recipient is EOA → use recipient
     *         2. If recipient implements ILotteryBeneficiary → use returned address
     *         3. Otherwise → use recipient (smart wallet case)
     */
    function _resolveLotteryBeneficiary(address recipient) internal view returns (address buyer) {
        // If recipient is EOA, use directly
        if (recipient.code.length == 0) {
            return recipient;
        }

        // FIX: H-04 — only trust the resolver callback for allowlisted contracts.
        // Previously any contract recipient could implement ILotteryBeneficiary
        // and redirect the lottery entry to an arbitrary address, letting an
        // attacker farm entries toward an address they control without being
        // the actual buyer. Gate behind isLotteryResolver and fall through to
        // the recipient itself for unknown contracts (smart wallet case).
        if (!isLotteryResolver[recipient]) {
            return recipient;
        }

        // Check if recipient implements ILotteryBeneficiary
        try ILotteryBeneficiary(recipient).getLotteryBeneficiary() returns (address beneficiary) {
            return beneficiary == address(0) ? recipient : beneficiary;
        } catch {
            return recipient;
        }
    }

    /**
     * @notice Allow or disallow a contract to act as a lottery beneficiary resolver
     * @dev FIX: H-04 — only owner-approved contracts (e.g. audited aggregator
     *      adapters) may redirect lottery entries via ILotteryBeneficiary.
     */
    function setLotteryResolver(address resolver, bool allowed) external onlyOwner {
        if (resolver == address(0)) revert ZeroAddress();
        isLotteryResolver[resolver] = allowed;
        emit LotteryResolverSet(resolver, allowed);
    }

    // ================================
    // WINNER CALLBACK RECEIVER (REMOTE ONLY)
    // ================================

    /**
     * @notice Override _lzReceive to handle both OFT token transfers and custom messages
     * @dev OFT messages use the standard OFTMsgCodec format.
     *      Custom messages (winner callbacks) are prefixed with MSG_TYPE_WINNER_CALLBACK.
     *      Winner callbacks are ABI-encoded, while OFT token-transfer messages are packed.
     *      We must never try to ABI-decode a "msgType" out of the first word of a packed OFT payload.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal virtual override {
        // Winner callback messages are ONLY accepted when:
        // - they come from `hubLotteryPeer`, and
        // - the payload is exactly the ABI encoding of (uint16,address,address,uint256) (128 bytes).
        if (_isWinnerCallbackMessage(_origin, _message)) {
            // FIX: H-14 — deduplicate winner-callback messages by LayerZero _guid
            // so a replayed callback cannot emit a duplicate LotteryWinnerNotification
            // and let a downstream indexer credit the prize twice.
            if (usedReportIds[_guid]) {
                emit WinnerCallbackReplayRejected(_guid);
                return;
            }
            usedReportIds[_guid] = true;
            _handleWinnerCallback(_origin, _message);
            return;
        }

        // Default: standard OFT token transfer handling
        super._lzReceive(_origin, _guid, _message, _executor, _extraData);
    }

    function _isWinnerCallbackMessage(Origin calldata _origin, bytes calldata _message) internal view returns (bool) {
        // Authentication: must be the configured hub LotteryManager peer.
        // NOTE: Long-term, consider routing winner callbacks through a dedicated OApp receiver (separate from the OFT)
        // so custom messages and token-transfer payloads never share the same entrypoint.
        bytes32 expectedSender = hubLotteryPeer;
        if (expectedSender == bytes32(0) || _origin.sender != expectedSender) return false;

        // FIX: M-7 — tighten callback detection: standard OFT SEND is ~40 bytes,
        // but SEND_AND_CALL with specific compose lengths could be exactly 128 bytes.
        // We verify the ABI structure of all 4 words to ensure this cannot collide
        // with any valid OFT packed payload (which uses bytes32 + uint64 layout).
        // ABI encoding of (uint16,address,address,uint256) is always 4 * 32 bytes.
        if (_message.length != 128) return false;

        uint256 word0;
        uint256 word1;
        uint256 word2;
        uint256 word3;
        assembly {
            word0 := calldataload(_message.offset)
            word1 := calldataload(add(_message.offset, 0x20))
            word2 := calldataload(add(_message.offset, 0x40))
            word3 := calldataload(add(_message.offset, 0x60))
        }

        // word0 is an ABI-encoded uint16 => upper 240 bits must be zero.
        if (word0 >> 16 != 0) return false;
        if (uint16(word0) != MSG_TYPE_WINNER_CALLBACK) return false;

        // word1, word2 are ABI-encoded addresses => upper 96 bits must be zero.
        // word3 is uint256 (totalSharesPaid) — must be non-zero for a valid winner callback
        if (word1 >> 160 != 0) return false;
        if (word2 >> 160 != 0) return false;
        // FIX: M-7 — require non-zero totalSharesPaid to further disambiguate from
        // OFT token transfers that happen to be 128 bytes
        if (word3 == 0) return false;

        return true;
    }

    /**
     * @dev Handle winner callback from hub LotteryManager
     *      Emits LotteryWinnerNotification on the user's chain
     */
    function _handleWinnerCallback(Origin calldata _origin, bytes calldata _message) internal {
        // Verify sender is the hub lottery peer
        if (hubLotteryPeer == bytes32(0) || _origin.sender != hubLotteryPeer) {
            revert InvalidCallback();
        }

        (, // msgType (already checked)
            address winner,
            address creatorCoin,
            uint256 totalSharesPaid
        ) = abi.decode(_message, (uint16, address, address, uint256));

        emit LotteryWinnerNotification(winner, creatorCoin, totalSharesPaid, _origin.srcEid);
    }

    // ================================
    // ADMIN - HUB CONFIGURATION
    // ================================

    /**
     * @notice Configure hub vs remote mode
     * @param _isHub True for hub chain (Base), false for remote chains
     * @param _hubEid LayerZero EID for the hub chain (set on remote chains)
     * @param _hubGaugeReceiver Address of GaugeController on hub (for fee bridging)
     */
    function setHubConfig(bool _isHub, uint32 _hubEid, address _hubGaugeReceiver) external onlyOwner {
        // FIX: L-2 — prevent converting hub to remote on Base, which would strand
        // pending fees and break fee routing
        require(_isHub || block.chainid != 8453, "Hub cannot be set to remote on Base");
        isHub = _isHub;
        hubEid = _hubEid;
        hubGaugeReceiver = _hubGaugeReceiver;
        emit HubConfigUpdated(_isHub, _hubEid, _hubGaugeReceiver);
    }

    /**
     * @notice Set the hub lottery peer (LotteryManager address on Base)
     * @param _hubEid LayerZero EID for the hub chain
     * @param _hubLotteryPeer bytes32-encoded address of the hub LotteryManager
     */
    function setHubLotteryPeer(uint32 _hubEid, bytes32 _hubLotteryPeer) external onlyOwner {
        // FIX: L-6 — require hubGaugeReceiver to be set before lottery peer;
        // calling this before setHubConfig leaves hubGaugeReceiver=0 causing
        // flushFees to revert with HubNotConfigured even though hubEid appears set
        require(hubGaugeReceiver != address(0), "Call setHubConfig first");
        hubEid = _hubEid;
        hubLotteryPeer = _hubLotteryPeer;
        emit HubLotteryPeerSet(_hubEid, _hubLotteryPeer);
    }

    /**
     * @notice Set the flush threshold for auto-bridging fees
     * @param _threshold Minimum accumulated fees before flush
     */
    function setFlushThreshold(uint256 _threshold) external onlyOwner {
        flushThreshold = _threshold;
        emit FlushThresholdUpdated(_threshold);
    }

    /**
     * @notice Set the gas limit for lottery entry messages
     * @param _gasLimit Gas limit for the lzReceive on the hub
     */
    function setLotteryEntryGasLimit(uint128 _gasLimit) external onlyOwner {
        lotteryEntryGasLimit = _gasLimit;
        emit LotteryEntryGasLimitUpdated(_gasLimit);
    }

    // ================================
    // ADMIN - EXISTING
    // ================================

    /**
     * @notice Set operation type for an address
     */
    function setAddressType(address addr, OperationType opType) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        addressType[addr] = opType;
        emit AddressTypeSet(addr, opType);
    }

    /**
     * @notice Batch set operation types
     */
    function setAddressTypes(address[] calldata addrs, OperationType opType) external onlyOwner {
        for (uint256 i; i < addrs.length;) {
            address addr = addrs[i];
            if (addr == address(0)) revert ZeroAddress();
            addressType[addr] = opType;
            emit AddressTypeSet(addr, opType);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Set gauge controller — fee recipient (hub-only)
     */
    function setGaugeController(address _controller) external onlyOwner {
        if (_controller == address(0)) revert ZeroAddress();
        gaugeController = _controller;
        addressType[_controller] = OperationType.NoFees;
        emit GaugeControllerSet(_controller);
    }

    /**
     * @notice Set buy fee (max 10%)
     */
    function setBuyFee(uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit BuyFeeUpdated(buyFeeBps, _feeBps);
        buyFeeBps = _feeBps;
    }

    /**
     * @notice Enable/disable fees
     */
    function setFeesEnabled(bool _enabled) external onlyOwner {
        feesEnabled = _enabled;
    }

    /**
     * @notice Enable/disable lottery
     */
    function setLotteryEnabled(bool _enabled) external onlyOwner {
        lotteryEnabled = _enabled;
    }

    /**
     * @notice Set the tax config delegate (hub-only, for future custom hooks)
     * @dev NOTE: The existing SimpleSellTaxHook at 0xca975B9dAF772C71161f3648437c3616E5Be0088
     *      checks msg.sender == token.owner(), so ONLY the ■TOKEN owner can configure it.
     *      This delegate feature is for future hooks that accept delegated configuration.
     * @param _delegate Address that can call configureTaxHook on behalf of this token
     */
    function setTaxConfigDelegate(address _delegate) external onlyOwner {
        taxConfigDelegate = _delegate;
        emit TaxConfigDelegateSet(_delegate);
    }

    /**
     * @notice Get tax hook configuration data for the owner to call directly (hub-only)
     * @dev Since the SimpleSellTaxHook requires msg.sender == token.owner(),
     *      this helper returns the exact parameters for the owner to call.
     *
     * @param counterAsset Counter asset (address(0) for ETH)
     * @return token The token address (this contract)
     * @return recipient The GaugeController address
     * @return counterIsEth Whether counter asset is ETH
     */
    function getTaxHookParams(address counterAsset)
        external
        view
        returns (address token, address recipient, bool counterIsEth)
    {
        return (address(this), gaugeController != address(0) ? gaugeController : owner(), counterAsset == address(0));
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Convert shares to underlying Creator Coin amount
     * @dev On remote chains (vault == address(0)), returns shares 1:1
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (vault == address(0)) return shares;
        return ICreatorOVault(vault).convertToAssets(shares);
    }

    /**
     * @notice Get contract version
     * @dev Kept as a deliberate part of the runtime ABI — indexers and
     *      audit tooling commonly check `version()` on deployed OFTs.
     */
    function version() external pure returns (string memory) {
        return "2.0.0-hub-centric";
    }

    // NOTE: A cluster of dead view helpers (`previewFee`, `isTradingVenue`,
    // `canTransfer`, `checkMinter`, `category`, `description`, `canFlush`,
    // `getRemoteStatus`) used to live here. They had ZERO on-chain or
    // off-chain callers and were redundant with the auto-generated public
    // getters for `addressType`, `isMinter`, `vault`, `owner`, `pendingFees`,
    // `totalFeesFlushed`, `totalLotteryEntriesSent`, `isHub`, `hubEid`, and
    // `hubGaugeReceiver`. Their dispatcher entries + selectors + literal
    // strings ("Creator Vault Share Token", "4626.fun Share Token") were
    // contributing to EIP-170 size pressure and pushing this contract over
    // the 24,576-byte runtime cap (audit M-01, 2026-04-25; see
    // docs/operations/contract-size-gate.md). Removed in the post-PLONK
    // size-shrink PR. Frontend / indexer code that used to call these
    // should read the public state variables directly via their
    // auto-getters and compute the (trivial) derived values client-side.
    //   * previewFee(from, to, amount):
    //       Mirror _transferWithFees order EXACTLY. The NoFees short-
    //       circuit MUST run first — SwapOnly → NoFees transfers (e.g.
    //       venue → vault, venue → wrapper, venue → GaugeController) are
    //       fee-exempt on-chain even though `from` is SwapOnly:
    //         if addressType(from) == NoFees || addressType(to) == NoFees:
    //             return (isBuy=false, fee=0)
    //         isBuy = addressType(from) == SwapOnly && addressType(to) != SwapOnly && feesEnabled()
    //         fee   = isBuy ? (amount * buyFeeBps()) / 10_000 : 0
    //   * isTradingVenue(addr): addressType(addr) == SwapOnly
    //   * canTransfer(...):     always true (vestigial; ERC-20 has no such hook)
    //   * checkMinter(account): isMinter(account) || account == vault() || account == owner()
    //   * canFlush():           !isHub() && pendingFees() > 0 &&
    //                           hubGaugeReceiver() != address(0) && hubEid() != 0
    //   * getRemoteStatus():    read each public getter individually

    // ================================
    // ERC-7572 CONTRACT METADATA
    // ================================

    /**
     * @notice ERC-7572 contract-level metadata URI
     * @dev ERC-7572 is contract-level metadata for fungible tokens (not ERC-721 tokenURI).
     *      If `_contractURI` is explicitly set, return it as-is.
     *      Otherwise, return the canonical HTTPS metadata endpoint for this token so that
     *      Uniswap, DEX aggregators, and wallets can fetch the JSON over HTTP and display
     *      the token image. A `data:application/json;base64,...` default was the previous
     *      behaviour but many indexers treat contractURI as a URL to fetch and silently skip
     *      `data:` schemes, leaving the token with no image in their UIs.
     *
     * @return URI string for contract metadata.
     */
    function contractURI() external view returns (string memory) {
        if (bytes(_contractURI).length > 0) {
            return _contractURI;
        }
        return _buildOnchainContractURI();
    }

    /**
     * @notice Set custom contract metadata URI
     * @param uri New metadata URI (empty string to use default)
     */
    function setContractURI(string calldata uri) external onlyOwner {
        _contractURI = uri;
        emit ContractURIUpdated();
    }

    /**
     * @dev Returns the canonical HTTPS metadata endpoint for this token.
     *      The endpoint responds with ERC-7572-compliant JSON containing the
     *      `image` field pointing at the AI-generated vault icon (or the
     *      auto-composited fallback), allowing any client that can make an
     *      HTTP GET request to display the correct token image.
     */
    function _buildOnchainContractURI() internal view returns (string memory) {
        return string(
            abi.encodePacked(
                "https://api.4626.fun/v1/token/",
                Strings.toHexString(address(this)),
                "/metadata?chain=",
                Strings.toString(block.chainid)
            )
        );
    }

    // NOTE: An on-chain `_buildContractMetadataJson` helper (and its
    // `_jsonAddressOrNull` / `_buildRendererImageUrl` companions) used to
    // live here, returning a `data:application/json;base64,...` payload as
    // a fallback for `contractURI()`. We removed it for two reasons:
    //   1. It became dead code once `contractURI()` started returning the
    //      canonical HTTPS endpoint (`api.4626.fun/v1/token/<addr>/metadata`)
    //      directly, since indexers reliably treat that as a URL but often
    //      silently skip `data:` schemes.
    //   2. Its bytecode footprint (Strings.escapeJSON, Base64 import, the
    //      try/catch ICreatorOVaultAsset path, four `string.concat` /
    //      `abi.encodePacked` blobs) was meaningfully contributing to the
    //      contract's EIP-170 size pressure (audit M-01, 2026-04-25 — see
    //      docs/operations/contract-size-gate.md).
    // If a future client ever wants the JSON inline, generate it server-
    // side at the canonical endpoint instead of paying for it on-chain.

    // ================================
    // TRADE FEE COLLECTOR
    // ================================

    /**
     * @notice Returns the canonical trade-fee collector address.
     * @dev Canonical terminology: `tradeFeeCollector`.
     *      Returns GaugeController when configured, otherwise owner fallback.
     *
     * @return The gauge controller address, or owner if not set
     */
    function tradeFeeCollector() public view returns (address) {
        return gaugeController != address(0) ? gaugeController : owner();
    }

    /**
     * @notice Helper used by integrations that check ownership-style access.
     * @param account Address to check
     * @return True if account is owner or current trade-fee collector
     */
    function isOwner(address account) external view returns (bool) {
        return account == owner() || account == tradeFeeCollector();
    }

    // ================================
    // GAS FUNDING
    // ================================

    // FIX: I-1 — add ETH withdrawal path for hub deployment; previously ETH from
    // LZ refunds accumulated with no recovery mechanism
    function withdrawETH(address payable to) external onlyOwner {
        require(to != address(0), "Zero address");
        uint256 bal = address(this).balance;
        require(bal > 0, "No ETH");
        (bool ok,) = to.call{value: bal}("");
        require(ok, "ETH transfer failed");
    }

    /**
     * @notice Accept native token transfers/refunds.
     * @dev Remote lottery entries are buyer-funded via submitPendingLotteryEntry(),
     *      but this contract can still receive native token via direct transfer.
     */
    receive() external payable {}
}
