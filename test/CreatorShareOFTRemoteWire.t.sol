// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {CreatorShareOFT} from "@4626/creator/messaging/CreatorShareOFT.sol";
import {OFTBootstrapRegistry} from "@4626/shared/deploy/infra/OFTBootstrapRegistry.sol";
import {UniversalBytecodeStore} from "@4626/shared/deploy/infra/UniversalBytecodeStore.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";

contract MockRobinhoodLzEndpoint {
    function setDelegate(address) external {}
}

contract CreatorShareOFTRemoteWireTest is Test {
    uint256 internal constant ROBINHOOD_CHAIN_ID = 4663;

    address internal constant ROBINHOOD_LZ_ENDPOINT = 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B;

    address internal constant PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address internal constant BASE_BATCHER = 0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33;

    bytes32 internal constant OFT_BOOTSTRAP_SALT = keccak256("4626:OFTBootstrapRegistry:v1");

    function setUp() external {
        MockRobinhoodLzEndpoint endpoint = new MockRobinhoodLzEndpoint();
        vm.etch(ROBINHOOD_LZ_ENDPOINT, address(endpoint).code);
    }

    function testProtocolTreasuryCanWireRemoteLane() external {
        vm.chainId(ROBINHOOD_CHAIN_ID);
        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();
        CreatorShareOFT oft = new CreatorShareOFT("Test Shares", unicode"■TEST", address(bootstrap), BASE_BATCHER);

        vm.prank(PROTOCOL_TREASURY);
        oft.setHubConfig(false, 30184, address(0x1234));

        assertFalse(oft.isHub());
        assertEq(oft.hubEid(), 30184);
        assertEq(oft.hubGaugeReceiver(), address(0x1234));
    }

    function testNonTreasuryCannotWireRemoteLane() external {
        vm.chainId(ROBINHOOD_CHAIN_ID);
        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();
        CreatorShareOFT oft = new CreatorShareOFT("Test Shares", unicode"■TEST", address(bootstrap), BASE_BATCHER);

        vm.expectRevert(CreatorShareOFT.NotRemoteProtocolWireAuthority.selector);
        vm.prank(address(0xBEEF));
        oft.setHubConfig(false, 30184, address(0x1234));
    }

    function testShareOftCreate2AddressMatchesAcrossChainIds() external {
        (UniversalCreate2DeployerFromStore deployer, UniversalBytecodeStore store,) = _deployInfra();
        bytes32 shareOftId = keccak256(type(CreatorShareOFT).creationCode);

        store.store(type(OFTBootstrapRegistry).creationCode);
        store.store(type(CreatorShareOFT).creationCode);

        bytes32 bootstrapInitCodeHash = keccak256(type(OFTBootstrapRegistry).creationCode);
        address bootstrapAddr = deployer.computeAddress(OFT_BOOTSTRAP_SALT, bootstrapInitCodeHash);

        bytes memory shareArgs =
            abi.encode("Test Shares", unicode"■TEST", bootstrapAddr, BASE_BATCHER);
        bytes32 shareInitCodeHash = keccak256(bytes.concat(store.get(shareOftId), shareArgs));
        bytes32 shareSalt = keccak256("test-share-salt");

        vm.chainId(8453);
        address baseShare = deployer.computeAddress(shareSalt, shareInitCodeHash);

        vm.chainId(ROBINHOOD_CHAIN_ID);
        address robinhoodShare = deployer.computeAddress(shareSalt, shareInitCodeHash);

        assertEq(baseShare, robinhoodShare);
    }

    function _deployInfra()
        internal
        returns (UniversalCreate2DeployerFromStore deployer, UniversalBytecodeStore store, address owner)
    {
        owner = address(this);
        store = new UniversalBytecodeStore();
        deployer = new UniversalCreate2DeployerFromStore(address(store), owner);
    }
}
