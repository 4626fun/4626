// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "../../../lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";

/// @dev Allowance-only Permit2 double for the isolated 0.8.26 router profile.
/// Production deployment and the lifecycle test use the pinned upstream
/// Permit2 artifact; this avoids importing its exact 0.8.17 unit here.
contract Permit2Mock {
    struct PackedAllowance {
        uint160 amount;
        uint48 expiration;
    }

    mapping(address owner => mapping(address token => mapping(address spender => PackedAllowance)))
        public allowance;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        allowance[msg.sender][token][spender] = PackedAllowance({amount: amount, expiration: expiration});
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        PackedAllowance storage allowed = allowance[from][token][msg.sender];
        require(block.timestamp <= allowed.expiration, "PERMIT2_EXPIRED");
        require(allowed.amount >= amount, "PERMIT2_ALLOWANCE");
        if (allowed.amount != type(uint160).max) allowed.amount -= amount;
        require(ERC20(token).transferFrom(from, to, amount), "TOKEN_TRANSFER");
    }
}
