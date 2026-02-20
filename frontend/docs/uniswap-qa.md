# Uniswap Swap + Liquidity QA Checklist

## Swap
- [ ] Load `/trade` on mobile viewport (iPhone SE / 390x844) and confirm dark theme consistency.
- [ ] Change token pair and amount; verify debounced quote auto-refresh updates output.
- [ ] Set same token for buy/sell and confirm validation warning appears.
- [ ] Open advanced panel and run quote + approval + build.
- [ ] Execute review flow and verify status or explicit failure handling.

## Cross-chain / advanced
- [ ] Provide differing chain IDs (if enabled in request body) and verify graceful fallback/error messaging.
- [ ] Test unavailable advanced wallet features and confirm sequential fallback still works.

## Liquidity
- [ ] Switch to Liquidity tab.
- [ ] In Simple mode: enter amounts + fee tier and run `Quote LP`.
- [ ] Run `Add liquidity` and verify request status messaging.
- [ ] Enter a position id and run `Claim fees`.
- [ ] Enter a position id and run `Remove`.
- [ ] Confirm `Your positions` panel renders fetched payload or empty fallback.

## Error handling
- [ ] Simulate rate-limit/429 and verify normalized message.
- [ ] Simulate approval failure and verify normalized message.
