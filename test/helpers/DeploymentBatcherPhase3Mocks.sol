// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/helpers/batchers/DeploymentBatcher.sol";

contract MockUniswapV3PoolForPhase3 {
    uint160 public lastSqrtPriceX96;

    function initialize(uint160 sqrtPriceX96) external {
        lastSqrtPriceX96 = sqrtPriceX96;
    }
}

contract MockUniswapV3FactoryForPhase3 {
    address public pool;

    function setPool(address pool_) external {
        pool = pool_;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return pool;
    }

    function createPool(address, address, uint24) external returns (address createdPool) {
        createdPool = address(new MockUniswapV3PoolForPhase3());
        pool = createdPool;
    }
}

contract MockAjnaPoolFactoryForPhase3 {
    address public pool;

    constructor(address pool_) {
        pool = pool_;
    }

    function ERC20_NON_SUBSET_HASH() external pure returns (bytes32) {
        return bytes32(uint256(1));
    }

    function deployedPools(bytes32, address, address) external view returns (address) {
        return pool;
    }

    function deployPool(address, address, uint256) external view returns (address) {
        return pool;
    }

    function MIN_RATE() external pure returns (uint256) {
        return 1e16;
    }

    function MAX_RATE() external pure returns (uint256) {
        return 1e17;
    }
}

contract MockOwnableTransferForPhase3 {
    address public lastOwner;

    function transferOwnership(address newOwner) external virtual {
        lastOwner = newOwner;
    }
}

contract MockCharmStrategyForPhase3 is MockOwnableTransferForPhase3 {
    bool public approvalsInitialized;
    address public creatorOracle;
    address public ajnaPool;
    bool public ajnaBorrowEnabled;
    uint256 public ajnaMaxDebt;
    uint256 public ajnaMaxBorrowPerWithdraw;
    uint256 public ajnaMinCollateralRatioBps;

    function initializeApprovals() external {
        approvalsInitialized = true;
    }

    function setCreatorOracle(address _creatorOracle) external {
        creatorOracle = _creatorOracle;
    }

    function setAjnaPool(address _ajnaPool) external {
        ajnaPool = _ajnaPool;
    }

    function setAjnaBorrowConfig(
        bool _enabled,
        uint256 _maxDebt,
        uint256 _maxBorrowPerWithdraw,
        uint256 _minCollateralRatioBps,
        uint256,
        uint256
    ) external {
        ajnaBorrowEnabled = _enabled;
        ajnaMaxDebt = _maxDebt;
        ajnaMaxBorrowPerWithdraw = _maxBorrowPerWithdraw;
        ajnaMinCollateralRatioBps = _minCollateralRatioBps;
    }
}

contract MockAjnaVaultAuthForPhase3 {
    address public admin;
    uint256 public bufferRatio;
    uint256 public minBucketIndex;
    mapping(address => bool) public keepers;
    address public swapper;

    function setBufferRatio(uint256 ratio) external {
        bufferRatio = ratio;
    }

    function setMinBucketIndex(uint256 index) external {
        minBucketIndex = index;
    }

    function setKeeper(address keeper, bool status) external {
        keepers[keeper] = status;
    }

    function setSwapper(address nextSwapper) external {
        swapper = nextSwapper;
    }

    function setAdmin(address nextAdmin) external {
        admin = nextAdmin;
    }

    function isAdmin(address account) external view returns (bool) {
        return admin == address(0) || admin == account;
    }

    function transferAdmin(address nextAdmin) external {
        admin = nextAdmin;
    }
}

contract MockAjnaAdapterForPhase3 is MockOwnableTransferForPhase3 {
    uint256 public idleBufferBps;

    function setIdleBufferBps(uint256 newBps) external {
        idleBufferBps = newBps;
    }
}

contract MockVaultStrategyManagerForPhase3 {
    address public owner;
    address public managementAddress;
    address[] public strategies;
    uint256[] public weights;
    bool public autoAllocate;

    error Unauthorized();

    constructor(address owner_) {
        owner = owner_;
        managementAddress = owner_;
    }

    function addStrategy(address strategy, uint256 weight) external {
        if (msg.sender != managementAddress && msg.sender != owner) revert Unauthorized();
        strategies.push(strategy);
        weights.push(weight);
    }

    function setAutoAllocate(bool enabled) external {
        if (msg.sender != managementAddress && msg.sender != owner) revert Unauthorized();
        autoAllocate = enabled;
    }

    function management() external view returns (address) {
        return managementAddress;
    }

    function setManagement(address account) external {
        managementAddress = account;
    }

    function strategyCount() external view returns (uint256) {
        return strategies.length;
    }
}

contract MockCharmVaultForPhase3 {
    address public manager;

    constructor(address manager_) {
        manager = manager_;
    }
}

contract MockCreate2DeployerForPhase3 is IUniversalCreate2DeployerFromStore {
    mapping(bytes32 => address) public deployments;

    function setDeployment(bytes32 codeId, address deployed) external {
        deployments[codeId] = deployed;
    }

    function deploy(bytes32, bytes32 codeId, bytes calldata) external view override returns (address addr) {
        addr = deployments[codeId];
        require(addr != address(0), "missing deployment");
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external pure override returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(salt, initCodeHash)))));
    }
}
