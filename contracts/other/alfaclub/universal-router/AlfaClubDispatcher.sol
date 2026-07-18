// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

import {V2SwapRouter} from "universal-router/modules/uniswap/v2/V2SwapRouter.sol";
import {V3SwapRouter} from "universal-router/modules/uniswap/v3/V3SwapRouter.sol";
import {V4SwapRouter} from "universal-router/modules/uniswap/v4/V4SwapRouter.sol";
import {BytesLib} from "universal-router/modules/uniswap/v3/BytesLib.sol";
import {Payments} from "universal-router/modules/Payments.sol";
import {V3ToV4Migrator} from "universal-router/modules/V3ToV4Migrator.sol";
import {Lock} from "universal-router/base/Lock.sol";
import {ChainedActions} from "universal-router/modules/ChainedActions.sol";
import {ERC20} from "lib/universal-router/lib/solmate/src/tokens/ERC20.sol";
import {IAllowanceTransfer} from "lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";
import {ActionConstants} from "lib/universal-router/lib/v4-periphery/src/libraries/ActionConstants.sol";
import {CalldataDecoder} from "lib/universal-router/lib/v4-periphery/src/libraries/CalldataDecoder.sol";
import {PoolKey} from "lib/universal-router/lib/v4-periphery/lib/v4-core/src/types/PoolKey.sol";
import {IPoolManager} from "lib/universal-router/lib/v4-periphery/lib/v4-core/src/interfaces/IPoolManager.sol";

import {AlfaClubCommands as Commands} from "./AlfaClubCommands.sol";
import {IAlfaClubSudoswapAdapter} from "./interfaces/IAlfaClubSudoswapAdapter.sol";

