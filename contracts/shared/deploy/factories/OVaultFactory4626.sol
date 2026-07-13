// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {IOvaultLane} from "@4626/shared/deploy/lanes/IOvaultLane.sol";
import {DeploymentBatcher} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {IGaugeSurfaceRegistry} from "@4626/shared/governance/surfaces/IGaugeSurfaceRegistry.sol";

/**
 * @title OVaultFactory4626
 * @author 0xakita.eth
 * @notice Product entrypoint for 4626 vault stacks: lane router (creator / agent / future) + optional
 *         legacy post-hoc registrar.
 *
 * @dev Design:
 *      - **Factory** = front door: choose `VaultKind`, resolve lane module (codeIds / salt labels).
 *      - **DeploymentBatcher** = multi-tx CREATE2 engine (phase 1–3).
 *      - **Registry4626** = runtime routes + `getVaultKind`.
 *
 *      Phase A: `startPhase1` / `finalizePhase1` — lane codeIds + forced `vaultKind`.
 *      Phase B: `startPhase2` / `finalizePhase2` / `startPhase3` — same auth model; phase2 core
 *      injects lane codeIds; phase3 uses caller (or factory-default) strategy codeIds.
 *      Batcher must authorize this factory via `setAuthorizedPhaseCaller`.
 *
 *      Legacy: `registerDeployment` still records already-deployed stacks (creator-oriented field names).
 */
