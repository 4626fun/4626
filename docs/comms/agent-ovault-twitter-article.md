# Twitter article — AgentOVault design

**Format:** Long-form article for Twitter Articles / Notes (~900 words)  
**Status:** Draft — copy-paste ready  
**Docs link (when live):** https://docs.4626.fun/overview/agent-vault

---

## Title suggestion

**Agent tokens tax every trade. Where is the balance sheet?**

---

## Article body

Agent tokens already tax every trade.

Buy ATIKA, sell ATIKA — a slice leaves on each transfer. That revenue accumulates somewhere. Holders speculate on price. But there is no standardized onchain claim on the vault behind the agent economy. No fair-launch price discovery. No shared infrastructure for fee routing, lottery, or cross-chain shares.

4626 is building that layer.

We call it **AgentOVault** — a parallel product lane to the creator vaults we already ship for Zora coins. Same launch shape. Same auction. Same 30/30/30/10 split at activation. Same lottery on qualifying buys. Different deposit asset. Different fee mechanics.

---

### Two economies, one protocol

Today, 4626 turns a **Zora creator coin** into an ERC-4626 vault with tradable shares. The creator coin goes in. Vault shares come out. Tradable shares trade on Base and bridge to Solana.

Agent economies work differently.

**Zora creator coins** live on Uniswap V4 with a 1% swap fee. Revenue flows through Zora's `payoutRecipient` into our PayoutRouter, which accrues value for share holders via vault price-per-share.

**AgentTokenV4 tokens** (Virtuals-style agents like ATIKA on Base) use Uniswap V2 pairs with **buy/sell transfer taxes**. Every transfer is fee-on-transfer. The token owner sets `projectTaxRecipient` — where trade tax revenue lands.

That difference matters for vault design. ERC-4626 assumes exact transfers. Fee-on-transfer breaks vanilla accounting. You cannot just point `projectTaxRecipient` at a vault address and call it done.

AgentOVault solves this with measured deposits and a dedicated revenue router — without forking upstream token code. Integration is ABI-driven: we read `vault()`, `projectTaxRecipient`, and `taxAccountingAdapter` from the existing token contract.

---

### A visual grammar you can read at a glance

Creator vaults use square badges:

- **▢** hollow square = vault share (internal ERC-4626 claim)
- **■** filled square = tradable share (DEX + cross-chain)

Agent vaults use diamond badges with the same rule:

- **◇** hollow diamond = vault share (`◇ATIKA`)
- **◆** filled diamond = tradable share (`◆ATIKA`)

Hollow means vault. Filled means tradable. Squares for creators. Diamonds for agents. One glance tells you which lane you are in.

---

### Three tokens, one vault

```text
  Agent token ($ATIKA)     Vault share (◇ATIKA)     Tradable share (◆ATIKA)
  AgentTokenV4 deposit  →  ERC-4626 vault share  →  LayerZero AgentShareOFT
  FOT on transfer          Measured on deposit       Wrapped 1:1 from ◇
```

Agent token address ≠ share token address. Same invariant as creator coins.

When trading is live:

- DEX buys of **◆** trigger ShareOFT fees → gauge → burn / jackpot / protocol split
- Qualifying buys hit the shared **4626LotteryManager** (protocol-wide, not per-agent)
- Trade tax revenue (when owner cooperates) flows **AgentRevenueRouter → vault → PPS accretion** for holders

Never route tax directly to the raw vault. Tax lands in the router first — mirroring how PayoutRouter handles Zora creator earnings today.

---

### Zora vs AgentTokenV4 — the comparison

| | Zora creator coin | AgentTokenV4 |
|---|---|---|
| Supply | 1B fixed; 500M pool + 500M vest | Often 1B; set at init |
| Trading | Uniswap V4 + Zora hook | Uniswap V2 pair |
| Fees | 1% swap fee (pool-level) | Buy/sell transfer taxes (FOT) |
| Revenue lane | `payoutRecipient` → PayoutRouter | `projectTaxRecipient` → AgentRevenueRouter |
| Vault deposit | Exact amount (strict) | Measured FOT (credits received) |
| Symbols | ▢ vault / ■ share | ◇ vault / ◆ share |

Same launch bundle shape. Same CCA fair-launch auction. Same 30% vesting, 30% Solana bridge, 10% LP reserve at finalize. Different token physics under the hood.

---

### Phased rollout — honest about what ships when

We are not claiming this is live today. AgentOVault is in active design and implementation.

**V1 — deposits without owner cooperation.** Measured FOT deposit/withdraw. Full deploy stack. CCA split. No token owner action required.

**V2 — revenue capture.** When the agent token owner sets `projectTaxRecipient` to AgentRevenueRouter, trade tax harvests accrue holder value through the vault.

**V3 — native tax adapter.** Optional `taxAccountingAdapter` cooperation for tighter onchain accounting when the token owner opts in.

**V4 — cross-chain mesh.** AgentShareOFT LayerZero and Solana bridge wiring — same mesh infrastructure creator vaults use today.

Each phase adds capability without breaking the prior lane. Creator vaults stay untouched.

---

### What this means for agent token holders

If you hold an agent token today, you hold exposure to price and tax revenue that may never reach you in a structured way.

AgentOVault gives holders:

- A standardized ERC-4626 claim on the agent economy's balance sheet
- Tradable **◆** shares with open fair-launch price discovery
- Onchain fee and tax revenue accretion (when owners cooperate)
- Lottery participation on qualifying buys
- Cross-chain share access via the same Solana mesh creator vaults use

If you are an agent token owner or deployer, the integration path does not require replacing your token. It requires pointing revenue lanes at 4626 infrastructure when you are ready.

---

### Read the full design

Implementation is in progress. No live AgentOVault deploy yet.

Full architecture, cooperation modes, and contract taxonomy:

**https://docs.4626.fun/overview/agent-vault**

4626 — vault infrastructure for creator and agent economies on Base.

---

## Short hook (optional standalone tweet)

Agent tokens tax every trade. Holders get price exposure — not a balance sheet.

4626 is building AgentOVault: ERC-4626 vaults for AgentTokenV4 economies. Same auction + lottery + Solana mesh as creator vaults. Diamond symbols (◇/◆) instead of squares (▢/■).

Design doc → docs.4626.fun/overview/agent-vault
