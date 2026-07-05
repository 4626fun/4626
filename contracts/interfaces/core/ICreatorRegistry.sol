// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {I4626Registry} from "./I4626Registry.sol";

/// @dev Hard-cut alias — use I4626Registry in new code.
interface ICreatorRegistry is I4626Registry {}
