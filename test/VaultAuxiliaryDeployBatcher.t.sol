// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/helpers/batchers/VaultAuxiliaryDeployBatcher.sol";
import "../contracts/helpers/infra/UniversalBytecodeStoreV2.sol";
import "../contracts/utilities/routers/CreatorCoinPolicyController.sol";
import "../contracts/utilities/routers/PayoutRouter.sol";
import "../contracts/utilities/routers/VaultShareBurnStream.sol";

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

contract VaultAuxiliaryDeployBatcherTest is Test {
    address internal constant BASE_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant DEFAULT_PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B;

    bytes32 internal burnStreamCodeId;
    bytes32 internal payoutRouterCodeId;
    bytes32 internal policyControllerCodeId;

    address internal owner;
    address internal protocolTreasury;
    address internal deploymentBatcher;
    address internal swapRouter;
    MockAuxiliaryVault internal vault;
    MockAuxiliaryCreatorToken internal creatorToken;
    UniversalBytecodeStoreV2 internal store;
    MockAuxiliaryCreate2Deployer internal create2;
    VaultAuxiliaryDeployBatcher internal auxBatcher;

    function setUp() public {
        vm.chainId(8453);
        vm.etch(DEFAULT_PROTOCOL_REWARDS, hex"00");

        owner = makeAddr("owner");
        protocolTreasury = makeAddr("protocolTreasury");
        deploymentBatcher = makeAddr("deploymentBatcher");
        swapRouter = makeAddr("swapRouter");
        vault = new MockAuxiliaryVault(owner);
        creatorToken = new MockAuxiliaryCreatorToken();

        store = new UniversalBytecodeStoreV2();
        create2 = new MockAuxiliaryCreate2Deployer(address(store), protocolTreasury);

        (burnStreamCodeId,) = store.store(type(VaultShareBurnStream).creationCode);
        (payoutRouterCodeId,) = store.store(type(PayoutRouter).creationCode);
        (policyControllerCodeId,) = store.store(type(CreatorCoinPolicyController).creationCode);

        auxBatcher = new VaultAuxiliaryDeployBatcher(
            address(create2),
            address(store),
            deploymentBatcher,
            protocolTreasury,
            swapRouter
        );

        vm.prank(protocolTreasury);
        create2.setAuthorizedDeployer(address(auxBatcher), true);
    }

    function test_directCreatorCreate2DeployStillBlocked() public {
        bytes32 salt = keccak256(abi.encodePacked("4626:VaultShareBurnStream", address(creatorToken), owner));
        bytes memory args = abi.encode(address(vault));

        vm.expectRevert(MockAuxiliaryCreate2Deployer.NotAuthorizedDeployer.selector);
        vm.prank(owner);
        create2.deploy(salt, burnStreamCodeId, args);
    }

    function test_ownerCanRouteAuxiliaryCreate2DeploysThroughAuthorizedHelper() public {
        VaultAuxiliaryDeployBatcher.Params memory params = VaultAuxiliaryDeployBatcher.Params({
            creatorToken: address(creatorToken),
            owner: owner,
            vault: address(vault),
            swapRouter: swapRouter,
            weth: BASE_WETH,
            protocolRewards: address(0)
        });
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = VaultAuxiliaryDeployBatcher.CodeIds({
            vaultShareBurnStream: burnStreamCodeId,
            payoutRouter: payoutRouterCodeId,
            creatorCoinPolicyController: policyControllerCodeId
        });

        VaultAuxiliaryDeployBatcher.Result memory out = auxBatcher.deployPhase2Auxiliaries(params, codeIds);

        assertGt(out.burnStream.code.length, 0, "burn stream deployed");
        assertGt(out.payoutRouter.code.length, 0, "payout router deployed");
        assertGt(out.creatorCoinPolicyController.code.length, 0, "policy controller deployed");
        assertEq(PayoutRouter(payable(out.payoutRouter)).owner(), protocolTreasury, "router owned by protocol");
        assertEq(CreatorCoinPolicyController(out.creatorCoinPolicyController).owner(), protocolTreasury, "policy owned by protocol");
    }

    function test_rejectsUnownedVault() public {
        VaultAuxiliaryDeployBatcher.Params memory params = VaultAuxiliaryDeployBatcher.Params({
            creatorToken: address(creatorToken),
            owner: makeAddr("notOwner"),
            vault: address(vault),
            swapRouter: swapRouter,
            weth: BASE_WETH,
            protocolRewards: address(0)
        });
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = VaultAuxiliaryDeployBatcher.CodeIds({
            vaultShareBurnStream: burnStreamCodeId,
            payoutRouter: payoutRouterCodeId,
            creatorCoinPolicyController: policyControllerCodeId
        });

        vm.expectRevert(VaultAuxiliaryDeployBatcher.NotOwner.selector);
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }

    function test_rejectsUnapprovedAuxiliaryRuntimeConfig() public {
        VaultAuxiliaryDeployBatcher.Params memory params = VaultAuxiliaryDeployBatcher.Params({
            creatorToken: address(creatorToken),
            owner: owner,
            vault: address(vault),
            swapRouter: makeAddr("unapprovedRouter"),
            weth: BASE_WETH,
            protocolRewards: address(0)
        });
        VaultAuxiliaryDeployBatcher.CodeIds memory codeIds = VaultAuxiliaryDeployBatcher.CodeIds({
            vaultShareBurnStream: burnStreamCodeId,
            payoutRouter: payoutRouterCodeId,
            creatorCoinPolicyController: policyControllerCodeId
        });

        vm.expectRevert(VaultAuxiliaryDeployBatcher.InvalidAuxiliaryConfig.selector);
        auxBatcher.deployPhase2Auxiliaries(params, codeIds);
    }
}
