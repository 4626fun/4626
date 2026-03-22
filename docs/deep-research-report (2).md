# Why the “Magic Select / breakout” behavior isn’t working in wenakita/4626

## Executive summary

Your current deployed path (as represented in `wenakita/4626` at commit `50c6feed…`) does **not** yet implement the “Magic Select–style subject extraction step for top-portion alignment” you asked for; instead, it only attempts breakout via **(a) a provided hero cutout**, **(b) existing source alpha**, or **(c) a rembg cutout** (opaque-only, texture-gated), and even that can be **silently disabled** by policy or runtime constraints. fileciteturn34file0L1-L1

In practice, “it isn’t working” most often comes down to one (or more) of these root causes:

- You’re still seeing **cached PNGs**: `_image.ts` caches the final PNG in Vercel Blob with a **one-year max-age**, keyed by `FRAME_STYLE_V`. If you don’t bump `FRAME_STYLE_V` after renderer changes, you can keep serving the old image indefinitely. fileciteturn33file0L1-L1  
- Breakout is being **suppressed** because a **hero cutout URL exists but failed to load**; `_image.ts` explicitly sets `suppressBreakout` when `heroCutoutLoadFailed` is true. That blocks *all* breakout plans (including rembg fallback) in the premium renderer. fileciteturn33file0L1-L1 fileciteturn34file0L1-L1  
- **rembg isn’t available in the runtime**: the premium renderer probes for a runnable `rembg` executable and will refuse the `rembgCutout` mode if it can’t execute one of the candidate paths. fileciteturn34file0L1-L1  
  - On Vercel/serverless, calling arbitrary system executables is often restricted or requires bundling/providing the binary; community guidance suggests this frequently fails unless you ship the executable yourself. citeturn1search6  
- Even when breakout is “enabled,” `renderBreakoutLayer()` can return an **all-transparent breakout sprite** if the subject-mask gate fails (and fallback band is disabled), so the composite looks like “no breakout.” fileciteturn34file0L1-L1  

Additionally, the specific “top portion (op portion) isolation + precise alignment inside the premium frame” is **not implemented in the repo**: there is no `_segmentation.ts` in this GitHub snapshot, and the premium renderer does not call a mask-generation helper for alignment. fileciteturn35file0L1-L1 fileciteturn34file0L1-L1

## What the code is actually doing today

### Premium vs deterministic render path and silent fallbacks

The PNG endpoint in `_image.ts` generates a cached PNG via `getOrCreatePng(...)`. That function renders the icon by calling `renderDeterministicTokenIcon(...)`, which **tries** `renderPremiumTokenIcon(...)` and **falls back** to a deterministic compatibility composition if the premium renderer throws. fileciteturn33file0L1-L1

This matters because if your premium renderer hits a runtime failure (common when `execFile` fails or sharp throws), you may not notice visually—your output will “work” but won’t contain new premium/breakout behaviors. The fallback behavior is explicitly logged as a warning. fileciteturn33file0L1-L1

### Caching can make “new code” look like it does nothing

`getOrCreatePng(...)` caches the final PNG in Vercel Blob under a key that includes `FRAME_STYLE_V` (and a hash seed that also includes `FRAME_STYLE_V`). It then uploads with `cacheControlMaxAgeSeconds: 31_536_000` (one year). fileciteturn33file0L1-L1

Consequence: **If you change rendering logic but do not increment `FRAME_STYLE_V`, you can keep fetching the previously cached PNG forever**, and your visual changes will appear to “not work.” fileciteturn33file0L1-L1

In your snapshot, `FRAME_STYLE_V = 104`. If you made changes expecting different output but didn’t bump this value, you are almost certainly seeing cached content. fileciteturn33file0L1-L1

## Breakout is heavily gated and has multiple “off switches”

### The suppression policy that can disable breakout unexpectedly

The handler resolves a “hero cutout load policy.” If a hero cutout URL exists but bytes fail to load, it sets `suppressBreakout: true`. fileciteturn33file0L1-L1

The premium renderer then uses `params.suppressBreakout` in `decideBreakoutPlan(...)` and in the breakout gating logic—if suppressed, breakout mode becomes `none`. fileciteturn34file0L1-L1

Practical interpretation:

- If a token has `heroCutoutArtworkUrl` metadata but it’s 404/timeout/auth-blocked, you will **disable breakout globally**, including rembg fallback, even when the main artwork would benefit from breakout. fileciteturn33file0L1-L1 fileciteturn34file0L1-L1  
- This is a *very* common reason “breakout isn’t working” on specific assets.

