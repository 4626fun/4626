# Website Audit: 4626.fun

**Audit date:** 2026-05-06 · **URL:** [4626.fun](https://4626.fun) · **Focus:** conversion, trust, positioning, X/Twitter readiness

---

## Executive summary

4626.fun is a visually polished, ecosystem-credible Base-native creator-vault protocol with a real and differentiable mechanic. But the website that visitors land on **is not yet ready to receive paid X traffic** and is currently optimized for visual impression rather than conversion, trust, or search visibility.

The site has six structural problems that compound:

1. **It is invisible to Google and AI search.** Every non-home route serves a `noindex,follow` SPA shell with no SSR or prerender. There is no JSON-LD, no real `robots.txt`, and no `sitemap.xml` (sitemap_index.xml returns 200 but `sitemap.xml` returns 405). For a brand-new domain, that means near-zero organic search and AI-engine surface area.
2. **It is exposed on crypto compliance.** The homepage publishes specific APY ranges (`4.2–7.8%`, `12.5–24.1%`, `18.3–31.7%`) and individual demo-vault APYs (`14.2%`, `18.6%`, `9.4%`, `22.1%`) with one quiet "for demonstration purposes only" line buried below them. The phrase *"vault holders earn fees regardless — pro rata, every day, no matter what"* reads as a guaranteed-return claim. There are no `/risks`, `/terms`, `/privacy`, `/security`, or `/about` pages with real content. There is no "not financial advice" disclaimer and no jurisdictional language.
3. **The hero fails the 5-second test.** The H1 (*DEPOSIT. Earn TOGETHER.*) and supporting copy do not answer *what is this*, *who is it for*, *why creator vaults matter*, or *what ERC-4626 has to do with creator coins*. Only "what to do next" (Join Waitlist) is clear.
4. **There is no inline waitlist form.** Every CTA points to `/waitlist`, which is JS-rendered and `noindex`. An X-ad click → JS load → form render is a fragile chain.
5. **There is no X/Twitter link in the static HTML and no `twitter:site` / `twitter:creator` meta tag.** The footer links GitHub and Discord but not the handle the user wants to drive ads from.
6. **The site looks more advanced than it is.** Vault tiles displayed with TVL ($1.8M, $3.2M, $740K, $520K), depositor counts (2,148), and APYs read as a live product. The viral X clip from a screenshot will misrepresent the protocol's stage — and that screenshot risk is the single biggest reputation hazard right now.

### Overall score: **5.4 / 10**

Visual craft and ecosystem credibility carry the score upward (Base, Zora, Uniswap, LayerZero, Chainlink, Solana, Meteora, Ajna, Charm logos in the hero are real signal). Crawlability, compliance, and 5-second-test failures pull it down hard.

| Dimension | Score | One-line |
|---|---|---|
| Hero clarity (5-second test) | 3.0 / 10 | Fails 4 of 5 questions. |
| Conversion path | 5.0 / 10 | One clear CTA, but no inline form, no social proof, mislabeled "View All Vaults" link. |
| Positioning | 5.5 / 10 | The mechanic is unique; the hero does not communicate it. |
| Trust & safety | **2.5 / 10** | No risks, terms, privacy, security, about; no NFA. Highest-risk dimension. |
| Compliance / wording | **2.0 / 10** | Multiple guaranteed-yield-shaped phrases and unguarded APY numbers. |
| SEO / indexability | **2.0 / 10** | Site is structurally invisible to crawlers and AI engines. |
| GEO (AI engine visibility) | 1.5 / 10 | No Wikipedia, no DeFi Llama, no Mirror, no third-party coverage. |
| Accessibility | 4.0 / 10 | All images have alt text and `lang=en`, but no semantic landmarks, no skip link, H1 spelled letter-by-letter. |
| Performance signals | 5.5 / 10 | Strong CSP/HSTS, HTTP/2, Vercel cache; 4 render-blocking CSS, 785KB OG image, GSAP without `defer`. |
| X/Twitter readiness | 3.0 / 10 | No X link, no `twitter:site`, APY copy will fail X ads policy review per [X financial-services ad rules](https://business.x.com/en/help/ads-policies/ads-content-policies/financial-services.html). |
| Brand voice | 6.0 / 10 | Cadence is good and onchain-native; vocabulary is too jargon-dense and the tagline "Earn together" is ambiguous. |

### Top 3 strengths

- **Strong technical/ecosystem stack visibly earned.** Base, Zora, Uniswap, LayerZero, Chainlink, Solana, Meteora, Ajna, Charm in the hero is real positioning, not vapor — backed by a docs subdomain on Docusaurus and a CSP that explicitly trusts those domains.
- **Excellent security headers.** HSTS, strict CSP allowlist, X-Content-Type-Options, Referrer-Policy, HTTP/2 — Vercel-grade hosting hygiene.
- **A genuinely differentiable mechanic.** The combination of ERC-4626 redeemability + 12-month creator vesting + 20% protocol-owned liquidity from CCA + cross-chain Solana yield is not what Friend.tech, Zora creator coins, or Pump.fun do — and not what [Doppler](https://doppler.lol), the dominant Base launchpad primitive, offers either.

### Top 3 critical issues

1. **Compliance language risk + missing `/risks` page** — Critical. The featured vault tiles will be screenshotted out of context.
2. **`noindex` on every subpage + no SSR** — Critical. SEO and GEO are zero today.
3. **Hero does not pass the 5-second test for the audiences the user named** — Critical for X ad ROI.

### Key growth opportunities

- "ERC-4626 creator vault" and "creator coin yield Base" are low-competition keywords today. First-mover SEO is open if crawlability is fixed in the next 30 days.
- Strong differentiation versus [Doppler](https://defillama.com/protocol/doppler) (generic launchpad infra), Zora creator coins (no underlying yield), and Friend.tech (collapsed) is *available* but not yet *messaged*.
- [Subreddits like r/BASE and r/zora have active threads](https://www.reddit.com/r/zora/comments/1mqblqv/so_what_do_we_actually_do_with_creator_coins/) where creators are explicitly asking the question 4626.fun answers.

---

## Product overview

4626.fun is a Base-native creator-finance protocol that wraps creator coins inside ERC-4626 tokenized vaults and launches the resulting share token via a 7-day Uniswap V4 Continuous Clearing Auction.

**Mechanic** (per [the homepage body](https://4626.fun)):
- Creator deposits 50,000,000 of their own creator coin as a one-time genesis deposit.
- 90% is allocated across three yield strategies; 10% stays idle for instant redemptions.
  - 30% → [Ajna Protocol](https://www.ajna.finance/) — permissionless lending — illustrative range 4.2–7.8% APY
  - 30% → [Charm Finance Alpha Vaults](https://charm.fi/) on Uniswap V3 — concentrated liquidity — illustrative range 12.5–24.1% APY
  - 30% → bridged via [LayerZero OFT](https://layerzero.network/) to [Meteora Alpha Vaults](https://www.meteora.ag/) on Solana — DLMM — illustrative range 18.3–31.7% APY
- Depositors receive a vault share token (e.g., ■AKITA, ■JESSE) which is redeemable anytime.
- Share token launches via a Uniswap V4 Continuous Clearing Auction (CCA) over 7 days: 40% public auction · 40% creator-vested linearly over 12 months · 20% seeded as protocol-owned liquidity into a ■SHARE/ETH full-range pool.

**Audience (per the user's brief):** Base builders, Zora users, creator-coin communities, crypto-native creators, DeFi users, protocol founders, onchain app developers, partner candidates.

**Site surface:** marketing SPA at 4626.fun (single page, ~72KB shell), docs site at [docs.4626.fun](https://docs.4626.fun) (Docusaurus 3.9.2), no other real pages.

---

## What's working

- The **mechanic explanation** in body copy (Tokenize → Allocate → Accrue → Share Token → Full Picture) is technically honest and well-paced.
- The **strategy breakdowns** (Ajna 30% / Charm 30% / Meteora 30% / Idle 10%) name real protocols and make the vault auditable in concept.
- **Visual identity** is distinctive (gold/cream palette, ■SHARE typography). The OG image renders well in X cards (size aside).
- **Security headers** (CSP, HSTS, no-sniff) are production-grade.
- **All images have alt text**; `<html lang="en">`; viewport meta correct.
- **Discord and GitHub** are linked → baseline community openness.
- The **dot-separator cadence** ("Fees flow back · pro rata") is onchain-native and brand-distinct.
- The **docs subdomain tagline** — *"A creator economy that behaves like a system"* — is the strongest single piece of brand copy you have. It belongs on the marketing site.

---

## What's confusing

| What a visitor sees | What they actually wonder |
|---|---|
| `D E P O S I T . Earn TOGETHER.` | Deposit what? Earn what? Earn with whom? |
| `ERC-4626 Creator Vaults on Base` | What's a creator vault? What's ERC-4626? Is this a yield product or a creator product? |
| `Deposit a creator coin into a vault. Receive vault shares. Fees shared pro rata. Redeemable anytime.` | I'm not a creator. I'm a fan / a builder. Is this for me? |
| `Akita Vault — APY 14.2% · TVL $1.8M · 2,148 depositors` | Is this a real product I can deposit into right now? (No.) |
| `Bridged to Solana for Meteora Alpha Vault liquidity` | Why do I need a Solana bridge to use a Base creator coin? |
| `View All Vaults →` | Where do these go? (Answer: `/waitlist`, surprisingly.) |
| `Join the Waitlist · Early access · No spam · Unsubscribe anytime` | Form? Where? (Answer: rendered after JS click-through.) |

> **Brand voice note** — pulled from `brand-positioning.md`: the homepage is *mechanism-first, outcome-last*, while every benchmark protocol the audit checked ([Morpho](https://morpho.org/), [Zora](https://zora.co), [Yearn](https://yearn.fi), [Pump.fun](https://pump.fun/)) leads with the outcome and suppresses mechanism in the hero.

---

## Top conversion blockers (ranked)

1. **Hero answers "how" before "why."** No visitor leaves the fold knowing why creator vaults matter to them specifically.
2. **No inline waitlist form above the fold.** Every CTA is a click-through to a JS-rendered route.
3. **Demo APY tiles look real.** A skeptical visitor closes the tab; a credulous one signs up for the wrong reason.
4. **"View All Vaults" → `/waitlist`** is a bait-and-switch link that breaks first-interaction trust.
5. **No social proof above the fold.** Ecosystem logos imply backing but no creator/builder names, no "X creators on the waitlist", no audit badge.
6. **No founder face / handle.** "Built by [@founder]" with photo + X handle costs nothing and lifts trust meaningfully.
7. **No risk/disclaimer language visible early** — sophisticated DeFi users bounce.
8. **No X handle in the footer**; audience is on X but the site doesn't reciprocate.
9. **`/waitlist` is `noindex`, no SSR**; X ads are essentially betting on JS executing perfectly on every clicker's device.
10. **Mobile**: 4 render-blocking CSS files + heavy GSAP timelines + 785KB OG image → measurable LCP cost on the X-ads landing-page-experience score.

---

## Trust / credibility gaps

The site is missing every standard trust artifact a Base-native, creator-adjacent, retail-visible protocol must publish before driving paid traffic. From `compliance-trust.md`:

- No `/risks` page
- No `/security` page (audit status, multisig, bug bounty, emergency-pause policy)
- No `/terms`, no `/privacy`
- No `/about` (founder bio, operating entity — `AKITA, LLC` per session context)
- No "not financial advice" disclaimer
- No jurisdictional disclaimer (US persons, OFAC sanctioned, etc.)
- No protocol status badge (testnet vs. mainnet vs. pre-launch)
- No deployed contract addresses with Etherscan/Basescan links
- No audits page (none, scheduled, or completed)
- No bug bounty (TBD or Immunefi)
- No clear "official links" block to defend against the impersonation attacks that follow any X traction
- Founder is linked only as `github.com/wenakita` — not framed as the team
- No security@ disclosure email

---

## Crypto / compliance wording risks (verbatim, with severity)

Pulled from `compliance-trust.md`. Each item below is currently on the live page.

| # | On-site phrase | Risk | Severity |
|---|---|---|---|
| 1 | `Est. Yield 4.2 – 7.8% APY` (Ajna), `12.5 – 24.1% APY` (Charm), `18.3 – 31.7% APY` (Meteora) | Yield projections without conditional framing | **Critical** |
| 2 | `APY 14.2% · TVL $1.8M · 2,148 depositors` (and three other vault tiles) | Specific APY claims with social-proof signals on a product not yet live | **Critical** |
| 3 | `The token price can do anything. But vault holders earn fees regardless — pro rata, every day, no matter what.` | Reads as guaranteed return | **Critical** |
| 4 | `Earn together` / `Earn alongside the community` (repeated) | Earn-passive-income framing without disclaimer | High |
| 5 | `Redeemable anytime` (no qualifier) | Implies guaranteed liquidity | High |
| 6 | One small "For demonstration purposes only" line below the vault tiles | Disclaimer too small, too late, too quiet | High |
| 7 | No NFA disclosure anywhere on page | Standard disclosure missing | High |
| 8 | No jurisdictional language | OFAC / US-persons exposure | High |
| 9 | CCA shown as bootstrap mechanic with no clarity on who is selling, who can buy, or how proceeds are routed | Could be framed as a securities offering | **Critical** |
| 10 | Featured vault tiles screenshot-able with no "DEMO" badge inside the tile | Viral misrepresentation risk on X | **Critical** |

X's [advertising policy on financial services](https://business.x.com/en/help/ads-policies/ads-content-policies/financial-services.html) explicitly bars promises of "returns, profits, or gains." With items 1–3 live on the homepage, X Premium Business ad review will likely fail.

### Safer drop-in replacements

**Before:** `Est. Yield 4.2 – 7.8% APY`
**After:** `Illustrative strategy yield range. Past performance is not indicative of future returns. Vaults are not yet live.`

**Before:** `APY 14.2% · TVL $1.8M · 2,148 depositors`
**After (drop into the tile, big badge top-left):**
> `[ DEMO PREVIEW — illustrative only, vaults not yet live ]`
> Strategy mix · Ajna 30% · Charm 30% · Meteora 30% · Idle 10%
> [Read about strategy risks →]

**Before:** `vault holders earn fees regardless — pro rata, every day, no matter what.`
**After:** `Vault depositors receive a pro-rata claim on fees generated by the underlying strategies. Fees depend on volume and may be zero in any given period. Strategy yields are variable and may be negative when impermanent loss exceeds fee income. Vault shares are not deposits, are not insured, and may lose value.`

**Before:** `Redeemable anytime.`
**After:** `Withdrawals processed against the 10% idle buffer. Larger redemptions may be queued or filled by unwinding strategy positions; cross-chain (Solana) positions can take longer.`

**Add globally** — sticky footer strip, persistent across the page:
> `4626.fun is experimental software. Vault tiles and APY figures are illustrative previews, not live products. Nothing here is investment, legal, or tax advice. Read the risks.`

---

## Competitor analysis (summary)

Full table in `competitor-analysis.md`. The competitive landscape clusters into five categories. Highlights:

- **Direct creator-coin competitors:** [Zora Creator Coins](https://zora.co) (1.8M+ tokens minted, [27M+ in creator rewards by Q2 2025](https://www.okx.com/en-us/learn/zora-trading-creator-economy-tokenized-content) — massive distribution, no yield mechanism), Friend.tech (defunct — [shut down per Yahoo Finance](https://finance.yahoo.com/news/social-platform-friend-tech-shuts-065105515.html)), [Bonfire](https://bonfirenetworks.org/app/social/) (alternative architecture, smaller).
- **Vault infrastructure competitors:** [Morpho Vaults](https://docs.morpho.org/build/earn/concepts), [Yearn V3](https://docs.yearn.fi/developers/v3/vault_management), [Lagoon Finance](https://docs.lagoon.finance/vault/fees) — none focus on creator coins.
- **Auction/launchpad competitor (most direct):** [Doppler](https://doppler.lol) — [90%+ of Base DEX pool launches, $9M seed from Pantera/Coinbase Ventures](https://defillama.com/protocol/doppler). Doppler controls the CCA primitive 4626.fun uses, but Doppler is *generic launch infra* and has no vault layer or POL strategy.
- **Cautionary counterexamples:** [Friend.tech](https://blog.pontem.network/what-is-friend-tech-the-socialfi-sensation-on-base-b0d250bdd166) and Rally — both collapsed due to misaligned creator incentives, no redemption mechanism, and bespoke (non-standard) tokens. 4626.fun's 12-month vesting + ERC-4626 redeemability + POL directly addresses all three failure modes. **This is the single strongest narrative the marketing site is not yet telling.**

### Six concrete differentiation opportunities (from `competitor-analysis.md`)

1. **ERC-4626 composability** as collateral — vault shares slot into Morpho, Aave, Euler.
2. **Instant `redeem()`** as a trust primitive — "you can leave anytime" is a Friend.tech-era pain point answered.
3. **Creator vesting** as a verifiable commitment signal — onchain proof the creator can't dump.
4. **Cross-chain yield to Solana** — no creator-coin protocol does this today.
5. **Protocol-owned liquidity from day one** — vs. mercenary liquidity that fled Friend.tech.
6. **Passive/perpetual vault economics** vs. subscription or access-token models.

---

## Brand & positioning recommendations

Full analysis in `brand-positioning.md`. Three positioning angles tested; recommendation below.

### Three positioning angles

| Angle | One-sentence positioning | Tagline | Hero subhead |
|---|---|---|---|
| **A · Builder/Infra-led (recommended)** | For Base builders, 4626.fun is open-source vault infrastructure that turns any creator coin into a yield-bearing, redeemable share token, unlike bespoke launchpads. | *Creator finance infrastructure. One click to deploy.* | Open ERC-4626 standard. Permissionless. Composable. |
| **B · Creator-led** | For Zora and Base creators, 4626.fun is a vault that puts your creator coin to work, unlike speculative trading-only tokens. | *Your coin. Working for you.* | Tokenize once. Earn from your community's liquidity. |
| **C · Depositor/Fan-led** | For onchain creator-economy fans, 4626.fun is a way to back a creator and earn from holding, unlike one-way social tokens. | *Back your people. Earn while you hold.* | A vault share that grows with the creator's onchain economy. |

**Recommended primary angle: A (Builder/Infra-led).** The user's audience priority list leads with "Base builders." Builder credibility cascades to creators and depositors; the reverse is harder.

### Seven voice rules (from `brand-positioning.md`)

1. Lead with the noun, not the mechanism.
2. Every page answers "What is this?" in <10 words.
3. Retire `pro rata` and `together` from public copy. Use "proportionally" and name the counterparty.
4. Every APY claim is conditionally framed by default. No exceptions.
5. Route creators and depositors to distinct copy paths from the hero.
6. The word "yield" is gated — only after a NFA disclosure or in technical/docs context.
7. CCA, OFT, DLMM, idle buffer — define inline on first use, every page.

---

## Recommended homepage rewrite (drop-in)

```
ERC-4626 Creator Vaults on Base

Turn any creator coin into a vault that earns trading fees,
mints a tradeable share token, and redeems on demand.

Open standard. Permissionless. Built on Base.

[ Join the builder waitlist → ]   [ Read the docs → ]

Experimental software · Audits in progress · Not financial advice
```

Below the hero, in this order:

1. **Two badges**: `Pre-launch · vaults not live yet` and `Built on Base · ERC-4626`. Honesty up front.
2. **Three audience cards** with their own CTAs: "I'm a creator → apply" · "I'm a builder → docs + waitlist" · "I'm a depositor → join the waitlist".
3. **The mechanic** (current Tokenize/Allocate/Accrue/Share Token/Full Picture sections — keep, but add H2s and define every term inline).
4. **Featured demo vaults** — re-skinned with `[ DEMO PREVIEW ]` badge inside every tile, range bands instead of point APYs, link to `/risks`.
5. **Ecosystem block** (the hero logos move here, with a "Why these protocols" one-paragraph note for each).
6. **Trust & safety strip**: Audits · Risks · Security · Contracts · Bug bounty (each linking to a real page).
7. **Founder + team**: small, with photo, X handle, GitHub.
8. **Inline waitlist form** (email + role + optional X handle, 3 fields max).
9. **Footer**: official links block (4626.fun, x.com/4626fun, docs.4626.fun, github.com/4626fun, discord.gg/4626) + "we will never DM you first" + entity name (AKITA, LLC) + jurisdiction.

---

## Recommended CTA structure

| Tier | Action | Where it lives |
|---|---|---|
| Primary | **Join the waitlist** (email + role) | Hero, sticky bottom on mobile, end-of-page inline form |
| Secondary | Read the docs | Hero (next to primary), top nav |
| Tertiary | Apply as a creator (Typeform/Tally) | Mid-page near "Tokenize" section |
| Tertiary | Talk to a builder (Discord deep link) | Mid-page near "Allocate" section |
| Tertiary | Partnership inquiries (mailto:partners@4626.fun) | Footer |

**Form fields** (3 max): Email · Role (Creator/Builder/Depositor/Partner/Other) · X handle (optional). Add Cloudflare Turnstile (already permitted in CSP).

---

## SEO & GEO assessment

Full detail in `seo-technical.md` and `seo-geo.md`. Headlines:

### Critical SEO fixes (top 6)

| # | Issue | Fix |
|---|---|---|
| 1 | Subpages serve `<meta name="robots" content="noindex,follow">` SPA shell with no SSR | Deploy `vite-ssg` or Playwright prerender for `/`, `/risks`, `/security`, `/about`, `/faq`, `/creators`, `/builders`, `/partners`, `/terms`, `/privacy`. Remove the global noindex once content renders. |
| 2 | `robots.txt` returns HTTP 405 | Ship a static `/public/robots.txt` with `Sitemap: https://4626.fun/sitemap.xml`. |
| 3 | `sitemap.xml` returns 405 (only `sitemap_index.xml` is 200) | Generate `sitemap.xml` at build time; have `sitemap_index.xml` reference it. Submit in Google Search Console. |
| 4 | 0 JSON-LD blocks site-wide | Add Organization, WebSite (with SearchAction), SoftwareApplication, FAQPage, BreadcrumbList. Snippets in `seo-geo.md`. |
| 5 | Missing `twitter:site` and `twitter:creator` | `<meta name="twitter:site" content="@4626fun">` and `<meta name="twitter:creator" content="@wenakita">`. |
| 6 | OG image is 785 KB | Compress to <200 KB (WebP or optimized PNG). |

### GEO (AI engine visibility)

Today, Perplexity / ChatGPT / Claude have effectively zero authoritative knowledge of 4626.fun. From `seo-geo.md`:

- No Wikipedia entry · no [DeFi Llama listing](https://defillama.com/) · no Mirror or Paragraph article · no CoinGecko / CoinMarketCap profile · no [The Block](https://www.theblock.co/) or [The Defiant](https://thedefiant.io/) coverage · no [ethresear.ch](https://ethresear.ch/) thread.
- The only AI-citable trace is a [LobeHub skill page](https://lobehub.com/zh-TW/skills/wenakita-creatorvault-vault-deployment) that names the deployment infrastructure but not the product.

**Eight 60-90 day GEO actions:**
1. Add JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList) to prerendered HTML.
2. Publish a docs explainer titled *"What is an ERC-4626 creator vault?"* under [docs.4626.fun](https://docs.4626.fun).
3. Submit a [DeFi Llama listing PR](https://github.com/DefiLlama/DefiLlama-Adapters) once vaults exist on testnet.
4. Publish a Mirror or Paragraph technical post on the CCA hook + vault architecture.
5. Pursue [CoinGecko](https://www.coingecko.com/) / [CMC](https://coinmarketcap.com/) listings post-launch.
6. Seed a Wikipedia stub once you have ≥3 third-party citations.
7. Post an ethresear.ch thread on the Continuous Clearing Auction primitive (high-value technical audience).
8. Pitch [The Defiant](https://thedefiant.io/) and [The Block](https://www.theblock.co/) for a launch story; aim for at least one tier-1 piece before X ad spend.

---

## Accessibility (WCAG 2.1 AA) — top issues

Full list in `accessibility.md`.

| # | Issue | WCAG | Severity |
|---|---|---|---|
| 1 | H1 DOM text is `D E P O S I T . Earn TOGETHER.` — letter-spaced via literal whitespace, screen readers spell it out | 1.3.1, 4.1.2 | High |
| 2 | Zero `<main>`, `<nav>`, `<header>`, `<footer>`, `<section>` — entire page is `<div>` soup | 1.3.1, 2.4.1 | High |
| 3 | No skip-to-content link | 2.4.1 | High |
| 4 | "View All Vaults" link points to `/waitlist` — link purpose mismatch | 2.4.4 | High |
| 5 | Hero gold #DDA01C on cream #F8F0E6 ≈ 2.6:1 contrast — fails AA for body text | 1.4.3 | Medium |
| 6 | GSAP-driven motion without confirmed `prefers-reduced-motion` honor | 2.3.3 | Medium |
| 7 | All 69 images have alt; `lang="en"`; viewport correct | 1.1.1, 3.1.1, 1.4.4 | **PASS** |

---

## X/Twitter readiness assessment

Full plan in `x-twitter.md`. Verdict and high-leverage details below.

### Verdict: **CONDITIONAL — do not run X Premium Business ads yet**

Reasons:

1. **Site is not crawlable**: ad clicks landing on `/waitlist` hit a JS-only `noindex` route. X's pixel/tracker can't measure as well; the OG card on shared replies will look thin.
2. **APY copy will fail X's [financial-services ads policy](https://business.x.com/en/help/ads-policies/ads-content-policies/financial-services.html)** — "returns, profits, or gains" language is barred; current copy says yield-bearing depositors *"earn fees regardless — pro rata, every day, no matter what."*
3. **No X handle in the static HTML and no `twitter:site`** — the brand and the handle are not linked from the Twitter Card unfurl.
4. **No `/risks`, `/terms`, `/about`** — landing-page-experience score will be low.
5. **Demo vault tiles screenshot-able as if real** — first viral X clip will be *"4626.fun says you earn 22% APY"* with no "demo" badge. That is a reputation risk that can outlast the protocol.

### Run 60 days of organic first; then ads. Order of operations:

| Phase | Duration | Actions |
|---|---|---|
| **0. Pre-flight** | 1 week | Fix items in the Vercel pre-launch checklist (below). Pre-empt the screenshot risk by adding DEMO badges and `/risks`. |
| **1. Profile readiness** | 1 week | Set up @4626fun (90-day age requirement, phone-confirmed, Professional Account, Business category = "Software" not "Cryptocurrency", domain email `hello@4626.fun`). |
| **2. Pin the launch thread, organic-only** | 4–6 weeks | The 9-tweet launch thread in `x-twitter.md` is ready to ship. Reply to 25 named accounts (Jesse Pollak, Zora team, ERC-4626/vault people, Base/Zora/Uniswap/LayerZero/Solana/Meteora/Ajna/Charm handles, CT educators). |
| **3. X Premium Business + ads** | week 8+ | Only after the homepage compliance copy is rewritten and `/risks` is published. Start at $50–$100/day on educational creatives, not yield creatives. |

### Pinned launch post (drop-in, ~240 chars)

```
Creators leave yield on the table every day.

Deposit your creator coin into a 4626.fun vault.
Receive vault shares.
Fees flow back to you — pro rata, every day.

ERC-4626 vaults on Base. Powered by Ajna, Charm + Meteora.

Waitlist → [tagged URL]
```

The full 9-tweet thread (with hook, mechanic, strategies, share token, why-it-matters, compliance disclaimer, demo vault honesty, CTA) is in `x-twitter.md`.

### 25 first-priority accounts to engage

Full list in `x-twitter.md`. Tier-1 highlights: `@jessepollak`, `@base`, `@zora`, `@js_horne` (Jacob Horne), `@MorphoLabs`, `@yearnfi`, `@LayerZero_Core`, `@MeteoraAG`, `@Uniswap`, `@AjnaProtocol`, `@CharmFinance`, `@0xfoobar`, `@ourzora`. Strategy is reply-with-depth, not promotion.

### UTM scheme (already in `conversion-analytics.md`)

Persist UTMs in `localStorage` on first visit; stamp into the waitlist insert (first-touch attribution).

```
?utm_source=x&utm_medium=social&utm_campaign=launch-2026-q2&utm_content=pinned
?utm_source=x&utm_medium=social&utm_campaign=launch-2026-q2&utm_content=reply-<thread-id>
?utm_source=x&utm_medium=ads&utm_campaign=x-bizpremium-v1&utm_content=<creative-id>
?utm_source=hn&utm_medium=organic&utm_campaign=show-hn-2026-05
?utm_source=reddit&utm_medium=organic&utm_campaign=launch-2026-q2&utm_content=r-<sub>-<thread>
```

---

## Hacker News strategy (summary)

Full plan in `hacker-news.md`. HN is structurally hostile to crypto; framing wins.

- **Recommended title:** `Show HN: 4626.fun – ERC-4626 creator-coin vaults on Base`
- **Best timing:** Tuesday or Wednesday, 09:00–10:00 EST (14:00–15:00 UTC) — per [a 2026 HN posting-time thread](https://news.ycombinator.com/item?id=47864566) and [a 73k-submission analysis](https://news.ycombinator.com/item?id=47986108).
- **Show HN body** is drafted in `hacker-news.md` (~300 words) — opens with mechanism, explicitly disclaims demo data, asks for feedback on auction-mechanism design and ERC-4626 inflation-attack handling.
- **Lower-stakes alternative:** post a technical writeup ("How we implemented a Continuous Clearing Auction hook on Uniswap V4") as a regular submission, no `Show HN:` prefix — bypasses the "is this real yet?" objection.
- **Threads to engage now** (link discovery in `hacker-news.md`): the [Coinbase Base launch thread](https://news.ycombinator.com/item?id=34912704), the [Yearn / Cronje thread](https://news.ycombinator.com/item?id=30591150), and the recent [HN-on-crypto retrospective](https://news.ycombinator.com/item?id=47047091). Comment substantively without linking the product on first comments.
- **Pre-write graceful comebacks** to the three predictable objections: *"why another DeFi yield thing"*, *"those APY numbers are marketing"*, *"creator coins are speculative"* — drafts in `hacker-news.md`.

---

## Reddit strategy (summary)

Full plan in `reddit.md`. Highlights:

- **10-subreddit map** with subscriber counts and self-promo rules: [r/BASE](https://www.reddit.com/r/BASE/), [r/ethereum](https://www.reddit.com/r/ethereum/), r/ethfinance (now merged into r/ethereum Daily), [r/defi](https://www.reddit.com/r/defi/), [r/CryptoTechnology](https://www.reddit.com/r/CryptoTechnology/), [r/ethdev](https://www.reddit.com/r/ethdev/), [r/zora](https://www.reddit.com/r/zora/), [r/CryptoCurrency](https://www.reddit.com/r/CryptoCurrency/), [r/CreatorEconomy](https://www.reddit.com/r/CreatorEconomy/), [r/passive_income](https://www.reddit.com/r/passive_income/) (with caution).
- **7 live threads cited with the exact pain points 4626.fun solves**, including [*"so what do we actually do with creator coins?"*](https://www.reddit.com/r/zora/comments/1mqblqv/so_what_do_we_actually_do_with_creator_coins/) and [*"Zora the future of the creator economy or just a…"*](https://www.reddit.com/r/BASE/comments/1o8alv1/zora_the_future_of_the_creator_economy_or_just_a/).
- **5 draft replies** (80–150 words each), each leading with the user's stated problem, ending with builder disclosure.
- **r/BASE launch post** framed as building-in-public / feedback request with specific open design questions (CCA vs. Dutch, minimum TVL, creator UX) — the framing that survives moderator review.
- **Critical pre-condition:** `/risks` must be a real page before any Reddit post. Linking to a `noindex` SPA shell will get the post removed.

---

## Tracking recommendations (Supabase + UTMs)

Full schema in `conversion-analytics.md`.

### Supabase tables

`events` (every visitor interaction):
- columns: `id`, `created_at`, `event_name`, `session_id`, `visitor_id`, `path`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `props jsonb`
- events to fire: `page_view`, `hero_cta_click`, `docs_click`, `discord_click`, `github_click`, `x_click`, `waitlist_modal_open`, `waitlist_form_start`, `waitlist_form_field_complete`, `waitlist_submit_success`, `waitlist_submit_error`, `vault_card_view`, `vault_card_click`, `risks_link_click`, `scroll_depth` (25/50/75/100)

`waitlist`:
- columns: `id`, `created_at`, `email unique`, `role`, `x_handle`, `utm_source/medium/campaign/content/term`, `referrer`, `visitor_id`, `ip_country` (from Vercel geolocation header), `ip_hash` (never raw IP), `confirmed_at`, `status`
- RLS: anon `INSERT` only; service role for read

### Five dashboards to build
1. Waitlist by source (utm_source × utm_campaign × utm_content over time)
2. Funnel (page_view → form_start → submit_success per source)
3. X campaign performance by creative (`utm_content`)
4. Role mix (Creator/Builder/Depositor/Partner) over time
5. Geo distribution (for OFAC/jurisdictional awareness)

---

## Linear task list (titles + acceptance criteria)

Copy-paste these into Linear. Severity prefix follows the priority plan below.

### Critical (do before any X push)

1. **[CRIT] Replace APY tile copy with `[ DEMO PREVIEW ]` badge + range bands**
   - Acceptance: every featured-vault tile renders an explicit `[ DEMO PREVIEW — illustrative only, vaults not yet live ]` badge top-left, no point APY values shown, "Read about strategy risks →" link points to `/risks`. Verified on mobile and desktop.

2. **[CRIT] Build `/risks` page with full disclosure copy**
   - Acceptance: page covers smart-contract, strategy, creator-coin, liquidity, bridge, CCA, regulatory risks; ends with NFA + jurisdictional language; linked from footer + every APY/yield mention; renders prerendered HTML (not behind JS).

3. **[CRIT] Build `/security` page (audit status, multisig, bug bounty, emergency pause)**
   - Acceptance: shows current status (pre-launch / testnet / mainnet), audit status (none/scheduled/completed with reports), Gnosis Safe address with signers, timelock parameters, security@ disclosure email, emergency-pause policy.

4. **[CRIT] Rewrite "vault holders earn fees regardless… no matter what" line**
   - Acceptance: replaced with the conditional rewrite from `compliance-trust.md`; shipped on every page where it appears; verified by grep over the build output.

5. **[CRIT] Add `<meta name="robots" content="noindex,nofollow">` to homepage if launching ads, OR remove SPA-route `noindex` once SSR ships — pick one and document**
   - Acceptance: site has a single, consistent indexability policy; documented in `/4626 — SEO playbook` Notion page.

6. **[CRIT] Implement build-time prerender (vite-ssg or Playwright) for `/`, `/risks`, `/security`, `/about`, `/terms`, `/privacy`, `/faq`, `/creators`, `/builders`, `/partners`**
   - Acceptance: `curl -A Googlebot https://4626.fun/risks` returns full HTML body (>5KB body text), no `noindex` meta on those routes, OG tags present per route.

7. **[CRIT] Ship `/robots.txt` and `/sitemap.xml` at build time; reference sitemap from robots**
   - Acceptance: `https://4626.fun/robots.txt` returns 200 with `Sitemap: https://4626.fun/sitemap.xml`; `sitemap.xml` returns 200 with all prerendered routes; submitted in Google Search Console.

8. **[CRIT] Add JSON-LD blocks to head**
   - Acceptance: prerendered HTML includes Organization, WebSite (with SearchAction), SoftwareApplication, FAQPage, BreadcrumbList. Validates in [Google Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/).

9. **[CRIT] Add `twitter:site=@4626fun` and `twitter:creator=@wenakita` meta tags**
   - Acceptance: present in HTML head on every prerendered route; X Card Validator shows attribution.

10. **[CRIT] Add `/about` page with founder + AKITA, LLC entity, jurisdiction**
    - Acceptance: page shows founder photo, X handle, GitHub, AKITA, LLC operating entity name + state of incorporation; linked from footer.

11. **[CRIT] Add sticky compliance disclaimer strip** (`experimental software · not financial advice · read the risks`)
    - Acceptance: visible across page on scroll; dismissible only after click-through on `/risks`; persists in localStorage.

### High

12. **[HIGH] Compress OG image to <200KB; ship 1200×630 JPEG + WebP**
    - Acceptance: `curl -I https://4626.fun/social/og-image-1200x630.png` shows content-length <200000; preview tested in [X Card Validator](https://cards-dev.x.com/validator), Discord, Slack, LinkedIn.

13. **[HIGH] Inline waitlist form on homepage above the fold**
    - Acceptance: 3 fields (email, role, x_handle optional), Cloudflare Turnstile, posts to Supabase `waitlist` table with full UTM stamping, success state via `role="status"` for a11y.

14. **[HIGH] Fix H1 — move letter-spacing to CSS, semantic text in DOM**
    - Acceptance: DOM `<h1>` text reads `Deposit. Earn together.` (or chosen rewrite); visual treatment unchanged; VoiceOver speaks the heading as a sentence.

15. **[HIGH] Wrap layout in semantic landmarks + add skip-to-content link**
    - Acceptance: `<main>`, `<header>`, `<nav>`, `<section>`, `<footer>` present; `.skip-link` first focusable element; passes `axe DevTools` with no landmark violations.

16. **[HIGH] Honor `prefers-reduced-motion` in GSAP timelines**
    - Acceptance: `matchMedia('(prefers-reduced-motion: reduce)').matches` short-circuits all GSAP and ScrollTrigger init; `@media (prefers-reduced-motion: reduce)` rule kills float animations in CSS.

17. **[HIGH] Replace "View All Vaults → /waitlist" with either real `/vaults` page or honest CTA copy**
    - Acceptance: link destination matches link text; verified in axe audit.

18. **[HIGH] Add X handle, support email, contracts (when live) to footer**
    - Acceptance: footer renders 4 official links + `hello@4626.fun` mailto + (post-deploy) deployer-key-signed contract list page.

19. **[HIGH] Add Supabase `events` and `waitlist` tables with RLS**
    - Acceptance: anon can `INSERT` only; reads gated to service role; tested with `pg_typecast` for utm_* columns; Discord webhook fires on `waitlist_submit_success`.

20. **[HIGH] Set up Cloudflare Turnstile on waitlist form (CSP already permits)**
    - Acceptance: form submission server-side validates the Turnstile token before insert.

21. **[HIGH] Submit `/sitemap.xml` to Google Search Console; verify domain ownership**
    - Acceptance: GSC reports successful sitemap ingest, no coverage errors on prerendered routes.

22. **[HIGH] X Premium Business profile setup + Professional Account category = Software (not Cryptocurrency) + domain email + UTM-tagged bio link**
    - Acceptance: gold checkmark applied; `@4626fun` linked from site footer; bio reads against the formula in `x-twitter.md`.

### Medium

23. **[MED] Inline critical CSS for above-the-fold; defer the other 3 stylesheets**
    - Acceptance: Lighthouse Perf ≥ 85 on mobile; LCP < 2.5s on 4G throttle.

24. **[MED] Add `defer` to GSAP + ScrollTrigger; lazy-init below-the-fold via IntersectionObserver**
    - Acceptance: First-load JS payload reduced; verified in Network tab.

25. **[MED] Register confusable domains and 301 to canonical** (`4626.app`, `4626.xyz`, `4626fun.com`, `0x4626.fun`, `4626.io`)
    - Acceptance: each returns 301 to `https://4626.fun/?ref=anti-phish-<source>`.

26. **[MED] Add `/terms` and `/privacy` real pages**
    - Acceptance: minimum-viable ToS (jurisdiction, dispute resolution, eligibility, prohibited use, no-warranty, limitation of liability) and Privacy (data collected, processors — Vercel/Supabase/Privy, retention, opt-out, contact); linked from footer; prerendered.

27. **[MED] Set up Sentry (or equivalent) for FE error tracking**
    - Acceptance: errors during `waitlist_submit` flow surface in Sentry within 60s; release tagging hooked to Vercel deploys.

28. **[MED] Build the 5 dashboards** (Waitlist by source, Funnel, X campaigns, Role mix, Geo)
    - Acceptance: SQL views or Metabase/Retool dashboards live, accessible to founder, refreshing daily.

29. **[MED] Switch GitHub link from `github.com/wenakita` to `github.com/4626fun` org once org exists**
    - Acceptance: footer + JSON-LD `sameAs` updated; old URL 301s if possible.

### Low

30. **[LOW] Pinned launch thread drafted, scheduled, and approved by founder per the X Operating Manual**
31. **[LOW] Build `/vaults` index page with proper "demo only" framing (replaces the "View All Vaults" → /waitlist redirect)**
32. **[LOW] Run a Lighthouse + axe DevTools full audit; target Lighthouse Perf ≥ 85, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 95**
33. **[LOW] Add HSTS preload submission** (`includeSubDomains; preload`) once subdomains are stable.

---

## Airtable fields to add

Full schema in `conversion-analytics.md`. Two bases:

**Base: 4626 Leads**
- `Waitlist` table: Email, Role (Creator/Builder/Depositor/Partner/Other), X Handle, Joined At, UTM Source/Medium/Campaign/Content/Term, Referrer, IP Country, Status (New/Confirmed/Contacted/Replied/Qualified/Disqualified), Tags (multi-select), First Touch Source, Last Activity, Discord Username, Notes, Owner, Lead Score (rule-based), Outreach Stage.
- `Creators` table: Creator Name, Creator Coin Symbol, Coin Contract Address, Chain, Audience Size, X Followers, Zora URL, Why-this-vault, Genesis-deposit-ready, Status, Vault Code, Linked Waitlist Record.
- `Builders` table: Name, GitHub, X, What-they-want-to-build, Stack (multi), Hackathon-availability, Status.
- `Partners` table: Org Name, Type (Protocol/Wallet/L1L2/Tooling/Media/Investor), Contact Name, Contact Email, X/TG, Status, Next Step, Owner.

**Base: 4626 Campaigns**
- `Campaigns` table: Campaign Name (matches utm_campaign), Channel, Goal, Spend, Start, End, Creative Notes, Pinned URL, Status, Owner, Linked Leads (rollup from Waitlist on utm_campaign), CPL (formula), Conversion Rate.

---

## Notion pages to create

1. `/4626 — Master` (top-level index)
2. `/4626 — Brand & Voice` (single source of truth for tone, do/don't word lists, banned phrases, hero copy versions)
3. `/4626 — Risk & Compliance Library` (long-form risk text, jurisdictional notes, "things we never say" list)
4. `/4626 — Launch Plan (Q2 2026)` (Gantt with X launch date, ad start, HN Show, Reddit posts, partner intros)
5. `/4626 — Roadmap` (public + internal)
6. `/4626 — Creator Onboarding Playbook` (genesis deposit checklist, comms templates)
7. `/4626 — Builder Outreach Playbook` (DM templates, profile screening, weekly cadence)
8. `/4626 — X Operating Manual` (pinned thread, daily cadence, who can post, banned phrases)
9. `/4626 — Security & Audits` (internal audit reports, multisig signers, incident-response runbook)
10. `/4626 — Glossary` (plain-English ERC-4626, vault share, CCA, OFT, DLMM, concentrated liquidity)
11. `/4626 — Press & Media Kit` (logos PNG/SVG, screenshots, founder bio, embargo policy)
12. `/4626 — Lead Triage SOP` (status-by-status response procedure, owner assignments)

---

## Vercel pre-launch checklist

| # | Item |
|---|---|
| 1 | Implement build-time prerender for prerenderable routes (vite-ssg / Playwright) |
| 2 | Generate static `robots.txt` referencing `sitemap.xml` |
| 3 | Generate `sitemap.xml` (replace bare `sitemap_index.xml`) |
| 4 | Add JSON-LD: Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList |
| 5 | Add `twitter:site` + `twitter:creator` meta |
| 6 | Compress OG image <200KB (PNG → WebP/optimized JPEG) |
| 7 | Ship `/risks` real page |
| 8 | Ship `/security`, `/terms`, `/privacy`, `/about` real pages |
| 9 | Replace H1 DOM text — semantic heading + CSS letter-spacing |
| 10 | Wrap in semantic landmarks; add skip link |
| 11 | Honor `prefers-reduced-motion` |
| 12 | Add sticky compliance disclaimer strip |
| 13 | Replace point APYs in vault tiles with `[ DEMO PREVIEW ]` badge + range bands |
| 14 | Fix "View All Vaults" link target |
| 15 | Add X handle, support email, contracts (when live) to footer |
| 16 | Replace `github.com/wenakita` link with `github.com/4626fun` org |
| 17 | Set up Supabase `events` + `waitlist` with RLS |
| 18 | Add Plausible / PostHog or Vercel Analytics with custom events |
| 19 | Discord webhook on waitlist signup (filter to role=creator/partner) |
| 20 | Cloudflare Turnstile on waitlist form |
| 21 | Set `Cache-Control: public, max-age=300, s-maxage=3600` on shell |
| 22 | `vercel.json` redirects for confusable domains |
| 23 | Set up Sentry for FE error tracking |
| 24 | Lighthouse + axe DevTools pass: Perf ≥ 85, A11y ≥ 95, SEO ≥ 95 |
| 25 | Test OG card in X / LinkedIn / Discord validators |
| 26 | Verify @4626fun X handle, set bio + UTM-tagged bio link |

---

## Priority action items

| # | Action | Category | Severity | Effort | Priority |
|---|---|---|---|---|---|
| 1 | Replace APY tile copy with DEMO badge + range bands | Compliance | **Critical** | S | **P0** |
| 2 | Build `/risks` page (real content, prerendered) | Trust | **Critical** | M | **P0** |
| 3 | Rewrite "earn regardless… no matter what" line | Compliance | **Critical** | S | **P0** |
| 4 | Add sticky compliance disclaimer strip | Compliance | **Critical** | S | **P0** |
| 5 | Implement prerender for non-home routes; fix `noindex` policy | SEO | **Critical** | L | **P0** |
| 6 | Ship `robots.txt` + `sitemap.xml` | SEO | **Critical** | S | **P0** |
| 7 | Add JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList) | SEO/GEO | **Critical** | M | **P0** |
| 8 | Add `twitter:site` + `twitter:creator` meta + X handle in footer | X-readiness | **High** | XS | **P0** |
| 9 | Build `/security` page | Trust | **Critical** | M | **P0** |
| 10 | Build `/about` page (founder + AKITA, LLC) | Trust | **Critical** | S | **P0** |
| 11 | Inline waitlist form on homepage + Turnstile | Conversion | **High** | M | **P1** |
| 12 | Rewrite hero per recommended copy; clarify 5-second test | Conversion/Brand | **High** | S | **P1** |
| 13 | Fix H1 DOM letter-spacing → CSS | A11y/SEO | **High** | XS | **P1** |
| 14 | Wrap in semantic landmarks; skip link | A11y | **High** | M | **P1** |
| 15 | Compress OG image <200KB | Performance | **High** | XS | **P1** |
| 16 | Fix "View All Vaults" link mismatch | A11y/Trust | **High** | XS | **P1** |
| 17 | Replace H1 fragmented text with keyword-bearing semantic version | SEO | **High** | XS | **P1** |
| 18 | Stand up Supabase `events` + `waitlist` schema + UTM stamping | Analytics | **High** | M | **P1** |
| 19 | `/terms` + `/privacy` real pages | Compliance | **High** | M | **P1** |
| 20 | Honor `prefers-reduced-motion` | A11y | **Medium** | XS | **P2** |
| 21 | Inline critical CSS; defer GSAP | Performance | **Medium** | M | **P2** |
| 22 | Submit DeFi Llama listing PR (post-testnet) | GEO | **Medium** | M | **P2** |
| 23 | Publish Mirror/Paragraph technical post on CCA | GEO/Brand | **Medium** | M | **P2** |
| 24 | Pitch The Defiant + The Block | GEO | **Medium** | L | **P2** |
| 25 | Register + 301 confusable domains | Anti-scam | **Medium** | S | **P2** |
| 26 | Pinned launch thread + 25-account engagement plan organic | X-growth | **Medium** | M | **P2** |
| 27 | Show HN ready + scheduled (Tue/Wed 09 EST) | HN | **Medium** | S | **P3** |
| 28 | r/BASE building-in-public post | Reddit | **Medium** | S | **P3** |
| 29 | X Premium Business activation + ads start ($50–$100/day educational creatives only) | X-ads | **High** | M | **P3 (after P0+P1 complete)** |
| 30 | Build the 5 analytics dashboards | Analytics | **Low** | M | **P3** |

**Sequencing rule:** Do not advance a P-tier until all items in the previous tier are merged on `main` and live in production.

---

## Conclusion

4626.fun is closer than it looks and farther than it feels. The mechanic is genuinely differentiable, the ecosystem stack is real, and the brand has a few lines of copy ([the docs subdomain's *"a creator economy that behaves like a system"*](https://docs.4626.fun)) that are sharper than anything currently on the marketing site. But the homepage is built for visual impression, and the audiences the user wants to convert from X — Base builders, Zora creators, DeFi power users, partner candidates — each need different proof, different copy, and different trust signals before they sign up to a waitlist for an experimental crypto vault.

The fastest path to ad-readiness is not more copy or more design. It is:

1. **Lower the screenshot risk now.** Add `[ DEMO PREVIEW ]` badges inside every vault tile, rewrite the three guaranteed-yield-shaped sentences, and ship a real `/risks` page. Do this in the next 48 hours. This is recoverable polish; a viral *"4626.fun says you earn 22% APY"* X clip is not.
2. **Make the site indexable.** Prerender, real `robots.txt`, real `sitemap.xml`, JSON-LD. Without these, ad spend leaks straight back to X and never compounds into search demand.
3. **Run organic on X for 60 days.** The thread, replies, and 25-account engagement plan in `x-twitter.md` build the credibility that paid ads need to convert. Add the X handle and `twitter:site` to the site in the same deploy that fixes APY copy.
4. **Then run X Premium Business ads** — at $50–$100/day, educational angle, never yield-led — measured on `utm_content` per creative against the Supabase funnel.

Score will move from 5.4 to ~7.5 with the P0 list alone. Past 8 requires real third-party coverage, real audits, and real creators on the waitlist — none of which can be hacked, but all of which the current site is now in a position to earn.

---

## Sources

This audit synthesizes:

- Live HTML fetched from [https://4626.fun/](https://4626.fun) and [https://docs.4626.fun/](https://docs.4626.fun)
- HTTP headers via `curl -I` (Vercel; HSTS, CSP, etag captured 2026-05-07)
- Six parallel research files in `/home/user/workspace/audit/`: `competitor-analysis.md`, `brand-positioning.md`, `seo-geo.md`, `seo-technical.md`, `accessibility.md`, `compliance-trust.md`, `conversion-analytics.md`, `reddit.md`, `x-twitter.md`, `hacker-news.md`

Tier-1 cited sources include: [DeFi Llama protocol pages](https://defillama.com/), [Morpho docs](https://docs.morpho.org/), [Yearn V3 docs](https://docs.yearn.fi/), [Zora docs and support](https://docs.zora.co/), [Doppler / Whetstone](https://defillama.com/protocol/doppler), [Lagoon Finance docs](https://docs.lagoon.finance/), [X advertising policy](https://business.x.com/en/help/ads-policies/ads-content-policies/financial-services.html), [HN posting-time analyses](https://news.ycombinator.com/item?id=47864566), [HN 73k-submission analysis](https://news.ycombinator.com/item?id=47986108), and named subreddit threads in `reddit.md`.
