# 4626 wallet roles — operator reference

Three-lane model after the **2026-07 protocol CSW split**. Do not conflate protocol agent identity, operator personal custody, or Hermit social automation.

Policy source: `frontend/src/wallet/canonicalWalletPolicy.ts`, `frontend/server/_lib/wallet/canonicalCswEnv.ts`

## Lane 1 — Protocol agent (`4626.base.eth` target)

| Address | Type | Role |
|---------|------|------|
| `0x793ca28123cba3ca3c20b9c6c67f37510c89c145` | **CSW** | XMTP agent 4626 inbox, Railway Keepr `sender`, AMOE publisher/relay, ERC-8004 agent #2205 **NFT owner**, **agentWallet** in registration JSON |
| `0x858c01556ec5a8531fa4118d595430ac7fd0baf0` | Privy server wallet | Protocol CSW owner **slot 2** — signs Railway / AMOE / protocol UserOps (`PROTOCOL_CSW_OWNER_INDEX=2`) |

Env: `PROTOCOL_CSW_ADDRESS`, `PROTOCOL_CSW_OWNER_INDEX`, optional `PROTOCOL_CSW_PRIVY_WALLET_ID` (falls back to `CANONICAL_CSW_PRIVY_WALLET_ID`), `VITE_PROTOCOL_CSW_ADDRESS`.

## Lane 2 — Operator personal account

| Address | Type | Role |
|---------|------|------|
| `0xAb6d5C10b03300326cd7fab7267ae192842967b5` | **CSW** | Personal custody, sponsored swap `msg.sender`, AKITA vault **owner** |
| `0xceca13f2686ed061c57620ecdf67e1b8c0f285e9` | Privy embedded EOA | User-initiated frontend signing (`canonical4337`) |
| `0x858c01556ec5a8531fa4118d595430ac7fd0baf0` | Privy server wallet | Operator CSW owner **slot 15** (`CANONICAL_CSW_OWNER_INDEX=15`) |
| `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` | Admin EOA | Zora-creation wallet; CSW owner slot ~1; `PRIVATE_KEY` treasury/ops |
| `0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3` | Passkey EOA | CSW owner slot ~0 |
| `0xd1780fc23f810b52d8cf277e54842dd8803c9361` | Admin EOA | CSW owner slot ~3 |

Env: `CANONICAL_CSW_ADDRESS`, `CANONICAL_CSW_OWNER_INDEX`, `CANONICAL_CSW_PRIVY_WALLET_ID`.

## Lane 3 — Hermit (AlfaClub / social)

| Address | Type | Role |
|---------|------|------|
| `0x8719fa7Be10533fd69885b124a8c84f9C51071AF` | **CSW** | Hermit bot — separate from protocol agent and operator account |

Do not route XMTP 4626 agent, AMOE, or ERC-8004 protocol identity through Hermit.

## Keeper / automation (hot EOA — not a CSW lane)

| Address | Env | Role |
|---------|-----|------|
| `0xed7eFE34D25a0B219de1b25AC99EB35E48CC1379` | `KPR_PRIVATE_KEY`, `PROTOCOL_AJNA_KEEPER`, `PAYOUT_ROUTER_KEEPER`, `KPR_ADDRESS` | KPR bot EOA, AKITA vault **`keeper`**, Ajna deploy keeper, payout harvest (EOA-only on Vercel) |

**Not** `KPR_ERC4337_SMART_WALLET` — that is the optional UserOp **sender** for KPR workflows (now protocol CSW `0x793c…` locally). On-chain `setKeeper()` for AKITA is still `0xed7e…` unless product explicitly rotates it.

Setup: [keeper-automation-setup.md](./keeper-automation-setup.md)

Retired: `0xed401e824df0F3de05Da00C939e81Df60c68a0Cd` — never activated; do not use.

## Protocol Safes

| Address | Role |
|---------|------|
| `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` | Protocol treasury Safe (cold) — strategy ownership, USDC custody |
| `0x08f0875E40781578F902998b2b831cc48d838eBE` | Protocol automation Safe (hot) — Charm `manager`, Ajna `admin`; 1-of-1 keeper EOA owner |

Manifest: [protocol-automation-safe-manifest.json](./protocol-automation-safe-manifest.json)

## Display vs custody

| `4626.base.eth` Basename (display) | `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` |
| Protocol agent XMTP / AMOE / agent registration | `0x793c…c145` |
| Operator personal custody | `0xAb6d5…967b5` |

Do not use Basename resolution as swap, AMOE, or agent identity truth.
