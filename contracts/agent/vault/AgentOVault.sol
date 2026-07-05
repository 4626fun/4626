// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {CreatorOVault} from "@4626/creator/vault/CreatorOVault.sol";

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
 */
contract AgentOVault is CreatorOVault {
    bytes32 internal constant AGENT_MODULE_KIND_CORE = keccak256("AgentOVaultModule.core");

    constructor(address _agentToken, address _owner, string memory _name, string memory _symbol)
        CreatorOVault(_agentToken, _owner, _name, _symbol) // reuses creator base for shared vault logic; accounting overridden in core module
    {}

    function _expectedCoreModuleKind() internal pure override returns (bytes32) {
        return AGENT_MODULE_KIND_CORE;
    }
}
