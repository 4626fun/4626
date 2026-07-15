# CSW-to-Agent Lifecycle (server delegation)

On-demand Tier 2. Load when editing XMTP agent, deploy-session, ERC-8004, Privy server wallets, or onboarding provision-agent-owner.

Policy authority: `.cursor/rules/csw-agent-lifecycle.mdc` (compact). Wallet pins: [wallet-identity.md](./wallet-identity.md).

## Lifecycle (chronological)

### 1. CSW Creation (user action)
- User connects via Privy/Zora.
- `POST /api/auth/verify` or `POST /api/wallet/sync` stores CSW in `profile_wallets` with `is_canonical_smart_wallet = true`.
- Files: `frontend/api/_handlers/auth/_verify.ts`, `frontend/server/_lib/walletSync.ts`

### 2. Privy Server Wallet Creation (server action)
- `createAgentWallet()` creates Privy-managed EOA via Privy Wallet API.
- Owned by `PRIVY_WALLET_OWNER_ID` (key quorum **4626 Server Agent Owner**), constrained by `PRIVY_WALLET_POLICY_ID`.
- Do not confuse server agent wallets with login embedded EOAs — `docs/operations/privy-wallet-lanes.md`.
- File: `frontend/server/_lib/wallet/privyWalletApi.ts`
- Env: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_WALLET_AUTHORIZATION_KEY`, `PRIVY_WALLET_OWNER_ID`, `PRIVY_WALLET_POLICY_ID`

### 3. Owner lanes (do not conflate)

**User-initiated signing** — waitlist, `/add-owner`, `AddOwnerSigningPanel`:
- Adds **4626 login embedded EOA** to **parent CSW** via Relay: `POST /api/onboarding/preview-add-owner` → `useAddOwnerFlow` → `executeOwnerMutationViaRelay`.
- Existing CSW owner approves; embedded EOA is only the `addOwnerAddress` target.
- Runbook: `docs/operations/relay-owner-mutation-kit-guide.md`.

**Server agent delegation** — deploy-session, XMTP, outreach iframe:
- Adds **Privy server agent wallet** via `POST /api/onboarding/provision-agent-owner` or `preview-agent-owner`.
- Orthogonal to user swap/signing via embedded EOA.
- Files: `frontend/api/_handlers/onboarding/_provision-agent-owner.ts`, `frontend/server/_lib/wallet/privyWalletApi.ts`

### 4. XMTP Agent Identity (server action)
- `createPrivyScwSigner()` — Privy `secp256k1_sign`, `SignatureWrapper`, `replaySafeHash()` ERC-1271.
- XMTP agent presents as `PROTOCOL_CSW_ADDRESS`, not operator `CANONICAL_CSW_ADDRESS` or delegated Privy EOA.
- Files: `frontend/server/_lib/privyXmtpSigner.ts`, `frontend/server/agents/eliza/index.ts`
- Env: `PROTOCOL_CSW_ADDRESS`, `PROTOCOL_CSW_PRIVY_WALLET_ID`, `PROTOCOL_CSW_OWNER_INDEX`

### 5. ERC-8004 Agent Registration (server action)
- Registration payload injects CSW into XMTP and `agentWallet` service entries.
- `setAgentWallet()` on Identity Registry via EIP-712; published to Lens Grove.
- Files: `frontend/server/_lib/agentRegistration.ts`, `frontend/api/_handlers/v1/agents/identity/_setAgentWallet.ts`
- Env: `ERC8004_AGENT_REGISTRY`, `ERC8004_AGENT_ID`, `ERC8004_AGENT_CHAIN_ID`

### 6. Deploy-Session Automation (server action, temporary)
- Validates canonical wallet ownership; `getOrCreateCreatorAgentWallet()` → `sessionOwner`.
- User approves `addOwnerAddress(sessionOwner)`; server signs UserOps; CSW is ERC-4337 sender.
- After deploy: remove temporary owner via `removeOwnerAtIndex()`.
- Files: `frontend/api/_handlers/deploy/session/_create.ts`, `_continue.ts`
- Env: `DEPLOY_SESSION_TOKEN_HMAC_SECRET`

## Key environment variables

| Variable | Purpose |
|---|---|
| `PROTOCOL_CSW_ADDRESS` | Agent 4626 XMTP/ERC-8004 CSW (`0x793c…c145`) |
| `PROTOCOL_CSW_PRIVY_WALLET_ID` | Protocol CSW delegated signer |
| `PROTOCOL_CSW_OWNER_INDEX` | Owner index on protocol CSW |
| `CANONICAL_CSW_ADDRESS` | Operator custody/execution CSW |
| `PRIVY_WALLET_AUTHORIZATION_KEY` | P-256 key for Privy API |
| `PRIVY_WALLET_OWNER_ID` | Key quorum for agent wallets |
| `ERC8004_AGENT_REGISTRY` / `ERC8004_AGENT_ID` | ERC-8004 identity |

### Retired env aliases

| Retired | Use instead |
|---|---|
| `XMTP_AGENT_CSW_ADDRESS` | `PROTOCOL_CSW_ADDRESS` |
| `XMTP_AGENT_CSW_CHAIN_ID` | `PROTOCOL_CSW_CHAIN_ID` |
| `XMTP_AGENT_CSW_OWNER_INDEX` | `PROTOCOL_CSW_OWNER_INDEX` |
| `XMTP_AGENT_PRIVY_WALLET_ID` | `PROTOCOL_CSW_PRIVY_WALLET_ID` |
| `XMTP_AGENT_CSW_SKIP_CANONICAL` | `CANONICAL_CSW_SKIP_ENFORCEMENT` |
| `XMTP_AGENT_ADDRESS` | `PROTOCOL_CSW_ADDRESS` |
| `VITE_AGENT_XMTP_ADDRESS` | `VITE_PROTOCOL_CSW_ADDRESS` |

## Code entry points (SSoT)

| Surface | Module |
|---|---|
| Policy + allowlists | `frontend/src/wallet/canonicalWalletPolicy.ts` |
| Server env | `frontend/server/_lib/wallet/canonicalCswEnv.ts` |
| Client XMTP inbox | `frontend/src/lib/xmtp/agentXmtpAddress.ts` |
| Chat UI | `frontend/src/components/chat/agentIdentity.ts` |

Guard: `pnpm -C frontend guard:canonical-csw`
