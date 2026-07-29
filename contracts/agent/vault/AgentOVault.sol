// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {CreatorOVault} from "@4626/creator/vault/CreatorOVault.sol";
import {IAgentTokenV4} from "@4626/agent/interfaces/IAgentTokenV4.sol";

/**
 * @title AgentOVault
 * @author 0xakita.eth
 * @notice ERC-4626 vault for the agent lane (AgentTokenV4 / measured fee-on-transfer tokens).
 *
 * @dev Uses AgentOVaultCoreModule for measured-transfer accounting (handles FOT/tax on deposits).
 *      Strategies and most modules are shared with the creator lane via interfaces.
 *      Core module kind is `keccak256("AgentOVaultModule.core")` to prevent mixing with creator's exact accounting.
 *
 *      The agent lane uses ◆/◇ share symbols (vs ■/▢ for creator coins).
 *      Accounting and FOT limitations are in AgentOVaultCoreModule.
 *
 *      QUOTING SURFACE (LeftClaw #509 U-04/U-05):
 *      - `previewDeposit` nets the asset's quoted transfer tax (max of buy/sell bps)
 *        before delegating to stock ERC-4626 math, so the quote never exceeds what
 *        `deposit` actually mints (EIP-4626 "no more than" restored).
 *      - `convertToShares`/`convertToAssets` stay NOMINAL: they are pure exchange-rate
 *        helpers used by queue accounting, not execution quotes.
 *      - `mint` is unsupported on this lane (exact-transfer pull reverts for taxed
 *        assets), so `maxMint` advertises 0 and `previewMint` reverts — EIP-4626
 *        permits a preview to revert when the corresponding action always reverts.
 */
contract AgentOVault is CreatorOVault {
    bytes32 internal constant AGENT_MODULE_KIND_CORE = keccak256("AgentOVaultModule.core");
    // MAX_BPS is inherited from CreatorOVault — do not redeclare (shadows the base).

    /// @notice Thrown by `previewMint`: mint is intentionally unsupported on this lane.
    error MintNotSupported();

    constructor(address _agentToken, address _owner, string memory _name, string memory _symbol)
        CreatorOVault(_agentToken, _owner, _name, _symbol) // reuses creator base for shared vault logic; accounting overridden in core module
    {}

    function _expectedCoreModuleKind() internal pure override returns (bytes32) {
        return AGENT_MODULE_KIND_CORE;
    }

    /// @notice LeftClaw #509 U-04: quote on the amount the vault will ACTUALLY receive.
    /// @dev Nets the asset's quoted worst-case transfer tax (max of buy/sell bps, the
    ///      rate AgentTokenV4 applies to plain transfers) out of `assets` before the
    ///      stock virtual-offset conversion, so the preview never overstates the mint.
    function previewDeposit(uint256 assets) public view override returns (uint256) {
        uint256 taxBps = _quotedMaxTaxBps();
        uint256 expectedReceived = taxBps == 0 ? assets : (assets * (MAX_BPS - taxBps)) / MAX_BPS;
        return super.previewDeposit(expectedReceived);
    }

    /// @notice LeftClaw #509 U-05: mint is intentionally unsupported on this lane (its
    ///         exact-transfer pull reverts for taxed assets), so advertise no capacity —
    ///         EIP-4626 requires mint not to revert at or below maxMint.
    function maxMint(address) public view override returns (uint256) {
        return 0;
    }

    /// @notice LeftClaw #509 U-05: never quote an unexecutable path. EIP-4626 permits a
    ///         preview to revert when the corresponding action would also revert.
    function previewMint(uint256) public pure override returns (uint256) {
        revert MintNotSupported();
    }

    /// @dev Worst-case quoted transfer tax (bps). AgentTokenV4 taxes plain transfers
    ///      (no liquidity pool on either side) at max(buy, sell). Falls back to 0 when
    ///      the token exposes no quote; degenerate quotes clamp to a zero receipt so
    ///      the preview never overstates. Mirrors AgentOVaultCoreModule._quotedMaxTaxBps.
    function _quotedMaxTaxBps() internal view returns (uint256 taxBps) {
        address token = asset();
        uint256 buyBps;
        try IAgentTokenV4(token).buyTaxBps() returns (uint16 bps) {
            buyBps = bps;
        } catch {
            return 0;
        }
        try IAgentTokenV4(token).sellTaxBps() returns (uint16 bps) {
            taxBps = bps > buyBps ? bps : buyBps;
        } catch {
            taxBps = buyBps;
        }
        if (taxBps > MAX_BPS) taxBps = MAX_BPS; // degenerate quote → zero receipt, never overstate
    }
}
