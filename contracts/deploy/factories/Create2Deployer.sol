// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Create2Deployer
 * @author 0xakita.eth
 * @notice Minimal CREATE2 deployer for deterministic deployments.
 * @dev Used by deployment tooling that passes init code via calldata.
 */
contract Create2Deployer {
    event Deployed(address indexed addr, bytes32 indexed salt, bytes32 indexed initCodeHash);
    // FIX: F-22 — restrict deploy to authorized callers only
    event DeployerAuthorized(address indexed deployer, bool allowed);

    error DeployFailed();
    error NotAuthorizedDeployer();

    address public immutable owner;
    mapping(address => bool) public authorizedDeployers;

    modifier onlyAuthorized() {
        // FIX: F-22 — access control: only owner or authorized deployers can deploy
        if (msg.sender != owner && !authorizedDeployers[msg.sender]) revert NotAuthorizedDeployer();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setAuthorizedDeployer(address deployer, bool allowed) external {
        if (msg.sender != owner) revert NotAuthorizedDeployer();
        authorizedDeployers[deployer] = allowed;
        emit DeployerAuthorized(deployer, allowed);
    }

    function deploy(bytes32 salt, bytes memory initCode) external onlyAuthorized returns (address addr) {
        bytes32 initCodeHash = keccak256(initCode);
        assembly {
            addr := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (addr == address(0)) revert DeployFailed();
        emit Deployed(addr, salt, initCodeHash);
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
