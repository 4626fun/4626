// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UniversalBytecodeStore} from "../helpers/infra/UniversalBytecodeStore.sol";

/**
 * @title UniversalCreate2DeployerFromStore
 * @author 0xakita.eth
 * @notice CREATE2 deployer using bytecode stored on-chain.
 * @dev Used with `UniversalBytecodeStore` to keep calldata small.
 */
contract UniversalCreate2DeployerFromStore {
    UniversalBytecodeStore public immutable store;
    // FIX: F-13 — restrict deploy to authorized callers to prevent salt squatting
    address public immutable owner;
    mapping(address => bool) public authorizedDeployers;

    event Deployed(address indexed addr, bytes32 indexed salt, bytes32 indexed codeId, bytes32 initCodeHash);
    event DeployerAuthorized(address indexed deployer, bool allowed);

    error CodeNotFound(bytes32 codeId);
    error DeployFailed();
    error NotAuthorizedDeployer();

    constructor(address _store) {
        require(_store != address(0), "Zero store");
        store = UniversalBytecodeStore(_store);
        owner = msg.sender;
    }

    // FIX: F-13 — deployer allowlist management
    function setAuthorizedDeployer(address deployer, bool allowed) external {
        require(msg.sender == owner, "Not owner");
        authorizedDeployers[deployer] = allowed;
        emit DeployerAuthorized(deployer, allowed);
    }

    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr) {
        // FIX: F-13 — only owner or authorized deployers can deploy
        if (msg.sender != owner && !authorizedDeployers[msg.sender]) revert NotAuthorizedDeployer();
        address pointer = store.pointers(codeId);
        if (pointer == address(0)) revert CodeNotFound(codeId);

        bytes memory creationCode = store.get(codeId);
        bytes memory initCode = bytes.concat(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);

        assembly ("memory-safe") {
            addr := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (addr == address(0)) revert DeployFailed();

        emit Deployed(addr, salt, codeId, initCodeHash);
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