/// @title Decodes and Executes Commands
/// @notice Called by the UniversalRouter contract to efficiently decode and execute a singular command
/// @dev Derived from Uniswap Universal Router Dispatcher.sol at commit
/// cb222d358a2ea780feedee6990ff8a3c185301bf.
abstract contract AlfaClubDispatcher is
    Payments,
    V2SwapRouter,
    V3SwapRouter,
    V4SwapRouter,
    V3ToV4Migrator,
    Lock,
    ChainedActions
{
    using BytesLib for bytes;
    using CalldataDecoder for bytes;

    error InvalidCommandType(uint256 commandType);
    error BalanceTooLow();
    error InvalidSudoswapInput();
    error SudoswapPayerMustBeUser();

    IAlfaClubSudoswapAdapter public immutable SUDOSWAP_ADAPTER;

    constructor(address sudoswapAdapter) {
        if (sudoswapAdapter == address(0)) revert InvalidSudoswapInput();
        SUDOSWAP_ADAPTER = IAlfaClubSudoswapAdapter(sudoswapAdapter);
    }

    /// @notice Executes encoded commands along with provided inputs.
    /// @param commands A set of concatenated commands, each 1 byte in length
    /// @param inputs An array of byte strings containing abi encoded inputs for each command
    function execute(bytes calldata commands, bytes[] calldata inputs) external payable virtual;

    /// @notice Public view function to be used instead of msg.sender, as the contract performs self-reentrancy and at
    /// times msg.sender == address(this). Instead msgSender() returns the initiator of the lock
    /// @dev overrides BaseActionsRouter.msgSender in V4Router
    function msgSender() public view override returns (address) {
        return _getLocker();
    }

    /// @notice Decodes and executes the given command with the given inputs
    /// @param commandType The command type to execute
    /// @param inputs The inputs to execute the command with
    /// @dev 2 masks are used to enable use of a nested-if statement in execution for efficiency reasons
    /// @return success True on success of the command, false on failure
    /// @return output The outputs or error messages, if any, from the command
    function dispatch(bytes1 commandType, bytes calldata inputs) internal returns (bool success, bytes memory output) {
        uint256 command = uint8(commandType & Commands.COMMAND_TYPE_MASK);

        success = true;

        // 0x00 <= command < 0x21
        if (command < Commands.EXECUTE_SUB_PLAN) {
            // 0x00 <= command < 0x10
            if (command < Commands.V4_SWAP) {
                // 0x00 <= command < 0x08
                if (command < Commands.V2_SWAP_EXACT_IN) {
                    if (command == Commands.V3_SWAP_EXACT_IN) {
                        // equivalent: abi.decode(inputs, (address, uint256, uint256, bytes, bool, uint256[]))
                        address recipient;
                        uint256 amountIn;
                        uint256 amountOutMin;
                        bool payerIsUser;
                        assembly {
                            recipient := calldataload(inputs.offset)
                            amountIn := calldataload(add(inputs.offset, 0x20))
                            amountOutMin := calldataload(add(inputs.offset, 0x40))
                            // 0x60 offset is the path, decoded below
                            payerIsUser := calldataload(add(inputs.offset, 0x80))
                        }
                        bytes calldata path = inputs.toBytes(3);
                        uint256[] calldata minHopPriceX36 = inputs.toUint256Array(5);
                        address payer = payerIsUser ? msgSender() : address(this);
                        v3SwapExactInput(map(recipient), amountIn, amountOutMin, path, payer, minHopPriceX36);
                    } else if (command == Commands.V3_SWAP_EXACT_OUT) {
                        // equivalent: abi.decode(inputs, (address, uint256, uint256, bytes, bool, uint256[]))
                        address recipient;
                        uint256 amountOut;
                        uint256 amountInMax;
                        bool payerIsUser;
                        assembly {
                            recipient := calldataload(inputs.offset)
                            amountOut := calldataload(add(inputs.offset, 0x20))
                            amountInMax := calldataload(add(inputs.offset, 0x40))
                            // 0x60 offset is the path, decoded below
                            payerIsUser := calldataload(add(inputs.offset, 0x80))
                        }
                        bytes calldata path = inputs.toBytes(3);
                        uint256[] calldata minHopPriceX36 = inputs.toUint256Array(5);
                        address payer = payerIsUser ? msgSender() : address(this);
                        v3SwapExactOutput(map(recipient), amountOut, amountInMax, path, payer, minHopPriceX36);
                    } else if (command == Commands.PERMIT2_TRANSFER_FROM) {
                        // equivalent: abi.decode(inputs, (address, address, uint160))
                        address token;
                        address recipient;
                        uint160 amount;
                        assembly {
                            token := calldataload(inputs.offset)
                            recipient := calldataload(add(inputs.offset, 0x20))
                            amount := calldataload(add(inputs.offset, 0x40))
                        }
                        permit2TransferFrom(token, msgSender(), map(recipient), amount);
                    } else if (command == Commands.PERMIT2_PERMIT_BATCH) {
                        IAllowanceTransfer.PermitBatch calldata permitBatch;
                        assembly {
                            // this is a variable length struct, so calldataload(inputs.offset) contains the
                            // offset from inputs.offset at which the struct begins
                            permitBatch := add(inputs.offset, calldataload(inputs.offset))
                        }
                        bytes calldata data = inputs.toBytes(1);
                        (success, output) = address(PERMIT2)
                            .call(
                                abi.encodeWithSignature(
                                    "permit(address,((address,uint160,uint48,uint48)[],address,uint256),bytes)",
                                    msgSender(),
                                    permitBatch,
                                    data
                                )
                            );
                    } else if (command == Commands.SWEEP) {
                        // equivalent:  abi.decode(inputs, (address, address, uint256))
                        address token;
                        address recipient;
                        uint160 amountMin;
                        assembly {
                            token := calldataload(inputs.offset)
                            recipient := calldataload(add(inputs.offset, 0x20))
                            amountMin := calldataload(add(inputs.offset, 0x40))
                        }
                        Payments.sweep(token, map(recipient), amountMin);
                    } else if (command == Commands.TRANSFER) {
                        // equivalent:  abi.decode(inputs, (address, address, uint256))
                        address token;
                        address recipient;
                        uint256 value;
                        assembly {
                            token := calldataload(inputs.offset)
                            recipient := calldataload(add(inputs.offset, 0x20))
                            value := calldataload(add(inputs.offset, 0x40))
                        }
                        Payments.pay(token, map(recipient), value);
                    } else if (command == Commands.PAY_PORTION) {
                        // equivalent:  abi.decode(inputs, (address, address, uint256))
                        address token;
                        address recipient;
                        uint256 bips;
                        assembly {
                            token := calldataload(inputs.offset)
                            recipient := calldataload(add(inputs.offset, 0x20))
                            bips := calldataload(add(inputs.offset, 0x40))
                        }
                        Payments.payPortion(token, map(recipient), bips);
                    } else if (command == Commands.PAY_PORTION_FULL_PRECISION) {
                        // equivalent:  abi.decode(inputs, (address, address, uint256))
                        address token;
                        address recipient;
                        uint256 portion;
                        assembly {
                            token := calldataload(inputs.offset)
                            recipient := calldataload(add(inputs.offset, 0x20))
                            portion := calldataload(add(inputs.offset, 0x40))
                        }
                        Payments.payPortionFullPrecision(token, map(recipient), portion);
                    } else {
                        revert InvalidCommandType(command);
                    }
                } else {
                    // 0x08 <= command < 0x10
                    if (command == Commands.V2_SWAP_EXACT_IN) {
                        // equivalent: abi.decode(inputs, (address, uint256, uint256, address[], bool, uint256[]))
                        address recipient;
                        uint256 amountIn;
                        uint256 amountOutMin;
                        bool payerIsUser;
                        assembly {
                            recipient := calldataload(inputs.offset)
                            amountIn := calldataload(add(inputs.offset, 0x20))
                            amountOutMin := calldataload(add(inputs.offset, 0x40))
                            // 0x60 offset is the path, decoded below
                            payerIsUser := calldataload(add(inputs.offset, 0x80))
                        }
                        address[] calldata path = inputs.toAddressArray(3);
                        uint256[] calldata minHopPriceX36 = inputs.toUint256Array(5);
                        address payer = payerIsUser ? msgSender() : address(this);
                        v2SwapExactInput(map(recipient), amountIn, amountOutMin, path, payer, minHopPriceX36);
                    } else if (command == Commands.V2_SWAP_EXACT_OUT) {
                        // equivalent: abi.decode(inputs, (address, uint256, uint256, address[], bool, uint256[]))
                        address recipient;
                        uint256 amountOut;
                        uint256 amountInMax;
                        bool payerIsUser;
                        assembly {
                            recipient := calldataload(inputs.offset)
                            amountOut := calldataload(add(inputs.offset, 0x20))
                            amountInMax := calldataload(add(inputs.offset, 0x40))
                            // 0x60 offset is the path, decoded below
                            payerIsUser := calldataload(add(inputs.offset, 0x80))
                        }
                        address[] calldata path = inputs.toAddressArray(3);
                        uint256[] calldata minHopPriceX36 = inputs.toUint256Array(5);
                        address payer = payerIsUser ? msgSender() : address(this);
                        v2SwapExactOutput(map(recipient), amountOut, amountInMax, path, payer, minHopPriceX36);
                    } else if (command == Commands.PERMIT2_PERMIT) {
                        // equivalent: abi.decode(inputs, (IAllowanceTransfer.PermitSingle, bytes))
                        IAllowanceTransfer.PermitSingle calldata permitSingle;
                        assembly {
                            permitSingle := inputs.offset
                        }
                        bytes calldata data = inputs.toBytes(6); // PermitSingle takes first 6 slots (0..5)
                        (success, output) = address(PERMIT2)
                            .call(
                                abi.encodeWithSignature(
                                    "permit(address,((address,uint160,uint48,uint48),address,uint256),bytes)",
                                    msgSender(),
                                    permitSingle,
                                    data
                                )
                            );
                    } else if (command == Commands.WRAP_ETH) {
                        // equivalent: abi.decode(inputs, (address, uint256))
                        address recipient;
                        uint256 amount;
                        assembly {
                            recipient := calldataload(inputs.offset)
                            amount := calldataload(add(inputs.offset, 0x20))
                        }
                        Payments.wrapETH(map(recipient), amount);
                    } else if (command == Commands.UNWRAP_WETH) {
                        // equivalent: abi.decode(inputs, (address, uint256))
                        address recipient;
                        uint256 amountMin;
                        assembly {
                            recipient := calldataload(inputs.offset)
                            amountMin := calldataload(add(inputs.offset, 0x20))
                        }
                        Payments.unwrapWETH9(map(recipient), amountMin);
                    } else if (command == Commands.PERMIT2_TRANSFER_FROM_BATCH) {
                        IAllowanceTransfer.AllowanceTransferDetails[] calldata batchDetails;
                        (uint256 length, uint256 offset) = inputs.toLengthOffset(0);
                        assembly {
                            batchDetails.length := length
                            batchDetails.offset := offset
                        }
                        permit2TransferFrom(batchDetails, msgSender());
                    } else if (command == Commands.BALANCE_CHECK_ERC20) {
                        // equivalent: abi.decode(inputs, (address, address, uint256))
                        address owner;
                        address token;
                        uint256 minBalance;
                        assembly {
                            owner := calldataload(inputs.offset)
                            token := calldataload(add(inputs.offset, 0x20))
                            minBalance := calldataload(add(inputs.offset, 0x40))
                        }
                        success = (ERC20(token).balanceOf(owner) >= minBalance);
                        if (!success) output = abi.encodePacked(BalanceTooLow.selector);
                    } else {
                        // placeholder area for command 0x0f
                        revert InvalidCommandType(command);
                    }
                }
            } else {
                // 0x10 <= command < 0x21
                if (command == Commands.V4_SWAP) {
                    // pass the calldata provided to V4SwapRouter._executeActions (defined in BaseActionsRouter)
                    _executeActions(inputs);
                    // This contract MUST be approved to spend the token since its going to be doing the call on the position manager
                } else if (command == Commands.V3_POSITION_MANAGER_PERMIT) {
                    _checkV3PermitCall(inputs);
                    (success, output) = address(V3_POSITION_MANAGER).call(inputs);
                } else if (command == Commands.V3_POSITION_MANAGER_CALL) {
                    _checkV3PositionManagerCall(inputs, msgSender());
                    (success, output) = address(V3_POSITION_MANAGER).call(inputs);
                } else if (command == Commands.V4_INITIALIZE_POOL) {
                    PoolKey calldata poolKey;
                    uint160 sqrtPriceX96;
                    assembly {
                        poolKey := inputs.offset
                        sqrtPriceX96 := calldataload(add(inputs.offset, 0xa0))
                    }
                    (success, output) =
                        address(poolManager).call(abi.encodeCall(IPoolManager.initialize, (poolKey, sqrtPriceX96)));
                } else if (command == Commands.V4_POSITION_MANAGER_CALL) {
                    // should only call modifyLiquidities() to mint
                    _checkV4PositionManagerCall(inputs);
                    (success, output) = address(V4_POSITION_MANAGER).call{value: address(this).balance}(inputs);
                } else {
                    // placeholder area for commands 0x15-0x20
                    revert InvalidCommandType(command);
                }
            }
        } else if (command < Commands.ACROSS_V4_DEPOSIT_V3) {
            // 0x21 <= command
            if (command == Commands.EXECUTE_SUB_PLAN) {
                (bytes calldata _commands, bytes[] calldata _inputs) = inputs.decodeCommandsAndInputs();
                (success, output) =
                    (address(this)).call(abi.encodeCall(AlfaClubDispatcher.execute, (_commands, _inputs)));
            } else {
                // placeholder area for commands 0x22-0x3f
                revert InvalidCommandType(command);
            }
        } else {
            if (command == Commands.ACROSS_V4_DEPOSIT_V3) {
                _acrossV4DepositV3(inputs);
            } else if (command == Commands.SUDOSWAP_ERC1155_BUY || command == Commands.SUDOSWAP_ERC1155_SELL) {
                if (inputs.length != 160) return (false, abi.encodePacked(InvalidSudoswapInput.selector));

                uint256 pairWord;
                uint256 recipientWord;
                uint256 keyAmount;
                uint256 limit;
                uint256 payerIsUserWord;
                assembly {
                    pairWord := calldataload(inputs.offset)
                    recipientWord := calldataload(add(inputs.offset, 0x20))
                    keyAmount := calldataload(add(inputs.offset, 0x40))
                    limit := calldataload(add(inputs.offset, 0x60))
                    payerIsUserWord := calldataload(add(inputs.offset, 0x80))
                }

                if (pairWord > type(uint160).max || recipientWord > type(uint160).max || payerIsUserWord > 1) {
                    return (false, abi.encodePacked(InvalidSudoswapInput.selector));
                }
                if (payerIsUserWord == 0) return (false, abi.encodePacked(SudoswapPayerMustBeUser.selector));

                // Both ABI words were bounded to uint160 above.
                // forge-lint: disable-next-line(unsafe-typecast)
                address pair = address(uint160(pairWord));
                // forge-lint: disable-next-line(unsafe-typecast)
                address recipient = map(address(uint160(recipientWord)));
                address payer = msgSender();

                if (command == Commands.SUDOSWAP_ERC1155_BUY) {
                    (success, output) = address(SUDOSWAP_ADAPTER)
                        .call(abi.encodeCall(IAlfaClubSudoswapAdapter.buy, (pair, recipient, keyAmount, limit, payer)));
                } else {
                    (success, output) = address(SUDOSWAP_ADAPTER)
                        .call(abi.encodeCall(IAlfaClubSudoswapAdapter.sell, (pair, recipient, keyAmount, limit, payer)));
                }
            } else {
                // placeholder area for commands 0x43-0x5f
                revert InvalidCommandType(command);
            }
        }
    }

    /// @notice Calculates the recipient address for a command
    /// @param recipient The recipient or recipient-flag for the command
    /// @return output The resultant recipient for the command
    function map(address recipient) internal view returns (address) {
        if (recipient == ActionConstants.MSG_SENDER) {
            return msgSender();
        } else if (recipient == ActionConstants.ADDRESS_THIS) {
            return address(this);
        } else {
            return recipient;
        }
    }
}
