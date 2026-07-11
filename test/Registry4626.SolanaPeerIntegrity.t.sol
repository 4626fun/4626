// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

contract Registry4626SolanaPeerIntegrityTest is Test {
    Registry4626 internal registry;
    address internal constant TOKEN_A = address(0xA11CE);
    address internal constant TOKEN_B = address(0xB0B);
    uint32 internal constant SOLANA_EID = 30168;
    bytes32 internal constant SOLANA_MINT = keccak256("solana-share-mint");

    function setUp() public {
        registry = new Registry4626(address(this));
        registry.registerToken(TOKEN_A, "Token A", "A", address(this), address(0), 0);
        registry.registerToken(TOKEN_B, "Token B", "B", address(this), address(0), 0);
    }

    function test_setRemoteOFTPeerBytes32_rejectsCrossTokenReverseMappingConflict() public {
        registry.setRemoteOFTPeerBytes32(TOKEN_A, SOLANA_EID, SOLANA_MINT);

        vm.expectRevert(
            abi.encodeWithSelector(
                Registry4626.ReverseMappingBytes32Conflict.selector,
                SOLANA_MINT,
                TOKEN_A,
                TOKEN_B
            )
        );
        registry.setRemoteOFTPeerBytes32(TOKEN_B, SOLANA_EID, SOLANA_MINT);

        assertEq(registry.remoteOFTBytes32ToToken(SOLANA_MINT), TOKEN_A);
    }

    function test_setRemoteOFTPeerBytes32_allowsSameTokenUpdateWithoutCorruptingReverseMap() public {
        bytes32 replacementMint = keccak256("replacement-solana-share-mint");
        registry.setRemoteOFTPeerBytes32(TOKEN_A, SOLANA_EID, SOLANA_MINT);
        registry.setRemoteOFTPeerBytes32(TOKEN_A, SOLANA_EID, replacementMint);

        assertEq(registry.remoteOFTBytes32ToToken(SOLANA_MINT), address(0));
        assertEq(registry.remoteOFTBytes32ToToken(replacementMint), TOKEN_A);
    }
}
