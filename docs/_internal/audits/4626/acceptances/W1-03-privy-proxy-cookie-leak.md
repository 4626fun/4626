# W1-03 Privy proxy cookie leak

Status: accept-risk

## Summary
- The production path is a `frontend/vercel.json` host rewrite from `privy.4626.fun` to `https://auth.privy.io/$1`.
- That rewrite has no application-layer hook to remove only `cv_auth_session` from the outbound browser request, and browser code cannot safely strip a single cookie while preserving the server-cookie Privy fallback lane.
- Existing client code already pins several local-dev flows to `auth.privy.io`, but a production-safe cookie-strip fix would require replacing the rewrite with a real proxy or changing the auth-domain/cookie architecture.

## Mitigation
- Keep this documented acceptance until the rewrite is replaced with a code proxy or the custom-domain server-cookie dependency is removed.
