# 4626.fun Website Audit Implementation OS

This document is the execution companion for the 2026-05-06 website audit. It keeps operational artifacts out of the plan file and gives akita a low-workload queue for implementation, review, and launch readiness.

## Current Rule

Do not run paid X ads until P0 and P1 are live:

- P0: screenshot/compliance risk removed, trust pages live, official metadata and links live, product stage honest.
- P1: inline waitlist works, attribution works, crawlability basics work, accessibility basics checked.

## First 10 Linear Issues

### 1. [P0] Replace demo APY/TVL/depositor vault tiles with DEMO PREVIEW framing

Priority: P0  
Context: Demo vault tiles looked like live products because they showed APY, TVL, and depositor counts.  
Expected outcome: Every demo tile is visibly illustrative and links to risks.

Acceptance criteria:
- Every vault tile has a visible `DEMO PREVIEW - illustrative only, vaults not live yet` badge or equivalent framing.
- No point APY values appear on homepage demo tiles.
- No fake TVL or depositor counts appear unless clearly marked as illustrative.
- Each tile links to `/risks`.
- Mobile and desktop verified.

### 2. [P0] Rewrite guaranteed-yield-shaped homepage copy

Priority: P0  
Context: Copy such as "earn fees regardless", "every day", and "no matter what" created guaranteed-return risk.  
Expected outcome: Homepage copy is conditional and risk-aware.

Acceptance criteria:
- Remove "earn regardless", "every day", "forever", and "no matter what" language.
- Replace with conditional language: fees may be zero, outcomes vary, shares may lose value.
- Search source/build output for banned public-copy phrases.
- Confirm no copy implies guaranteed fees, APY, liquidity, or profit.

### 3. [P0] Add /risks page

Priority: P0  
Context: There was no real risk page for a retail-visible DeFi/creator-finance site.  
Expected outcome: `/risks` is public, crawlable, linked, and honest.

Acceptance criteria:
- Covers smart contract, strategy, creator coin, liquidity, bridge, auction, regulatory, no financial advice, no insurance, no guaranteed returns, may lose value, and fees may be zero.
- Linked from homepage, footer, demo vault tiles, and disclaimer strip.
- Renders as crawlable HTML.

### 4. [P0] Add homepage disclaimer strip

Priority: P0  
Context: The prior disclaimer was too quiet and too late.  
Expected outcome: Visitors see product stage and NFA language near the hero.

Acceptance criteria:
- Visible near hero.
- Says demo vaults are illustrative and not live.
- Includes not financial advice.
- Links to `/risks`.
- Repeated or summarized in the footer.

### 5. [P0] Add official links and anti-scam block to footer

Priority: P0  
Context: The footer did not link the official X handle and lacked anti-scam guidance.  
Expected outcome: Footer becomes a public verification surface.

Acceptance criteria:
- Includes website, docs, X, GitHub, Discord if active, and email.
- Includes anti-scam warning.
- `@4626fun` appears visibly.
- Footer appears on primary public routes.

### 6. [P0] Add twitter:site and twitter:creator meta tags

Priority: P0  
Context: X cards lacked official account attribution.  
Expected outcome: Shared links attribute to the 4626 account and creator account.

Acceptance criteria:
- `twitter:site = @4626fun`.
- `twitter:creator = @wenakita`, unless akita approves another handle.
- Present in static homepage and prerendered/static route heads.
- X card preview validates.

### 7. [P1] Rewrite hero for 5-second clarity

Priority: P1  
Context: The old hero did not say what 4626.fun is quickly enough.  
Expected outcome: The first screen explains ERC-4626 creator vaults on Base.

Acceptance criteria:
- H1 explains ERC-4626 creator vaults on Base.
- Subhead explains creator coins to vault shares.
- Primary CTA is Join Waitlist.
- Secondary CTA is Read Docs.
- Includes pre-launch/NFA language.

### 8. [P1] Add inline homepage waitlist form

Priority: P1  
Context: CTA-only flow through `/waitlist` was fragile for X traffic.  
Expected outcome: Visitors can join from the homepage without relying on SPA route handoff.

Acceptance criteria:
- Fields: email, role, optional X handle.
- Form submits to Supabase-backed API.
- UTM fields are captured.
- Success and error states are accessible.
- Spam protection included through rate limiting and honeypot, with Turnstile left as a future enhancement if keys are configured.

### 9. [P1] Add Supabase waitlist attribution fields and event tracking

Priority: P1  
Context: Organic and paid readiness require first-touch attribution and conversion events.  
Expected outcome: Waitlist leads and website events are stored in Supabase.

