// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IRegistryOracleLookup {
    function getOracleForToken(address token) external view returns (address);
    function getGaugeControllerForToken(address token) external view returns (address);
}

interface ICreatorOracleQa {
    function creatorSymbol() external view returns (string memory);
    function chainlinkFeed() external view returns (address);
    function v4PoolConfigured() external view returns (bool);
    function v3PoolConfigured() external view returns (bool);
    function v3Pool() external view returns (address);
    function v3CreatorToken() external view returns (address);
    function v3UsdToken() external view returns (address);
    function v3TwapDuration() external view returns (uint32);
    function priceUpdateCooldown() external view returns (uint32);
    function maxTicksPerObservation() external view returns (int24);
    function creatorPriceUSD() external view returns (int256);
    function creatorPriceTimestamp() external view returns (uint256);
    function isPriceFresh() external view returns (bool);
    function getEthPrice() external view returns (int256 price, uint256 timestamp);
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
    function getCreatorEthTWAP(uint32 duration) external view returns (uint256 price);
    function getCreatorUsdTWAP(uint32 duration) external view returns (uint256 priceUsd18);
    function getAjnaBucketFromV3TWAP(uint32 duration) external view returns (uint256 bucketIndex);
}

interface ICreatorGaugeOracleRef {
    function oracle() external view returns (address);
}

interface ICCALaunchOracleRef {
    function oracle() external view returns (address);
}

