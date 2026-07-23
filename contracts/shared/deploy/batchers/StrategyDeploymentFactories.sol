// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@4626/shared/interfaces/external/IAjnaPool.sol";
import "@4626/shared/strategies/ERC4626StrategyAdapter.sol";
import "@4626/shared/strategies/ajna/AjnaERC4626Vault.sol";
import "@4626/shared/strategies/ajna/AjnaVaultAuth.sol";
import "@4626/shared/strategies/univ3/CharmStrategy4626.sol";

/**
 * Note: Creator* strategies are for creator lane but implement general IStrategy interfaces.
 * For agent and future ecosystems, use or add similar in shared/strategies/ or under their lane. Shared strategies should be generalized where possible.
 */

interface ICharmStrategy4626Factory {
    function deployAndInitialize(
        address creatorVault,
        address underlyingToken,
        address quoteToken,
        address uniswapRouter,
        address charmVault,
        address v3Pool,
        address owner
    ) external returns (address strategy);
}

interface IAjnaERC4626StrategyFactory {
    function deploy(
        address creatorVault,
        address underlyingToken,
        address ajnaPoolFactory,
        address quoteToken,
        address owner,
        string calldata vaultName,
        string calldata vaultSymbol,
        uint256 bufferRatioBps,
        uint256 minBucketIndex,
        address keeper
    ) external returns (address strategy, address innerVault, address auth);
}

contract CharmStrategy4626Deployer {
    function deploy(
        address creatorVault,
        address underlyingToken,
        address quoteToken,
        address uniswapRouter,
        address charmVault,
        address v3Pool,
        address owner
    ) external returns (address) {
        return address(
            new CharmStrategy4626(creatorVault, underlyingToken, quoteToken, uniswapRouter, charmVault, v3Pool, owner)
        );
    }
}

contract CharmStrategy4626Factory is ICharmStrategy4626Factory {
    CharmStrategy4626Deployer public immutable deployer;

    constructor() {
        deployer = new CharmStrategy4626Deployer();
    }

    function deployAndInitialize(
        address creatorVault,
        address underlyingToken,
        address quoteToken,
        address uniswapRouter,
        address charmVault,
        address v3Pool,
        address owner
    ) external returns (address strategy) {
        strategy = deployer.deploy(creatorVault, underlyingToken, quoteToken, uniswapRouter, charmVault, v3Pool, owner);
        CharmStrategy4626(strategy).initializeApprovals();
    }
}

contract AjnaVaultAuthDeployer {
    function deploy(address owner) external returns (address) {
        return address(new AjnaVaultAuth(owner));
    }
}

contract AjnaInnerVaultDeployer {
    function deploy(address ajnaPool, address underlyingToken, string calldata vaultName, string calldata vaultSymbol, address auth)
        external
        returns (address)
    {
        return address(new AjnaERC4626Vault(ajnaPool, IERC20(underlyingToken), vaultName, vaultSymbol, AjnaVaultAuth(auth)));
    }
}

contract AjnaAdapterDeployer {
    function deploy(address creatorVault, address innerVault, address owner) external returns (address) {
        return address(new ERC4626StrategyAdapter(creatorVault, innerVault, owner));
    }
}

contract AjnaERC4626StrategyFactory is IAjnaERC4626StrategyFactory {
    AjnaVaultAuthDeployer public immutable authDeployer;
    AjnaInnerVaultDeployer public immutable vaultDeployer;
    AjnaAdapterDeployer public immutable adapterDeployer;

    constructor() {
        authDeployer = new AjnaVaultAuthDeployer();
        vaultDeployer = new AjnaInnerVaultDeployer();
        adapterDeployer = new AjnaAdapterDeployer();
    }

    function deploy(
        address creatorVault,
        address underlyingToken,
        address ajnaPoolFactory,
        address quoteToken,
        address owner,
        string calldata vaultName,
        string calldata vaultSymbol,
        uint256 bufferRatioBps,
        uint256 minBucketIndex,
        address keeper
    ) external returns (address strategy, address innerVault, address auth) {
        bytes32 subsetHash = IAjnaPoolFactory(ajnaPoolFactory).ERC20_NON_SUBSET_HASH();
        address ajnaPool = IAjnaPoolFactory(ajnaPoolFactory).deployedPools(subsetHash, quoteToken, underlyingToken);

        if (ajnaPool == address(0)) {
            uint256 interestRate = 5e16;
            uint256 minRate = IAjnaPoolFactory(ajnaPoolFactory).MIN_RATE();
            uint256 maxRate = IAjnaPoolFactory(ajnaPoolFactory).MAX_RATE();
            if (interestRate < minRate) interestRate = minRate;
        if (interestRate > maxRate) interestRate = maxRate;
        ajnaPool = IAjnaPoolFactory(ajnaPoolFactory).deployPool(quoteToken, underlyingToken, interestRate);
    }

        AjnaVaultAuth authContract = AjnaVaultAuth(authDeployer.deploy(address(this)));
        if (bufferRatioBps != 0) authContract.setBufferRatio(bufferRatioBps);
        if (minBucketIndex != 0) authContract.setMinBucketIndex(minBucketIndex);
        if (keeper != address(0)) authContract.setKeeper(keeper, true);

        AjnaERC4626Vault innerVaultContract = AjnaERC4626Vault(
            vaultDeployer.deploy(ajnaPool, underlyingToken, vaultName, vaultSymbol, address(authContract))
        );
        ERC4626StrategyAdapter adapter =
            ERC4626StrategyAdapter(adapterDeployer.deploy(creatorVault, address(innerVaultContract), address(this)));
        adapter.setIdleBufferBps(0);
        // FIX: F-28 — set swapper to adapter BEFORE transferring admin, since only admin can setSwapper
        authContract.setSwapper(address(adapter));
        // Arm toll/tax at zero so later fee changes require the 24h timelock.
        authContract.setToll(0);
        authContract.setTax(0);
        adapter.transferOwnership(owner);
        // FIX: F-04 compatibility — use two-step admin transfer (owner must acceptAdmin).
        authContract.transferAdmin(owner);

        auth = address(authContract);
        innerVault = address(innerVaultContract);
        strategy = address(adapter);
    }
}
