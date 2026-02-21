// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CreatorVaultDeployer} from "../contracts/helpers/batchers/CreatorVaultDeployer.sol";
import {OFTBootstrapRegistry} from "../contracts/helpers/infra/OFTBootstrapRegistry.sol";

interface IEndpointRegistryLike {
    function getLayerZeroEndpoint(uint16 chainId) external view returns (address);
}

contract MockBytecodeStore {}

contract MockCreatorRegistry {
    address public endpoint;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function setEndpoint(address _endpoint) external {
        endpoint = _endpoint;
    }

    function getLayerZeroEndpoint(uint16) external view returns (address) {
        return endpoint;
    }
}

contract MockVault {
    address public creatorToken;
    address public owner;
    string public vaultName;
    string public vaultSymbol;

    constructor(address _creatorToken, address _owner, string memory _vaultName, string memory _vaultSymbol) {
        creatorToken = _creatorToken;
        owner = _owner;
        vaultName = _vaultName;
        vaultSymbol = _vaultSymbol;
    }

    function setWhitelist(address, bool) external {}
}

contract MockWrapper {
    address public creatorToken;
    address public vault;
    address public owner;
    address public shareOFT;

    constructor(address _creatorToken, address _vault, address _owner) {
        creatorToken = _creatorToken;
        vault = _vault;
        owner = _owner;
    }

    function setShareOFT(address _shareOFT) external {
        shareOFT = _shareOFT;
    }
}

