---
title: Token Image
sidebar_position: 8
---

# Uniswap Token Image Ingestion and Requirements

## Executive summary
Uniswap’s token icons are not derived from any on-chain ERC‑20 “image” field because ERC‑20 (EIP‑20) defines core token methods and optional metadata like name, symbol, and decimals, but it does not standardize an image/logo field. 
 As a result, Uniswap’s live token image display is primarily an off‑chain metadata problem solved via Token Lists (TokenLists JSON schema / tokenlists.org ecosystem), plus third‑party asset sources (notably TrustWallet and CoinGecko) and Uniswap’s own token project metadata returned by its GraphQL/Data API used in the Uniswap Interface. 

From an implementation standpoint, the current Uniswap Interface code path shows token logos being rendered from a logoUrl value within CurrencyInfo, which is built from GraphQL token/project data (project.logoUrl). 
 Logos are then loaded through a shared UniversalImage component that sanitizes/normalizes URIs into fetchable HTTP(S) URLs, supports SVGs (by URL extension), and falls back to a “text badge” (first ~3 characters of the token symbol) when an image can’t be used. 

Practically: you do not need 1024×1024 for Uniswap to display a crisp icon; the Token Lists schema itself recommends 64×64 for token logos (and 256×256 for list-level logos). 
 In the interface UI, logos are typically rendered at small sizes (e.g., default “40px icon size” for one common component). 
 A “master” 1024×1024 can be fine for reuse elsewhere, but for Uniswap-specific reliability/performance you should host an optimized PNG/SVG (and ensure the URL/protocol patterns Uniswap accepts).

Token list specs and official schema expectations
What fields exist and which are required
Uniswap’s Token Lists schema (tokenlist.schema.json) defines a list document with required top-level fields:

name
timestamp
version
tokens 
For each token entry (TokenInfo), the required fields are:

chainId
address
decimals
name
symbol 
The token image field in this ecosystem is logoURI. It is not part of the required list (since required for tokens does not include logoURI), so it is optional from a schema standpoint. 

What image fields are expected and recommended sizes
The schema describes logoURI at two levels:

Token-level logoURI:
The schema describes it as a URI to the token logo asset and notes that if it’s missing, the interface will attempt to find a logo based on token address. It also recommends “SVG or PNG of size 64×64.” 

List-level logoURI (logo for the token list itself):
The schema recommends “SVG or PNG of size 256×256.” 

Accepted URI formats and what Uniswap will actually fetch
The Token Lists schema uses the URI format (it is not restricted to only HTTPS), and common examples include ipfs://…. 

However, what matters operationally is what the Uniswap Interface converts and fetches. In current code, URI normalization is handled by a helper that explicitly supports these URI schemes:

