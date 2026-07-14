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

/// @dev AUDIT-2026-07-08-NEW-H — phase modules / aux batcher consult DeploymentBatcher for codeId allowlist.
interface IDeploymentBatcherCodeAllowlist {
    function requireApprovedCodeId(bytes32 codeId) external view;
}

/**
 * @title VaultAuxiliaryDeployBatcher
 * @notice CREATE2 helper for phase-2 revenue auxiliaries (burn stream, revenue router,
 *         revenue policy controller) for Creator and Agent execution templates.
 * @dev Creator salt tags remain the historical concrete strings. Agent uses its own
 *      concrete salt tags. Field names are lane-neutral; vaultKind selects bytecode
 *      and salt domains. Constructor-pinned codeIds bind each vaultKind to its lane
 *      bytecode; treasury may still revoke via DeploymentBatcher.approvedCodeIds.
 */
contract VaultAuxiliaryDeployBatcher {
    address internal constant BASE_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant DEFAULT_PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B;

    uint8 public constant VAULT_KIND_CREATOR = 0;
    uint8 public constant VAULT_KIND_AGENT = 1;

    IAuxiliaryCreate2Deployer public immutable create2Deployer;
    IAuxiliaryBytecodeStore public immutable bytecodeStore;
    address public immutable deploymentBatcher;
    address public immutable protocolTreasury;
    address public immutable swapRouter;

    /// @notice Shared burn-stream bytecode (lane-neutral).
    bytes32 public immutable vaultShareBurnStreamCodeId;
    bytes32 public immutable creatorRevenueRouterCodeId;
    bytes32 public immutable agentRevenueRouterCodeId;
    bytes32 public immutable creatorRevenuePolicyControllerCodeId;
    bytes32 public immutable agentRevenuePolicyControllerCodeId;

    error ZeroAddress();
    error NotOwner();
    error InvalidCodeId();
    error InvalidAuxiliaryConfig();
    error InvalidVaultKind(uint8 vaultKind);
    error CodeIdKindMismatch(bytes32 expected, bytes32 actual);

    struct Params {
        address assetToken;
        address owner;
        address vault;
        address shareOFT;
        address wrapper;
        address swapRouter;
        address weth;
        address protocolRewards;
        uint8 vaultKind;
    }

    struct CodeIds {
        bytes32 vaultShareBurnStream;
        bytes32 revenueRouter;
        bytes32 revenuePolicyController;
    }

    struct Result {
        address burnStream;
        address revenueRouter;
        address revenuePolicyController;
    }

    constructor(
        address create2Deployer_,
        address bytecodeStore_,
        address deploymentBatcher_,
        address protocolTreasury_,
        address swapRouter_,
        bytes32 vaultShareBurnStreamCodeId_,
        bytes32 creatorRevenueRouterCodeId_,
        bytes32 agentRevenueRouterCodeId_,
        bytes32 creatorRevenuePolicyControllerCodeId_,
        bytes32 agentRevenuePolicyControllerCodeId_
    ) {
        if (
            create2Deployer_ == address(0) || bytecodeStore_ == address(0) || deploymentBatcher_ == address(0)
                || protocolTreasury_ == address(0) || swapRouter_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (
            vaultShareBurnStreamCodeId_ == bytes32(0) || creatorRevenueRouterCodeId_ == bytes32(0)
                || agentRevenueRouterCodeId_ == bytes32(0) || creatorRevenuePolicyControllerCodeId_ == bytes32(0)
                || agentRevenuePolicyControllerCodeId_ == bytes32(0)
        ) {
            revert InvalidCodeId();
        }
        create2Deployer = IAuxiliaryCreate2Deployer(create2Deployer_);
        bytecodeStore = IAuxiliaryBytecodeStore(bytecodeStore_);
        deploymentBatcher = deploymentBatcher_;
        protocolTreasury = protocolTreasury_;
        swapRouter = swapRouter_;
        vaultShareBurnStreamCodeId = vaultShareBurnStreamCodeId_;
        creatorRevenueRouterCodeId = creatorRevenueRouterCodeId_;
        agentRevenueRouterCodeId = agentRevenueRouterCodeId_;
        creatorRevenuePolicyControllerCodeId = creatorRevenuePolicyControllerCodeId_;
        agentRevenuePolicyControllerCodeId = agentRevenuePolicyControllerCodeId_;
    }

    function deployPhase2Auxiliaries(Params calldata params, CodeIds calldata codeIds)
        external
        returns (Result memory out)
    {
        if (
            params.assetToken == address(0) || params.owner == address(0) || params.vault == address(0)
                || params.shareOFT == address(0) || params.wrapper == address(0)
        ) {
            revert ZeroAddress();
        }
        if (
            codeIds.vaultShareBurnStream == bytes32(0) || codeIds.revenueRouter == bytes32(0)
                || codeIds.revenuePolicyController == bytes32(0)
        ) {
            revert InvalidCodeId();
        }
        if (params.vaultKind != VAULT_KIND_CREATOR && params.vaultKind != VAULT_KIND_AGENT) {
            revert InvalidVaultKind(params.vaultKind);
        }
        if (params.swapRouter != swapRouter || params.weth != BASE_WETH) revert InvalidAuxiliaryConfig();
        if (params.protocolRewards != address(0) && params.protocolRewards != DEFAULT_PROTOCOL_REWARDS) {
            revert InvalidAuxiliaryConfig();
        }
        if (IOwnableViewForAuxiliary(params.vault).owner() != params.owner) revert NotOwner();

        _requireLaneCodeIds(params.vaultKind, codeIds);

        bytes32 burnStreamSalt =
            keccak256(abi.encodePacked("4626:VaultShareBurnStream", params.assetToken, params.owner));
        bytes memory burnStreamArgs = abi.encode(params.vault);
        out.burnStream = create2Deployer.computeAddress(
            burnStreamSalt, _deriveInitCodeHash(codeIds.vaultShareBurnStream, burnStreamArgs)
        );
        if (out.burnStream.code.length == 0) {
            out.burnStream = create2Deployer.deploy(burnStreamSalt, codeIds.vaultShareBurnStream, burnStreamArgs);
        }

        bytes32 routerSalt = keccak256(
            abi.encodePacked(
                params.vaultKind == VAULT_KIND_AGENT
                    ? "4626:AgentRevenueRouter"
                    : "4626:CreatorPayoutRouter",
                params.assetToken,
                params.owner
            )
        );
        bytes memory routerArgs = abi.encode(
            params.assetToken,
            params.vault,
            out.burnStream,
            params.shareOFT,
            params.wrapper,
            protocolTreasury,
            params.swapRouter,
            params.weth,
            params.protocolRewards
        );
        out.revenueRouter =
            create2Deployer.computeAddress(routerSalt, _deriveInitCodeHash(codeIds.revenueRouter, routerArgs));
        if (out.revenueRouter.code.length == 0) {
            out.revenueRouter = create2Deployer.deploy(routerSalt, codeIds.revenueRouter, routerArgs);
        }

        bytes32 policyControllerSalt = keccak256(
            abi.encodePacked(
                params.vaultKind == VAULT_KIND_AGENT
                    ? "4626:AgentRevenuePolicyController"
                    : "4626:CreatorCoinPolicyController",
                params.assetToken,
                params.owner
            )
        );
        bytes memory policyControllerArgs = abi.encode(params.assetToken, out.revenueRouter, protocolTreasury);
        out.revenuePolicyController = create2Deployer.computeAddress(
            policyControllerSalt, _deriveInitCodeHash(codeIds.revenuePolicyController, policyControllerArgs)
        );
        if (out.revenuePolicyController.code.length == 0) {
            out.revenuePolicyController = create2Deployer.deploy(
                policyControllerSalt, codeIds.revenuePolicyController, policyControllerArgs
            );
        }
    }

    function _requireLaneCodeIds(uint8 vaultKind, CodeIds calldata codeIds) internal view {
        if (codeIds.vaultShareBurnStream != vaultShareBurnStreamCodeId) {
            revert CodeIdKindMismatch(vaultShareBurnStreamCodeId, codeIds.vaultShareBurnStream);
        }

        bytes32 expectedRouter =
            vaultKind == VAULT_KIND_AGENT ? agentRevenueRouterCodeId : creatorRevenueRouterCodeId;
        if (codeIds.revenueRouter != expectedRouter) {
            revert CodeIdKindMismatch(expectedRouter, codeIds.revenueRouter);
        }

        bytes32 expectedPolicy = vaultKind == VAULT_KIND_AGENT
            ? agentRevenuePolicyControllerCodeId
            : creatorRevenuePolicyControllerCodeId;
        if (codeIds.revenuePolicyController != expectedPolicy) {
            revert CodeIdKindMismatch(expectedPolicy, codeIds.revenuePolicyController);
        }

        IDeploymentBatcherCodeAllowlist allowlist = IDeploymentBatcherCodeAllowlist(deploymentBatcher);
        allowlist.requireApprovedCodeId(codeIds.vaultShareBurnStream);
        allowlist.requireApprovedCodeId(codeIds.revenueRouter);
        allowlist.requireApprovedCodeId(codeIds.revenuePolicyController);
    }

    function _deriveInitCodeHash(bytes32 codeId, bytes memory constructorArgs) internal view returns (bytes32) {
        return keccak256(bytes.concat(bytecodeStore.get(codeId), constructorArgs));
    }
}
