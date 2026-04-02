// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface ICreatorOVaultFeeView {
    function performanceFee() external view returns (uint16);
    function performanceFeeRecipient() external view returns (address);
}

interface IAjnaVaultAuthFeeView {
    function toll() external view returns (uint256);
    function tax() external view returns (uint256);
    function admin() external view returns (address);
    function swapper() external view returns (address);
}

interface IAjnaInnerVaultLike {
    function AUTH() external view returns (address);
}

/// @notice Print live vault fee configuration from chain state.
/// @dev Usage examples:
///   forge script script/InspectVaultAndAjnaFees.s.sol:InspectVaultAndAjnaFees --rpc-url "$BASE_RPC_URL"
///
///   VAULT=0x... forge script script/InspectVaultAndAjnaFees.s.sol:InspectVaultAndAjnaFees --rpc-url "$BASE_RPC_URL"
///   AJNA_VAULT_AUTH=0x... forge script script/InspectVaultAndAjnaFees.s.sol:InspectVaultAndAjnaFees --rpc-url "$BASE_RPC_URL"
///   AJNA_INNER_VAULT=0x... forge script script/InspectVaultAndAjnaFees.s.sol:InspectVaultAndAjnaFees --rpc-url "$BASE_RPC_URL"
///
/// Notes:
/// - 100 bps = 1%
/// - CreatorOVault default performanceFee in this repo is 0 bps (0%) unless changed onchain.
contract InspectVaultAndAjnaFees is Script {
    function run() external view {
        address vault = vm.envOr("VAULT", address(0));
        address ajnaAuth = vm.envOr("AJNA_VAULT_AUTH", address(0));
        address ajnaInnerVault = vm.envOr("AJNA_INNER_VAULT", address(0));

        if (vault == address(0) && ajnaAuth == address(0) && ajnaInnerVault == address(0)) {
            console2.log("No addresses provided.");
            console2.log("Set one or more env vars: VAULT, AJNA_VAULT_AUTH, AJNA_INNER_VAULT");
            return;
        }

        if (vault != address(0)) {
            _printVaultFees(vault);
        }

        if (ajnaAuth == address(0) && ajnaInnerVault != address(0)) {
            try IAjnaInnerVaultLike(ajnaInnerVault).AUTH() returns (address resolvedAuth) {
                ajnaAuth = resolvedAuth;
                console2.log("Resolved Ajna auth from inner vault:", ajnaAuth);
            } catch {
                console2.log("Could not resolve AUTH() from AJNA_INNER_VAULT:", ajnaInnerVault);
            }
        }

        if (ajnaAuth != address(0)) {
            _printAjnaFees(ajnaAuth);
        }
    }

    function _printVaultFees(address vault) internal view {
        console2.log("---- CreatorOVault Fees ----");
        console2.log("vault:", vault);

        try ICreatorOVaultFeeView(vault).performanceFee() returns (uint16 feeBps) {
            console2.log("performanceFeeBps:", uint256(feeBps));
            console2.log("performanceFeePercentWhole:", uint256(feeBps) / 100);
            console2.log("performanceFeePercentHundredths:", uint256(feeBps) % 100);
        } catch {
            console2.log("performanceFee(): unavailable");
        }

        try ICreatorOVaultFeeView(vault).performanceFeeRecipient() returns (address recipient) {
            console2.log("performanceFeeRecipient:", recipient);
        } catch {
            console2.log("performanceFeeRecipient(): unavailable");
        }
    }

    function _printAjnaFees(address ajnaAuth) internal view {
        console2.log("---- Ajna Inner Vault Fees ----");
        console2.log("ajnaAuth:", ajnaAuth);

        try IAjnaVaultAuthFeeView(ajnaAuth).toll() returns (uint256 tollBps) {
            console2.log("tollBps (deposit fee):", tollBps);
            console2.log("tollPercentWhole:", tollBps / 100);
            console2.log("tollPercentHundredths:", tollBps % 100);
        } catch {
            console2.log("toll(): unavailable");
        }

        try IAjnaVaultAuthFeeView(ajnaAuth).tax() returns (uint256 taxBps) {
            console2.log("taxBps (withdraw fee):", taxBps);
            console2.log("taxPercentWhole:", taxBps / 100);
            console2.log("taxPercentHundredths:", taxBps % 100);
        } catch {
            console2.log("tax(): unavailable");
        }

        try IAjnaVaultAuthFeeView(ajnaAuth).admin() returns (address adminAddr) {
            console2.log("admin:", adminAddr);
        } catch {
            console2.log("admin(): unavailable");
        }

        try IAjnaVaultAuthFeeView(ajnaAuth).swapper() returns (address swapperAddr) {
            console2.log("swapper:", swapperAddr);
        } catch {
            console2.log("swapper(): unavailable");
        }
    }
}
