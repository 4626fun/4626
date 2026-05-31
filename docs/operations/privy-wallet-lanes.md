# Privy wallet lanes and dashboard naming

4626 uses **three distinct Privy wallet lanes**. Dashboard labels should make the lane obvious at a glance — especially because login embedded EOAs and server agent wallets can both show `walletClientType: privy`.

## Lane map

| Lane | Purpose | Privy shape | CSW owner install? |
| --- | --- | --- | --- |
| **Login embedded EOA** | User signs CSW owner adds, canonical swaps | Email OTP embedded wallet; **no** `policy_ids`, **not** owned by server key quorum | **Yes — target for `addOwnerAddress`** |
| **Server agent wallet** | Deploy-session / XMTP automation | Wallet API wallet with `owner_id = PRIVY_WALLET_OWNER_ID` + `policy_ids = [PRIVY_WALLET_POLICY_ID]` | **No — server automation only** |
| **Canonical CSW / sub-account** | Custody + app execution | Base Account / Coinbase Smart Wallet (not a Privy Wallet API wallet) | N/A (this is the CSW being modified) |

## Canonical Privy dashboard labels

These are **display names only**. Env vars still store opaque Privy IDs.

| Resource | Env var | Canonical dashboard label | Old / confusing label |
| --- | --- | --- | --- |
| Key quorum (server owner) | `PRIVY_WALLET_OWNER_ID` | **4626 Server Agent Owner** | `cre-privy-signer` |
| Wallet policy (agent constraint) | `PRIVY_WALLET_POLICY_ID` | **4626 Agent Wallet Policy** | `4626-prod-autoprovision-<timestamp>` |
| Deploy/agent signer wallet | *(per wallet)* | **4626 Agent Signer (server)** | `4626.base.eth` on `0xfB11237…` |
| Canonical CSW XMTP signer wallet | `CANONICAL_CSW_PRIVY_WALLET_ID` (legacy: `XMTP_AGENT_PRIVY_WALLET_ID`) | **4626 XMTP Agent Signer** | *(unset)* |

Production IDs (2026-05, do not rotate without updating env):

- `PRIVY_WALLET_OWNER_ID` → `lr8vgu2l0wnmwg824n4jrtr3`
- `PRIVY_WALLET_POLICY_ID` → `a7vgzko1jhidbaqqg1whufnc`
- Agent signer wallet → `qka29gnn1to96pji6kw2qcq0` (`0xfB11237…`)
- XMTP agent wallet → `wyji2bc8j6sfcu5nilf4325h` (`0x858c0155…`) — set `CANONICAL_CSW_PRIVY_WALLET_ID`

## Apply / verify labels

```bash
# Preview
pnpm -C frontend exec tsx --env-file=.env scripts/ops/rename-privy-wallet-labels.ts --dry-run

# Write to Privy (needs PRIVY_APP_ID, PRIVY_APP_SECRET; PATCH may use PRIVY_WALLET_AUTHORIZATION_KEY)
pnpm -C frontend exec tsx --env-file=.env scripts/ops/rename-privy-wallet-labels.ts --apply
```

After renaming, confirm in Privy dashboard:

1. Key quorum shows **4626 Server Agent Owner**
2. Policy shows **4626 Agent Wallet Policy**
3. `0xfB11237…` wallet is **4626 Agent Signer (server)** — not `4626.base.eth`
4. Login embedded wallets (`0x1b77…`, `0xB2aa…`) have **no policy** and are **not** owned by the server key quorum

## Code alignment

Server owner-install resolution (`extractPrivyEmbeddedEoaAddress`) excludes wallets when:

- `policy_ids` is non-empty, or
- `owner_id` equals `PRIVY_WALLET_OWNER_ID`

Renaming alone does not change runtime behavior; it prevents operators from mistaking the agent wallet for the user's CSW or login signer.

## Owner install paths (embedded EOA vs server agent)

