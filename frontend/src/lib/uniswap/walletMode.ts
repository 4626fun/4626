/**
 * Wallet execution mode type — the only live export from this module.
 *
 * The runtime preference logic that was previously here (localStorage-backed
 * `readPreferredWalletMode` / `writePreferredWalletMode` / `getDefaultWalletMode`
 * / `getExecutionContext` / `isCSWAvailable` / `getActiveSignerOrProvider`) was
 * dead code — no module imported those functions. The live per-signer-per-chain
 * preference lives in `frontend/src/wallet/accountContext/storage.ts`
 * (`cv.account.preferred_mode.v1:<chainId>:<signer>`) and feeds
 * `resolveActiveAccount` in `useAccountContext`.
 *
 * `executionMode` is derived in `Swap.tsx` from `accountContext.activeAccountType`:
 *   - `SMART_WALLET` → `'canonical'` (parent CSW is sender, embedded EOA is signer)
 *   - `EOA`          → `'eoa'`      (external EOA is sender + signer)
 */
export type WalletMode = 'canonical' | 'eoa'
