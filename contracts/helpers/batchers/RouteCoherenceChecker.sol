// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";

/**
 * @title RouteCoherenceChecker
 * @notice Read-only helper to validate registry route wiring for a creator token.
 */
contract RouteCoherenceChecker {
    ICreatorRegistry public immutable registry;

    struct RouteCoherenceStatus {
        bool ok;
        uint8 mismatchBitmap;
        bool active;
        address registryVault;
        address registryShareOFT;
        address registryOracle;
        address registryGaugeController;
    }

    error ZeroAddress();

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = ICreatorRegistry(registry_);
    }

    /**
     * @dev Bit mapping for `mismatchBitmap`:
     *      1 = vault mismatch
     *      2 = shareOFT mismatch
     *      4 = oracle mismatch
     *      8 = gauge mismatch
     */
    function checkRouteCoherence(
        address creatorToken,
        address expectedVault,
        address expectedShareOFT,
        address expectedOracle,
        address expectedGaugeController
    ) external view returns (RouteCoherenceStatus memory status) {
        if (creatorToken == address(0)) revert ZeroAddress();

        ICreatorRegistry.CreatorCoinInfo memory info = registry.getCreatorCoin(creatorToken);
        status.active = info.isActive;
        status.registryVault = info.vault;
        status.registryShareOFT = info.shareOFT;
        status.registryOracle = info.oracle;
        status.registryGaugeController = info.gaugeController;

        if (status.registryVault != expectedVault) status.mismatchBitmap |= 1;
        if (status.registryShareOFT != expectedShareOFT) status.mismatchBitmap |= 2;
        if (status.registryOracle != expectedOracle) status.mismatchBitmap |= 4;
        if (status.registryGaugeController != expectedGaugeController) status.mismatchBitmap |= 8;

        status.ok = status.mismatchBitmap == 0;
    }
}