contract OVaultFactory4626 is Ownable {
    bytes32 public constant CREATOR_LANE_KEY = keccak256("creator");
    bytes32 public constant AGENT_LANE_KEY = keccak256("agent");

    // =================================
    // STATE
    // =================================

    IRegistry4626 public registry;
    DeploymentBatcher public deploymentBatcher;
    uint256 public deploymentCount;

    mapping(address => DeploymentInfo) public deployments;
    address[] public deployedTokens;

    /// @notice Authorized deployers (register + startPhase1)
    mapping(address => bool) public authorizedDeployers;

    /// @notice Pluggable lane modules keyed by registry VaultKind.
    mapping(IRegistry4626.VaultKind => address) public laneOf;

    /// @notice Extensible ecosystem lanes keyed by keccak256(bytes(lane.laneId())).
    mapping(bytes32 => address) public ecosystemLaneOf;

    /// @notice Optional gauge surface registry (votes/bribes/streams eligibility).
    IGaugeSurfaceRegistry public surfaceRegistry;

    /// @notice Optional default strategy bytecode ids for `startPhase3` when caller passes empty set.
    DeploymentBatcher.StrategyCodeIds public defaultStrategyCodeIds;
    bool public defaultStrategyCodeIdsSet;

    /// @notice Kind pinned at `startPhase1` for a token so later phases cannot switch lanes mid-stack.
    mapping(address => IRegistry4626.VaultKind) public phaseKindByToken;
    mapping(address => bool) public hasPhaseKind;
    /// @notice Ecosystem key pinned at phase 1 so a stack cannot switch codeId lanes mid-deploy.
    mapping(address => bytes32) public phaseLaneKeyByToken;
    mapping(address => bool) public hasPhaseLaneKey;

    struct DeploymentInfo {
        address creatorCoin; // underlying token (creator coin or agent token)
        address vault;
        address wrapper;
        address shareOFT;
        address gaugeController;
        address ccaLaunchArm;
        address oracle;
        address creator; // stack owner / attribution
        uint256 deployedAt;
        bool exists;
        IRegistry4626.VaultKind vaultKind;
    }

    // =================================
    // EVENTS
    // =================================

    event DeploymentRegistered(
        address indexed creatorCoin,
        address indexed vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaLaunchArm,
        address oracle,
        address creator
    );

    event DeploymentRegisteredWithKind(
        address indexed token,
        address indexed vault,
        IRegistry4626.VaultKind kind,
        address owner
    );

    event DeployerAuthorized(address indexed deployer, bool authorized);
    event RegistryUpdated(address indexed newRegistry);
    event DeploymentBatcherUpdated(address indexed batcher);
    event LaneUpdated(IRegistry4626.VaultKind indexed kind, address indexed lane);
    event EcosystemLaneUpdated(bytes32 indexed laneKey, IRegistry4626.VaultKind indexed executionKind, address lane);
    event SurfaceRegistryUpdated(address indexed surfaceRegistry);
    event Phase1Started(
        address indexed token,
        address indexed owner,
        IRegistry4626.VaultKind kind,
        address vault,
        address wrapper
    );
    event Phase1Finalized(
        address indexed token, address indexed owner, IRegistry4626.VaultKind kind, address shareOFT
    );
    event Phase2CoreStarted(
        address indexed token,
        address indexed owner,
        IRegistry4626.VaultKind kind,
        address gaugeController,
        address ccaLaunchArm,
        address oracle
    );
    event Phase2Finalized(
        address indexed token, address indexed owner, IRegistry4626.VaultKind kind, address auction
    );
    event Phase3Started(
        address indexed token,
        address indexed owner,
        IRegistry4626.VaultKind kind,
        address vault,
        address charmStrategy,
        address ajnaStrategy
    );
    event DefaultStrategyCodeIdsUpdated();

    // =================================
    // ERRORS
    // =================================

    error ZeroAddress();
    error AlreadyDeployed();
    error NotAuthorized();
    error LaneNotConfigured(IRegistry4626.VaultKind kind);
    error LaneKindMismatch(IRegistry4626.VaultKind expected, IRegistry4626.VaultKind actual);
    error EcosystemLaneNotConfigured(bytes32 laneKey);
    error EcosystemLaneKeyMismatch(bytes32 expected, bytes32 actual);
    error ReservedEcosystemLaneKey(bytes32 laneKey);
    error PhaseKindMismatch(address token, IRegistry4626.VaultKind expected, IRegistry4626.VaultKind actual);
    error PhaseLaneKeyMismatch(address token, bytes32 expected, bytes32 actual);
    error BatcherNotConfigured();
    error StrategyCodeIdsNotConfigured();

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry != address(0)) {
            registry = IRegistry4626(_registry);
        }
        authorizedDeployers[_owner] = true;
    }

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyAuthorizedDeployer() {
        if (!authorizedDeployers[msg.sender] && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }

    // =================================
    // ADMIN
    // =================================

    function setAuthorizedDeployer(address _deployer, bool _authorized) external onlyOwner {
        authorizedDeployers[_deployer] = _authorized;
        emit DeployerAuthorized(_deployer, _authorized);
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = IRegistry4626(_registry);
        emit RegistryUpdated(_registry);
    }

    function setDeploymentBatcher(address _batcher) external onlyOwner {
        deploymentBatcher = DeploymentBatcher(payable(_batcher));
        emit DeploymentBatcherUpdated(_batcher);
    }

    /**
     * @notice Wire a lane module for a vault kind (creator / agent / future).
     * @dev Lane contract's `kind()` must match `kind` arg.
     */
    function setLane(IRegistry4626.VaultKind kind, address lane) external onlyOwner {
        if (lane == address(0)) revert ZeroAddress();
        IRegistry4626.VaultKind laneKind = IOvaultLane(lane).kind();
        if (laneKind != kind) revert LaneKindMismatch(kind, laneKind);
        laneOf[kind] = lane;
        bytes32 laneKey = keccak256(bytes(IOvaultLane(lane).laneId()));
        bytes32 expectedKey = _canonicalLaneKey(kind);
        if (laneKey != expectedKey) revert EcosystemLaneKeyMismatch(expectedKey, laneKey);
        ecosystemLaneOf[laneKey] = lane;
        emit LaneUpdated(kind, lane);
        emit EcosystemLaneUpdated(laneKey, kind, lane);
    }

    /**
     * @notice Register an additional ecosystem lane without replacing the canonical
     * creator or agent lane for its execution template.
     */
    function setEcosystemLane(bytes32 laneKey, address lane) external onlyOwner {
        if (lane == address(0) || laneKey == bytes32(0)) revert ZeroAddress();
        if (laneKey == CREATOR_LANE_KEY || laneKey == AGENT_LANE_KEY) {
            revert ReservedEcosystemLaneKey(laneKey);
        }
        bytes32 declaredKey = keccak256(bytes(IOvaultLane(lane).laneId()));
        if (declaredKey != laneKey) revert EcosystemLaneKeyMismatch(laneKey, declaredKey);
        IRegistry4626.VaultKind executionKind = IOvaultLane(lane).kind();
        ecosystemLaneOf[laneKey] = lane;
        emit EcosystemLaneUpdated(laneKey, executionKind, lane);
    }

    function setSurfaceRegistry(address registry_) external onlyOwner {
        surfaceRegistry = IGaugeSurfaceRegistry(registry_);
        emit SurfaceRegistryUpdated(registry_);
    }

    /// @notice Default Charm/Ajna/Solana strategy codeIds for phase-3 when callers pass zeros.
    function setDefaultStrategyCodeIds(DeploymentBatcher.StrategyCodeIds calldata ids) external onlyOwner {
        defaultStrategyCodeIds = ids;
        defaultStrategyCodeIdsSet = true;
        emit DefaultStrategyCodeIdsUpdated();
    }

    // =================================
    // LANE FACADE → BATCHER (Phase A + B)
    // =================================

    /**
     * @notice Resolve lane + codeIds for a kind (tooling / UI preflight).
     */
    function resolveLane(IRegistry4626.VaultKind kind)
        external
        view
        returns (address lane, IOvaultLane.CodeIds memory ids, string memory laneId_)
    {
        lane = laneOf[kind];
        if (lane == address(0)) revert LaneNotConfigured(kind);
        ids = IOvaultLane(lane).codeIds();
        laneId_ = IOvaultLane(lane).laneId();
    }

    function resolveEcosystemLane(bytes32 laneKey)
        external
        view
        returns (
            address lane,
            IRegistry4626.VaultKind executionKind,
            IOvaultLane.CodeIds memory ids,
            string memory laneId_
        )
    {
        IOvaultLane resolved = _requireEcosystemLane(laneKey);
        lane = address(resolved);
        executionKind = resolved.kind();
        ids = resolved.codeIds();
        laneId_ = resolved.laneId();
    }

    /**
     * @notice Start phase-1 core deploy via DeploymentBatcher using the lane's codeIds.
     * @dev `params.vaultKind` is forced from `kind`. Caller must be authorized on this factory;
     *      this factory must be `authorizedPhaseCallers` on the batcher; `params.owner` is the
     *      vault owner recorded in CREATE2 salts / events.
     */
    function startPhase1(
        IRegistry4626.VaultKind kind,
        DeploymentBatcher.Phase1Params calldata params,
        bytes32 shareOftSaltOverride
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase1Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();

        _pinPhaseLane(params.creatorToken, _canonicalLaneKey(kind), kind);
        IOvaultLane lane = _requireLane(kind);
        DeploymentBatcher.CodeIds memory codeIds = _toBatcherCodeIds(lane.codeIds());

        DeploymentBatcher.Phase1Params memory p = params;
        p.vaultKind = _toBatcherKind(kind);

        out = batcher.deployPhase1CoreWithSalt(p, codeIds, shareOftSaltOverride);
        // Vault address is known after phase-1 core — register gauge surface once (fail-loud).
        _maybeRegisterGaugeSurface(out.vault, kind);
        emit Phase1Started(p.creatorToken, p.owner, kind, out.vault, out.wrapper);
    }

    /**
     * @notice Finalize phase-1 (shareOFT leg) for a prior `startPhase1` session.
     */
    function finalizePhase1(
        IRegistry4626.VaultKind kind,
        DeploymentBatcher.Phase1Params calldata params,
        bytes32 shareOftSaltOverride
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase1Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();

        _requirePhaseLane(params.creatorToken, _canonicalLaneKey(kind), kind);
        IOvaultLane lane = _requireLane(kind);
        DeploymentBatcher.CodeIds memory codeIds = _toBatcherCodeIds(lane.codeIds());

        DeploymentBatcher.Phase1Params memory p = params;
        p.vaultKind = _toBatcherKind(kind);

        out = batcher.finalizePhase1WithSalt(p, codeIds, shareOftSaltOverride);
        emit Phase1Finalized(p.creatorToken, p.owner, kind, out.shareOFT);
    }

    /**
     * @notice Phase-2 core: gauge / CCA / oracle via lane codeIds.
     * @dev Kind is recorded in events; stack bytecode comes from the configured lane.
     *      When Phase 1 ran through this factory, `kind` must match the pinned Phase 1 kind.
     */
    function startPhase2(IRegistry4626.VaultKind kind, DeploymentBatcher.Phase2CoreParams calldata params)
        external
        onlyAuthorizedDeployer
        returns (DeploymentBatcher.Phase2Result memory out)
    {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();

        _requirePhaseLane(params.creatorToken, _canonicalLaneKey(kind), kind);
        IOvaultLane lane = _requireLane(kind);
        DeploymentBatcher.CodeIds memory codeIds = _toBatcherCodeIds(lane.codeIds());

        out = batcher.deployPhase2Core(params, codeIds);
        emit Phase2CoreStarted(
            params.creatorToken, params.owner, kind, out.gaugeController, out.ccaLaunchArm, out.oracle
        );
    }

    /**
     * @notice Phase-2 core with explicit vault role policy (deploy-session guarded path).
     */
    function startPhase2WithRolePolicy(
        IRegistry4626.VaultKind kind,
        DeploymentBatcher.Phase2CoreParams calldata params,
        uint256 rolePolicyId
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase2Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();

        _requirePhaseLane(params.creatorToken, _canonicalLaneKey(kind), kind);
        IOvaultLane lane = _requireLane(kind);
        DeploymentBatcher.CodeIds memory codeIds = _toBatcherCodeIds(lane.codeIds());

        out = batcher.deployPhase2CoreWithRolePolicy(params, codeIds, rolePolicyId);
        emit Phase2CoreStarted(
            params.creatorToken, params.owner, kind, out.gaugeController, out.ccaLaunchArm, out.oracle
        );
    }

    /**
     * @notice Finalize phase-2 (deposit / launch / ownership handoff). Payable for native deposit paths.
     */
    function finalizePhase2(IRegistry4626.VaultKind kind, DeploymentBatcher.Phase2FinalizeParams calldata params)
        external
        payable
        onlyAuthorizedDeployer
        returns (DeploymentBatcher.Phase2Result memory out)
    {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        // Ensure lane exists (kind is product routing metadata even when batcher does not re-read codeIds).
        _requirePhaseLane(params.creatorToken, _canonicalLaneKey(kind), kind);
        _requireLane(kind);

        out = batcher.finalizePhase2{value: msg.value}(params);
        emit Phase2Finalized(params.creatorToken, params.owner, kind, out.auction);
    }

    /**
     * @notice Finalize phase-2 with Permit2 signature transfer for the creator-token deposit.
     */
    function finalizePhase2WithPermit2(
        IRegistry4626.VaultKind kind,
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external payable onlyAuthorizedDeployer returns (DeploymentBatcher.Phase2Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        _requirePhaseLane(params.creatorToken, _canonicalLaneKey(kind), kind);
        _requireLane(kind);

        out = batcher.finalizePhase2WithPermit2{value: msg.value}(params, permit, signature);
        emit Phase2Finalized(params.creatorToken, params.owner, kind, out.auction);
    }

    /**
     * @notice Phase-3 yield strategies (Charm / Ajna / optional Solana strategy module).
     * @param strategyCodeIds_ Caller-supplied ids; if all zero and defaults are set, uses
     *        `defaultStrategyCodeIds`.
     */
    function startPhase3(
        IRegistry4626.VaultKind kind,
        DeploymentBatcher.Phase3Params calldata params,
        DeploymentBatcher.StrategyCodeIds calldata strategyCodeIds_
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase3Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        _requirePhaseLane(params.creatorToken, _canonicalLaneKey(kind), kind);
        _requireLane(kind);

        DeploymentBatcher.StrategyCodeIds memory ids = _resolveStrategyCodeIds(strategyCodeIds_);
        out = batcher.deployPhase3Strategies(params, ids);
        emit Phase3Started(
            params.creatorToken, params.owner, kind, params.vault, out.charmStrategy, out.ajnaStrategy
        );
    }

    // =================================
    // KEYED ECOSYSTEM LANE FACADE
    // =================================

    function startPhase1ByLane(
        bytes32 laneKey,
        DeploymentBatcher.Phase1Params calldata params,
        bytes32 shareOftSaltOverride
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase1Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        IOvaultLane lane = _requireEcosystemLane(laneKey);
        IRegistry4626.VaultKind kind = lane.kind();
        _pinPhaseLane(params.creatorToken, laneKey, kind);

        DeploymentBatcher.Phase1Params memory p = params;
        p.vaultKind = _toBatcherKind(kind);
        out = batcher.deployPhase1CoreWithSalt(p, _toBatcherCodeIds(lane.codeIds()), shareOftSaltOverride);
        _maybeRegisterGaugeSurfaceWithLane(out.vault, kind, laneKey);
        emit Phase1Started(p.creatorToken, p.owner, kind, out.vault, out.wrapper);
    }

    function finalizePhase1ByLane(
        bytes32 laneKey,
        DeploymentBatcher.Phase1Params calldata params,
        bytes32 shareOftSaltOverride
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase1Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        IOvaultLane lane = _requireEcosystemLane(laneKey);
        IRegistry4626.VaultKind kind = lane.kind();
        _requirePhaseLane(params.creatorToken, laneKey, kind);

        DeploymentBatcher.Phase1Params memory p = params;
        p.vaultKind = _toBatcherKind(kind);
        out = batcher.finalizePhase1WithSalt(p, _toBatcherCodeIds(lane.codeIds()), shareOftSaltOverride);
        emit Phase1Finalized(p.creatorToken, p.owner, kind, out.shareOFT);
    }

    function startPhase2ByLane(bytes32 laneKey, DeploymentBatcher.Phase2CoreParams calldata params)
        external
        onlyAuthorizedDeployer
        returns (DeploymentBatcher.Phase2Result memory out)
    {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        IOvaultLane lane = _requireEcosystemLane(laneKey);
        IRegistry4626.VaultKind kind = lane.kind();
        _requirePhaseLane(params.creatorToken, laneKey, kind);
        out = batcher.deployPhase2Core(params, _toBatcherCodeIds(lane.codeIds()));
        emit Phase2CoreStarted(
            params.creatorToken, params.owner, kind, out.gaugeController, out.ccaLaunchArm, out.oracle
        );
    }

    function startPhase2WithRolePolicyByLane(
        bytes32 laneKey,
        DeploymentBatcher.Phase2CoreParams calldata params,
        uint256 rolePolicyId
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase2Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        IOvaultLane lane = _requireEcosystemLane(laneKey);
        IRegistry4626.VaultKind kind = lane.kind();
        _requirePhaseLane(params.creatorToken, laneKey, kind);
        out = batcher.deployPhase2CoreWithRolePolicy(params, _toBatcherCodeIds(lane.codeIds()), rolePolicyId);
        emit Phase2CoreStarted(
            params.creatorToken, params.owner, kind, out.gaugeController, out.ccaLaunchArm, out.oracle
        );
    }

    function finalizePhase2ByLane(bytes32 laneKey, DeploymentBatcher.Phase2FinalizeParams calldata params)
        external
        payable
        onlyAuthorizedDeployer
        returns (DeploymentBatcher.Phase2Result memory out)
    {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        IOvaultLane lane = _requireEcosystemLane(laneKey);
        IRegistry4626.VaultKind kind = lane.kind();
        _requirePhaseLane(params.creatorToken, laneKey, kind);
        out = batcher.finalizePhase2{value: msg.value}(params);
        emit Phase2Finalized(params.creatorToken, params.owner, kind, out.auction);
    }

    function finalizePhase2WithPermit2ByLane(
        bytes32 laneKey,
        DeploymentBatcher.Phase2FinalizeParams calldata params,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external payable onlyAuthorizedDeployer returns (DeploymentBatcher.Phase2Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        IOvaultLane lane = _requireEcosystemLane(laneKey);
        IRegistry4626.VaultKind kind = lane.kind();
        _requirePhaseLane(params.creatorToken, laneKey, kind);
        out = batcher.finalizePhase2WithPermit2{value: msg.value}(params, permit, signature);
        emit Phase2Finalized(params.creatorToken, params.owner, kind, out.auction);
    }

    function startPhase3ByLane(
        bytes32 laneKey,
        DeploymentBatcher.Phase3Params calldata params,
        DeploymentBatcher.StrategyCodeIds calldata strategyCodeIds_
    ) external onlyAuthorizedDeployer returns (DeploymentBatcher.Phase3Result memory out) {
        DeploymentBatcher batcher = deploymentBatcher;
        if (address(batcher) == address(0)) revert BatcherNotConfigured();
        IOvaultLane lane = _requireEcosystemLane(laneKey);
        IRegistry4626.VaultKind kind = lane.kind();
        _requirePhaseLane(params.creatorToken, laneKey, kind);
        out = batcher.deployPhase3Strategies(params, _resolveStrategyCodeIds(strategyCodeIds_));
        emit Phase3Started(
            params.creatorToken, params.owner, kind, params.vault, out.charmStrategy, out.ajnaStrategy
        );
    }

    // =================================
    // REGISTRATION (legacy / post-hoc)
    // =================================

    /**
     * @notice Register an already-deployed stack (defaults vaultKind = Creator).
     */
    function registerDeployment(
        address _creatorCoin,
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _gaugeController,
        address _ccaLaunchArm,
        address _oracle,
        address _creator
    ) external onlyAuthorizedDeployer {
        _registerDeployment(
            _creatorCoin,
            _vault,
            _wrapper,
            _shareOFT,
            _gaugeController,
            _ccaLaunchArm,
            _oracle,
            _creator,
            IRegistry4626.VaultKind.Creator
        );
    }

    /**
     * @notice Register an already-deployed stack with explicit vault kind.
     */
    function registerDeploymentWithKind(
        address _token,
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _gaugeController,
        address _ccaLaunchArm,
        address _oracle,
        address _owner,
        IRegistry4626.VaultKind kind
    ) external onlyAuthorizedDeployer {
        _registerDeployment(
            _token, _vault, _wrapper, _shareOFT, _gaugeController, _ccaLaunchArm, _oracle, _owner, kind
        );
    }

    // =================================
    // INTERNAL
    // =================================

    function _requireLane(IRegistry4626.VaultKind kind) internal view returns (IOvaultLane lane) {
        address laneAddr = laneOf[kind];
        if (laneAddr == address(0)) revert LaneNotConfigured(kind);
        return IOvaultLane(laneAddr);
    }

    function _requireEcosystemLane(bytes32 laneKey) internal view returns (IOvaultLane lane) {
        address laneAddr = ecosystemLaneOf[laneKey];
        if (laneAddr == address(0)) revert EcosystemLaneNotConfigured(laneKey);
        return IOvaultLane(laneAddr);
    }

    function _canonicalLaneKey(IRegistry4626.VaultKind kind) internal pure returns (bytes32) {
        return kind == IRegistry4626.VaultKind.Agent ? AGENT_LANE_KEY : CREATOR_LANE_KEY;
    }

    function _pinPhaseLane(address token, bytes32 laneKey, IRegistry4626.VaultKind kind) internal {
        _pinPhaseKind(token, kind);
        if (hasPhaseLaneKey[token] && phaseLaneKeyByToken[token] != laneKey) {
            revert PhaseLaneKeyMismatch(token, phaseLaneKeyByToken[token], laneKey);
        }
        phaseLaneKeyByToken[token] = laneKey;
        hasPhaseLaneKey[token] = true;
    }

    function _requirePhaseLane(address token, bytes32 laneKey, IRegistry4626.VaultKind kind) internal view {
        _requirePhaseKind(token, kind);
        if (hasPhaseLaneKey[token] && phaseLaneKeyByToken[token] != laneKey) {
            revert PhaseLaneKeyMismatch(token, phaseLaneKeyByToken[token], laneKey);
        }
    }

    /// @dev Pin lane kind at Phase 1; reject later phase calls (or re-start) with a different kind.
    function _pinPhaseKind(address token, IRegistry4626.VaultKind kind) internal {
        if (token == address(0)) revert ZeroAddress();
        if (hasPhaseKind[token] && phaseKindByToken[token] != kind) {
            revert PhaseKindMismatch(token, phaseKindByToken[token], kind);
        }
        phaseKindByToken[token] = kind;
        hasPhaseKind[token] = true;
    }

    /// @dev When Phase 1 ran through this factory, later phases must use the same kind.
    ///      Tokens never started here (legacy/out-of-band) are not constrained.
    function _requirePhaseKind(address token, IRegistry4626.VaultKind kind) internal view {
        if (hasPhaseKind[token] && phaseKindByToken[token] != kind) {
            revert PhaseKindMismatch(token, phaseKindByToken[token], kind);
        }
    }

    function _toBatcherKind(IRegistry4626.VaultKind kind) internal pure returns (DeploymentBatcher.VaultKind) {
        if (kind == IRegistry4626.VaultKind.Agent) {
            return DeploymentBatcher.VaultKind.Agent;
        }
        return DeploymentBatcher.VaultKind.Creator;
    }

    function _toBatcherCodeIds(IOvaultLane.CodeIds memory ids)
        internal
        pure
        returns (DeploymentBatcher.CodeIds memory out)
    {
        out = DeploymentBatcher.CodeIds({
            vault: ids.vault,
            wrapper: ids.wrapper,
            shareOFT: ids.shareOFT,
            gauge: ids.gauge,
            cca: ids.cca,
            oracle: ids.oracle,
            oftBootstrap: ids.oftBootstrap
        });
    }

    function _resolveStrategyCodeIds(DeploymentBatcher.StrategyCodeIds calldata passed)
        internal
        view
        returns (DeploymentBatcher.StrategyCodeIds memory ids)
    {
        bool passedEmpty = passed.charmAlphaVaultDeploy == bytes32(0) && passed.charmStrategy4626 == bytes32(0)
            && passed.ajnaVaultAuth == bytes32(0) && passed.ajnaVault == bytes32(0)
            && passed.erc4626StrategyAdapter == bytes32(0) && passed.solanaStrategy == bytes32(0);
        if (!passedEmpty) {
            return passed;
        }
        if (!defaultStrategyCodeIdsSet) revert StrategyCodeIdsNotConfigured();
        return defaultStrategyCodeIds;
    }

    function _registerDeployment(
        address _token,
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _gaugeController,
        address _ccaLaunchArm,
        address _oracle,
        address _owner,
        IRegistry4626.VaultKind kind
    ) internal {
        if (_token == address(0)) revert ZeroAddress();
        if (deployments[_token].exists) revert AlreadyDeployed();
        require(_vault.code.length > 0, "vault has no code");
        require(_wrapper.code.length > 0, "wrapper has no code");
        require(_shareOFT.code.length > 0, "shareOFT has no code");

        DeploymentInfo memory info = DeploymentInfo({
            creatorCoin: _token,
            vault: _vault,
            wrapper: _wrapper,
            shareOFT: _shareOFT,
            gaugeController: _gaugeController,
            ccaLaunchArm: _ccaLaunchArm,
            oracle: _oracle,
            creator: _owner,
            deployedAt: block.timestamp,
            exists: true,
            vaultKind: kind
        });

        deployments[_token] = info;
        deployedTokens.push(_token);
        deploymentCount++;

        if (address(registry) != address(0)) {
            _registerWithRegistry(_token, _vault, _wrapper, _shareOFT, _oracle, _gaugeController, _owner, kind);
        }

        emit DeploymentRegistered(
            _token, _vault, _wrapper, _shareOFT, _gaugeController, _ccaLaunchArm, _oracle, _owner
        );
        emit DeploymentRegisteredWithKind(_token, _vault, kind, _owner);

        // Hermes-style gauge surface: vault is the gauge id for votes / bribes / streams.
        _maybeRegisterGaugeSurface(_vault, kind);
    }

    /// @dev Fail-loud when `surfaceRegistry` is set. Idempotent if already registered (phase1 + post-hoc).
    function _maybeRegisterGaugeSurface(address vault, IRegistry4626.VaultKind kind) internal {
        _maybeRegisterGaugeSurfaceWithLane(vault, kind, _canonicalLaneKey(kind));
    }

    function _maybeRegisterGaugeSurfaceWithLane(
        address vault,
        IRegistry4626.VaultKind kind,
        bytes32 laneKey
    ) internal {
        if (address(surfaceRegistry) == address(0) || vault == address(0)) return;
        if (surfaceRegistry.isRegistered(vault)) return;
        surfaceRegistry.registerSurface(vault, kind, laneKey, true, true, true);
    }

    function _registerWithRegistry(
        address _token,
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _oracle,
        address _gaugeController,
        address _owner,
        IRegistry4626.VaultKind kind
    ) internal {
        (bool success, bytes memory data) = _token.staticcall(abi.encodeWithSignature("name()"));
        string memory name = success ? abi.decode(data, (string)) : "Unknown";

        (success, data) = _token.staticcall(abi.encodeWithSignature("symbol()"));
        string memory symbol = success ? abi.decode(data, (string)) : "UNK";

        registry.registerToken(_token, name, symbol, _owner, address(0), 0);
        registry.setVault(_token, _vault);
        registry.setWrapperForToken(_token, _wrapper);
        registry.setShareOFTForToken(_token, _shareOFT);
        registry.setOracleForToken(_token, _oracle);
        registry.setGaugeControllerForToken(_token, _gaugeController);

        // Record kind so runtime getVaultKind is explicit when this factory is registry owner.
        IRegistry4626.AgentIntegrationMeta memory meta;
        meta.vaultKind = kind;
        try registry.setAgentIntegrationMeta(_token, meta) {} catch {}
    }

    // =================================
    // VIEWS
    // =================================

    function getDeployment(address _token) external view returns (DeploymentInfo memory) {
        return deployments[_token];
    }

    function getAllDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }

    function isDeployed(address _token) external view returns (bool) {
        return deployments[_token].exists;
    }

    function isAuthorizedDeployer(address _deployer) external view returns (bool) {
        return authorizedDeployers[_deployer] || _deployer == owner();
    }
}

