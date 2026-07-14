// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "@4626/shared/deploy/batchers/VaultAuxiliaryDeployBatcher.sol";
import "@4626/shared/deploy/infra/UniversalBytecodeStoreV2.sol";
import "@4626/creator/revenue/CreatorCoinPolicyController.sol";
import "@4626/creator/revenue/CreatorPayoutRouter.sol";
import "@4626/agent/revenue/AgentRevenuePolicyController.sol";
import "@4626/shared/distribution/VaultShareBurnStream.sol";

contract MockAuxiliaryVault {
    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }
}

contract MockAuxiliaryCreate2Deployer {
    UniversalBytecodeStoreV2 public immutable store;
    address public immutable owner;
    mapping(address => bool) public authorizedDeployers;

    error NotAuthorizedDeployer();
    error CodeNotFound(bytes32 codeId);
    error DeployFailed();

    constructor(address store_, address owner_) {
        store = UniversalBytecodeStoreV2(store_);
        owner = owner_;
    }

    function setAuthorizedDeployer(address deployer, bool allowed) external {
        require(msg.sender == owner, "Not owner");
        authorizedDeployers[deployer] = allowed;
    }

    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr) {
        if (msg.sender != owner && !authorizedDeployers[msg.sender]) revert NotAuthorizedDeployer();
        if (store.pointers(codeId) == address(0)) revert CodeNotFound(codeId);
        bytes memory initCode = bytes.concat(store.get(codeId), constructorArgs);
        assembly ("memory-safe") {
            addr := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (addr == address(0)) revert DeployFailed();
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}

contract MockAuxiliaryCreatorToken {
    function approve(address, uint256) external pure returns (bool) {
        return true;
    }
}

contract MockDeploymentBatcherCodeAllowlist {
    mapping(bytes32 => bool) public approvedCodeIds;
    bool public codeIdAllowlistEnabled = true;

    error CodeIdNotApproved(bytes32 codeId);

    function setApprovedCodeId(bytes32 codeId, bool approved) external {
        approvedCodeIds[codeId] = approved;
    }

    function requireApprovedCodeId(bytes32 codeId) external view {
        if (!codeIdAllowlistEnabled) return;
        if (!approvedCodeIds[codeId]) revert CodeIdNotApproved(codeId);
    }
}

interface IOwnableView {
    function owner() external view returns (address);
}

contract VaultAuxiliaryDeployBatcherTest is Test {
    address internal constant BASE_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant DEFAULT_PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B;

    bytes32 internal burnStreamCodeId;
    bytes32 internal creatorRouterCodeId;
    bytes32 internal creatorPolicyCodeId;
    bytes32 internal agentRouterCodeId;
    bytes32 internal agentPolicyCodeId;

    address internal owner;
    address internal protocolTreasury;
    address internal swapRouter;
    MockAuxiliaryVault internal vault;
    MockAuxiliaryCreatorToken internal assetToken;
    MockAuxiliaryCreatorToken internal shareOftToken;
    UniversalBytecodeStoreV2 internal store;
    MockAuxiliaryCreate2Deployer internal create2;
    MockDeploymentBatcherCodeAllowlist internal deploymentBatcher;
    VaultAuxiliaryDeployBatcher internal auxBatcher;

    function setUp() public {
        vm.chainId(8453);
        vm.etch(DEFAULT_PROTOCOL_REWARDS, hex"00");

        owner = makeAddr("owner");
        protocolTreasury = makeAddr("protocolTreasury");
        swapRouter = makeAddr("swapRouter");
        vault = new MockAuxiliaryVault(owner);
        assetToken = new MockAuxiliaryCreatorToken();
        shareOftToken = new MockAuxiliaryCreatorToken();

        store = new UniversalBytecodeStoreV2();
        create2 = new MockAuxiliaryCreate2Deployer(address(store), protocolTreasury);
        deploymentBatcher = new MockDeploymentBatcherCodeAllowlist();

        (burnStreamCodeId,) = store.store(type(VaultShareBurnStream).creationCode);
        (creatorRouterCodeId,) = store.store(type(CreatorPayoutRouter).creationCode);
        (creatorPolicyCodeId,) = store.store(type(CreatorCoinPolicyController).creationCode);
        // Avoid importing AgentRevenueRouter.sol alongside CreatorPayoutRouter (duplicate local interfaces).
        (agentRouterCodeId,) = store.store(vm.getCode("AgentRevenueRouter.sol:AgentRevenueRouter"));
        (agentPolicyCodeId,) = store.store(type(AgentRevenuePolicyController).creationCode);

        deploymentBatcher.setApprovedCodeId(burnStreamCodeId, true);
        deploymentBatcher.setApprovedCodeId(creatorRouterCodeId, true);
        deploymentBatcher.setApprovedCodeId(creatorPolicyCodeId, true);
        deploymentBatcher.setApprovedCodeId(agentRouterCodeId, true);
        deploymentBatcher.setApprovedCodeId(agentPolicyCodeId, true);

        auxBatcher = new VaultAuxiliaryDeployBatcher(
            address(create2),
            address(store),
            address(deploymentBatcher),
            protocolTreasury,
            swapRouter,
            burnStreamCodeId,
            creatorRouterCodeId,
            agentRouterCodeId,
            creatorPolicyCodeId,
            agentPolicyCodeId
        );

        vm.prank(protocolTreasury);
        create2.setAuthorizedDeployer(address(auxBatcher), true);
    }

    function _creatorParams() internal returns (VaultAuxiliaryDeployBatcher.Params memory) {
        return VaultAuxiliaryDeployBatcher.Params({
            assetToken: address(assetToken),
            owner: owner,
            vault: address(vault),
            shareOFT: address(shareOftToken),
            wrapper: makeAddr("wrapper"),
            swapRouter: swapRouter,
            weth: BASE_WETH,
            protocolRewards: address(0),
            vaultKind: VaultAuxiliaryDeployBatcher(address(auxBatcher)).VAULT_KIND_CREATOR()
        });
    }

    function _creatorCodeIds() internal view returns (VaultAuxiliaryDeployBatcher.CodeIds memory) {
        return VaultAuxiliaryDeployBatcher.CodeIds({
            vaultShareBurnStream: burnStreamCodeId,
            revenueRouter: creatorRouterCodeId,
            revenuePolicyController: creatorPolicyCodeId
        });
    }

    function _agentCodeIds() internal view returns (VaultAuxiliaryDeployBatcher.CodeIds memory) {
        return VaultAuxiliaryDeployBatcher.CodeIds({
            vaultShareBurnStream: burnStreamCodeId,
            revenueRouter: agentRouterCodeId,
            revenuePolicyController: agentPolicyCodeId
        });
    }

    function test_directCreatorCreate2DeployStillBlocked() public {
        bytes32 salt = keccak256(abi.encodePacked("4626:VaultShareBurnStream", address(assetToken), owner));
        bytes memory args = abi.encode(address(vault));

        vm.expectRevert(MockAuxiliaryCreate2Deployer.NotAuthorizedDeployer.selector);
        vm.prank(owner);
        create2.deploy(salt, burnStreamCodeId, args);
    }

    function test_ownerCanRouteCreatorAuxiliaryCreate2Deploys() public {
        VaultAuxiliaryDeployBatcher.Result memory out =
            auxBatcher.deployPhase2Auxiliaries(_creatorParams(), _creatorCodeIds());

        assertGt(out.burnStream.code.length, 0, "burn stream deployed");
        assertGt(out.revenueRouter.code.length, 0, "router deployed");
        assertGt(out.revenuePolicyController.code.length, 0, "policy controller deployed");
        assertEq(IOwnableView(out.revenueRouter).owner(), protocolTreasury, "router owned by protocol");
        assertEq(
            CreatorCoinPolicyController(out.revenuePolicyController).owner(),
            protocolTreasury,
            "policy owned by protocol"
        );
    }

    function test_ownerCanRouteAgentAuxiliaryCreate2Deploys() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        params.vaultKind = VaultAuxiliaryDeployBatcher(address(auxBatcher)).VAULT_KIND_AGENT();

        VaultAuxiliaryDeployBatcher.Result memory out = auxBatcher.deployPhase2Auxiliaries(params, _agentCodeIds());

        assertGt(out.burnStream.code.length, 0, "burn stream deployed");
        assertGt(out.revenueRouter.code.length, 0, "agent router deployed");
        assertGt(out.revenuePolicyController.code.length, 0, "agent policy deployed");
        assertEq(IOwnableView(out.revenueRouter).owner(), protocolTreasury);
        assertEq(AgentRevenuePolicyController(out.revenuePolicyController).owner(), protocolTreasury);
        assertEq(AgentRevenuePolicyController(out.revenuePolicyController).agentToken(), address(assetToken));
        assertEq(AgentRevenuePolicyController(out.revenuePolicyController).agentRevenueRouter(), out.revenueRouter);
    }

    function test_idempotentCreatorRedeployReusesExistingAuxiliaries() public {
        VaultAuxiliaryDeployBatcher.Result memory first =
            auxBatcher.deployPhase2Auxiliaries(_creatorParams(), _creatorCodeIds());
        VaultAuxiliaryDeployBatcher.Result memory second =
            auxBatcher.deployPhase2Auxiliaries(_creatorParams(), _creatorCodeIds());

        assertEq(second.burnStream, first.burnStream);
        assertEq(second.revenueRouter, first.revenueRouter);
        assertEq(second.revenuePolicyController, first.revenuePolicyController);
    }

    function test_rejectsCreatorVaultKindWithAgentRouterCodeId() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = _creatorCodeIds();
        codeIds.revenueRouter = agentRouterCodeId;

        vm.expectRevert(
            abi.encodeWithSelector(
                VaultAuxiliaryDeployBatcher.CodeIdKindMismatch.selector, creatorRouterCodeId, agentRouterCodeId
            )
        );
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_rejectsAgentVaultKindWithCreatorPolicyCodeId() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        params.vaultKind = VaultAuxiliaryDeployBatcher(address(auxBatcher)).VAULT_KIND_AGENT();
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = _agentCodeIds();
        codeIds.revenuePolicyController = creatorPolicyCodeId;

        vm.expectRevert(
            abi.encodeWithSelector(
                VaultAuxiliaryDeployBatcher.CodeIdKindMismatch.selector, agentPolicyCodeId, creatorPolicyCodeId
            )
        );
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_rejectsWrongSharedBurnStreamCodeId() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = _creatorCodeIds();
        bytes32 wrongBurn = bytes32(uint256(1));
        codeIds.vaultShareBurnStream = wrongBurn;

        vm.expectRevert(
            abi.encodeWithSelector(
                VaultAuxiliaryDeployBatcher.CodeIdKindMismatch.selector, burnStreamCodeId, wrongBurn
            )
        );
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_rejectsUnapprovedCodeId() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = _creatorCodeIds();
        deploymentBatcher.setApprovedCodeId(creatorRouterCodeId, false);

        vm.expectRevert(
            abi.encodeWithSelector(MockDeploymentBatcherCodeAllowlist.CodeIdNotApproved.selector, creatorRouterCodeId)
        );
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_rejectsUnownedVault() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = _creatorCodeIds();
        params.owner = makeAddr("notOwner");

        vm.expectRevert(VaultAuxiliaryDeployBatcher.NotOwner.selector);
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_rejectsUnapprovedAuxiliaryRuntimeConfig() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = _creatorCodeIds();
        params.swapRouter = makeAddr("unapprovedRouter");

        vm.expectRevert(VaultAuxiliaryDeployBatcher.InvalidAuxiliaryConfig.selector);
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_rejectsInvalidVaultKind() public {
        VaultAuxiliaryDeployBatcher.Params memory params = _creatorParams();
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = _creatorCodeIds();
        params.vaultKind = 9;

        vm.expectRevert(abi.encodeWithSelector(VaultAuxiliaryDeployBatcher.InvalidVaultKind.selector, uint8(9)));
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_agentAndCreatorRouterSaltsDiverge() public {
        bytes32 creatorSalt =
            keccak256(abi.encodePacked("4626:CreatorPayoutRouter", address(assetToken), owner));
        bytes32 agentSalt = keccak256(abi.encodePacked("4626:AgentRevenueRouter", address(assetToken), owner));
        assertTrue(creatorSalt != agentSalt);
    }

    function test_pinnedCodeIdGettersMatchConstructor() public view {
        assertEq(auxBatcher.vaultShareBurnStreamCodeId(), burnStreamCodeId);
        assertEq(auxBatcher.creatorRevenueRouterCodeId(), creatorRouterCodeId);
        assertEq(auxBatcher.agentRevenueRouterCodeId(), agentRouterCodeId);
        assertEq(auxBatcher.creatorRevenuePolicyControllerCodeId(), creatorPolicyCodeId);
        assertEq(auxBatcher.agentRevenuePolicyControllerCodeId(), agentPolicyCodeId);
    }
}
