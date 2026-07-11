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
    // linkReferences start for PricingLib (out/LotteryManager4626.sol/LotteryManager4626.json)
    uint256 constant PRICING_LIB_LINK_OFFSET = 12_558;

    function test_creationCode_isLinked_notPlaceholder() public pure {
        bytes memory creation = type(LotteryManager4626).creationCode;
        require(creation.length > PRICING_LIB_LINK_OFFSET + 20, "creation too short");

        // Opcode before the 20-byte address must be PUSH20.
        assertEq(uint8(creation[PRICING_LIB_LINK_OFFSET - 1]), 0x73, "expected PUSH20 before lib address");

        address embedded;
        assembly {
            embedded := shr(96, mload(add(add(creation, 32), PRICING_LIB_LINK_OFFSET)))
        }
        assertTrue(embedded != address(0), "PricingLib link address must be non-zero");

        // Sanity: library itself has non-empty creation code (deployable).
        assertGt(type(LotteryManager4626PricingLib).creationCode.length, 0);
    }

    function test_creationCode_fullSize_notTruncatedAtPlaceholder() public pure {
        // Unlinked artifact hex truncates at the first `__$` placeholder (~12_558 bytes).
        // Linked creation must keep full EIP-170-era size (~45k creation bytes).
        assertGt(type(LotteryManager4626).creationCode.length, 40_000, "creation looks truncated");
    }
}