### rembg is only attempted for a narrow slice of images

In `decideBreakoutPlan(...)`, rembg is only considered when all of these hold:

- `breakoutRequested` is true (cover fit, not bright badge, not suppressed) fileciteturn34file0L1-L1  
- The source has **no transparency** (`!analysis.hasTransparency`) and is **not low-res** fileciteturn34file0L1-L1  
- The classified `sourceClass` is `portraitPhoto` or `illustration` plus top-region texture/occupancy thresholds (`topCenterStdDev`, `topOccupancy`) fileciteturn34file0L1-L1  

So if your image is:
- transparent art (PNG stickers, most pixel art exports), **rembg won’t run** by design (it’ll prefer source alpha breakout), fileciteturn34file0L1-L1  
- low resolution or “badge-like,” breakout will also be disabled, fileciteturn34file0L1-L1  
- an opaque image lacking enough top texture/occupancy under these heuristics, it also won’t run rembg. fileciteturn34file0L1-L1  

### rembg may not exist in production at all

Even if `decideBreakoutPlan` chooses `rembgCutout`, actual extraction uses `execFile` invoking `rembg` from `binCandidates` such as `/tmp/rembg-env/bin/rembg`, `/usr/local/bin/rembg`, or `rembg` on PATH. fileciteturn34file0L1-L1  

The renderer probes availability by executing `rembg --help`; if none of these succeed, it treats rembg as unavailable. fileciteturn34file0L1-L1

This is frequently the runtime reality on serverless platforms: community guidance indicates Vercel often does **not** allow calling arbitrary system executables unless you bundle/provide them (or move the work into a runtime that supports it). citeturn1search6  

If rembg is your intended “Magic Select brain,” confirm it actually runs in production before expecting masks/breakouts.

### A subtle “it rendered but it’s invisible” failure mode

In `renderBreakoutLayer(...)`, the function creates a subject mask via `createTopBreakoutSubjectMask(...)`. If it cannot produce a subject mask **and** `allowFallbackBand` is false, it returns a fully transparent breakout layer (“no subject mask and fallback disabled”). fileciteturn34file0L1-L1

At the call site in `renderPremiumTokenIcon(...)`, you can still end up compositing an “empty breakout layer,” which visually looks like **breakout didn’t work**, even though the code path executed. fileciteturn34file0L1-L1

This is especially likely when:
- source alpha exists but the breakout-region alpha stats fail the “meaningful transparency” gate, fileciteturn34file0L1-L1  
- fallback band is disabled (default, unless `TOKEN_PREMIUM_BREAKOUT_FALLBACK_BAND=1`). fileciteturn34file0L1-L1  

## The “Magic Select–style segmentation + top alignment” step isn’t actually integrated in the repo

You asked for a segmentation helper (`generateSegmentationMask`) and for using that intermediate mask to align the top portion inside the chamber.

In the GitHub repo snapshot we inspected:

- The premium renderer does **not** import a segmentation helper; it only invokes `rembg` directly and only as a breakout-mode option. fileciteturn34file0L1-L1  
- A repo search for `_segmentation` does not show a helper module in the runtime path; it only surfaces a docs file, not a TS helper. fileciteturn35file0L1-L1  

So if you expect “Magic Select alignment,” and you’ve only deployed what’s in `wenakita/4626`, then *by definition* it won’t happen yet.

## Why your specific images likely fail in practice

I can’t directly inspect the “sediment://…” image pointers you posted (they’re not accessible as raw bytes in this environment), so image-specific characteristics (transparency, resolution, top occupancy, etc.) are **unspecified**. That said, your recent outputs and your description (“breakout still hasn’t been resolved” / “still not there”) are consistent with one or more of these concrete scenarios derived from the code:

### Scenario A: You’re looking at cached PNGs

If you’re iterating on rendering styles but viewing the same token+size+preset combination via `getOrCreatePng`, you will receive the cached Blob result unless `FRAME_STYLE_V` changes. fileciteturn33file0L1-L1

This is the single most common “why didn’t my change show up” failure in this codebase because the blob cache is long-lived by design. fileciteturn33file0L1-L1

### Scenario B: Breakout is being suppressed due to a broken hero cutout URL

If `heroCutoutArtworkUrl` exists for the token but fetch fails, `_image.ts` sets `suppressBreakout` true. fileciteturn33file0L1-L1  
Then the premium renderer’s `decideBreakoutPlan` will return `mode: 'none'` with reason `suppressed`, and you’ll see no breakout. fileciteturn34file0L1-L1

