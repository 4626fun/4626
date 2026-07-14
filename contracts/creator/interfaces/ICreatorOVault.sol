// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IOVault4626} from "@4626/shared/interfaces/vault/IOVault4626.sol";

/**
 * @title ICreatorOVault
 * @author 0xakita.eth
 * @notice Creator-lane vault wiring interface.
 * @dev Extends the shared IOVault4626 capability surface. Asset-specific
 *      getters remain on the concrete CreatorOVault ABI.
 */
interface ICreatorOVault is IOVault4626 {}
