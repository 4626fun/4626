// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

interface IAgentOracleQa {
    function owner() external view returns (address);
    function referenceQuoteToken() external view returns (address);
    function referenceQuoteTokenLocked() external view returns (bool);
    function v2QuoteUsdFeed() external view returns (address);
    function v2PairConfigured() external view returns (bool);
    function v2Pair() external view returns (address);
    function v2AgentToken() external view returns (address);
    function v2QuoteToken() external view returns (address);
    function v2TwapDuration() external view returns (uint32);
}

/**
 * @title AgentOraclePostDeployQa
 * @notice Read-only QA for AgentOracle quote-lane wiring.
 *
 * Required env:
 * - AGENT_ORACLE
 *
 * Optional expected values:
 * - AGENT_TOKEN
 * - AGENT_ORACLE_PAIR
 * - AGENT_ORACLE_QUOTE_TOKEN
 * - AGENT_ORACLE_QUOTE_USD_FEED
 * - AGENT_ORACLE_TWAP_DURATION
 * - AGENT_ORACLE_EXPECT_REFERENCE_QUOTE_LOCKED (1/0)
 *
 * Strict mode:
 * - AGENT_ORACLE_QA_STRICT=1
 *   Reverts when any provided expected value does not match onchain state.
 */
contract AgentOraclePostDeployQa is Script {
    function run() external view {
        address oracleAddr = vm.envAddress("AGENT_ORACLE");
        require(oracleAddr != address(0), "AGENT_ORACLE required");
        require(oracleAddr.code.length > 0, "oracle has no code");

        IAgentOracleQa o = IAgentOracleQa(oracleAddr);

        address expectedAgentToken = vm.envOr("AGENT_TOKEN", address(0));
        address expectedPair = vm.envOr("AGENT_ORACLE_PAIR", address(0));
        address expectedQuoteToken = vm.envOr("AGENT_ORACLE_QUOTE_TOKEN", address(0));
        address expectedQuoteUsdFeed = vm.envOr("AGENT_ORACLE_QUOTE_USD_FEED", address(0));
        uint32 expectedTwapDuration = uint32(vm.envOr("AGENT_ORACLE_TWAP_DURATION", uint256(0)));
        uint256 expectLockedRaw = vm.envOr("AGENT_ORACLE_EXPECT_REFERENCE_QUOTE_LOCKED", uint256(0));
        bool expectLockedProvided = expectLockedRaw == 0 || expectLockedRaw == 1;
        bool expectedLocked = expectLockedRaw == 1;
        bool strict = vm.envOr("AGENT_ORACLE_QA_STRICT", uint256(0)) == 1;

        address owner = o.owner();
        address referenceQuoteToken = o.referenceQuoteToken();
        bool referenceQuoteTokenLocked = o.referenceQuoteTokenLocked();
        address v2QuoteUsdFeed = o.v2QuoteUsdFeed();
        bool v2PairConfigured = o.v2PairConfigured();
        address v2Pair = o.v2Pair();
        address v2AgentToken = o.v2AgentToken();
        address v2QuoteToken = o.v2QuoteToken();
        uint32 v2TwapDuration = o.v2TwapDuration();

        console2.log("oracle:", oracleAddr);
        console2.log("owner:", owner);
        console2.log("referenceQuoteToken:", referenceQuoteToken);
        console2.log("referenceQuoteTokenLocked:", referenceQuoteTokenLocked);
        console2.log("quoteUsdFeed:", v2QuoteUsdFeed);
        console2.log("pairConfigured:", v2PairConfigured);
        console2.log("pair:", v2Pair);
        console2.log("agentToken:", v2AgentToken);
        console2.log("quoteToken:", v2QuoteToken);
        console2.log("twapDuration:", uint256(v2TwapDuration));

        bool allOk = true;

        if (expectedPair != address(0) && v2Pair != expectedPair) {
            allOk = false;
            console2.log("mismatch: pair expected", expectedPair);
        }
        if (expectedAgentToken != address(0) && v2AgentToken != expectedAgentToken) {
            allOk = false;
            console2.log("mismatch: agentToken expected", expectedAgentToken);
        }
        if (expectedQuoteToken != address(0) && v2QuoteToken != expectedQuoteToken) {
            allOk = false;
            console2.log("mismatch: quoteToken expected", expectedQuoteToken);
        }
        if (expectedQuoteUsdFeed != address(0) && v2QuoteUsdFeed != expectedQuoteUsdFeed) {
            allOk = false;
            console2.log("mismatch: quoteUsdFeed expected", expectedQuoteUsdFeed);
        }
        if (expectedQuoteToken != address(0) && referenceQuoteToken != expectedQuoteToken) {
            allOk = false;
            console2.log("mismatch: referenceQuoteToken expected", expectedQuoteToken);
        }
        if (expectedTwapDuration != 0 && v2TwapDuration != expectedTwapDuration) {
            allOk = false;
            console2.log("mismatch: twapDuration expected", uint256(expectedTwapDuration));
        }
        if (expectLockedProvided && referenceQuoteTokenLocked != expectedLocked) {
            allOk = false;
            console2.log("mismatch: referenceQuoteTokenLocked expected", expectedLocked);
        }

        if (strict && !allOk) {
            revert("strict: AgentOracle QA mismatch");
        }
    }
}
