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

## Uniswap-inspired stability guardrails (pre-ship)

- [ ] No timer-driven UI state updates on idle `/swap` unless the timer output is visibly rendered and product-required.
- [ ] Route guards block only on initial loads (`isLoading`), not background fetch refreshes (`isFetching`).
- [ ] Non-critical nav queries (for example admin badge checks) are route-scoped and do not refetch on focus/reconnect by default.
- [ ] Idle `/swap` network profile has no app-level polling loops besides explicit, route-local product behavior.
- [ ] Quote lifecycle is action-driven: stale quote is rebuilt at review/submit time, not by perpetual idle polling.
- [ ] Swap primary CTA copy/state does not oscillate when background quote work is non-blocking.
- [ ] React DevTools profiler for idle `/swap` shows no fixed cadence commit loop (for example ~1Hz).
- [ ] Query defaults are explicit for heavy endpoints (`staleTime`, `refetchOnWindowFocus`, `refetchOnReconnect`) and reviewed per route.
- [ ] Any new interval/effect added to swap path includes cleanup, necessity comment, and measurable UX reason.
- [ ] Pre-merge check includes manual idle stability pass (60s) and one stale-quote execute path validation.

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
