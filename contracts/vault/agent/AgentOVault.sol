// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {CreatorOVault} from "@4626/vault/creator/CreatorOVault.sol";

/**
 * @title AgentOVault
 * @author 0xakita.eth
 * @notice ERC-4626 vault variant for Agent tokens (AgentTokenV4 / fee-on-transfer style).
 *
 * @dev Identical to CreatorOVault except for the deposit accounting mode, which is
 *      supplied by AgentOVaultCoreModule (measured-transfer accounting) instead of
 *      CreatorOVaultCoreModule (exact-transfer accounting). The strategies and admin
 *      modules are shared unchanged.
 *
 *      `setModulesOnce` on this vault only accepts a core module whose
 *      `moduleKind()` is `keccak256("AgentOVaultModule.core")`, and CreatorOVault
 *      only accepts `keccak256("CreatorOVaultModule.core")`, so the two vault
 *      flavors can never be wired with the wrong accounting mode.
 *
 *      Accounting behavior and the documented mint/withdraw limitations for
 *      fee-on-transfer assets live in AgentOVaultCoreModule.
 */
contract AgentOVault is CreatorOVault {
    bytes32 internal constant AGENT_MODULE_KIND_CORE = keccak256("AgentOVaultModule.core");

    constructor(address _agentToken, address _owner, string memory _name, string memory _symbol)
        CreatorOVault(_agentToken, _owner, _name, _symbol)
    {}

    function _expectedCoreModuleKind() internal pure override returns (bytes32) {
        return AGENT_MODULE_KIND_CORE;
    }
}