contract MockShareOFT {
    address public constructorEndpoint;
    address public constructorRegistry;
    address public owner;
    string public shareName;
    string public shareSymbol;
    address public registry;
    address public vault;

    constructor(string memory _name, string memory _symbol, address _registry, address _owner) {
        shareName = _name;
        shareSymbol = _symbol;
        constructorRegistry = _registry;
        owner = _owner;
        constructorEndpoint = IEndpointRegistryLike(_registry).getLayerZeroEndpoint(uint16(block.chainid));
    }

    function setRegistry(address _registry) external {
        registry = _registry;
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function setMinter(address, bool) external {}

    function setHubConfig(bool, uint32, address) external {}
}

contract MockUniversalCreate2Deployer {
    bytes32 public bootstrapSalt;
    bytes32 public bootstrapCodeId;
    address public bootstrapAddress;

    mapping(bytes32 => uint8) public codeKinds;

    function configureBootstrap(bytes32 _bootstrapSalt, bytes32 _bootstrapCodeId, address _bootstrapAddress) external {
        bootstrapSalt = _bootstrapSalt;
        bootstrapCodeId = _bootstrapCodeId;
        bootstrapAddress = _bootstrapAddress;
    }

    function setCodeKind(bytes32 codeId, uint8 kind) external {
        codeKinds[codeId] = kind;
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        if (salt == bootstrapSalt && initCodeHash == bootstrapCodeId) {
            return bootstrapAddress;
        }
        return address(uint160(uint256(keccak256(abi.encodePacked("mock-address", salt, initCodeHash)))));
    }

    function deploy(bytes32, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr) {
        uint8 kind = codeKinds[codeId];
        if (kind == 1) {
            (address creatorToken, address owner, string memory vaultName, string memory vaultSymbol) =
                abi.decode(constructorArgs, (address, address, string, string));
            return address(new MockVault(creatorToken, owner, vaultName, vaultSymbol));
        }
        if (kind == 2) {
            (address creatorToken, address vault, address owner) = abi.decode(constructorArgs, (address, address, address));
            return address(new MockWrapper(creatorToken, vault, owner));
        }
        if (kind == 3) {
            (string memory name, string memory symbol, address registry, address owner) =
                abi.decode(constructorArgs, (string, string, address, address));
            return address(new MockShareOFT(name, symbol, registry, owner));
        }
        revert("unknown codeId");
    }
}

contract CreatorVaultDeployerPhase1EndpointPoisoningTest is Test {
    bytes32 internal constant VAULT_CODE_ID = bytes32(uint256(1));
    bytes32 internal constant WRAPPER_CODE_ID = bytes32(uint256(2));
    bytes32 internal constant SHARE_OFT_CODE_ID = bytes32(uint256(3));
    bytes32 internal constant OFT_BOOTSTRAP_CODE_ID = bytes32(uint256(4));
    bytes32 internal constant GAUGE_CODE_ID = bytes32(uint256(5));
    bytes32 internal constant CCA_CODE_ID = bytes32(uint256(6));
    bytes32 internal constant ORACLE_CODE_ID = bytes32(uint256(7));

    address internal constant CANONICAL_ENDPOINT = address(0x1111111111111111111111111111111111111111);
    address internal constant ATTACKER_ENDPOINT = address(0x2222222222222222222222222222222222222222);
    address internal constant ATTACKER = address(0xBEEF);

    function _oftBootstrapSalt() internal pure returns (bytes32) {
        return keccak256("CreatorVault:OFTBootstrapRegistry:v1");
    }

    function _codeIds() internal pure returns (CreatorVaultDeployer.CodeIds memory codeIds) {
        codeIds = CreatorVaultDeployer.CodeIds({
            vault: VAULT_CODE_ID,
            wrapper: WRAPPER_CODE_ID,
            shareOFT: SHARE_OFT_CODE_ID,
            gauge: GAUGE_CODE_ID,
            cca: CCA_CODE_ID,
            oracle: ORACLE_CODE_ID,
            oftBootstrap: OFT_BOOTSTRAP_CODE_ID
        });
    }

    function _phase1Params() internal view returns (CreatorVaultDeployer.Phase1Params memory params) {
        params = CreatorVaultDeployer.Phase1Params({
            creatorToken: address(0xCAFE),
            owner: address(this),
            vaultName: "Creator Vault",
            vaultSymbol: "cvTOKEN",
            shareName: "Creator Shares",
            shareSymbol: "sTOK",
            version: "v1"
        });
    }

    function _deployFixture(address bootstrapAddress)
        internal
        returns (CreatorVaultDeployer deployer, MockCreatorRegistry registry, MockUniversalCreate2Deployer create2)
    {
        registry = new MockCreatorRegistry(CANONICAL_ENDPOINT);
        MockBytecodeStore store = new MockBytecodeStore();
        create2 = new MockUniversalCreate2Deployer();
        create2.configureBootstrap(_oftBootstrapSalt(), OFT_BOOTSTRAP_CODE_ID, bootstrapAddress);
        create2.setCodeKind(VAULT_CODE_ID, 1);
        create2.setCodeKind(WRAPPER_CODE_ID, 2);
        create2.setCodeKind(SHARE_OFT_CODE_ID, 3);

        deployer = new CreatorVaultDeployer(
            address(registry),
            address(store),
            address(create2),
            address(this),
            address(0x1001),
            address(0x1002),
            address(0x1003),
            address(0x1004),
            address(0x1005),
            address(0x1006),
            address(0x1007),
            address(0x1008),
            address(0x1009),
            address(0x1010)
        );
    }

    function test_deployPhase1Core_setsBootstrapEndpointFromCanonicalRegistry() public {
        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();
        (CreatorVaultDeployer deployer,,) = _deployFixture(address(bootstrap));

        deployer.deployPhase1Core(_phase1Params(), _codeIds());

        // Bootstrap registry is intentionally write-free; it always returns the canonical LZ endpoint.
        assertEq(
            bootstrap.getLayerZeroEndpoint(uint16(block.chainid)),
            bootstrap.LZ_COMMON_ENDPOINT(),
            "bootstrap should return canonical common endpoint"
        );
    }

    function test_finalizePhase1_overwritesPoisonedBootstrapEndpointBeforeShareDeployment() public {
        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();
        (CreatorVaultDeployer deployer, MockCreatorRegistry registry,) = _deployFixture(address(bootstrap));

        deployer.deployPhase1Core(_phase1Params(), _codeIds());

        // Even if the main registry endpoint is changed (\"poisoned\"), the ShareOFT constructor binds
        // the chain-global bootstrap registry endpoint, not the mutable registry endpoint.
        vm.prank(ATTACKER);
        registry.setEndpoint(ATTACKER_ENDPOINT);

        CreatorVaultDeployer.Phase1Result memory out = deployer.finalizePhase1(_phase1Params(), _codeIds());

        assertEq(
            MockShareOFT(out.shareOFT).constructorEndpoint(),
            bootstrap.LZ_COMMON_ENDPOINT(),
            "shareOFT should bind canonical common endpoint"
        );
    }

    function test_finalizePhase1_ignoresRegistryEndpointPoisoning() public {
        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();
        (CreatorVaultDeployer deployer, MockCreatorRegistry registry,) = _deployFixture(address(bootstrap));

        deployer.deployPhase1Core(_phase1Params(), _codeIds());

        registry.setEndpoint(ATTACKER_ENDPOINT);

        CreatorVaultDeployer.Phase1Result memory out = deployer.finalizePhase1(_phase1Params(), _codeIds());
        assertEq(MockShareOFT(out.shareOFT).constructorEndpoint(), bootstrap.LZ_COMMON_ENDPOINT());
    }
}
