// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../vault/strategies/univ3/CreatorCharmStrategy.sol";
import "../../vault/strategies/AjnaStrategy.sol";

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

interface IAjnaStrategyFactory {
    function deploy(
        address creatorVault,
        address underlyingToken,
        address ajnaPoolFactory,
        address quoteToken,
        address owner
    ) external returns (address strategy);
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
                creatorVault,
                underlyingToken,
                quoteToken,
                uniswapRouter,
                charmVault,
                v3Pool,
                owner
            )
        );
        CreatorCharmStrategy(strategy).initializeApprovals();
    }
}

contract AjnaStrategyFactory is IAjnaStrategyFactory {
    function deploy(
        address creatorVault,
        address underlyingToken,
        address ajnaPoolFactory,
        address quoteToken,
        address owner
    ) external returns (address strategy) {
        strategy = address(
            new AjnaStrategy(
                creatorVault,
                underlyingToken,
                ajnaPoolFactory,
                quoteToken,
                owner
            )
        );
    }
}
