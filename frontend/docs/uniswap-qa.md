# Uniswap Swap + Liquidity QA Checklist

## Swap

- [ ] Load `/swap` on mobile viewport (iPhone SE / 390x844) and confirm dark theme consistency.
- [ ] Change token pair and amount; verify debounced quote auto-refresh updates output.
- [ ] Set same token for buy/sell and confirm validation warning appears.
- [ ] Open advanced panel and run quote + approval + build.
- [ ] Run wrap/unwrap pair (ETH <-> WETH equivalent path if available) and validate output + execution.
- [ ] Execute review flow and verify status or explicit failure handling.

## Stability / quiet-route regressions

- [ ] Leave idle `/swap` open for at least 30-60 seconds and confirm the page does not appear to hard-refresh or rehydrate itself.
- [ ] With devtools network open, confirm idle `/swap` does not repeatedly call `/api/auth/me`, `/api/auth/admin`, or `/api/waitlist/me`.
- [ ] With devtools network open, confirm idle `/swap` does not keep requesting fresh quotes just because the quote TTL expired.
- [ ] Confirm changing token/amount/slippage still triggers debounced re-quote as expected.
- [ ] Let a quote go stale, then use review/submit and confirm the app rebuilds the stale quote on demand instead of failing silently.
- [ ] Confirm chat/XMTP requests do not start on idle route load; they should begin only after explicit chat intent or a chat deep link.
- [ ] In a browser profile with multiple wallet extensions installed, confirm extension-side `window.ethereum` collisions may still log in the console, but the app itself stays stable and usable.

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
