// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

// Keep the exact Permit2 compiler unit in the project build graph. Lifecycle
// tests install this runtime at Base's canonical Permit2 address with
// `vm.deployCode`; putting the wrapper under `contracts/` makes the artifact
// available to the default 0.8.30 harness.
import {Permit2} from "../../lib/universal-router/lib/permit2/src/Permit2.sol";

contract CompilePermit2 is Permit2 {}