Do not conflate **user signing** with **server automation**:

| Path | Adds | Target CSW | Live surfaces |
| --- | --- | --- | --- |
| **Relay embedded-owner install** | 4626 **login embedded EOA** | Parent (`profiles.csw_address`) or sub-account when flagged | `/add-owner`, waitlist `AddOwnerSigningPanel`, `?setup=owner-install` |
| **Server agent install** | Privy **server agent wallet** (`createAgentWallet`) | Parent CSW | `provision-agent-owner`, deploy-session, outreach iframe |
| **Legacy (unwired)** | Embedded EOA calldata only | Parent CSW | `prepare-add-privy-owner` — API registered, **no SPA caller** |

Canonical user path: `POST /api/onboarding/preview-add-owner` → `useAddOwnerFlow` → `executeOwnerMutationViaRelay`. Golden txs (block 45600637): [0xa6b543…b4c3](https://basescan.org/tx/0xa6b5435718a8969905a08093a7208dadefdf702602c63e3fd322d84db5f4b4c3) (deposit) + [0xa9a063…9a36](https://basescan.org/tx/0xa9a06340a7725063f1dd9b0a29af6c72f4fbfe3a408b28dd28e2fd2db7649a36) (solver fill). Full runbook: `docs/operations/relay-owner-mutation-kit-guide.md`.

An **existing CSW owner** must approve `addOwnerAddress(embeddedEoa)` — the embedded EOA is the owner being added, not the approver. Base App sub-account track (`?setup=base-app`) uses sub-account Relay install instead of parent CSW when sub-account flags are on.

## Orphan cleanup: `alfaclub` key quorum (safe to delete)

An experimental key quorum was created in the **4626 Privy app** during an AlfaClub wallet experiment. It is **not** wired to live AlfaClub chat auth (that uses AlfaClub's separate Privy app + JWT refresh).

| Resource | ID | Address |
| --- | --- | --- |
| Key quorum `alfaclub` | `iugbyquej8u2oe80w6ox9kfv` | — |
| Owned wallet | `l6zzzn135ig2w0y44r1ycq19` | `0x5744e8DBf8815F4BA4d1a87984da849289c4e75b` |

On-chain: 0 ETH, nonce 0. Not referenced in code or env.

**API delete note:** Privy requires an authorization signature from **this quorum's member key** (public key ending `…ztreGwg`). That private key is **not** the same as `PRIVY_WALLET_AUTHORIZATION_KEY` (4626 Server Agent Owner). Unless you saved the alfaclub quorum's private key at creation time, use the dashboard path below.

### Dashboard delete (recommended)

1. Open [4626 Privy app → Wallets](https://dashboard.privy.io/apps/cmk411efm034jl50cs618o8cy/wallets).
2. Find wallet **`0x5744e8…e75b`** → delete/remove wallet.
3. Open [Key quorums](https://dashboard.privy.io/apps/cmk411efm034jl50cs618o8cy/authorization-keys) (or Wallets → Authorization).
4. Delete quorum **`alfaclub`** (`iugbyquej8u2oe80w6ox9kfv`).

Do **not** delete **`4626 Server Agent Owner`** (`lr8vgu2l0wnmwg824n4jrtr3`).

### API delete (only if you have the alfaclub quorum private key)

```bash
# Pass the quorum-specific wallet-auth key (NOT the 4626 server agent key)
PRIVY_WALLET_AUTHORIZATION_KEY='wallet-auth:<alfaclub-quorum-private-key>' \
  pnpm -C frontend exec tsx --env-file=.env scripts/ops/delete-privy-orphan-quorum.ts --apply
```

## Local env gap

If `PRIVY_WALLET_POLICY_ID` is empty locally but set on Vercel/Railway, copy the production value (`a7vgzko1jhidbaqqg1whufnc`) into `frontend/.env` for local agent-wallet scripts and dry-runs.
