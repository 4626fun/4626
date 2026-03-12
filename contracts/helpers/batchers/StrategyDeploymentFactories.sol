// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IAjnaPool.sol";
import "../../vault/strategies/ERC4626StrategyAdapter.sol";
import "../../vault/strategies/ajna4626/AjnaERC4626Vault.sol";
import "../../vault/strategies/ajna4626/AjnaVaultAuth.sol";
import "../../vault/strategies/univ3/CreatorCharmStrategy.sol";

interface ICreatorCharmStrategyFactory {
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

contract CreatorCharmStrategyFactory is ICreatorCharmStrategyFactory {
    function deployAndInitialize(
        address creatorVault,
        address underlyingToken,
        address quoteToken,
        address uniswapRouter,
        address charmVault,
        address v3Pool,
        address owner
    ) external returns (address strategy) {
        strategy = address(
            new CreatorCharmStrategy(
                creatorVault, underlyingToken, quoteToken, uniswapRouter, charmVault, v3Pool, owner
            )
        );
        CreatorCharmStrategy(strategy).initializeApprovals();
    }
}

contract AjnaERC4626StrategyFactory is IAjnaERC4626StrategyFactory {
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

        AjnaVaultAuth authContract = new AjnaVaultAuth(address(this));
        if (bufferRatioBps != 0) authContract.setBufferRatio(bufferRatioBps);
        if (minBucketIndex != 0) authContract.setMinBucketIndex(minBucketIndex);
        if (keeper != address(0)) authContract.setKeeper(keeper, true);

        AjnaERC4626Vault innerVaultContract =
            new AjnaERC4626Vault(ajnaPool, IERC20(underlyingToken), vaultName, vaultSymbol, authContract);
        ERC4626StrategyAdapter adapter = new ERC4626StrategyAdapter(creatorVault, address(innerVaultContract), address(this));
        adapter.setIdleBufferBps(0);
        adapter.transferOwnership(owner);
        authContract.setAdmin(owner);

        auth = address(authContract);
        innerVault = address(innerVaultContract);
        strategy = address(adapter);
    }
}
