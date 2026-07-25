// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Registry4626} from "@4626/shared/core/Registry4626.sol";

/// @dev Minimal deployed factory stand-in: only needs real bytecode so `extcodehash`
///      is stable and can be pinned via `approveFactoryCodehash`.
contract MockPinnedFactory {
    uint256 public value;

    function bump() external {
        ++value;
    }
}

/// @notice ODA-495-M02: the factory codehash pin must not block its own revocation.
///         A factory whose live bytecode has diverged from the pin is exactly the one
///         that must stay de-authorizable.
contract ODA495FactoryRevokeTest is Test {
    Registry4626 internal registry;
    MockPinnedFactory internal factory;

    function setUp() public {
        registry = new Registry4626(address(this));
        factory = new MockPinnedFactory();
    }

    function _liveCodehash(address target) internal view returns (bytes32 hash) {
        assembly {
            hash := extcodehash(target)
        }
    }

    function test_authorizeFactory_withCorrectPin_succeeds() external {
        registry.approveFactoryCodehash(address(factory), _liveCodehash(address(factory)));

        registry.setAuthorizedFactory(address(factory), true);

        assertTrue(registry.authorizedFactories(address(factory)), "correct pin must authorize");
    }

    /// ODA-495-M02 core case: once the pin diverges, revocation must still succeed.
    function test_revokeFactory_succeeds_afterPinDiverges() external {
        registry.approveFactoryCodehash(address(factory), _liveCodehash(address(factory)));
        registry.setAuthorizedFactory(address(factory), true);
        assertTrue(registry.authorizedFactories(address(factory)), "precondition: factory authorized");

        // Pin now disagrees with the live bytecode (upgrade/redeploy drift).
        bytes32 divergentPin = keccak256("divergent-factory-bytecode");
        registry.approveFactoryCodehash(address(factory), divergentPin);

        registry.setAuthorizedFactory(address(factory), false);

        assertFalse(registry.authorizedFactories(address(factory)), "divergent pin must not block revocation");
    }

    /// Granting is still gated by the pin — the fix must not weaken authorization.
    function test_authorizeFactory_withMismatchedPin_stillReverts() external {
        bytes32 divergentPin = keccak256("divergent-factory-bytecode");
        registry.approveFactoryCodehash(address(factory), divergentPin);

        vm.expectRevert(
            abi.encodeWithSelector(
                Registry4626.FactoryCodehashMismatch.selector,
                address(factory),
                divergentPin,
                _liveCodehash(address(factory))
            )
        );
        registry.setAuthorizedFactory(address(factory), true);

        assertFalse(registry.authorizedFactories(address(factory)), "mismatched pin must not authorize");
    }
}
