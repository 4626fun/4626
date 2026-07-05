// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MockAgentTokenV4} from "../mocks/MockAgentTokenV4.sol";

contract MockAgentTokenV4Test is Test {
    function test_fot_transfer_and_distribute() public {
        MockAgentTokenV4 token = new MockAgentTokenV4("ATIKA", "ATIKA", 1000, 1000);
        address router = makeAddr("router");
        token.setProjectTaxRecipient(router);
        token.setPairToken(makeAddr("pair"));

        token.mint(address(this), 1000 ether);
        token.transfer(makeAddr("bob"), 100 ether);

        assertGt(token.projectTaxPendingSwap(), 0);
        token.distributeTaxTokens();
        assertEq(token.projectTaxPendingSwap(), 0);
        assertGt(token.balanceOf(router), 0);
    }
}
