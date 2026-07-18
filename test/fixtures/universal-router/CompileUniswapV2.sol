// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.5.16;

// This source makes the official Uniswap v2 core artifacts available to the
// 0.8.26 integration test through vm.deployCode/vm.getCode.
import {UniswapV2Factory} from "../../../node_modules/@uniswap/v2-core/contracts/UniswapV2Factory.sol";
import {UniswapV2Pair} from "../../../node_modules/@uniswap/v2-core/contracts/UniswapV2Pair.sol";