Acceptance criteria:
- Capture `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `visitor_id`, `session_id`.
- Preserve first-touch attribution.
- Track waitlist form funnel events.
- RLS allows safe public inserts and no public reads.

### 10. [P1] Fix robots.txt, sitemap.xml, prerendering, and noindex policy

Priority: P1  
Context: The site was structurally hard for Google and AI engines to read.  
Expected outcome: Public trust pages are crawlable, while app/private routes remain noindex.

Acceptance criteria:
- `/robots.txt` returns 200.
- `/sitemap.xml` returns 200.
- Sitemap includes homepage and real trust pages.
- Crawlable public routes do not carry accidental noindex.
- Googlebot receives meaningful HTML for important public routes.

## Supabase Tables

Use `public.waitlist_leads` for low-friction marketing lead capture and `public.website_events` for anonymous funnel events. These complement, rather than replace, the existing profile/account waitlist flow.

Key implementation properties:
- RLS enabled on both tables.
- Public insert policies only.
- No public read/update/delete policies.
- Store hashed IP only, not raw IP.
- Preserve first-touch attribution on lead upsert.

## Airtable Base: 4626 Growth OS

### Waitlist Leads

Fields: Email, Role, X Handle, Joined At, UTM Source, UTM Medium, UTM Campaign, UTM Content, UTM Term, Referrer, Lead Score, Status, Suggested Next Action, Notes, Supabase ID.

Statuses: New, Confirmed, Contacted, Replied, Qualified, Pilot candidate, Partner candidate, Not now, Disqualified.

### People

Fields: Name, X Handle, Segment, Source, Priority, Status, Last Interaction, Next Action, Suggested Message, Related Waitlist Record, Related Campaign, Notes, Notion Link, Linear Link.

Segments: Creator, Builder, Partner, Protocol, Investor, Community, Unknown.

### X Signals

Fields: Post URL, Author Handle, Topic, Signal Type, Priority, Suggested Reply, Should Link 4626.fun?, Add to People?, Create Linear Issue?, Notes.

### Campaigns

Fields: Campaign Name, Channel, Audience, Goal, CTA, UTM URL, Spend, Signups, Qualified Leads, Cost Per Qualified Lead, Status, Result, Notes.

### Content Pipeline

Fields: Title, Format, Status, Source, Draft Copy, CTA, UTM Link, Published URL, Related Campaign, Performance Notes, Compliance Risk, Approval Needed?.

Primary view: `Needs akita`, filtered to high-priority records where Next Action is not empty and Approval Needed? is Yes when relevant.

## Notion Command Center

Create these pages once Notion auth is connected:

- `4626 - Master`: top-level index linking systems, checklists, docs, and dashboards.
- `4626 - Brand & Voice`: approved copy, banned phrases, safe phrases, audience positioning.
- `4626 - Risk & Compliance Library`: NFA language, demo-vault language, things never to say, approved replacements.
- `4626 - Launch Readiness`: P0/P1 checklist, X readiness, Vercel readiness, analytics readiness, approval state.
- `4626 - X Operating Manual`: profile copy, pinned post, reply strategy, safe CTAs, banned language, anti-scam post.
- `4626 - SEO/GEO Playbook`: sitemap, robots, JSON-LD, route metadata, content targets, AI-search visibility plan.
- `4626 - Security & Audits`: audit status, contract addresses, security contact, bug bounty, incident response, pause notes.
- `4626 - Glossary`: ERC-4626, vault share, creator coin, CCA, OFT, DLMM, concentrated liquidity, impermanent loss, idle buffer, protocol-owned liquidity.

## UTM Links

- X bio: `https://4626.fun/?utm_source=x&utm_medium=organic&utm_campaign=profile&utm_content=bio`
- Pinned post: `https://4626.fun/?utm_source=x&utm_medium=organic&utm_campaign=launch&utm_content=pinned`
- Organic reply: `https://4626.fun/?utm_source=x&utm_medium=organic&utm_campaign=launch&utm_content=reply`
- Paid ad later: `https://4626.fun/?utm_source=x&utm_medium=paid&utm_campaign=x_premium_basic_test&utm_content=creative_001`

## Safe Pinned Post

```text
Introducing 4626.fun.

ERC-4626 creator-vault infrastructure on Base.

Creator coins can be deposited into vaults.
Depositors receive redeemable vault shares.
Strategy outcomes flow through the vault proportionally.

Vaults are not live yet.
Experimental software.
Not financial advice.

Early access ↓
https://4626.fun/?utm_source=x&utm_medium=organic&utm_campaign=launch&utm_content=pinned
```

## Needs akita

- Confirm `twitter:creator` as `@wenakita`.
- Confirm official GitHub org/link.
- Confirm Discord invite is active and public.
- Confirm whether `AKITA, LLC` can appear publicly.
- Confirm security contact: `security@4626.fun` or `hello@4626.fun`.
- Legal review for terms, privacy, jurisdiction, eligibility, prohibited use, warranties, and liability.
- Approval before public copy ships to production, X posts publish, outreach sends, or paid spend starts.

## Can Wait

- X Premium Business and paid ads.
- HN, Reddit, PR/media, DeFi Llama, CoinGecko/CMC, Mirror/Paragraph expansion.
- Full dashboards beyond funnel tables.
- Confusable-domain anti-phishing redirects.
- Third-party citation and GEO content engine.