https: (kept as-is)
http: (rewritten to https first, with http as fallback in most cases)
ipfs: (gateway rewritten to HTTPS)
ipns: (gateway rewritten to HTTPS)
ar: (rewritten to https://arweave.net/<tx>)
data: (kept as-is)
local paths / file: URIs only when explicitly allowed (not typical for production token logos) 
Anything outside these patterns is effectively rejected (returns no usable URL), which is the most important “URL accessibility rule” in practice. 

How Uniswap ingests and renders token images in the live Interface
Where the Interace gets the “logo URL”
A current, concrete code path in the Uniswap Interface is:

The UI builds/uses a CurrencyInfo object, which includes logoUrl. 
logoUrl is sourced from GraphQL token project metadata (project.logoUrl) when converting GraphQL token responses into CurrencyInfo. 
Token data fetching is performed via GraphQLApi.useTokenQuery(...) with Apollo-like caching policies (cache-first by default; cache-and-network when refetching). This is a key part of the “ingestion pipeline” because token metadata (including logoUrl) is cached at the data layer, not only at the image layer. 
There is also a specific logic note for “common base” tokens: when a local common-base entry exists, the interface may override its logo with queryResult.data.token.project.logoUrl because “some common base images are broken,” explicitly preferring the Uniswap-served project logo when present. 

How the Interface turns URIs into fetchable URLs
The UniversalImage component takes the raw uri (here: the token’s logoUrl) and derives an HTTP URL via uriToHttpUrls(uri)[0]. 

For IPFS/IPNS, the current code converts:

ipfs://<hash> → https://ipfs.io/ipfs/<hash>/ and an alternate gateway https://hardbin.com/ipfs/<hash>/
ipns://<name> → https://ipfs.io/ipns/<name>/ and https://hardbin.com/ipns/<name>/ 
This means Uniswap’s effective availability and cache characteristics for IPFS-hosted logos depend heavily on these gateway choices.

Format handling, sizing, fallbacks, and “resizing behavior”
SVG handling is extension-based. The system checks whether the HTTP URL’s path ends in .svg (case-insensitive) and only then routes into the SVG rendering path. 

Implication: If you host an SVG but the URL does not end with .svg (for example .../logo?format=svg), the interface may treat it as a “plain image” instead of using the SVG pipeline. 

No server-side resizing is implied in this code path. The component is given a target display size, and the browser/device image stack renders the remote asset into that box. 
 From a performance standpoint, larger source images will download larger bytes unless your hosting/CDN does content negotiation or serves an appropriately sized thumbnail URL.

Size computation: when fastImage is enabled and dimensions are not known, the component calls Image.getSize(uri, ...) to compute width/height; errors lead to a fallback. 

Fallback behavior: if no image URL works or an error occurs, Uniswap falls back to a “symbol badge” rendering (first ~3 characters of the token symbol), which is an important safety net for broken/missing images. 

Caching and CDN/proxy behavior
There are two distinct caching layers worth separating:

Metadata caching: GraphQL token queries use cache policies (cache-first, optionally cache-and-network), so the mapping from token → logoUrl may be cached even before image fetch/caching is considered. 
Image caching: the actual image requests are standard HTTP(S) image fetches from the user’s browser/device, so caching largely follows HTTP cache headers and the browser cache model (plus any caching by the upstream host or IPFS gateway). The code shows Uniswap is not wrapping images in a bespoke “image resizing proxy” in this path; it is normal URL loading through UniversalImage / Image / SVG renderer. 
Token standards and how they relate to images
ERC‑20 and why Uniswap can’t get logos from the chain
ERC‑20 (EIP‑20) standardizes token methods/events; even its commonly-used “metadata” functions are optional, and there is no standardized “image/logo” function in ERC‑20 itself. 
 This is why Uniswap needs off‑chain token lists and/or off‑chain registries for logos.

ERC‑721 and ERC‑1155 metadata versus fungible token logos
For NFTs, ERC‑721 and ERC‑1155 define metadata URI patterns (tokenURI / uri) and are commonly associated with JSON metadata containing an image field (and related extensions). 
 This is structurally different from ERC‑20 token icons in Uniswap’s swap UI: Uniswap’s token selector is dealing with fungible assets and expects a single icon per token contract, not per token ID.

ERC‑681 and why it usually doesn’t help token icons
ERC‑681 defines an “ethereum:” URL format for transaction requests and deep-links. It helps represent transaction intents, not token logo discovery. 

ERC‑1046 and its limited practical impact on Uniswap token logos
ERC‑1046 proposes token URI interoperability and describes metadata interoperability concepts (primarily used with ERC‑721/1155 contexts). 
 Even where ERC‑1046-style metadata exists, Uniswap’s current interface code path for token logos uses project.logoUrl from GraphQL token/project metadata plus Token Lists conventions (logoURI), rather than attempting to interrogate ERC‑20 contracts for a token URI. 

Ecosystem sources and likely priority order for icons
Token Lists as the explicit spec layer
Token Lists are the standardized way for interfaces/wallets to associate tokens with logoURI. The Uniswap-maintained schema formalizes this and recommends SVG/PNG sizing guidelines (64×64 token, 256×256 list). 

TrustWallet as a historically important logo source
Uniswap’s own docs (even if under the v1 docs section) explicitly state that “Logo images are pulled from TrustWallet” and instruct projects to submit a PR to the TrustWallet assets repository to update logos. 

The practical reality is also visible in Uniswap’s default token list: many tokens’ logoURI fields directly reference TrustWallet-hosted GitHub raw asset paths. 

CoinGecko as a common hosted-logo source
Uniswap’s default token list also contains many logoURI values that point directly to CoinGecko-hosted assets (e.g., https://assets.coingecko.com/...). 

This implies that, in practice, Uniswap’s UI pipeline can display third-party HTTPS-hosted PNG/JPG assets even though the schema text recommends SVG/PNG. 

Uniswap Interface’s token project logos via GraphQL Data API
In current interface code, the displayed token logo “url” is commonly the logoUrl coming from project.logoUrl returned by GraphQL queries. 

This strongly suggests Uniswap has a “token project” registry service that aggregates token metadata (and likely resolves logos from curated sources), which the UI treats as canonical enough to override some broken local sources. 

Reasonable inferred priority order
Based on the code and official schema wording, the most defensible summary of “priority” is:

If Uniswap Data API returns a project.logoUrl, the interface uses it as CurrencyInfo.logoUrl. 
Token Lists provide logoURI (optional) and are widely used across the ecosystem; Uniswap’s schema is explicit about this and implies interfaces can fall back to address-based sources when logoURI is missing. 
TrustWallet/CoinGecko URLs are both observed in Uniswap’s default list and referenced by Uniswap docs as mechanisms for logo updates, making them key ecosystem routes for “getting your logo to show up.” 
If none of the above resolves, the UI falls back to a generated symbol badge. 
Practical constraints, recent issues, and a compatibility checklist
Practical constraints derived from Uniswap’s actual URL handling
HTTPS is strongly preferred. For http:// URIs, Uniswap tries an https:// rewrite first (and retains the http version as a fallback in most cases). If your hosting doesn’t support HTTPS correctly, your logo may intermittently fail. 

Only certain schemes are supported. If you provide something outside {https, http, ipfs, ipns, ar, data} (or a local path when allowed), Uniswap’s URL normalizer returns no usable URL and the UI will show a fallback. 

SVG support is highly URL-shape dependent. Uniswap’s SVG detection is based on the URL pathname ending in .svg. Prefer URLs that literally end in /logo.svg (and don’t rely solely on query params) for maximum SVG reliability. 

IPFS logos are gateway-dependent. ipfs://… is converted to https://ipfs.io/ipfs/.../ plus a backup gateway. If either gateway is blocked or degraded for a user, the logo can fail. 

What “size” should you ship
From Uniswap’s own Token Lists schema:

Token icon recommended: 64×64 (SVG or PNG). 
Token list icon recommended: 256×256 (SVG or PNG). 
From the UI code, tokens are often displayed at small sizes (one common default is a “40px icon size”), so ultra-high-resolution raster images are usually wasted bandwidth unless you need them for other platforms too. 

A practical best practice is to keep a “master” (e.g., 512–1024) for reuse, but host a web-optimized PNG/SVG for the actual logoURI used by Uniswap.

Format comparison for token icons
Format	Pros for Uniswap token icons	Cons / risks in Uniswap context
PNG	Widely compatible, supports transparency, explicitly recommended by Token Lists schema. 
Larger files than vector for simple logos; large PNGs waste bandwidth if you serve 1024×1024 for a 40px render. 
JPEG	Smaller for photo-like images; Uniswap default list demonstrates that JPEG/JPG logos are used in practice via CoinGecko-hosted assets. 
No transparency; compression artifacts; not what schema recommends (schema suggests SVG/PNG). 
SVG	Perfect scaling at small icon sizes; explicitly recommended by schema; handled by UniversalImage when URL ends with .svg. 
If the URL does not end with .svg, Uniswap may not treat it as SVG; complex SVGs can be heavy or render differently across engines. 
WebP	Often smaller than PNG/JPEG; supported by most modern browsers	Not explicitly recommended in the Token Lists schema; ecosystem tooling and some clients may not handle it consistently. (Uniswap’s schema guidance and observed defaults are mainly PNG/SVG/JPEG.) 

Recent changes and known issues affecting ingestion
Even if your logo is correct, real-world ingestion can be impacted by upstream reliability and platform differences:

Wallet / Android environments have reported token list loading failures (token selector shows no list; searching by token address fails) in Uniswap Interface issue tracking. 
The Uniswap Interface has had incidents reported as “Failed to load tokens” affecting token availability in the UI (which can indirectly affect whether logos appear at all if token metadata can’t be fetched). 
Separately, IPFS gateway availability is a recurring operational dependency in Web3 UIs; Uniswap’s current code uses ipfs.io plus a secondary gateway for IPFS/IPNS resolution. 

Testing recommendations and a compatibility checklist
To maximize the chance your token logo displays correctly on Uniswap (and similar token-list-based UIs), test both the token list JSON and the image URL.

Checklist

Your token is present in a Token Lists–compatible JSON document with required fields (chainId, address, decimals, name, symbol). 
Provide logoURI (optional but strongly recommended), ideally:
https://…/logo.png (64×64 PNG) or
https://…/logo.svg (URL ends with .svg). 
Ensure the logoURI is reachable via HTTPS, with no auth and a stable URL. 
Avoid unusual schemes: stick to https:// or ipfs:// (knowing IPFS will be gateway-resolved). 
If using IPFS, test the resolved gateway URLs (ipfs.io, and the backup gateway used by the interface). 
For “default appearance” beyond your own list, consider the ecosystem routes Uniswap historically references:
TrustWallet assets PR path for logos is explicitly mentioned in Uniswap docs and is used in Uniswap’s default list. 
CoinGecko-hosted logos are used in Uniswap’s default list, indicating CoinGecko inclusion may also be relevant. 
Sample curl commands

Check that your image is served as an image with HTTPS, correct content type, and acceptable caching:

bash
Copy
# 1) Verify headers for the logo
curl -I "https://example.com/path/logo.png"

# Look for:
# - HTTP/2 200 (or 304)
# - Content-Type: image/png  (or image/svg+xml)
# - Cache-Control: public, max-age=...
# - No login redirects

# 2) Verify the token list JSON is reachable (and ideally CORS-friendly)
curl -I "https://example.com/my.tokenlist.json"
curl -s  "https://example.com/my.tokenlist.json" | head

# 3) If you use ipfs://... verify the gateway-resolved URL Uniswap will actually hit
curl -I "https://ipfs.io/ipfs/<CID>/"
Sources to trust first
For Uniswap token icon compatibility, the most authoritative sources are:

The Uniswap-maintained Token Lists JSON schema (Uniswap/token-lists) for the logoURI field and size/protocol expectations. 
The Uniswap Interface repository for actual runtime behavior (UniversalImage, URI normalization, SVG detection, and API-sourced project.logoUrl). 
Uniswap documentation indicating historical/official operational practice for logos (TrustWallet). 
The Uniswap default token list (Uniswap/default-token-list) as evidence of real-world accepted logoURI hosting patterns (CoinGecko URLs, TrustWallet GitHub raw URLs, IPFS).

4626 implementation baseline (March 2026)

Current status versus the requirements above:

- Implemented: canonical token renderer endpoint (`/api/v1/token/{address}/image`) with public CORS and cache headers.
- Implemented: extension-based canonical logo aliases (`/api/v1/token/{address}/logo.png`, `/api/v1/token/{address}/logo.svg`) with a 64x64 default output size.
- Implemented: Token Lists-compatible endpoint (`/api/v1/token/{address}/tokenlist`) that emits `logoURI` as an absolute URL to `logo.png` and includes `extensions.logoSVG`.
- Implemented: source artwork URI normalization for `https`, `http`, `ipfs`, `ipns`, `ar`, and `data:image/...`.
- Preserved for compatibility: existing query-based image endpoints (`format=png|svg`, custom `size`).

Canonical routes for Uniswap-oriented integrations:

- PNG logo (recommended `logoURI` target):  
  `https://api.4626.fun/v1/token/<address>/logo.png?chain=8453`
- SVG logo alias (optional):  
  `https://api.4626.fun/v1/token/<address>/logo.svg?chain=8453`
- Token list payload for a single token:  
  `https://api.4626.fun/v1/token/<address>/tokenlist?chain=8453`

Managed multi-token list (stable URL for tokenlists ingestion):

- TokenLists-compatible multi-token document:  
  `https://api.4626.fun/api/tokenlist`
- Optional extension alias (some ingestion pipelines prefer a .json filename):  
  `https://api.4626.fun/api/tokenlist.json`

When enabled, deploy automation can append newly deployed `shareOFT` addresses into the stable multi-token document so ingestion can pick them up without changing the URL.

Related:

- `docs/reference/coins-metadata.md` — recommended ERC-7572 coin metadata JSON format and how to validate it with `@zoralabs/coins-sdk`.