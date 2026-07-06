// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

interface IAgentOracleV2Config {
    function owner() external view returns (address);
    function referenceQuoteToken() external view returns (address);
    function referenceQuoteTokenLocked() external view returns (bool);
    function v2QuoteUsdFeed() external view returns (address);
    function v2PairConfigured() external view returns (bool);
    function v2Pair() external view returns (address);
    function v2AgentToken() external view returns (address);
    function v2QuoteToken() external view returns (address);
    function v2TwapDuration() external view returns (uint32);

    function setReferenceQuoteToken(address token) external;
    function lockReferenceQuoteToken() external;
    function setV2QuoteUsdFeed(address feed) external;
    function setV2Pair(address pair, address agentToken, address quoteToken, uint32 twapDuration) external;
}

/**
 * @title ConfigureAgentOracleV2Lane
 * @notice Idempotent operational script for AgentOracle V2 quote lane wiring.
 *
 * Required env:
 * - PRIVATE_KEY
 * - AGENT_ORACLE
 * - AGENT_TOKEN
 * - AGENT_ORACLE_V2_PAIR
 * - AGENT_ORACLE_V2_QUOTE_TOKEN
 * - AGENT_ORACLE_V2_QUOTE_USD_FEED
 *
 * Optional env:
 * - AGENT_ORACLE_V2_TWAP_DURATION (default 1800)
 * - AGENT_ORACLE_LOCK_REFERENCE_QUOTE_TOKEN (1/0, default 0)
 */
contract ConfigureAgentOracleV2Lane is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address caller = vm.addr(pk);

        address oracleAddr = vm.envAddress("AGENT_ORACLE");
        address agentToken = vm.envAddress("AGENT_TOKEN");
        address v2Pair = vm.envAddress("AGENT_ORACLE_V2_PAIR");
        address quoteToken = vm.envAddress("AGENT_ORACLE_V2_QUOTE_TOKEN");
        address quoteUsdFeed = vm.envAddress("AGENT_ORACLE_V2_QUOTE_USD_FEED");
        uint32 twapDuration = uint32(vm.envOr("AGENT_ORACLE_V2_TWAP_DURATION", uint256(1800)));
        bool shouldLock = vm.envOr("AGENT_ORACLE_LOCK_REFERENCE_QUOTE_TOKEN", uint256(0)) == 1;

        require(oracleAddr != address(0), "AGENT_ORACLE required");
        require(agentToken != address(0), "AGENT_TOKEN required");
        require(v2Pair != address(0), "AGENT_ORACLE_V2_PAIR required");
        require(quoteToken != address(0), "AGENT_ORACLE_V2_QUOTE_TOKEN required");
        require(quoteUsdFeed != address(0), "AGENT_ORACLE_V2_QUOTE_USD_FEED required");

        IAgentOracleV2Config oracle = IAgentOracleV2Config(oracleAddr);
        require(oracle.owner() == caller, "caller must be oracle owner");

        console2.log("oracle:", oracleAddr);
        console2.log("owner:", caller);
        console2.log("v2Pair:", v2Pair);
        console2.log("agentToken:", agentToken);
        console2.log("quoteToken:", quoteToken);
        console2.log("quoteUsdFeed:", quoteUsdFeed);
        console2.log("twapDuration:", uint256(twapDuration));

        vm.startBroadcast(pk);

        // Ensure quote-token policy is explicit for the V2 lane.
        address currentReferenceQuote = oracle.referenceQuoteToken();
        if (currentReferenceQuote != quoteToken) {
            require(!oracle.referenceQuoteTokenLocked(), "reference quote token already locked");
            oracle.setReferenceQuoteToken(quoteToken);
            console2.log("setReferenceQuoteToken ->", quoteToken);
        } else {
            console2.log("[skip] referenceQuoteToken already set");
        }

        // Ensure quote/USD feed is explicit and not relying on fallback behavior.
        address currentQuoteUsdFeed = oracle.v2QuoteUsdFeed();
        if (currentQuoteUsdFeed != quoteUsdFeed) {
            oracle.setV2QuoteUsdFeed(quoteUsdFeed);
            console2.log("setV2QuoteUsdFeed ->", quoteUsdFeed);
        } else {
            console2.log("[skip] v2QuoteUsdFeed already set");
        }

        // Configure or refresh V2 pair wiring.
        bool needsV2Update = !oracle.v2PairConfigured() || oracle.v2Pair() != v2Pair || oracle.v2AgentToken() != agentToken
            || oracle.v2QuoteToken() != quoteToken || oracle.v2TwapDuration() != twapDuration;
        if (needsV2Update) {
            oracle.setV2Pair(v2Pair, agentToken, quoteToken, twapDuration);
            console2.log("setV2Pair -> updated");
        } else {
            console2.log("[skip] V2 pair config already matches");
        }

        if (shouldLock) {
            if (oracle.referenceQuoteTokenLocked()) {
                console2.log("[skip] reference quote token already locked");
            } else {
                oracle.lockReferenceQuoteToken();
                console2.log("lockReferenceQuoteToken -> locked");
            }
        }

        vm.stopBroadcast();
    }
}
