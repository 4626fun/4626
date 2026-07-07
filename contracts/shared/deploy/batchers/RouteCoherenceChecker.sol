// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {I4626Registry} from "@4626/shared/interfaces/core/I4626Registry.sol";

/**
 * @title RouteCoherenceChecker
 * @notice Read-only helper to validate registry route wiring for a creator token.
 */
contract RouteCoherenceChecker {
    I4626Registry public immutable registry;

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
        registry = I4626Registry(registry_);
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

        I4626Registry.TokenInfo memory info = registry.getTokenInfo(creatorToken);
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

