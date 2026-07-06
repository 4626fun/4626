# 4626 wallet roles — operator reference

Quick map of the addresses you interact with on the canonical 4626 account. Custody identity is always the **parent CSW**; EOAs are signers or automation keys only.

## Canonical account (4626 operator)

| Address | Type | Role |
|---------|------|------|
| `0xAb6d5C10b03300326cd7fab7267ae192842967b5` | **CSW** | Custody, XMTP inbox, vault owner, Railway `sender`, sponsored swap `msg.sender` |
| `0xceca13f2686ed061c57620ecdf67e1b8c0f285e9` | Privy embedded EOA | User-initiated frontend signing (`canonical4337`) |
| `0x858c01556ec5a8531fa4118d595430ac7fd0baf0` | Privy server wallet | Railway XMTP / server automation signer on CSW |
| `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` | Admin EOA | Your Zora-creation wallet; CSW owner slot ~1; `PRIVATE_KEY` ops; **not** canonical identity |
| `0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3` | Passkey EOA | CSW owner slot ~0 |
| `0xd1780fc23f810b52d8cf277e54842dd8803c9361` | Admin EOA | CSW owner slot ~3 |

Policy source: `frontend/src/wallet/canonicalWalletPolicy.ts`

## Keeper / automation (single EOA)

| Address | Env | Role |
|---------|-----|------|
| `0xed7eFE34D25a0B219de1b25AC99EB35E48CC1379` | `KPR_PRIVATE_KEY`, `PROTOCOL_AJNA_KEEPER`, `PAYOUT_ROUTER_KEEPER` | KPR bot, AKITA vault `keeper`, Ajna deploy keeper, payout harvest |

Setup: [keeper-automation-setup.md](./keeper-automation-setup.md)

Retired: `0xed401e824df0F3de05Da00C939e81Df60c68a0Cd` — never activated; do not use.

## Protocol Safes

| Address | Role |
|---------|------|
| `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` | Protocol treasury Safe (cold) — strategy ownership, USDC custody |
| `0x08f0875E40781578F902998b2b831cc48d838eBE` | Protocol automation Safe (hot) — Charm `manager`, Ajna `admin`; 1-of-1 keeper EOA owner |

Manifest: [protocol-automation-safe-manifest.json](../wallet/protocol-automation-safe-manifest.json)

Deploy: `pnpm -C frontend ops:deploy-protocol-automation-safe -- --dry-run`

## Display vs custody

| `4626.base.eth` resolves to | `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` |
| Asset custody / XMTP inbox | `0xAb6d5…967b5` (CSW) |

Do not use Basename resolution as swap or custody truth.
