// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {CreatorOVaultModuleStorage} from "./CreatorOVaultModuleStorage.sol";

interface ICreatorOVaultModuleCalls {
    function __moduleUpdate(address from, address to, uint256 value) external;
    function __moduleSpendAllowance(address owner, address spender, uint256 value) external;
    function __moduleTransferOwnership(address newOwner) external;
}

/// @notice Shared helpers for CreatorOVault delegatecall modules.
abstract contract CreatorOVaultModuleBase is CreatorOVaultModuleStorage {
    error OnlyDelegateCall();

    address private immutable _self;

    constructor() {
        _self = address(this);
    }

    modifier onlyDelegateCall() {
        if (address(this) == _self) revert OnlyDelegateCall();
        _;
    }

    function _creatorCoin() internal view returns (IERC20) {
        // CreatorOVault inherits ERC4626; the underlying is available via `asset()`.
        return IERC20(IERC4626(address(this)).asset());
    }

    function _sharesUpdate(address from, address to, uint256 value) internal {
        ICreatorOVaultModuleCalls(address(this)).__moduleUpdate(from, to, value);
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal {
        ICreatorOVaultModuleCalls(address(this)).__moduleSpendAllowance(owner, spender, value);
    }

    function _transferOwnership(address newOwner) internal {
        ICreatorOVaultModuleCalls(address(this)).__moduleTransferOwnership(newOwner);
    }
}