This can happen even if your base art would otherwise be a perfect rembg candidate—suppression blocks the whole breakout stack.

### Scenario C: rembg isn’t actually runnable in your deployed runtime

If rembg cannot be executed at runtime, the renderer will log `rembgAvailable: false` and will refuse `rembgCutout` mode, yielding no breakout (without fallback band). fileciteturn34file0L1-L1

Given that rembg’s “real” implementation is Python/ONNX under the hood and it typically depends on a Python environment, deploying it into a Node serverless runtime requires extra work; this is not “automatic.” citeturn1search1turn1search6

### Scenario D: Your input has transparency but fails the subject-mask gate in the breakout band

Even when source alpha breakout is chosen, `createTopBreakoutSubjectMask` has conservative checks intended to prevent “rectangle strip” breakouts; if those checks reject the region, breakout becomes transparent unless fallback band is enabled. fileciteturn34file0L1-L1

This often happens for artwork where transparency exists globally, but the breakout region itself is mostly opaque (or the alpha structure doesn’t match the “subject-like” contour assumptions).

## Concrete actions to make it “work” reliably

### Confirm whether you’re seeing cached output

In `_image.ts`, bump `FRAME_STYLE_V` any time you change premium composition or breakout logic. This is the intended cache invalidation lever because it is embedded in the blob key. fileciteturn33file0L1-L1

If you want a quick test without editing versions, request SVG mode (`?format=svg`) to bypass blob caching (though edge caching still exists). The SVG path renders a fresh PNG in-process. fileciteturn33file0L1-L1

### Turn on runtime logging and debug asset dumps

The premium renderer already has strong logging hooks:

- Set `TOKEN_PREMIUM_BREAKOUT_LOG=1` to print the runtime banner and per-request breakout mode decision. fileciteturn34file0L1-L1  
- Set `TOKEN_BREAKOUT_DEBUG=1` and/or `TOKEN_BREAKOUT_DEBUG_DIR=<some writable path>` to dump intermediate PNGs (`breakout-source-canvas`, `breakout-mask-subject`, etc.). fileciteturn34file0L1-L1  

These logs will immediately tell you which of the four scenarios you’re in: cached, suppressed, rembg unavailable, or mask gate rejected.

### Validate whether hero cutouts are suppressing breakout

If you don’t want a broken hero cutout URL to suppress all breakouts, change the policy so that “hero cutout load failed” triggers **“don’t cache this result”** (already handled) but does **not** globally set `suppressBreakout`. Right now it does. fileciteturn33file0L1-L1

A more resilient policy is:
- hero cutout loaded → use it  
- hero cutout missing/broken → fall back to rembg or no-breakout, but don’t suppress the entire mechanism

### If rembg is the blocker, choose an integration path that actually runs on your platform

rembg itself is excellent as a model orchestrator (supports `bria-rmbg`, `birefnet-*`, `isnet-*`, `u2net*`, `sam`, and more). citeturn1search1  
But calling it as a CLI binary from Node in serverless can be fragile. citeturn1search6

Robust options:

- Put segmentation into a dedicated **Python runtime function** (Vercel supports Python serverless functions as first-class). citeturn0search2  
- Or avoid the CLI entirely and integrate segmentation within Node using ONNX runtime (this is more engineering work but avoids system executables).

If your goal is “Magic Select quality,” rembg’s modern models (`bria-rmbg`, `birefnet-general`) are exactly the right direction. citeturn1search1  
U²-Net is still useful (and has a tiny `u2netp`), but it’s older and tends to be less robust across styles without refinement. citeturn1search0turn1search1  

## Bottom line

From the repo state alone, the most defensible explanation is:

- The repo **does not yet include the segmentation + alignment integration**, so the “Magic Select top-portion isolation” goal cannot be met. fileciteturn35file0L1-L1  
- Even for breakout-only behavior, the system can be “working” internally but outputting “no visible breakout” due to caching, suppression, rembg unavailability, or conservative subject-mask gating. fileciteturn33file0L1-L1 fileciteturn34file0L1-L1  

If you tell me which environment you generated those three new images from (local dev vs deployed URL) and whether `TOKEN_PREMIUM_BREAKOUT_LOG=1` shows `rembgAvailable: true/false` + which `mode` you’re landing in, I can narrow it down to the exact branch of the decision tree—using the existing logging fields already emitted by `renderPremiumTokenIcon`. fileciteturn34file0L1-L1