// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IApprovedV4HooksRegistry {
    function isHookApproved(address hook) external view returns (bool);
}

contract ApprovedV4HooksRegistry is Ownable, IApprovedV4HooksRegistry {
    error ZeroAddress();
    error HookNotContract(address hook);

    mapping(address => bool) private _approvedHooks;
    mapping(address => bool) private _knownHooks;
    address[] private _allHooks;

    event HookApprovalUpdated(address indexed hook, bool approved);

    constructor(address _owner) Ownable(_owner) {}

    function setHookApproval(address hook, bool approved) external onlyOwner {
        if (hook == address(0)) revert ZeroAddress();
        if (approved && hook.code.length == 0) revert HookNotContract(hook);

        if (!_knownHooks[hook]) {
            _knownHooks[hook] = true;
            _allHooks.push(hook);
        }

        _approvedHooks[hook] = approved;
        emit HookApprovalUpdated(hook, approved);
    }

    function isHookApproved(address hook) external view returns (bool) {
        return _approvedHooks[hook];
    }

    function getAllHooks() external view returns (address[] memory) {
        return _allHooks;
    }

    function getApprovedHooks() external view returns (address[] memory hooks) {
        uint256 length = _allHooks.length;
        uint256 count;
        for (uint256 i = 0; i < length; i++) {
            if (_approvedHooks[_allHooks[i]]) count++;
        }

        hooks = new address[](count);
        uint256 cursor;
        for (uint256 i = 0; i < length; i++) {
            address hook = _allHooks[i];
            if (_approvedHooks[hook]) {
                hooks[cursor] = hook;
                cursor++;
            }
        }
    }
}
