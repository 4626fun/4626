// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IAuxiliaryCreate2Deployer {
    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
}

interface IAuxiliaryBytecodeStore {
    function get(bytes32 codeId) external view returns (bytes memory);
}

interface IOwnableViewForAuxiliary {
    function owner() external view returns (address);
}

contract VaultAuxiliaryDeployBatcher {
    address internal constant BASE_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant DEFAULT_PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B;

    IAuxiliaryCreate2Deployer public immutable create2Deployer;
    IAuxiliaryBytecodeStore public immutable bytecodeStore;
    address public immutable deploymentBatcher;
    address public immutable protocolTreasury;
    address public immutable swapRouter;

    error ZeroAddress();
    error NotOwner();
    error InvalidCodeId();
    error InvalidAuxiliaryConfig();

    struct Params {
        address creatorToken;
        address owner;
        address vault;
        address swapRouter;
        address weth;
        address protocolRewards;
    }

    struct CodeIds {
        bytes32 vaultShareBurnStream;
        bytes32 payoutRouter;
        bytes32 creatorCoinPolicyController;
    }

    struct Result {
        address burnStream;
        address payoutRouter;
        address creatorCoinPolicyController;
    }

    constructor(
        address create2Deployer_,
        address bytecodeStore_,
        address deploymentBatcher_,
        address protocolTreasury_,
        address swapRouter_
    ) {
        if (
            create2Deployer_ == address(0) || bytecodeStore_ == address(0) || deploymentBatcher_ == address(0)
                || protocolTreasury_ == address(0) || swapRouter_ == address(0)
        ) {
            revert ZeroAddress();
        }
        create2Deployer = IAuxiliaryCreate2Deployer(create2Deployer_);
        bytecodeStore = IAuxiliaryBytecodeStore(bytecodeStore_);
        deploymentBatcher = deploymentBatcher_;
        protocolTreasury = protocolTreasury_;
        swapRouter = swapRouter_;
    }

    function deployPhase2Auxiliaries(Params calldata params, CodeIds calldata codeIds)
        external
        returns (Result memory out)
    {
        if (params.creatorToken == address(0) || params.owner == address(0) || params.vault == address(0)) {
            revert ZeroAddress();
        }
        if (
            codeIds.vaultShareBurnStream == bytes32(0) || codeIds.payoutRouter == bytes32(0)
                || codeIds.creatorCoinPolicyController == bytes32(0)
        ) {
            revert InvalidCodeId();
        }
        if (params.swapRouter != swapRouter || params.weth != BASE_WETH) revert InvalidAuxiliaryConfig();
        if (params.protocolRewards != address(0) && params.protocolRewards != DEFAULT_PROTOCOL_REWARDS) {
            revert InvalidAuxiliaryConfig();
        }
        if (IOwnableViewForAuxiliary(params.vault).owner() != params.owner) revert NotOwner();

        bytes32 burnStreamSalt =
            keccak256(abi.encodePacked("4626:VaultShareBurnStream", params.creatorToken, params.owner));
        bytes memory burnStreamArgs = abi.encode(params.vault);
        out.burnStream = create2Deployer.computeAddress(
            burnStreamSalt, _deriveInitCodeHash(codeIds.vaultShareBurnStream, burnStreamArgs)
        );
        if (out.burnStream.code.length == 0) {
            out.burnStream = create2Deployer.deploy(burnStreamSalt, codeIds.vaultShareBurnStream, burnStreamArgs);
        }

        bytes32 payoutRouterSalt =
            keccak256(abi.encodePacked("4626:PayoutRouter", params.creatorToken, params.owner));
        bytes memory payoutRouterArgs = abi.encode(
            params.creatorToken,
            params.vault,
            out.burnStream,
            protocolTreasury,
            params.swapRouter,
            params.weth,
            params.protocolRewards
        );
        out.payoutRouter = create2Deployer.computeAddress(
            payoutRouterSalt, _deriveInitCodeHash(codeIds.payoutRouter, payoutRouterArgs)
        );
        if (out.payoutRouter.code.length == 0) {
            out.payoutRouter = create2Deployer.deploy(payoutRouterSalt, codeIds.payoutRouter, payoutRouterArgs);
        }

        bytes32 policyControllerSalt =
            keccak256(abi.encodePacked("4626:CreatorCoinPolicyController", params.creatorToken, params.owner));
        bytes memory policyControllerArgs = abi.encode(params.creatorToken, out.payoutRouter, protocolTreasury);
        out.creatorCoinPolicyController = create2Deployer.computeAddress(
            policyControllerSalt, _deriveInitCodeHash(codeIds.creatorCoinPolicyController, policyControllerArgs)
        );
        if (out.creatorCoinPolicyController.code.length == 0) {
            out.creatorCoinPolicyController = create2Deployer.deploy(
                policyControllerSalt, codeIds.creatorCoinPolicyController, policyControllerArgs
            );
        }
    }

    function _deriveInitCodeHash(bytes32 codeId, bytes memory constructorArgs) internal view returns (bytes32) {
        return keccak256(bytes.concat(bytecodeStore.get(codeId), constructorArgs));
    }
}
