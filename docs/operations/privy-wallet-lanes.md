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
| XMTP primary agent wallet | `XMTP_AGENT_PRIVY_WALLET_ID` | **4626 XMTP Agent Signer** | *(unset)* |

Production IDs (2026-05, do not rotate without updating env):

- `PRIVY_WALLET_OWNER_ID` → `lr8vgu2l0wnmwg824n4jrtr3`
- `PRIVY_WALLET_POLICY_ID` → `a7vgzko1jhidbaqqg1whufnc`
- Agent signer wallet → `qka29gnn1to96pji6kw2qcq0` (`0xfB11237…`)
- XMTP agent wallet → `wyji2bc8j6sfcu5nilf4325h` (`0x858c0155…`)

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

## Local env gap

If `PRIVY_WALLET_POLICY_ID` is empty locally but set on Vercel/Railway, copy the production value (`a7vgzko1jhidbaqqg1whufnc`) into `frontend/.env` for local agent-wallet scripts and dry-runs.
