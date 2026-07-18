// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

// This source keeps the exact Permit2 compiler unit available to Foundry tests
// without forcing the 0.8.26 Universal Router unit to import an incompatible
// exact pragma.
import {Permit2} from "../../../lib/universal-router/lib/permit2/src/Permit2.sol";

