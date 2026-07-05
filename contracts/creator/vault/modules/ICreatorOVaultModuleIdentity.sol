// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICreatorOVaultModuleIdentity {
    function moduleKind() external pure returns (bytes32);
    function moduleStorageVersion() external pure returns (bytes32);
}
