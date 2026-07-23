// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {LotteryManager4626PricingLib} from "@4626/shared/lottery/manager/LotteryManager4626PricingLib.sol";

/**
 * @notice Guard that LM creation bytecode is linked (not left as solc placeholders).
 * @dev Forge links libraries to different addresses in `forge test` vs `forge script`
 *      (script uses EIP-2470 + create2_library_salt 0). This test only asserts the
 *      bytecode is fully linked to a non-zero address at the known call site.
 *      CREATE2 address parity is covered by `script/lib/extract_linked_bytecode.py`
 *      and the CREATE2 deploy scripts.
 */
contract LotteryManager4626BytecodeLinkTest is Test {
    function test_creationCode_isLinked_notPlaceholder() public pure {
        bytes memory creation = type(LotteryManager4626).creationCode;
        address linkedLibrary = address(LotteryManager4626PricingLib);
        assertTrue(linkedLibrary != address(0), "PricingLib link address must be non-zero");
        assertTrue(
            _containsPush20Address(creation, linkedLibrary),
            "creation bytecode must contain linked PricingLib address"
        );

        // Sanity: library itself has non-empty creation code (deployable).
        assertGt(type(LotteryManager4626PricingLib).creationCode.length, 0);
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

    function test_creationCode_fullSize_notTruncatedAtPlaceholder() public pure {
        // Unlinked artifact hex truncates at the first `__$` placeholder (~12_558 bytes).
        // Linked creation must keep full EIP-170-era size (~45k creation bytes).
        assertGt(type(LotteryManager4626).creationCode.length, 40_000, "creation looks truncated");
    }
}
