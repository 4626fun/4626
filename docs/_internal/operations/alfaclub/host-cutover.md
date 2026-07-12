# AlfaClub host cutover (alfaclub.4626.fun)

Hard-cut the AlfaClub product shell onto `https://alfaclub.4626.fun` with canonical short paths `/rooms`, `/safety`, and `/pools`.

## Infrastructure order (do not skip)

1. **Move the Cloudflare chat proxy** custom domain from `alfaclub.4626.fun` → `relay.4626.fun`.
   - Repo config: `alfaclub/infra/cloudflare-proxy/wrangler.toml` already binds `relay.4626.fun`.
   - Deploy: `cd alfaclub/infra/cloudflare-proxy && pnpm install && pnpm exec wrangler deploy` (Node ≥ 22; Cloudflare login required).
2. **Point the bridge at relay** before releasing the SPA hostname:
   - Vercel Production + Preview: `ALFACLUB_CHAT_API_PROXY_URL=https://relay.4626.fun`
   - Redeploy frontend / Railway consumers that call the bridge.
3. **Verify relay health** before detaching the old hostname:
   ```bash
   curl -s https://relay.4626.fun/_health
   # → {"ok":true,"upstream":"https://api.alfaclub.app"}
   ```
4. **Only then** remove any remaining Worker binding for `alfaclub.4626.fun` and attach `alfaclub.4626.fun` as a Vercel custom domain on the frontend project.
5. Deploy the frontend host cutover and smoke-test auth / LP writes.

Combining steps 2 and 4 without step 3 creates a chat-proxy outage.

## Product surface

| Path | Access |
|------|--------|
| `/rooms` | Public browse |
| `/safety` | Public browse |
| `/pools` | Public directory; LP create/add/buy/sell/remove require accepted session + execution-ready wallet |

Same account model: `cv_auth_session` on `.4626.fun`, Privy allowlist includes `https://alfaclub.4626.fun`, CORS/CSRF trusted origins include the AlfaClub host. External chat links stay on `https://alfaclub.app/rooms/{id}/`.

## Privy dashboard

Add `https://alfaclub.4626.fun` to Allowed Origins (and iframe ancestors if required) for the existing Privy app — do not create a second Privy app.

## Local override

```
VITE_HOST_MODE_OVERRIDE=alfaclub
VITE_ALFACLUB_ORIGIN=http://localhost:5173
```
