# W1-04 Vercel Privy secret scope

Status: fixed

## Summary
- `script/sync-v1180-vercel-env.sh` now skips `PRIVY_ENV` secrets for `preview` and `development` targets.
- Sensitive Privy wallet values, including `PRIVY_WALLET_AUTHORIZATION_KEY`, are now synced to `production` only.

## Validation
- Script logic review only; no live Vercel mutation was run in this remediation pass.
