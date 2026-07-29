// SPDX-License-Identifier: MIT

// Sourced from Base Sourcify exact_match (matchId 6470368) at
// 0xca975B9dAF772C71161f3648437c3616E5Be0088 - solc 0.8.26, viaIR, optimizer 200, cancun.
// Ctor: (IPoolManager poolManager_, address wrappedNative_). Hook flags: beforeSwap + beforeSwapReturnDelta (addr & 0x88).
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import { Hooks } from "@uniswap/v4-core/src/libraries/Hooks.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { SwapParams } from "@uniswap/v4-core/src/types/PoolOperation.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { PoolId, PoolIdLibrary } from "@uniswap/v4-core/src/types/PoolId.sol";
import { Currency, CurrencyLibrary } from "@uniswap/v4-core/src/types/Currency.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { BeforeSwapDelta, toBeforeSwapDelta } from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleSellTaxHook is BaseHook {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    // structs //
    /////////////

    struct TaxConfig {
        address token; // pool's primary asset
        address counterAsset; // ETH, WETH, etc.
        address recipient; // tax collection receiver
        uint256 taxRate; // basis points (e.g., 100 = 1%)
        bool enabled; // functional state
        bool lock; // finalize state
    }

    // state vars //
    ////////////////

    Currency public constant ADDRESS_ZERO = Currency.wrap(address(0)); // ETH, etc.
    address public immutable wrappedNative; // WETH, etc.

    // mappings //
    ////////////////

    mapping(address => TaxConfig) public tokenTaxConfigs; // primary asset addr => taxConfig

    // modifiers //
    ///////////////

    modifier onlyTokenOwner(address token_) { // only allow token owner to set/update tax config
        require(token_ != address(0), "!0");
        try Ownable(token_).owner() returns (address tokenOwner_) {
            require(
                tokenOwner_ == msg.sender || // if token is owned by a contract or EOA direct call
                tokenOwner_ == tx.origin, // if token is owned by an EOA making a contract call
                "!TO"
            );
        } catch {
            revert("!OF");
        }
        _;
    }

    // events //
    ////////////

    event SellTaxCollected(
        address indexed token, address indexed seller, uint256 taxAmount
    );

    event TaxConfigSet(
        address indexed token, address indexed counterAsset, address indexed recipient, uint256 taxRate, bool enabled, bool lock
    );

    event TaxConfigRemoved(
        address indexed token
    );

    // constructor //
    /////////////////

    constructor(IPoolManager poolManager_, address wrappedNative_) BaseHook(poolManager_) {
        require(wrappedNative_ != address(0), "!0");
        wrappedNative = wrappedNative_;
    }

    // hooks //
    ///////////

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        (address cAddr0, address cAddr1) = getCurrencyAddresses(key);
        bool zeroIsCounter = key.currency0 == ADDRESS_ZERO || cAddr0 == wrappedNative;
        bool oneIsCounter = key.currency1 == ADDRESS_ZERO || cAddr1 == wrappedNative;

        if (!(zeroIsCounter || oneIsCounter) || (zeroIsCounter && oneIsCounter)) {
            return (IHooks.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        if (!((params.zeroForOne && !zeroIsCounter) || (!params.zeroForOne && !oneIsCounter))) {
            return (IHooks.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        TaxConfig memory taxConfig = zeroIsCounter ? getTaxConfig(cAddr1) : getTaxConfig(cAddr0);
        if (!taxConfig.enabled || taxConfig.token == address(0) || taxConfig.recipient == address(0)) {
            return (IHooks.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        if (taxConfig.counterAsset != (zeroIsCounter ? cAddr0 : cAddr1)) {
            return (IHooks.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        uint256 feeAmount = ((params.amountSpecified < 0 
            ? uint256(-params.amountSpecified) 
            : uint256(params.amountSpecified)) * taxConfig.taxRate) / 10000;
            
        if (feeAmount == 0) {
            return (IHooks.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        poolManager.take(
            params.zeroForOne ? key.currency0 : key.currency1, 
            taxConfig.recipient, 
            feeAmount
        );

        emit SellTaxCollected(taxConfig.token, sender, feeAmount);

        return (IHooks.beforeSwap.selector, toBeforeSwapDelta(int128(int256(feeAmount)), 0), 0);
    }

    // helpers //
    /////////////

    function getCurrencyAddresses(PoolKey calldata key_) internal pure returns (
        address currencyAddr0_, address currencyAddr1_
    ) {
        currencyAddr0_ = Currency.unwrap(key_.currency0);
        currencyAddr1_ = Currency.unwrap(key_.currency1);
    }

    // setters //
    /////////////

    function setTaxConfig(
        address token_,
        address counterAsset_,
        address recipient_,
        uint256 taxRate_,
        bool counterIsEth,
        bool enabled_,
        bool lock_
    ) external onlyTokenOwner(token_) {
        require(token_ != address(0), "!0");
        require(counterAsset_ != address(0) || counterIsEth, "!0");
        require(recipient_ != address(0), "!0");
        require(taxRate_ <= 10000, "!100");
        require(!tokenTaxConfigs[token_].lock, "!L");

        tokenTaxConfigs[token_] = TaxConfig({
            token: token_,
            counterAsset: counterAsset_,
            recipient: recipient_,
            taxRate: taxRate_,
            enabled: enabled_,
            lock: lock_
        });

        emit TaxConfigSet(token_, counterAsset_, recipient_, taxRate_, enabled_, lock_);
    }

    function removeTaxConfig(address token_) external onlyTokenOwner(token_){
        delete tokenTaxConfigs[token_];
        emit TaxConfigRemoved(token_);
    }

    function toggleTaxEnabled(address token_) external onlyTokenOwner(token_) {
        require(tokenTaxConfigs[token_].recipient != address(0), "!0");
        tokenTaxConfigs[token_].enabled = !tokenTaxConfigs[token_].enabled;
        
        emit TaxConfigSet(
            token_,
            tokenTaxConfigs[token_].counterAsset,
            tokenTaxConfigs[token_].recipient,
            tokenTaxConfigs[token_].taxRate,
            tokenTaxConfigs[token_].enabled,
            tokenTaxConfigs[token_].lock
        );
    }

    function updateTaxRate(address token_, uint256 newTaxRate_) external onlyTokenOwner(token_) {
        require(tokenTaxConfigs[token_].recipient != address(0), "!0");
        require(newTaxRate_ <= 10000, "!100");
        
        tokenTaxConfigs[token_].taxRate = newTaxRate_;
        
        emit TaxConfigSet(
            token_,
            tokenTaxConfigs[token_].counterAsset,
            tokenTaxConfigs[token_].recipient,
            newTaxRate_,
            tokenTaxConfigs[token_].enabled,
            tokenTaxConfigs[token_].lock
        );
    }

    function updateRecipient(address token_, address newRecipient_) external onlyTokenOwner(token_) {
        require(tokenTaxConfigs[token_].recipient != address(0), "!0");
        require(newRecipient_ != address(0), "!0");
        
        tokenTaxConfigs[token_].recipient = newRecipient_;
        
        emit TaxConfigSet(
            token_,
            tokenTaxConfigs[token_].counterAsset,
            newRecipient_,
            tokenTaxConfigs[token_].taxRate,
            tokenTaxConfigs[token_].enabled,
            tokenTaxConfigs[token_].lock
        );
    }

    // getters //
    /////////////

    function getTaxConfig(address token_) public view returns (TaxConfig memory) {
        return tokenTaxConfigs[token_];
    }

    function isTaxEnabled(address token_) external view returns (bool) {
        return tokenTaxConfigs[token_].enabled && tokenTaxConfigs[token_].recipient != address(0);
    }

    function getTaxRate(address token_) external view returns (uint256) {
        return tokenTaxConfigs[token_].taxRate;
    }

    function getRecipient(address token_) external view returns (address) {
        return tokenTaxConfigs[token_].recipient;
    }

    function getCounterAsset(address token_) external view returns (address) {
        return tokenTaxConfigs[token_].counterAsset;
    }
}