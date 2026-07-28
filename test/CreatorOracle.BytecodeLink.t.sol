// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorOracle} from "@4626/creator/oracles/CreatorOracle.sol";
import {CreatorOracleQuoteLib} from "@4626/creator/oracles/CreatorOracleQuoteLib.sol";

/**
 * @notice Guard that CreatorOracle creation bytecode is linked (not left as solc placeholders).
 * @dev Forge links libraries to different addresses in `forge test` vs `forge script`
 *      (script uses EIP-2470 + create2_library_salt 0). This test only asserts the
 *      bytecode is fully linked to a non-zero address at a known call site.
 *      CREATE2 address parity is covered by `script/lib/extract_linked_bytecode.py`
 *      and `script/DeployCreatorOracleQuoteLib.s.sol` / SeedUniversalBytecodeStore.
 */
contract CreatorOracleBytecodeLinkTest is Test {
    function test_creationCode_isLinked_notPlaceholder() public pure {
        bytes memory creation = type(CreatorOracle).creationCode;
        address linkedLibrary = address(CreatorOracleQuoteLib);
        assertTrue(linkedLibrary != address(0), "QuoteLib link address must be non-zero");
        assertTrue(
            _containsPush20Address(creation, linkedLibrary),
            "creation bytecode must contain linked QuoteLib address"
        );

        assertGt(type(CreatorOracleQuoteLib).creationCode.length, 0);
    }

    function test_creationCode_fullSize_notTruncatedAtPlaceholder() public pure {
        // Unlinked artifact hex truncates near the first `__$` placeholder (~13k bytes).
        // Linked creation must retain full post-split size (~26k creation bytes).
        assertGt(type(CreatorOracle).creationCode.length, 20_000, "creation looks truncated");
    }

    function _containsPush20Address(bytes memory code, address target) internal pure returns (bool) {
        bytes20 needle = bytes20(target);
        for (uint256 i = 1; i + 20 <= code.length; ++i) {
            if (uint8(code[i - 1]) != 0x73) continue;
            bytes20 candidate;
            assembly {
                candidate := mload(add(add(code, 32), i))
            }
            if (candidate == needle) return true;
        }
        return false;
    }
}
