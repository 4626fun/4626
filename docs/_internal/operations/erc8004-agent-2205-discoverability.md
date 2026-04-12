# ERC-8004 Agent 2205 Discoverability

## Goal

Keep agent `2205` on Base scanner-discoverable by making four layers agree:

1. the onchain `tokenURI`
2. the canonical registration payload
3. the public `.well-known` mirrors
4. the public endpoint health checks

The canonical policy is strict immutable onchain metadata. Use a `data:`, `ipfs://`, or `ar://` URI as the onchain `tokenURI`. Keep `/.well-known/agent-registration.json` and `/.well-known/erc8004.json` live as public mirrors. Treat Grove HTTPS URLs as compatibility fallbacks, not the canonical onchain source.

## Canonical URLs

- `tokenURI`: strict immutable URI written onchain for agent `2205`
- Registration mirror: `https://4626.fun/.well-known/agent-registration.json`
- Domain proof: `https://4626.fun/.well-known/erc8004.json`
- Dynamic registration helper: `https://4626.fun/api/agent-registration`
- Publish helper: `https://4626.fun/api/lens/agent-registration`
- Public verification report: `https://4626.fun/api/v1/agents/identity/verification`

## Operator Order

1. Publish or regenerate the canonical payload.

   Use the admin publish flow or:

   ```bash
   curl -s "https://4626.fun/api/lens/agent-registration" \
     -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <session>" \
     -d '{"store":true}'
   ```

   Capture:

   - `data.uriPolicy.preferredOnchainUri`
   - `data.uriPolicy.mirrorUrl`
   - `data.uriPolicy.domainVerificationUrl`
   - `data.grove.gatewayUrl` if present

2. Write the strict immutable `tokenURI` onchain for agent `2205`.

   Use the immutable URI from `data.uriPolicy.preferredOnchainUri`. Do not write `lens://` onchain. Only use the Grove HTTPS URL if you are intentionally falling back for compatibility and have accepted the trade-off.

3. Confirm the onchain `agentWallet` points to the canonical CSW.

   `setAgentWallet` must bind the canonical Coinbase Smart Wallet, not a delegated signer.

4. Confirm both `.well-known` mirrors are live.

   They must stay aligned with the same canonical payload and registry references used by the app.

5. Run the discoverability check.

   ```bash
   pnpm -C frontend check:agent-discoverability
   ```

   Optional overrides:

   ```bash
   AGENT_DISCOVERABILITY_URL="https://4626.fun/api/v1/agents/identity/verification" \
   AGENT_DISCOVERABILITY_EXPECTED_ID=2205 \
   AGENT_DISCOVERABILITY_EXPECTED_REGISTRY="eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432" \
   pnpm -C frontend check:agent-discoverability
   ```

6. If needed, generate a paid review artifact.

   The paid x402 review is optional for discoverability, but useful as a public proof that scanners and reviewers can inspect.

## What “Ready” Means

The public verification route should report all of the following:

- `discoverabilityReady = true`
- `walletBoundToCanonical = true`
- `tokenUriIsStrictImmutable = true`
- `tokenUriMatchesCanonical = true`
- `mirrors.registration.matchesCanonical = true`
- `mirrors.domainVerification.matchesCanonical = true`
- `endpoint.ok = true`

If any of those are false, the verification response includes a failing `checks[]` entry with the reason.

## Common Failure Modes

### `token-uri-reachable`

The onchain `tokenURI` is missing or unreadable. Fix by writing the immutable URI onchain again.

### `token-uri-matches-canonical`

The onchain payload does not match the canonical registration payload built by the current deployment. Republish and rewrite the correct immutable URI.

### `canonical-agent-wallet`

The registry `agentWallet` is missing or no longer equals the canonical CSW. Re-run the `setAgentWallet` flow.

### `registration-mirror`

The public registration mirror differs from the canonical payload. Update the checked-in mirror or deploy the latest frontend.

### `domain-proof`

The domain proof file is stale or inconsistent with the registration mirror. Update `/.well-known/erc8004.json`.

### `service-availability`

The primary advertised endpoint is unhealthy. Fix the deployed service before expecting scanners to mark the agent ready.

## Notes

- Scanner refresh is not instantaneous. Expect a lag after writing a new onchain `tokenURI`.
- If ownership changes, the registry can clear `agentWallet`; rerun verification immediately after any transfer or recovery flow.
- Do not replace the existing public URLs. The discoverability flow depends on those routes staying stable.