/// @notice Post-deploy oracle QA pass (read-only).
/// @dev Mirrors Silo-style operator QA: print config, wiring, and quote sanity.
///
/// Required env:
/// - CREATOR_TOKEN
///
/// Optional env:
/// - ORACLE
/// - REGISTRY
/// - GAUGE
/// - CCA
/// - TWAP_DURATION (default 1800)
/// - V3_TWAP_DURATION (default 1800)
/// - STRICT (1 => require key checks to pass)
///
/// Example:
///   forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa --rpc-url $BASE_RPC_URL
contract OraclePostDeployQa is Script {
    address internal constant DEFAULT_REGISTRY = 0x777e28d7617ADb6E2fE7b7C49864A173e36881EF;
    uint32 internal constant DEFAULT_TWAP = 1800;

    function run() external view {
        address creatorToken = vm.envAddress("CREATOR_TOKEN");
        address registry = _envAddressOr("REGISTRY", DEFAULT_REGISTRY);
        address oracle = _envAddressOr("ORACLE", address(0));
        uint32 twapDuration = _envUint32Or("TWAP_DURATION", DEFAULT_TWAP);
        uint32 v3TwapDuration = _envUint32Or("V3_TWAP_DURATION", DEFAULT_TWAP);
        bool strict = _envBoolOr("STRICT", false);

        if (oracle == address(0)) {
            oracle = IRegistryOracleLookup(registry).getOracleForToken(creatorToken);
        }
        require(oracle != address(0), "oracle not found");
        require(oracle.code.length > 0, "oracle has no code");

        address gauge = _envAddressOr("GAUGE", address(0));
        if (gauge == address(0) && registry != address(0)) {
            gauge = IRegistryOracleLookup(registry).getGaugeControllerForToken(creatorToken);
        }
        address cca = _envAddressOr("CCA", address(0));

        ICreatorOracleQa o = ICreatorOracleQa(oracle);

        console2.log("=== Oracle QA ===");
        console2.log("chainId:", block.chainid);
        console2.log("creatorToken:", creatorToken);
        console2.log("registry:", registry);
        console2.log("oracle:", oracle);
        console2.log("oracleCodeSize:", oracle.code.length);
        console2.log("");

        string memory symbol = o.creatorSymbol();
        address chainlinkFeed = o.chainlinkFeed();
        bool v4Configured = o.v4PoolConfigured();
        bool v3Configured = o.v3PoolConfigured();

        console2.log("--- Config ---");
        console2.log("creatorSymbol:", symbol);
        console2.log("chainlinkFeed:", chainlinkFeed);
        console2.log("v4PoolConfigured:", v4Configured);
        console2.log("v3PoolConfigured:", v3Configured);
        console2.log("priceUpdateCooldown:", o.priceUpdateCooldown());
        console2.log("maxTicksPerObservation:", o.maxTicksPerObservation());
        console2.log("");

        if (v3Configured) {
            console2.log("--- V3 Config ---");
            console2.log("v3Pool:", o.v3Pool());
            console2.log("v3CreatorToken:", o.v3CreatorToken());
            console2.log("v3UsdToken:", o.v3UsdToken());
            console2.log("v3TwapDuration(default):", o.v3TwapDuration());
            console2.log("");
        }

        console2.log("--- Wiring ---");
        address registryOracle = registry == address(0) ? address(0) : IRegistryOracleLookup(registry).getOracleForToken(creatorToken);
        console2.log("registryOracleForToken:", registryOracle);
        console2.log("registryMatchesOracle:", registryOracle == oracle);

        if (gauge != address(0) && gauge.code.length > 0) {
            address gaugeOracle = ICreatorGaugeOracleRef(gauge).oracle();
            console2.log("gauge:", gauge);
            console2.log("gaugeOracle:", gaugeOracle);
            console2.log("gaugeMatchesOracle:", gaugeOracle == oracle);
        } else {
            console2.log("gauge: not provided/resolveable");
        }

        if (cca != address(0) && cca.code.length > 0) {
            address ccaOracle = ICCALaunchOracleRef(cca).oracle();
            console2.log("cca:", cca);
            console2.log("ccaOracle:", ccaOracle);
            console2.log("ccaMatchesOracle:", ccaOracle == oracle);
        } else {
            console2.log("cca: not provided");
        }
        console2.log("");

        console2.log("--- Stored Prices ---");
        (int256 ethUsd18, uint256 ethTs) = o.getEthPrice();
        (int256 creatorUsd18, uint256 creatorTs) = o.getCreatorPrice();
        bool fresh = o.isPriceFresh();
        console2.log("ethUsd1e18:", ethUsd18);
        console2.log("ethPriceTimestamp:", ethTs);
        console2.log("creatorUsd1e18:", creatorUsd18);
        console2.log("creatorPriceTimestamp:", creatorTs);
        console2.log("isPriceFresh:", fresh);
        console2.log("");

        console2.log("--- TWAP Checks ---");
        uint256 creatorPerEth = _tryCreatorEthTwap(o, twapDuration);
        console2.log("creatorPerEth1e18 (V4 TWAP):", creatorPerEth);
        if (creatorPerEth > 0 && ethUsd18 > 0) {
            uint256 impliedCreatorUsd = uint256(ethUsd18) * 1e18 / creatorPerEth;
            console2.log("impliedCreatorUsd1e18 (ETH/USD over V4 TWAP):", impliedCreatorUsd);
            if (creatorUsd18 > 0) {
                uint256 deltaBps = _absDiffBps(uint256(creatorUsd18), impliedCreatorUsd);
                console2.log("deltaBps(stored vs impliedV4):", deltaBps);
            }
        } else {
            console2.log("impliedCreatorUsd1e18: unavailable");
        }

        if (v3Configured) {
            uint256 v3Usd = _tryCreatorUsdTwap(o, v3TwapDuration);
            console2.log("creatorUsd1e18 (V3 TWAP):", v3Usd);
            uint256 ajnaBucket = _tryAjnaBucket(o, v3TwapDuration);
            console2.log("ajnaBucketFromV3:", ajnaBucket);
            if (creatorUsd18 > 0 && v3Usd > 0) {
                uint256 v3DeltaBps = _absDiffBps(uint256(creatorUsd18), v3Usd);
                console2.log("deltaBps(stored vs V3):", v3DeltaBps);
            }
        } else {
            console2.log("v3 checks skipped: pool not configured");
        }
        console2.log("");

        if (strict) {
            require(registryOracle == oracle, "strict: registry/oracle mismatch");
            require(chainlinkFeed != address(0), "strict: missing chainlink feed");
            require(v4Configured || v3Configured, "strict: no pool configured");
            require(creatorUsd18 > 0, "strict: creator price is zero");
            require(fresh, "strict: creator price stale");
        }
    }

    function _tryCreatorEthTwap(ICreatorOracleQa oracle, uint32 duration) internal view returns (uint256 out) {
        try oracle.getCreatorEthTWAP(duration) returns (uint256 p) {
            return p;
        } catch {
            return 0;
        }
    }

    function _tryCreatorUsdTwap(ICreatorOracleQa oracle, uint32 duration) internal view returns (uint256 out) {
        try oracle.getCreatorUsdTWAP(duration) returns (uint256 p) {
            return p;
        } catch {
            return 0;
        }
    }

    function _tryAjnaBucket(ICreatorOracleQa oracle, uint32 duration) internal view returns (uint256 out) {
        try oracle.getAjnaBucketFromV3TWAP(duration) returns (uint256 b) {
            return b;
        } catch {
            return 0;
        }
    }

    function _absDiffBps(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return b == 0 ? 0 : type(uint256).max;
        uint256 diff = a > b ? a - b : b - a;
        return (diff * 10_000) / a;
    }

    function _envAddressOr(string memory key, address fallbackValue) internal view returns (address) {
        try vm.envAddress(key) returns (address v) {
            return v;
        } catch {
            return fallbackValue;
        }
    }

    function _envUint32Or(string memory key, uint32 fallbackValue) internal view returns (uint32) {
        try vm.envUint(key) returns (uint256 v) {
            return uint32(v);
        } catch {
            return fallbackValue;
        }
    }

    function _envBoolOr(string memory key, bool fallbackValue) internal view returns (bool) {
        try vm.envBool(key) returns (bool v) {
            return v;
        } catch {
            return fallbackValue;
        }
    }
}
