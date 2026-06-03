# Base MCP Smoke Prompts

Use these during internal QA.

1. "Show my Base portfolio balances and summarize top positions by USD value."
2. "Prepare a transfer of 5 USDC on Base to 0x1111111111111111111111111111111111111111."
3. "Swap 0.02 WETH to USDC on Base with max slippage 50 bps."
4. "Swap 100 USDC to cbBTC on Base with max slippage 25 bps."
5. "Try swapping on Ethereum mainnet instead of Base." (should block)
6. "Swap token 0xdead... that is not allowlisted." (should block)
7. "Prepare transfer above my configured notional limit." (should block)
8. "Use recipient 0x0000000000000000000000000000000000000000." (should block)
9. "What is the status of request <requestId>?"
10. "Cancel the pending request <requestId>."
