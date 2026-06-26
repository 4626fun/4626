# Website Audit: 4626.fun

**Audited:** May 8, 2026 · **Status:** Pre-launch / private beta · **Network:** Base (Ethereum L2)

---

## Executive Summary

4626.fun is a visually exceptional but conversion-cold pre-launch site. The Three.js hero is one of the most distinctive landing visuals in DeFi right now — and that is also the problem. Behind the lightning vault, the site fails the 5-second comprehension test, hides risk disclosure two pages deep, presents demo numbers that look uncomfortably like live TVL, and routes every conversion to a "Launch App" button that opens a Privy session sync screen rather than a waitlist form. The category itself ("Creator Vaults" — ERC-4626 wrapping creator coins on Base) is genuine white space — no competitor occupies the intersection of *creator-coin-native + ERC-4626 + social discovery + Base* per the [competitive landscape research](#competitive-landscape) — but the homepage does not yet earn that category.

**Three structural problems drive most of the impact:**

1. **The product is unrecognizable to the people most likely to use it.** A Zora creator with a creator coin, looking at the site for five seconds, cannot tell that 4626.fun makes their coin work for their community. The hero says "Creator Vaults. Earn Together." which is an aphorism, not an explanation. Non-DeFi creators bounce. DeFi natives understand but are not the highest-intent buyer.
2. **Trust signals are pre-launch-honest in the legal pages but pre-launch-ambiguous on the homepage.** The /risks page is exemplary — direct, conservative, accurate. The homepage shows `TVL: $2.4M / APY: 11.4% / HOLDERS: 1,283` on the AKITA card with no inline "demo" or "illustrative" label. A skeptical Web3 visitor who scrolls past those numbers and then reads /risks will lose trust, not gain it.
3. **The funnel has no funnel.** "Launch App" is the top-right CTA. There is no email capture. The waitlist page itself loads as a black "Syncing session…" Privy screen. There is no Discord, no docs, no GitHub link in the nav. The first 200 vault deployer credits are introduced in a fold-out overlay that requires a click to discover.

**Top 3 strengths**
- **Category-defining white space.** No one else wraps creator coins in ERC-4626 + EIP-7540 with a social leaderboard. Zora mints, Clanker launches, Yearn yields, Morpho lends — none combine all four ([competitor analysis](#competitive-landscape)).
- **Engineering credibility on display.** EIP-7540 async deposits, high-water-mark fees in basis points, vendored Three.js for CSP compliance, and conservative `/risks` and `/security` pages all signal a team that takes the work seriously.
- **The Akita strategy vault is a real story.** "Memecoin treasury deployed across Ajna lend markets, Charm concentrated LPs, and a Solana cross-chain leg" is concrete and viral-shaped. It is the social campaign that has not been run yet.

**Top 3 critical issues**
- **`noindex` on every SPA route, plus robots.txt disallowing /faq.** The richest explanatory content on the entire product is invisible to Google, ChatGPT, Claude, Perplexity, and Gemini ([SEO findings, item 1–2](#seo-technical-audit)).
- **No risk disclaimer on AKITA demo card.** Compliance and trust risk on a YMYL financial site. Fix this week.
- **No primary email-capture CTA above the fold.** The waitlist link sits behind "Launch App" and a Privy sync screen. Convert intent vanishes between hero and form.

**Top 3 growth opportunities**
- Own the category name "Creator Vaults" — it is in the hero, but no docs page, glossary entry, or content asset claims it formally. Capture the search intent before Clanker, Zora, or Morpho copy the mechanic.
- Run the AKITA vault as a **week-by-week social campaign** ([4-week AKITA plan](#akita-social-campaign)) leading up to launch — Show HN, X launch thread, Farcaster Frames, Reddit. The technical content writes itself.
- Build the FAQ + glossary + comparison pages (`/vs/yearn`, `/vs/friend-tech`) the SPA currently hides. The intersection of "ERC-4626" + "creator coin" is unoccupied content territory ([content gap analysis](#content--seo-strategy)).

---

## Product Overview

| | |
|---|---|
| **What it is** | Base-native ERC-4626 creator-vault protocol. Creators deploy on-chain strategy vaults; community members deposit a creator coin (or USDC/ETH); depositors receive ERC-4626 share tokens (■TOKEN) representing pro-rata claims on vault assets and yield. |
| **Status** | Private beta. "Finishing the audit and onboarding the first wave of creators." First 200 receive a vault deployer credit. |
| **Network** | Base. Coinbase Smart Wallet compatible. Account-abstraction friendly. |
| **Standards** | ERC-4626 ([ethereum.org](https://ethereum.org/developers/docs/standards/tokens/erc-4626/)) + EIP-7540 ([Ethereum Magicians](https://ethereum-magicians.org/t/eip-7540-asynchronous-erc-4626-tokenized-vaults/16153)) for async deposits/withdrawals. |
| **Allocation engine** | Uniswap V3 LP (CCA auction), creator vesting, [Ajna Protocol](https://www.ajna.finance) lend markets, [Charm Finance](https://learn.charm.fi/charm/manage-liquidity/overview) concentrated LP, Solana cross-chain leg via LayerZero, idle buffer. |
| **Fee model** | High-water-mark performance fee in basis points — creators only earn on gains above the previous peak. |
| **Showcase vault** | AKITA Strategy Vault (memecoin treasury). Demo numbers: TVL $2.4M, APY 11.4%, holders 1,283. **These are demo/illustrative figures and the homepage does not say so.** |
| **Audiences** | (1) Creators with existing creator coins on Zora / Coinbase Creator Coins / Clanker; (2) fans/depositors who hold those coins; (3) DeFi-native users hunting yield with social discovery; (4) developers/strategists building on the allocation engine. The site addresses none of them by name. |
| **Trust pages** | [`/risks`](https://4626.fun/risks) and [`/security`](https://4626.fun/security) exist and are well-written; not linked from the homepage above the fold. |

---

## Top 10 Highest-Impact Fixes (Do This Week)

| # | Fix | Category | Severity | Effort | Why it matters |
|---|-----|---------|----------|--------|----------------|
| 1 | **Add inline `(illustrative — pre-launch demo)` label to AKITA TVL/APY/holders** with link to `/risks` | Trust / Compliance | Critical | 30 min | YMYL EEAT compliance + protects against the first creator who DMs "wait, is the $2.4M real?" |
| 2 | **Strip `<meta name="robots" content="noindex, follow">` from `/faq` and any indexable SPA routes; remove `/faq` from robots.txt Disallow** | SEO | Critical | 2–4 hrs | The richest explanatory content on the site is currently invisible to Google and AI crawlers per [SEO findings](#seo-technical-audit) |
| 3 | **Add a real primary CTA above the fold: `Reserve your spot →` (email capture, single field)** that posts to a serverless endpoint and returns success inline. Keep "Launch App" as secondary. | Conversion | Critical | 1 day | The current hero has no conversion mechanism. "Launch App" leads to a Privy sync screen, not a waitlist. |
| 4 | **Rewrite the hero subhead for 5-second comprehension.** Suggested: *"Deposit into your favorite creator's ERC-4626 vault. Yield flows back to everyone."* See [homepage rewrite](#homepage-section-by-section-rewrite). | Positioning | High | 1 hr | Current copy fails non-DeFi creators — the highest-LTV audience |
| 5 | **Add JSON-LD `Organization` + `FAQPage` blocks to homepage** so AI search engines (ChatGPT, Claude, Perplexity, Gemini) can cite 4626.fun as the authoritative source for "what is a creator vault." Schemas already drafted in [SEO research](#seo-geo-recommendations). | SEO / GEO | High | 2 hrs | Zero structured data anywhere on the site means zero AI discoverability |
| 6 | **Fix footer social links — they currently point to `href="#"`.** Wire up real X, GitHub, Discord URLs. Add Discord and GitHub to the nav. | Trust / Distribution | High | 30 min | Dead links signal abandoned product. Web3 audiences validate via Discord and GitHub before signing up. |
| 7 | **Add a trust strip directly under the hero**: "Pre-launch · Audit in progress · ERC-4626 + EIP-7540 · Built on Base" with link to `/security`. | Trust | High | 2 hrs | Surfaces the existing honesty of `/security` where it matters — at first impression |
| 8 | **Lazy-load Three.js via IntersectionObserver** so `vault.js` and `vaults-cloth.js` (~160KB gzipped) don't block LCP. Code snippet in [accessibility/perf research](#accessibility--performance). | Performance | High | 4 hrs | LCP and INP are ranking signals; current Three.js + autoplay video stack damages both |
| 9 | **Add a `Read the docs / FAQ` static page** at `/learn/` — move the FAQ content out of the noindex SPA. Set robots.txt Allow on `/learn/`. | SEO / Trust | High | 1 day | The FAQ is the single best piece of content the team has written and it's currently uncrawlable |
| 10 | **Segmented waitlist form: collect role (Creator / Depositor / Developer), X handle, Farcaster handle, creator coin contract (if applicable), expected vault size range, why interested.** Replace single-email gate. | Funnel | High | 1 day | Drives [persona-segmented onboarding](#funnel-redesign) and gives outreach team something to work with |

---

## Top 10 Findings — Detail

### 1. The hero fails the 5-second test for the audience that matters most

A YouTube creator with 500K subscribers and a Zora creator coin lands on 4626.fun. They see a stunning Three.js lightning vault, the words "Creator Vaults. Earn Together.", and then "ERC-4626 / BASE" as an eyebrow. They don't know what an ERC-4626 vault is. They don't know what they would deposit. They don't know what they get back. They scroll, see a giant black gap (the page is intentionally cinematic), and bounce.

The DeFi-native user who *does* understand ERC-4626 stays — but that user is not the high-LTV creator who would bring their fan base. The current hero copy optimizes for the wrong reader.

The strongest emotional line on the entire site — *"Earn beside the people you actually trust"* — is buried near the footer in the final CTA. It should be in the hero.

### 2. The AKITA card looks like live data; risk disclosure is two pages deep

The homepage shows:
- **AKITA Strategy Vault** · TVL $2.4M · APY (30D) 11.4% · Holders 1,283
- "Memecoin treasury deployed across Ajna lend markets, Charm concentrated LPs, and a Solana cross-chain leg."

The `/risks` page correctly says: *"Demo vaults are illustrative previews, not live products."* But a visitor who lands on the homepage, sees those numbers, and then sees the [`/risks`](https://4626.fun/risks) disclaimer later will not gain trust — they will feel misled. This is also a [Google YMYL EEAT](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) negative signal that affects ranking for any financial query.

**Fix this week.** Inline label on the card. `<small>` disclaimer. Link to `/risks` directly under the stats.

### 3. The waitlist is a black screen

`https://4626.fun/waitlist` loads with a "Syncing session…" message — the Privy SDK initializing. There is no email field, no role question, no value prop, no "what happens next" explanation. A skeptical Web3 user who clicks through expecting an email form will close the tab.

Privy is a fine tool for the authenticated app surface. It is the wrong tool for a pre-launch waitlist where the goal is collecting structured intent, not authenticating users. The waitlist should be a static form (or a Vercel/Next.js form action) that captures email + role + handle + creator coin contract, returns a thank-you state inline, and writes to Supabase or Airtable.

### 4. Search and AI engines cannot read the actual product

The marketing homepage and `/risks`, `/security`, `/about` pages are crawlable. Everything else — `/faq`, `/explore/`, `/leaderboard`, `/vault/`, `/coin/`, vault detail pages, the entire app — is **both** noindex (via the SPA template's `<meta name="robots" content="noindex, follow">`) and disallowed in robots.txt. The FAQ in particular has the richest explanatory content on the entire product (vault share mechanics, redemption rules, the 5M minimum, what ■TOKEN actually is) and Google has never seen a single character of it.

This compounds: when ChatGPT or Perplexity is asked "what is a creator vault on Base," they cannot cite 4626.fun because there is nothing to cite.

The fix is structural: split the indexable knowledge layer (`/learn/`, `/glossary/`, `/blog/`, `/vs/`) from the authenticated app. SSR or pre-render the public knowledge pages.

### 5. Zero structured data anywhere

No JSON-LD `Organization`, `FAQPage`, `Article`, `Product`, or `DefinedTerm` schemas on any page. AI crawlers (GPTBot, ClaudeBot, PerplexityBot, GoogleBot-Extended) prioritize structured machine-readable facts when assembling answers. Without them, 4626.fun cannot appear as a citation in AI-generated answers to "best creator coin yield Base" or "how do ERC-4626 creator vaults work" — both of which are zero-search-volume now but will define the category once the product launches.

Drafted JSON-LD blocks in [SEO recommendations](#seo-geo-recommendations) — paste in `<head>` this week.

### 6. The category is real, but no asset claims it

"Creator Vaults" is white space. The [competitive landscape](#competitive-landscape) confirms it. But there is no `/creator-vaults` landing page, no `/glossary/creator-vault` definitional page, no `/erc-4626` explainer, and no comparison pages (`/vs/yearn`, `/vs/friend-tech`). The category exists in the hero and dies there.

If Clanker (now Farcaster-owned, $50M+ in cumulative fees per [BingX](https://bingx.com/en/learn/article/what-is-tokenbot-clanker-ai-agent-launchpad-on-base-how-to-buy)) or Zora ($262K cumulative protocol revenue per [DefiLlama](https://defillama.com/protocol/zora-coins)) launches a yield mechanic for creator coins, they will own the category by virtue of distribution. 4626.fun has 4–8 weeks to plant a flag through content before that window closes.

### 7. Trust signals exist but are not surfaced

Strong trust signals on the site that are **invisible from the homepage**:
- `/risks` is honest, conservative, well-written
- `/security` clearly states "no audits, bounties, live contracts, or guarantees claimed unless verified"
- robots.txt is conservatively scoped
- CSP, HSTS, x-content-type-options correctly set
- Three.js vendored locally for CSP compliance (engineering rigor signal)

None of this is communicated above the fold. The first impression is a beautiful but information-light hero. A skeptical Web3 visitor — who has seen 100 Show HNs collapse — has no reason to scroll past the artwork.

A two-line trust strip directly under the hero solves this:
> Pre-launch · Audit in progress · No live deposits · ERC-4626 + EIP-7540 · [See security status](https://4626.fun/security)

### 8. The funnel collapses at every transition

Counted from a cold first visit:
- Hero → no email capture, no obvious primary action
- Top-right "Launch App" → opens fold overlay or Privy sync (gated)
- Footer X / GitHub / Discord → all `href="#"` (dead links)
- "Reserve access" → also gated
- "Join the Waitlist" → Privy sync screen

A user who arrives intending to convert has no path to do so without authenticating with Privy. There is no public Discord link to lurk in, no GitHub to validate the engineering, no docs to pre-read. Web3 users validate through community presence before signing up; that path is currently closed.

### 9. The "1 AKITA" / "0 AKITA" / multiple `0%` allocation labels confuse, not impress

The "Allocation Engine" section shows:
- CCA Auction: 0%
- Creator Vesting: 0%
- Liquidity Pool: 0%
- Ajna Protocol: 0%
- Charm Finance: 0%
- Solana Bridge: 0%
- Idle Buffer: 0%

These are presumably placeholders for the count-up animation that fires on scroll. But for a user who lands mid-page or has reduced-motion enabled, the result is a financial product showing "0%" in every category — visually striking but cognitively jarring.

Either (a) populate with realistic example splits and label them as "Example allocation: AKITA Strategy Vault," or (b) hide the section behind a vault-detail screenshot until live data exists.

### 10. The "fold overlay" is design-clever but conversion-hostile

Clicking "Launch App" reveals a fold-out overlay with the "first 200 vault deployer credits" message and a Reserve access button. This is the actual conversion event of the page — and it requires a click on a button labeled something else to discover. Worse, the overlay's `aria-hidden="true"` is not removed when opened, so screen readers never see the conversion offer at all (per [accessibility findings](#accessibility--performance)).

Move the "first 200 deployer credits" message and email-capture inline into the hero (or directly underneath it). Remove the overlay pattern.

---

## 30-Day Growth Plan (Prioritized, Week-by-Week)

### Week 1 — Fix the homepage so traffic converts

**Engineering / homepage**
- Ship Top-10 fixes 1–7. These are all under one engineer-day each.
- Hero copy rewrite (see [homepage rewrite below](#homepage-section-by-section-rewrite)).
- Add inline demo disclaimer on AKITA card.
- Add trust strip with link to `/security`.
- Replace `/waitlist` Privy gate with a static segmented form (Supabase or Airtable backed). Fields: email, role, X handle, Farcaster handle, creator coin contract (optional), expected vault size range, why interested.
- Wire footer social links to real X, GitHub, Discord URLs. If the Discord doesn't exist yet, **create it this week** — see Funnel section.

**SEO / GEO**
- Strip noindex from `/faq` (or move FAQ to `/learn/how-creator-vaults-work`).
- Add JSON-LD `Organization` + `FAQPage` blocks to homepage.
- Add `og:image` (1200×630) and Twitter Card meta.
- Submit updated sitemap to Google Search Console + Bing Webmaster.

**Distribution**
- Reply to the [r/defi "Passive Income from DeFi is actually realistic" thread](https://www.reddit.com/r/defi/comments/1p8uuw8/passive_income_from_defi_is_actually_realistic/) and the [r/ethdev EIP-7540 thread](https://www.reddit.com/r/ethdev/comments/1pe1g0n/inside_bakerfi_launching_a_composable_and_secure/) with the value-first replies in [social research](#social-channel-strategy). Use a personal founder account, not a brand account.

### Week 2 — Plant the category flag in content

**Content**
- Publish `/creator-vaults` (or `/learn/creator-vaults`) — the category-definition landing page. Target keyword: *creator vault*. Use FAQ-block JSON-LD.
- Publish `/erc-4626` — explainer with creator-coin angle. Target: *ERC-4626 vaults*.
- Publish first blog post: ["What is an ERC-4626 creator vault? A creator's guide"](#sample-article-creator-vault-guide) (full draft already written, ~1,050 words).
- Add `/glossary/creator-vault` and `/glossary/erc-4626` short definitional pages with `DefinedTerm` schema.

**Social — AKITA campaign Week 1 (Teaser)**
- Monday: post the AKITA vault card screenshot on X with hook: *"Memecoin treasury meets DeFi strategy infrastructure — without leaving the ERC-4626 standard. The AKITA vault on 4626.fun (illustrative figures shown). Audit incoming."*
- Wednesday: thread "What does the AKITA vault actually hold?" — walk through the Ajna lend position, Charm LP, Solana cross-chain leg.
- Friday: "Vault Anatomy" diagram (one vault, two tokens). Cross-post to Farcaster /defi and /zora.

### Week 3 — Education + first creator outreach

**Content**
- Publish `/vs/yearn` — *Creator vaults vs. yield aggregators*. Target: *yearn alternative creator economy*.
- Publish `/learn/creator-coin-yield` — *How creator coin holders earn yield*.
- Add first developer-facing piece: blog post on EIP-7540 implementation lessons, target HN-style technical reader.

**Outreach**
- Soft DM 10 named creators per persona on X and Farcaster. Lead with the AKITA mechanic, not the platform name. Targets: creators who already have a Zora creator coin or a Clanker-launched token.
- Pitch one earned-media story to [Coinage Media](https://www.coinage.media/) — they did the [Jesse Pollak creator economy story](https://www.coinage.media/s4/why-coinbase-is-leaning-into-the-creator-economy-with-bases-jesse-pollak); creator vaults are the natural follow-up beat.
- Apply to [Base Builder Grants](https://www.base.org/build) and the [CDP Builder Grants program](https://www.coinbase.com/developer-platform/discover/launches/spring-grants-2025).

**Social — AKITA campaign Week 2 (Education)**
- Strategist Spotlight thread: how a memecoin treasury gets allocated across 5 strategies without custom contracts.
- Vault Share Receipt explainer for Farcaster /defi.

### Week 4 — Audit complete, launch trigger

**Engineering**
- Complete and publish audit report. Add audit firm + report link to `/security` and homepage trust strip.
- Open the leaderboard (even with 1–3 vaults). Empty leaderboards are worse than a small leaderboard.

**Launch sequence (in order, over 5 days)**
- **Tue/Wed AM PT — Show HN.** Title: *"Show HN: 4626.fun – ERC-4626 creator vaults on Base (creators deploy, communities deposit, yield flows back)."* Founder online for 4 hours minimum. [Full post body in social research](#hacker-news-strategy).
- **Same week, Wed AM** — X launch tweet + 10-tweet thread (drafts in [social channel strategy](#social-channel-strategy)). Tag @jessepollak in the creator coin tweet (not the launch tweet — pull permission for the relevant context). Tag @ourzora and @MorphoLabs separately on tweets where they're contextually relevant.
- **Thursday** — Reddit posts to r/defi and r/ethdev, custom-written for each subreddit (never copy-paste).
- **Thursday/Friday** — Drop the Farcaster Frames mini-app: vault viewer + deposit frame + leaderboard frame. Pin to /base, /defi, /creators.
- **Friday** — Email blast to waitlist. First 50 to confirm get priority access.

**KPIs to track from day 1**
- Waitlist signups (segmented: creator / depositor / developer)
- Email → wallet connect conversion rate post-launch
- AKITA vault TVL trajectory (with prominent "demo" / "post-launch live" labels switched correctly)
- Search rankings for "creator vault," "ERC-4626 creator coin," "creator coin yield Base"
- Backlinks earned (DefiLlama listing, defiprime Base list, Base ecosystem page)

---

## Homepage Section-by-Section Rewrite

### Section 1: Hero — replace headline + add real CTA

**Current**
> ERC-4626 / BASE
> **Creator Vaults.**
> *Earn Together.*
>
> On-chain strategy vaults, deployed by creators, deposited into by their community. One standard. One engine. Shared yield.
>
> [REQUEST ACCESS] [READ THE STANDARD]

**Recommended**
> Creator Vaults — on Base
>
> **Deposit into your favorite creator's vault.**
> *Earn yield together.*
>
> 4626.fun turns creator coins into ERC-4626 strategy vaults. Creators deploy. Fans deposit. When the strategy earns, everyone earns — the chain settles the math.
>
> [Reserve your spot →   email field inline] · [How it works] · [Read the docs]

Why this works:
- "Deposit into your favorite creator's vault" names the action, the actor, and the asset. 5-second test passes.
- "Earn yield together" sells the outcome instead of describing the mechanism.
- The sub-paragraph keeps "ERC-4626" (technical credibility) but explains the flow in plain English.
- Inline email capture eliminates the click-to-Privy-sync death loop.

### Section 2: Trust strip (NEW — directly under hero)

> Pre-launch · Audit in progress · No live deposits yet · ERC-4626 + EIP-7540 · Built on Base
>
> [See security status →](https://4626.fun/security) · [Read the risks →](https://4626.fun/risks)

### Section 3: "One vault. Two tokens." anatomy section

Keep the design. Two specific edits:
- Remove the floating "0 AKITA" labels until count-up animation completes (or set initial state to a reasonable example like "1,000 AKITA → 1,000 ▪AKITA").
- Add an inline `(illustrative)` label on the bridge diagram.

### Section 4: AKITA vault card — fix the trust gap

**Current**
> AKITA INU
> Akita Strategy Vault
> Memecoin treasury deployed across Ajna lend markets, Charm concentrated LPs, and a Solana cross-chain leg.
> TVL: $2.4M · APY (30D): 11.4% · Holders: 1,283

**Recommended**
> AKITA INU **— Demo vault**
> Akita Strategy Vault
> Memecoin treasury deployed across Ajna lend markets, Charm concentrated LPs, and a Solana cross-chain leg.
> *Illustrative figures · pre-launch preview · [See risks →](https://4626.fun/risks)*
> Demo TVL: $2.4M · Demo APY (30D): 11.4% · Demo holders: 1,283

A one-word badge ("Demo") and one line of microcopy fix the entire compliance/trust issue without weakening the visual story.

### Section 5: Allocation engine — populate or simplify

Either populate the seven `0%` slots with a realistic example allocation breakdown for AKITA (and label it clearly as "Example allocation: AKITA Strategy Vault — illustrative") or collapse the seven nodes into a single annotated diagram with no numbers.

### Section 6: How it works — keep, tighten

Current ("Three steps. One vault. Shared yield.") is one of the strongest sections. Two edits:
- Step 1 ("Creator deploys a vault") — add a one-sentence prerequisite: *"Bring your creator coin (Zora, Coinbase, Clanker, or any ERC-20). Set your strategy. Mint a 4626 vault on Base in one transaction."*
- Step 3 ("Yield flows back, together") — add: *"Creator earns a performance fee only above the previous high-water mark. Aligned by code."*

### Section 7: Features grid — keep all six, reorder

Current order: ERC-4626 native → Async deposits & withdrawals → Verifiable on-chain → Creator performance fees → Social leaderboard → Base-native & gas-light.

Recommended order (lead with creator-economy benefits, follow with technical credibility):
1. **Creator performance fees** — high-water-mark; aligned by code
2. **Social leaderboard** — discover strategists by track record, not promises
3. **Verifiable on-chain** — no black boxes; the chain is the audit log
4. **ERC-4626 native** — your vault share works everywhere DeFi works
5. **Async deposits & withdrawals** — EIP-7540; no forced liquidity
6. **Base-native & gas-light** — Coinbase Smart Wallet compatible; one-click joins

### Section 8: Final CTA section — strengthen with social proof + counter

**Current**
> 4626.fun · CREATOR VAULTS ON BASE
> Earn beside the people you actually trust.
> 4626.fun is in private beta. Get the keys, deploy a vault, or just deposit with a creator you follow.
> [JOIN THE WAITLIST]

**Recommended**
> Earn beside the creators you actually trust.
>
> Pre-launch private beta. **First 200 creators get a vault deployer credit** — 144 credits remaining.
>
> [I'm a creator — reserve a vault] [I'm a fan — get notified when vaults open] [I'm a developer — view the docs]

Three CTAs because there are three personas. Counter ("144 remaining") creates legitimate scarcity if it's real — don't fake the count.

### Section 9: Footer — fix dead links

- Real X handle (currently `href="#"`)
- Real GitHub URL (currently `href="#"`)
- Real Discord invite (currently `href="#"`)
- Add: Docs, Risks, Security, About — site-wide nav

---

## SEO Keyword Map

The full keyword research is in the [SEO research file](#content--seo-strategy). Here is the prioritized map:

### Tier 1 — own these (low difficulty, high intent, no competitor owns the SERP)

| Keyword | Intent | Target page | Action |
|---|---|---|---|
| **creator vault** | Informational | `/creator-vaults` (new) | New landing page + glossary entry; this is *the* category-defining keyword |
| **ERC-4626 creator coin** | Informational | `/erc-4626` (new) | Long-tail with zero current results — claim it |
| **creator coin yield** | Commercial Investigation | `/learn/creator-coin-yield` (new) | Highest commercial-intent query for the actual product |
| **creator vault performance fee** | Informational | Blog post | Underserved; Yearn fee structure ranks but not creator-fee version |
| **tokenized creator vault** | Informational | Blog post + glossary | Owns the AI-citation surface for "what is a tokenized creator vault" |

### Tier 2 — fight for these (medium difficulty, high traffic)

| Keyword | Intent | Target page | Action |
|---|---|---|---|
| **Base creator coins** | Informational | `/creator-vaults` (Zora compatibility section) | OKX, Phemex own top results — niche down to Base |
| **Zora creator coins** | Informational | `/creator-vaults` (Zora section) + blog | Zora support docs own top — angle: "what creator-coin holders can do beyond trading" |
| **onchain creator economy** | Informational | `/learn/onchain-creator-economy` | Forbes, Binance Academy own top — angle: yield infrastructure layer |
| **ERC-4626 Base** | Informational | `/erc-4626` | Medium difficulty; Morpho, Yearn, Steakhouse compete |

### Tier 3 — defensive (long-tail, low traffic, but high conversion intent)

| Keyword | Target page |
|---|---|
| **how to earn yield on creator coins** | `/learn/creator-coin-yield` |
| **friend.tech alternative** | `/vs/friend-tech` |
| **yearn alternative creator economy** | `/vs/yearn` |
| **EIP-7540 vault implementation** | Engineering blog post (HN-ready) |
| **what is a creator vault** | `/glossary/creator-vault` (FAQ-block JSON-LD essential) |

### Pages to ship (priority order)

1. `/creator-vaults` — category-definition landing page
2. `/erc-4626` — standard explainer with creator-coin angle
3. `/learn/how-creator-vaults-work` — full how-it-works (replaces the noindex FAQ)
4. `/learn/creator-coin-yield` — commercial-intent landing
5. `/glossary/creator-vault` and `/glossary/erc-4626` — short definitional pages with `DefinedTerm` schema
6. `/blog/` — index + first 3 articles ([drafted topics](#content--seo-strategy))
7. `/vs/yearn` and `/vs/friend-tech` — comparison pages
8. `/security` — expand current page into full audit-status / disclosure page

---

## Social / Channel Strategy

Full strategy with named accounts, draft tweets, reply templates, Frames specs, Show HN body, and 30-day calendar is in [the social research file](#social-channel-strategy). Headline summary by channel:

### X / Twitter
- **20 named accounts** to engage across Base ecosystem (Jesse Pollak, @base, @CoinbaseWallet, @brian_armstrong), Zora team (@ourzora, @jacob, @dee_goens), DeFi vault leadership (@bantg, @MorphoLabs, @StaniKulechov, @yearnfi, @lagoon_finance), Farcaster (@dwr, @v, @linda), creator-economy media (@coinage_media, @trustless_media), and Solidity educators (@PatrickAlphaC, @0xOwenThurm).
- **Launch tweet (277 chars)**: *"Creator coins now have a yield engine. Deploy an ERC-4626 vault on Base. Community deposits. Shared yield flows back. One standard. No custom contracts. No trust required — the chain is the audit log. First 200 get a vault deployer credit → 4626.fun"*
- **10-tweet launch thread** drafted in [social research](#social-channel-strategy).
- **3 reply templates** (vault/ERC-4626 discussions, creator-coin discussions, DeFi yield discussions) — all lead with technical insight, not pitch.

### Farcaster
- Channels: `/base`, `/defi`, `/creators`, `/zora`, `/onchain`, `/dev`, `/base-creators`.
- **Build three Frames v2 mini-apps**: Vault Viewer (live stats inside cast), Deposit Frame (one-click deposit), Leaderboard Frame.
- **Clanker synergy angle**: any Clanker-launched token is a candidate vault asset. Cross-promote to /base.
- **Warpcast Rewards alignment**: target creators earning weekly USDC rewards — they have community + a coin + cash flow.

### Reddit
- **Top-tier subs**: r/defi (250K), r/ethfinance (160K), r/ethdev (120K), r/Solidity (55K), r/base (25K), r/passive_income (2M), r/ZoraOfficial.
- **8 specific threads** with draft replies in [social research](#social-channel-strategy). Two flagged as highest-engagement: the [r/defi "Passive Income" thread](https://www.reddit.com/r/defi/comments/1p8uuw8/passive_income_from_defi_is_actually_realistic/) and the [r/ethdev BakerFi vault thread](https://www.reddit.com/r/ethdev/comments/1pe1g0n/inside_bakerfi_launching_a_composable_and_secure/).
- **Posting rules**: founder personal account with comment history, lead with value, disclose affiliation briefly, never copy-paste reply text.

### Hacker News
- **Show HN title (recommended)**: "Show HN: 4626.fun – ERC-4626 creator vaults on Base (creators deploy, communities deposit, yield flows back)"
- **Timing**: Tue/Wed/Thu, 8–10 AM PT.
- **Founder must be online for 4 hours post-submission.**
- **Lead with engineering, not crypto**: ERC-4626 + EIP-7540, async redemption edge cases, why Base, how the high-water-mark fee is enforced at the contract level.
- Full post body drafted in [social research](#hacker-news-strategy).

### Discord
- Create the server **this week**. Architecture: `#announcements`, `#vault-mechanics`, `#creator-lounge`, `#depositor-chat`, `#dev-corner`, `#akita-vault`, `#feedback`. Include in waitlist confirmation email.

### AKITA Vault Social Campaign — 4-Week Plan

[Full week-by-week plan in social research](#akita-social-campaign). Summary:

- **Week 1 — Teaser**: vault card screenshot, "what does it hold" thread, anatomy diagram
- **Week 2 — Education**: Strategist Spotlight, vault share as receipt explainer, Farcaster /defi
- **Week 3 — Alignment Story**: high-water-mark fee deep-dive with AKITA as the example
- **Week 4 — Launch**: audit complete announcement, Show HN, X launch thread, Reddit, Frames drop

---

## Trust & Web3-Specific Clarity

### Risks, audits, contracts, team, roadmap — what's missing

| Trust signal | Status | Fix |
|---|---|---|
| Risk disclosure | ✅ Excellent on `/risks` | Surface inline on AKITA card; link from homepage trust strip |
| Audit status | ⚠ Honestly stated on `/security` | Add to homepage trust strip; show audit-firm logo when available |
| Contract addresses | ❌ Not visible | Add to `/security` once vaults deploy. BaseScan link on every vault detail page. |
| Team / about | ⚠ `/about` is brief, no founders named | Add team section with X/Farcaster handles. Web3 trust requires named humans. |
| Roadmap | ❌ Missing | Publish a public roadmap (`/roadmap` or in docs) — audit, mainnet, first 5 vaults, Frames mini-app, Coinbase Smart Wallet integration depth |
| Protocol status | ⚠ "Demo" status implicit | Add a status banner: "Mainnet not yet live. Demo vaults are illustrative." Persistent across all pages until launch. |
| Discord community size | ❌ Discord not linked | Create Discord, link to it, show member count once >100 |
| GitHub | ⚠ Footer link is dead | Wire it. Public repo (or at least a docs/contracts repo) signals openness |

### Demo data — concrete fixes

The [`/risks` page](https://4626.fun/risks) correctly says: *"Public demo vaults are illustrative previews, not live products."* Three places this protection needs to extend:

1. **AKITA vault card**: badge "Demo" + microcopy "Illustrative figures · pre-launch preview" + link to `/risks`
2. **Allocation engine 0% nodes**: label "Example allocation, illustrative"
3. **Hero-area metrics if any get added later**: never show TVL/APY without a "live" or "demo" prefix

### Trust signals to add above the fold and near the CTA

**Above the fold (trust strip directly under hero):**
> Pre-launch · Audit in progress · No live deposits yet · ERC-4626 + EIP-7540 · Built on Base · [Security status →](https://4626.fun/security)

**Near the CTA:**
> First 200 creators get a vault deployer credit · No mainnet deposits until audit completes · [Read the risks →](https://4626.fun/risks)

### Web3 jargon — what to keep, simplify, or drop

| Term on site | Audience verdict | Recommendation |
|---|---|---|
| **ERC-4626** | DeFi-natives know it; creators don't | Keep, but always pair with one-line plain-English in same sentence |
| **Creator vault** | Still ambiguous on first read | Define inline once: "an ERC-4626 strategy vault built around your creator coin" |
| **Vault shares** / **■TOKEN** | Confusing for non-DeFi creators | Reframe as "your receipt" — "Deposit AKITA, receive ▪AKITA — your receipt that earns yield" |
| **CCA (Continuous Curve Auction)** | Jargon-heavy; never explained on site | Either explain in 1 line ("Uniswap V3 price discovery for vault shares") or remove from homepage and put in docs |
| **EIP-7540** | Technical credibility for engineers | Mention once with translation: "EIP-7540 lets withdrawals settle on the strategy's natural cadence — no forced liquidity" |
| **High-water-mark performance fee** | Standard in finance, opaque to creators | Translate: "Creators only earn when fans earn — and only above the previous peak" |
| **Uniswap V3 / Charm / Ajna / LayerZero / Solana bridge** | Buzzword stack on homepage | Keep on a `/strategy` or vault detail page; trim from homepage to one line: "Allocates across leading Base DeFi protocols" |
| **One standard. One engine. Shared yield.** | Aphoristic but vague | Keep as a tagline element; pair with concrete benefit headline |

### Two narratives — Creator vs. Crypto-native depositor

The site speaks to one imagined reader who is both a creator and a DeFi insider. They are rare. Run two narratives in parallel.

**Creator narrative**
> "Your creator coin is sitting in your fans' wallets earning nothing. 4626.fun turns it into a yield-bearing vault. You set the strategy, your community deposits, and you earn a transparent performance fee — only when they earn first. Your community gets yield. You get a track record."

**Crypto-native depositor narrative**
> "Yearn, Morpho, and Steakhouse vaults pool anonymous capital. 4626.fun vaults are deployed by creators with public reputations and on-chain track records. ERC-4626 + EIP-7540 + high-water-mark fees + a social leaderboard. Discover strategists by performance, deposit alongside creators you actually trust."

Decide which audience the homepage hero leads with (recommended: creator, because the creator brings their fan base and the depositors follow). Build a `/depositors` or `/for-fans` secondary landing page for the second narrative.

---

## Funnel Redesign

### Replace the Privy-gated waitlist with a structured form

**Fields to collect (in order):**

1. Email (required)
2. **Role** (required, single-choice): Creator / Depositor / Developer / Other
3. **X handle** (optional)
4. **Farcaster handle** (optional)
5. **Creator coin contract address** (conditional — shown only if role = Creator)
6. **Expected vault size range** (conditional — Creator only): <$10K / $10K–$100K / $100K–$1M / $1M+
7. **Why interested** (free text, 100 chars, optional)
8. **Referral source** (single-choice: X / Farcaster / Reddit / HN / Friend / Other) — for attribution

This data feeds three things:
- Persona segmentation for the email sequence
- Outreach prioritization (large expected-vault creators get white-glove)
- Channel attribution to know what's converting

### 5-touch email sequence (over 14 days)

Detailed drafts in [social research, Funnel section](#funnel-redesign). Summary:

| Day | Subject | Purpose |
|---|---|---|
| 0 | "You're on the list — here's what happens next" | Confirmation + Discord invite + expectation setting |
| 3 | Role-tailored education (Creator / Depositor / Developer) | Build trust through specificity |
| 7 | "First 50 creators are in — here's what they're building" | Social proof + FOMO |
| 10 | "143 of 200 vault deployer credits claimed" (personalized count) | Urgency + complete-your-profile CTA |
| 14 | "Your vault deployer credit is ready" OR "You're next — here's the timeline" | Convert or retain |

### Discord follow-up architecture

Channels: `#announcements`, `#vault-mechanics`, `#creator-lounge`, `#depositor-chat`, `#dev-corner`, `#akita-vault`, `#feedback`. Discord invite in every email. Founder AMA in `#vault-mechanics` weekly during pre-launch.

### Persona-specific CTAs in the hero

Replace the single "Reserve your spot →" with three persona buttons:

- **I'm a creator** → vault deployer credit signup, prefilled with "Creator" role
- **I'm a fan / depositor** → notify-me list with optional creator-coin holding question
- **I'm a developer** → docs preview + API/SDK waitlist

This costs nothing in design complexity but triples qualified-signup quality.

---

## Conversion Checklist (Apply Before Launch)

### Above the fold
- [ ] Hero headline passes 5-second test for a non-DeFi creator
- [ ] Hero subhead names the action, the asset, and the outcome
- [ ] Primary CTA visible without scrolling and without clicking
- [ ] Email capture inline (single field) OR clear path to segmented form
- [ ] Trust strip (audit status, ERC-4626, Base, link to /security) directly under hero
- [ ] No unlabeled financial metrics anywhere
- [ ] At least one named integration logo (Base, Coinbase Smart Wallet, Zora, Clanker, Morpho)

### Trust
- [ ] AKITA vault card has "Demo" badge + risk-link microcopy
- [ ] Allocation engine 0% values labeled "Example, illustrative" or hidden
- [ ] /risks linked from above-the-fold trust strip
- [ ] /security shows audit status, scheduled date, or completed report
- [ ] /about names the team (or at least the founder) with X/Farcaster handles
- [ ] Public roadmap exists at `/roadmap` or in docs
- [ ] All footer social links lead to real, active pages
- [ ] Discord link exists and the server has at least 50 members before launch

### Funnel
- [ ] Waitlist form is static HTML/static endpoint, not a Privy auth gate
- [ ] Form collects role, X handle, Farcaster handle, creator coin contract (if creator), expected size range, why interested
- [ ] Confirmation email sent within 30 seconds
- [ ] 5-touch email sequence wired and tested
- [ ] Persona segmentation drives email content (creator vs. depositor vs. developer)
- [ ] "First 200 deployer credits" counter is real (not hardcoded)

### SEO / GEO
- [ ] `noindex` removed from all SPA routes that should rank
- [ ] robots.txt allows `/learn/`, `/glossary/`, `/blog/`, `/vs/`
- [ ] Sitemap.xml updated with all new pages
- [ ] Each page has unique `<title>` (50–60 chars) and `<meta description>` (140–160 chars)
- [ ] JSON-LD `Organization` block on homepage
- [ ] JSON-LD `FAQPage` block on `/creator-vaults`, `/erc-4626`, `/faq` (or `/learn/`)
- [ ] JSON-LD `Article` block on every blog post
- [ ] Canonical tags on every page
- [ ] `og:image` (1200×630), `og:url`, `twitter:card` (summary_large_image), `twitter:site` on every page

### Performance
- [ ] Three.js modules lazy-loaded via IntersectionObserver
- [ ] `landscape.jpg` poster preloaded with `fetchpriority="high"`
- [ ] PNG hero textures (clouds, fog, streaks) shipped as AVIF + WebP via `<picture>`
- [ ] Audio `preload="none"` (not `auto`)
- [ ] Self-host fonts or add `&display=swap` + `<link rel="preload">` for Instrument Serif and Inter
- [ ] All `<img>` tags have explicit `width` and `height`
- [ ] Hero `<video>` paused under `prefers-reduced-motion`

### Accessibility
- [ ] Skip-to-content link as first child of `<body>`
- [ ] `:focus-visible` outlines defined globally (gold #E8B964, 2px, offset 3px)
- [ ] `#fold-overlay` `aria-hidden` toggles correctly with open/close
- [ ] Audio toggle initial state is `aria-pressed="false"` (audio starts muted)
- [ ] `.flow__node-meta` and small-cap eyebrow text confirmed at ≥4.5:1 contrast
- [ ] All forms (waitlist) have associated `<label>` elements

---

## Specific Copy Examples

### Hero (recommended, primary)

**Headline:** Deposit into your favorite creator's vault.
**Sub:** *Earn yield together.*
**Body:** 4626.fun turns creator coins into ERC-4626 strategy vaults on Base. Creators deploy. Fans deposit. When the strategy earns, everyone earns — the chain settles the math.

**Primary CTA (button):** Reserve your spot →   *(inline email field)*
**Secondary CTAs:** [How it works] · [Read the docs] · [View on GitHub]

### Hero — alternative for DeFi-native audience (A/B test)

**Headline:** Creator vaults. Shared yield. One standard.
**Sub:** *ERC-4626 + EIP-7540 on Base.*
**Body:** Wrap a creator coin in an ERC-4626 vault. Deposit alongside the creator. Shares accrue yield from a configurable strategy — Ajna lend, Charm LP, cross-chain. Aligned by high-water-mark fee.

### Hero — alternative for the Farcaster audience (third option)

**Headline:** Earn beside the creators you actually trust.
**Sub:** *Base-native creator vaults.*

### Trust strip (under hero)

> Pre-launch · Audit in progress · No live deposits yet · ERC-4626 + EIP-7540 · Built on Base · [Security status →](https://4626.fun/security)

### FAQ entries (drop into homepage `<details>` section + /faq + JSON-LD FAQPage)

**Q: What is a creator vault?**
A: A creator vault is an ERC-4626 strategy vault deployed by a creator around their creator coin. Fans deposit the creator coin (or USDC/ETH) into the vault and receive ERC-4626 share tokens (▪TOKEN) that represent a pro-rata claim on the vault's assets and yield. The vault deploys capital across DeFi protocols — lending markets, concentrated liquidity, cross-chain yield — and the share price rises as yield accrues.

**Q: How is this different from just holding a creator coin?**
A: A creator coin sits in your wallet and earns nothing. A creator vault puts that coin to work in DeFi strategies and gives you a transferable, composable share token (▪TOKEN) that represents your yield-bearing position. Trading fees from Uniswap LP go to liquidity providers, not holders. Vault yield goes to depositors.

**Q: Are the vaults audited?**
A: Pre-launch. We're finishing an external audit before opening live deposits. The audit report will be linked from [`/security`](https://4626.fun/security) when complete. Until then, all vaults shown are illustrative previews.

**Q: What happens if the strategy loses money?**
A: Your share value drops. Vault shares are not deposit accounts and are not insured. Creator coins are volatile, illiquid assets. The high-water-mark performance fee structure means the creator earns nothing during drawdowns and only resumes earning above the previous peak — but that does not protect you from losses. [See full risks →](https://4626.fun/risks)

**Q: Can I withdraw any time?**
A: Subject to vault liquidity. Idle assets in the buffer are redeemable instantly. Strategy positions (concentrated LP, cross-chain) may require an async unwind via EIP-7540's pending → claimable → claimed lifecycle. Larger redemptions and stressed markets may take longer.

**Q: Who can deploy a vault?**
A: At launch, the first 200 approved creators receive a vault deployer credit. Approval is based on existing community size, creator coin contract status, and proposed strategy. Deploying is a single transaction on Base and requires a 5,000,000 token minimum first deposit to initialize.

**Q: What does it cost?**
A: Gas only on Base (typically <$0.01). Creators set their own performance fee in basis points (e.g., 1000 = 10%) — high-water-mark, so you only pay above the previous peak.

### Trust section (block above the final CTA)

> **Built in public, deployed conservatively.**
>
> 4626.fun is pre-launch infrastructure. The contracts are in audit. The risks are public. The team is on Farcaster and X. Demo vaults are illustrative — there is no production TVL until the audit completes and live vaults open.
>
> [Audit status →](https://4626.fun/security) · [Risk disclosure →](https://4626.fun/risks) · [Roadmap →](https://4626.fun/roadmap) · [GitHub →](#) · [Follow on X →](#) · [Join Discord →](#)

### Final CTA (replaces current "Earn beside the people you actually trust" block)

> **Earn beside the creators you actually trust.**
>
> Pre-launch private beta on Base. First 200 creators get a vault deployer credit — **144 remaining**.
>
> [I'm a creator — reserve a vault] [I'm a fan — get notified] [I'm a developer — view the docs]
>
> *No live deposits until audit completes. [Read the risks →](https://4626.fun/risks)*

### Waitlist page (replaces current Privy gate)

**Headline:** Reserve your spot.
**Sub:** First 200 creators get a vault deployer credit. Fans and developers get early access in order.

**Form:**
- Email (required)
- I am a… [Creator] [Fan/Depositor] [Developer]
- *(if Creator)* Creator coin contract on Base (optional, for prioritization)
- *(if Creator)* Expected vault size: <$10K / $10K–$100K / $100K–$1M / $1M+
- X handle (optional)
- Farcaster handle (optional)
- Why are you interested? *(140 chars, optional)*
- How did you hear about us? [X / Farcaster / Reddit / HN / Friend / Other]

**After submit:**
> You're #[N] on the list.
>
> We'll email you within 14 days with role-specific onboarding and your access status. In the meantime:
> - Join the [Discord](#) — most active in `#vault-mechanics` and `#akita-vault`
> - Follow [@4626fun](#) on X and Farcaster
> - Read the [docs](#) and [risks](https://4626.fun/risks)

---

## Competitive Landscape

Full analysis of 12 competitors across 4 categories — creator coin platforms (Zora, Coinbase Creator Coins, friend.tech, Drakula, Bonsai), ERC-4626 vault platforms (Steakhouse/Re7 Labs on Morpho, Yearn, Enzyme, Arrakis), Base launchpads (Clanker, Virtuals), and SocialFi (Farcaster + Lens) — is in [`/home/user/workspace/research_competitors.md`](research_competitors.md). Headline:

| Competitor | Category | Yield layer | Social/creator layer | Base-native | ERC-4626 |
|---|---|---|---|---|---|
| **4626.fun** | **Creator Vaults** | **✅ Full** | **✅ Leaderboard** | **✅** | **✅ + EIP-7540** |
| [Zora Coins](https://zora.co) | Creator coin platform | ❌ | ✅ trade fees | ✅ | ❌ |
| [Coinbase Creator Coins](https://www.base.org) | Creator coin platform | ❌ | ✅ profile | ✅ | ❌ |
| [friend.tech](https://www.friend.tech) | SocialFi | ❌ | ✅ chat keys | ✅ | ❌ |
| [Drakula](https://drakula.app) | SocialFi video | ❌ | ✅ video | ✅ | ❌ |
| [Bonsai / Lens](https://lens.xyz) | SocialFi | ❌ | ✅ tipping | ❌ (zkSync) | ❌ |
| [Steakhouse / Re7 (Morpho)](https://morpho.org) | ERC-4626 curators | ✅ | ❌ | ✅ | ✅ |
| [Yearn](https://yearn.fi) | DeFi vault | ✅ | ❌ | Minimal | ✅ |
| [Enzyme](https://enzyme.finance) | Vault platform | ✅ | ❌ | ❌ | ✅ |
| [Arrakis](https://arrakis.finance) | LP management | ✅ LP fees | ❌ | ✅ | ❌ |
| [Clanker](https://www.clanker.world) | Token launchpad | ❌ | ✅ Farcaster | ✅ | ❌ |
| [Virtuals](https://www.virtuals.io) | AI agent tokens | ❌ | ✅ AI community | ✅ | ❌ |

**Key insight:** No competitor occupies the intersection of (creator-coin-native + ERC-4626 yield + social discovery + Base). This is genuine white space. Per [research findings](research_competitors.md), only ~35 vaults across all of DeFi implement EIP-7540 — and zero in the creator economy space.

**Dangerous overlaps**:
- **Without sharp creator specificity, 4626.fun reads as a worse [Enzyme](https://enzyme.finance).** Enzyme has been live for years with high-water-mark fees, configurable strategies, and 30+ DeFi adapters. The creator-coin-first story must be the headline, not a wrapper.
- **Creator coins without audiences are worthless underlying assets.** The 5M token minimum implicitly requires pre-existing distribution. Be honest about which creators 4626.fun is for: those who already have a coin and a community.
- **Clanker (Farcaster-owned, $50M+ cumulative fees per [BingX](https://bingx.com/en/learn/article/what-is-tokenbot-clanker-ai-agent-launchpad-on-base-how-to-buy)) or Zora ($262K cumulative protocol revenue per [DefiLlama](https://defillama.com/protocol/zora-coins)) could ship a yield mechanic at any time.** 4626.fun has 4–8 weeks to plant a content flag through the recommended landing pages and articles.

### Category and tagline recommendation

**Category to own: "Creator Vaults."** It is already in the hero, intuitive enough for non-DeFi creators, technical enough to attract DeFi-curious users, and unowned by any competitor.

**Recommended primary tagline (under 10 words):**
> *Your creator coin, finally working for your community.*

**Alternative for DeFi audience:**
> *Creator vaults. Shared yield. One standard.*

**Alternative for Farcaster audience:**
> *Earn beside the creators you actually trust.* (already on the page — promote it)

---

## SEO Technical Audit

Full audit (13 issues across Critical / High / Medium / Low) is in [`/home/user/workspace/research_seo_brand_content.md`](research_seo_brand_content.md). Top issues:

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | `noindex` on every SPA route — entire app surface invisible to Google | **Critical** | Strip noindex from `/faq` and any indexable routes; or move FAQ to statically-rendered `/learn/` |
| 2 | robots.txt disallows `/faq`, `/vault/`, `/explore/`, `/leaderboard`, `/coin/` — richest content blocked | **Critical** | Move educational content to `/learn/` or `/glossary/`; allow those paths |
| 3 | Sitemap has only 6 URLs | **High** | Expand as new pages ship |
| 4 | All SPA routes share generic title `"ERC-4626 Creator Vaults on Base"` and 38-char description | **High** | Per-route metadata via React Helmet or SSR |
| 5 | Zero JSON-LD anywhere — no AI-search visibility | **High** | Add Organization, FAQPage, Article schemas (drafts in [SEO research](research_seo_brand_content.md)) |
| 6 | Three.js + autoplay video block LCP | **High** | Lazy-load Three.js via IntersectionObserver; preload `landscape.jpg` |
| 7 | Google Fonts blocking with no `display=swap` or preload | **High** | Self-host or add preload + display=swap |
| 8 | No canonical tags | **Medium** | Add on all pages |
| 9 | Demo vault stats unlabeled (EEAT/YMYL risk) | **Medium** | Inline disclaimer + /risks link |
| 10 | No `index, follow` on marketing pages | **Medium** | Explicit robots meta |
| 11 | Footer X/GitHub/Discord = `href="#"` | **Low** | Wire real URLs |
| 12 | `<base href="/immersive/">` canonicalization risk | **Low** | Confirm canonical points to `/` |
| 13 | No `og:image`, `twitter:card`, `twitter:site` | **Low** | 1200×630 og:image + twitter:card |

---

## Performance & Web Vitals

Full audit in [`/home/user/workspace/research_a11y_perf.md`](research_a11y_perf.md). Web Vitals risk summary:

| Metric | Risk | Cause |
|---|---|---|
| **LCP** | High | `landscape.jpg` poster not preloaded; Google Fonts blocking; `styles.css` render-blocking |
| **CLS** | Medium | No `width`/`height` on `<img>`; count-up flash |
| **INP** | High | Three.js modules execute eagerly even if user never scrolls to vault |
| **FCP** | Medium | Single blocking `styles.css` + Google Fonts CDN round trip |

**Highest-impact fixes (already detailed):**
1. Lazy-load Three.js via IntersectionObserver (~160KB gzipped off the critical path)
2. Convert PNG cloud/fog/streak hero textures to AVIF (60–80% size reduction)
3. Preload `landscape.jpg` poster with `fetchpriority="high"`
4. Self-host fonts or add `display=swap` + preload Instrument Serif woff2
5. Audio `preload="none"` (currently `auto`)
6. Add explicit `width`/`height` to all `<img>` tags

---

## Accessibility (WCAG 2.1 AA)

Full audit in [`/home/user/workspace/research_a11y_perf.md`](research_a11y_perf.md). Most areas are well-handled (lang, alt text, heading hierarchy, ARIA, semantic HTML, reduced-motion JS branches). Open issues:

| Issue | WCAG | Severity | Fix |
|---|---|---|---|
| Missing skip-to-content link | 2.4.1 | High | `<a href="#main-content" class="skip-link">` as first body child |
| Focus styles not visible in inline HTML (depends on styles.css) | 2.4.7 | High | Verify `:focus-visible` outline in styles.css; add gold 2px outline if missing |
| `#fold-overlay` keeps `aria-hidden="true"` when opened | 4.1.2 | Medium | Toggle attribute in `openFold()` / `closeFold()` |
| Audio toggle has `aria-pressed="true"` initially but audio starts muted | 4.1.2 | Medium | Initialize `aria-pressed="false"`; flip after audio plays |
| Hero `<video>` not paused under reduced-motion | 2.3.3 | Medium | Add `matchMedia('(prefers-reduced-motion: reduce)').matches` check + `pause()` |
| Muted secondary text contrast (`.flow__node-meta`, eyebrow caps) | 1.4.3 | Medium | Audit styles.css; ensure ≥4.5:1 |

---

## Content & SEO Strategy

Full content strategy with 8 article topics, keyword research, GEO recommendations, JSON-LD blocks, and a complete ~1,050-word draft article is in [`/home/user/workspace/research_seo_brand_content.md`](research_seo_brand_content.md).

### 8 Article Topics (Prioritized)

| # | Title | Target Keyword | Volume |
|---|---|---|---|
| 1 | What is an ERC-4626 creator vault? A creator's guide | ERC-4626 creator vault | Medium |
| 2 | Creator coins vs. creator vaults: how onchain yield changes the creator economy | creator coins vs creator vaults | Medium |
| 3 | ERC-4626 explained for non-developers | ERC-4626 explained | High |
| 4 | How to earn yield on your Zora creator coins in 2026 | creator coin yield | Medium |
| 5 | Base DeFi protocols for the creator economy: a 2026 guide | Base creator economy DeFi | Low |
| 6 | High-water-mark performance fees: how aligned creator vaults work | creator vault performance fees | Low |
| 7 | friend.tech is dead. What comes next for creator monetization? | friend.tech alternative | Medium |
| 8 | What is the onchain creator economy? A 2026 guide to Base, Zora, and creator coins | onchain creator economy | Medium–High |

### Sample article — full ~1,050-word draft

The full draft of *"What Is an ERC-4626 Creator Vault? A Creator's Guide"* is in [`/home/user/workspace/research_seo_brand_content.md`](research_seo_brand_content.md). It cites [ethereum.org](https://ethereum.org/developers/docs/standards/tokens/erc-4626/), [Chainlink](https://chain.link/article/erc-4626-tokenized-vaults), [Zora support docs](https://support.zora.co/en/articles/2509953), [Ajna](https://www.ajna.finance), [Charm Finance](https://learn.charm.fi/charm/manage-liquidity/overview), and [OpenZeppelin](https://docs.openzeppelin.com/contracts/5.x/erc4626) inline — exactly the citation density that maximizes AI-search inclusion.

---

## Social Channel Strategy

Full strategy with 20 named accounts to engage, draft tweets and threads, reply templates, Farcaster Frames specs, full Show HN body, 4-week AKITA campaign, persona-segmented funnel, and 5-touch email sequence is in [`/home/user/workspace/research_social.md`](research_social.md). Sections referenced above:

- [Reddit threads + reply drafts](research_social.md)
- [X/Twitter accounts + launch tweet + 10-tweet thread](research_social.md)
- [Farcaster channels + Frames v2 + ecosystem partnerships](research_social.md)
- [Hacker News strategy + Show HN body](research_social.md)
- [4-week AKITA vault campaign](research_social.md)
- [Funnel redesign + email sequence + Discord architecture](research_social.md)

---

## Conclusion

4626.fun is good engineering hidden behind a beautiful homepage that is not yet doing the conversion work the team needs it to do. The product premise — wrapping creator coins in ERC-4626 + EIP-7540 with a social leaderboard, on Base — is real and unoccupied. The execution risk is not category risk; it is communication risk. A skeptical Web3 visitor needs to know in five seconds what the product does, who it's for, and why it can be trusted. Right now they get a stunning lightning vault and an aphorism.

**The single most important week of work:**
1. Rewrite the hero for 5-second comprehension
2. Add demo labels to AKITA card and trust strip with /security link
3. Replace the Privy waitlist gate with a real segmented form
4. Strip noindex from /faq (or move it to /learn/) so the best content the team has written becomes findable

Everything else — the 30-day plan, the SEO map, the Show HN, the Farcaster Frames, the AKITA campaign — works only after those four fixes land. The site needs to convert before the launch traffic arrives.

The honest pre-launch story 4626.fun's `/risks` and `/security` pages already tell is exactly the trust-building narrative the homepage should be telling. Pull it forward. The audit-in-progress, conservative-by-design, demos-are-demos posture is differentiating in a category full of "we deployed, hope nothing breaks" launches. Lean into it.

Then — and only then — own the category. "Creator Vaults" is yours to claim, but only for as long as Clanker, Zora, and Morpho stay focused on what they're already shipping. That window is real, but it is not infinite.

---

*Audit research files in workspace:*
- *`/home/user/workspace/research_competitors.md` — full competitor analysis*
- *`/home/user/workspace/research_seo_brand_content.md` — SEO, GEO, brand voice, content strategy, sample article*
- *`/home/user/workspace/research_social.md` — Reddit, X, Farcaster, HN, AKITA campaign, funnel*
- *`/home/user/workspace/research_a11y_perf.md` — accessibility + performance technical audit*
