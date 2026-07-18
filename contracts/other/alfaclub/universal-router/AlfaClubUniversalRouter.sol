// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.24;

// Command implementations
import {RouteSigner} from "universal-router/base/RouteSigner.sol";
import {RouterParameters} from "universal-router/types/RouterParameters.sol";
import {PaymentsImmutables, PaymentsParameters} from "universal-router/modules/PaymentsImmutables.sol";
import {UniswapImmutables, UniswapParameters} from "universal-router/modules/uniswap/UniswapImmutables.sol";
import {V4SwapRouter} from "universal-router/modules/uniswap/v4/V4SwapRouter.sol";
import {IUniversalRouter} from "universal-router/interfaces/IUniversalRouter.sol";
import {MigratorImmutables, MigratorParameters} from "universal-router/modules/MigratorImmutables.sol";
import {ChainedActions} from "universal-router/modules/ChainedActions.sol";
import {EIP712} from "@openzeppelin/contracts-universal-router/utils/cryptography/EIP712.sol";

import {AlfaClubDispatcher} from "./AlfaClubDispatcher.sol";
import {AlfaClubCommands as Commands} from "./AlfaClubCommands.sol";

/// @notice Universal Router 2.1.1 with two third-party commands for official Sudoswap v2 ERC1155/ERC20 pairs.
/// @dev Derived from Uniswap Universal Router at commit
/// cb222d358a2ea780feedee6990ff8a3c185301bf.
contract AlfaClubUniversalRouter is IUniversalRouter, ChainedActions, RouteSigner, AlfaClubDispatcher {
    constructor(RouterParameters memory params, address sudoswapAdapter)
        UniswapImmutables(UniswapParameters(
                params.v2Factory, params.v3Factory, params.pairInitCodeHash, params.poolInitCodeHash
            ))
        V4SwapRouter(params.v4PoolManager, params.permissionsAdapterFactory)
        PaymentsImmutables(PaymentsParameters(params.permit2, params.weth9))
        MigratorImmutables(MigratorParameters(params.v3NFTPositionManager, params.v4PositionManager))
        ChainedActions(params.spokePool)
        EIP712("UniversalRouter", "2")
        AlfaClubDispatcher(sudoswapAdapter)
    {}

    modifier checkDeadline(uint256 deadline) {
        // The caller-supplied expiry is the intended protection against delayed execution.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > deadline) revert TransactionDeadlinePassed();
        _;
    }

    /// @notice To receive ETH from WETH
    receive() external payable {
        if (msg.sender != address(WETH9) && msg.sender != address(poolManager)) revert InvalidEthSender();
    }

    /// @inheritdoc IUniversalRouter
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline)
        external
        payable
        checkDeadline(deadline)
    {
        execute(commands, inputs);
    }

    /// @inheritdoc IUniversalRouter
    function executeSigned(
        bytes calldata commands,
        bytes[] calldata inputs,
        bytes32 intent,
        bytes32 data,
        bool verifySender,
        bytes32 nonce,
        bytes calldata signature,
        uint256 deadline
    ) external payable checkDeadline(deadline) {
        // Set signature context and verify
        _setSignatureContext(commands, inputs, intent, data, verifySender, nonce, signature, deadline);

        // Execute commands
        execute(commands, inputs);

        // Clear signature context
        _resetSignatureContext();
    }

    /// @inheritdoc AlfaClubDispatcher
    function execute(bytes calldata commands, bytes[] calldata inputs) public payable override isNotLocked {
        bool success;
        bytes memory output;
        uint256 numCommands = commands.length;
        if (inputs.length != numCommands) revert LengthMismatch();

        // loop through all given commands, execute them and pass along outputs as defined
        for (uint256 commandIndex = 0; commandIndex < numCommands; commandIndex++) {
            bytes1 command = commands[commandIndex];

            bytes calldata input = inputs[commandIndex];

            (success, output) = dispatch(command, input);

            if (!success && successRequired(command)) {
                revert ExecutionFailed({commandIndex: commandIndex, message: output});
            }
        }
    }

    /// @inheritdoc IUniversalRouter
    function signedRouteContext() external view returns (address signer, bytes32 intent, bytes32 data) {
        return _signedRouteContext();
    }

    function successRequired(bytes1 command) internal pure returns (bool) {
        return command & Commands.FLAG_ALLOW_REVERT == 0;
    }
}
