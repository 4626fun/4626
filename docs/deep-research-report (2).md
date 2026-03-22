# Integrating Magic Select–Style Subject Extraction Into the wenakita/4626 Premium Renderer

## Executive summary

The current wenakita/4626 rendering pipeline already contains two distinct “breakout/mask” worlds: a **deterministic compatibility renderer** (in `frontend/api/_handlers/token/_image.ts`) that can call **rembg** to extract a foreground and then uses that extracted alpha as a reference for breakout masking and cleanup, and a **premium renderer** (in `frontend/api/_handlers/token/_premiumTokenIconRenderer.ts`) that builds a much richer frame/glow stack and can accept “hero cutout” assets—but still needs a **reliable subject-mask generator** to (a) precisely align the “top portion” of a subject within the chamber and (b) decide when a breakout is actually warranted. fileciteturn22file0L1-L1 fileciteturn23file0L1-L1

For a “Magic Select–style” step, **rembg is the best integration vehicle** because it already packages multiple segmentation models (U²-Net variants, IS-Net, SAM, BiRefNet, BRIA RMBG) behind one CLI/library, and explicitly supports model selection (`-m`), mask-only output (`-om`), alpha matting (`-a`), and even SAM prompting (`-x`). citeturn6view0turn5view0 This makes it possible to ship a single Node/TS integration that can improve quality over time without rewriting model runners.

Recommended strategy:

- Use **rembg with a higher-quality default model** (for example **`bria-rmbg`** or **`birefnet-general`**) for photos and most illustrations, and switch to **pixel-art-safe heuristics** when the source is genuinely pixel art or low-res. citeturn6view0  
- Use the segmentation mask not only to “cut out” a breakout sprite, but also to compute a deterministic **top alignment bias** (so the top of the subject sits where you want inside the premium chamber). This is the missing “Magic Select → align” bridge.
- Do **not** force breakout: compute a simple **breakout potential** score from the subject mask in the frame-top band; only render breakout when this score is above a threshold. Keep “no-breakout” as the production default when segmentation fails; keep your optional “fallback band” behind an env var for debugging.

This report provides: (a) where the relevant code lives, (b) what open-source segmentation stacks are best, (c) an integration design for mask generation + top alignment + breakout gating, (d) diff-style TypeScript changes, (e) parameter tuning tables, (f) tests, and (g) mermaid diagrams.

## Codebase reconnaissance in wenakita/4626

### Premium renderer composition, breakout entry points, and signature placement

The premium renderer is located at:

- `frontend/api/_handlers/token/_premiumTokenIconRenderer.ts` fileciteturn21file0L1-L1

Within this file (as fetched from the repo snapshot), the premium pipeline includes:

- A full premium composition function `renderPremiumTokenIcon(...)` (the top-level entry point used by the token image handler). fileciteturn22file0L1-L1  
- The premium glow/frame stack (including `renderOuterGlow`, `renderFrameBloom`, and `renderPremiumFrame`). fileciteturn22file0L1-L1  
- Breakout-specific functions including `renderBreakoutLayer(...)`, which can take `subjectMaskSourceImage` (a cutout/reference alpha source) and an `allowFallbackBand` flag. fileciteturn22file0L1-L1  
- Signature placement via an internal helper `renderCreatorSignature(...)` that computes a bottom-right lockup aligned to the frame geometry. fileciteturn22file0L1-L1

Important implication: the premium renderer already has a “slot” for a reference alpha source (`subjectMaskSourceImage`) and fallback band behavior gated by env vars (for example `TOKEN_PREMIUM_BREAKOUT_FALLBACK_BAND`). fileciteturn22file0L1-L1  
What it does **not** fully solve on its own is the “Magic Select” problem: generating a reliable subject mask for arbitrary art styles and using that mask to **align** the subject and **decide** if breakout should exist.

### Deterministic renderer breakout + rembg integration points

The deterministic/compatibility renderer is in:

- `frontend/api/_handlers/token/_image.ts` fileciteturn23file0L1-L1

It contains:

- A `BREAKOUT_CONFIG` block that defines breakout geometry behavior (for example `riseAboveFrameRatio`, `visibleBelowFrameRatio`, `fadeBelowFrameRatio`) and points at a rembg executable path (`BREAKOUT_CONFIG.rembgBin`). fileciteturn23file0L1-L1  
- A rembg-based foreground extraction helper `extractForeground(pngBytes)` which shells out to `rembg i input output`. fileciteturn23file0L1-L1  
- Mask refinement helpers, notably `refineForegroundCutout(...)` and `applyReferenceAlphaMask(...)` (threshold → morphology → blur), which are exactly the sort of post-processing you’d expect after a Magic Select–style segmentation. fileciteturn23file0L1-L1  
- A breakout alpha application function `applyBreakoutAlphaMask(...)` that uses the configured ratios and later thresholds/blur to keep the breakout soft and continuous. fileciteturn23file0L1-L1  

Key takeaway: wenakita/4626 already trusts the “rembg produces a good enough alpha matte” approach in the deterministic path. The premium path should reuse that philosophy—**but with higher quality models, better gating, and alignment**.

### Existing tests relevant to renderer safety and geometry

The repo already contains Vitest-based tests in:

- `frontend/api/__tests__/tokenImageRenderer.test.ts` fileciteturn29file0L1-L1

Notable patterns worth reusing:

- It generates synthetic PNGs via `sharp({ create: ... }).composite(...)` for deterministic layout testing without shipping copyrighted photos. fileciteturn29file0L1-L1
- It tests breakout mask creation behavior and basic output dimensions. fileciteturn29file0L1-L1

This makes it feasible to add automated tests for “top alignment” and “breakout gating” later.

## Open-source segmentation options for Magic Select–style masks

### U²-Net and its variants

U²-Net is a salient object detection architecture frequently used for foreground/background separation. The official repository documents large and small checkpoints (for example `u2net.pth` around **176 MB** and `u2netp.pth` around **4.7 MB**) and describes the workflow to generate saliency masks. citeturn4view0  
The repo is **Apache-2.0 licensed**. citeturn0search0turn4view0

Strengths:
- Good at “single prominent subject” extraction, often sufficient for icon-like compositions. citeturn0search0  
- Small variant (`u2netp`) is fast and small (but lower quality). citeturn4view0

Weaknesses (relevant to your use case):
- It is saliency-driven, which can fail on complex “busy” illustrations or when the subject is not salient by contrast.
- Human segmentation models may not yield hair-level precision (explicitly noted in their repo notes). citeturn4view2
- Pixel art and hard-edged cartoons can produce mushy edges unless you do heavy edge refinement.

### rembg as a practical production wrapper

`rembg` is a background removal tool that runs on ONNX Runtime and can be used as CLI, library, server, or Docker image. It is **MIT licensed**. citeturn6view0

What makes rembg especially relevant:

- It supports explicit **model selection**: `rembg i -m <model> ...` citeturn5view0  
- It can output **mask-only** results (`-om`) citeturn5view0  
- It supports **alpha matting** (`-a`) for higher quality edges (important for premium look) citeturn5view0  
- It can run **SAM** as a model and accept prompt JSON via `-x` (even though your use case is likely promptless most of the time). citeturn5view0  
- It maintains a large list of available models and downloads them automatically to `~/.u2net/` (or a path you control via env vars such as `U2NET_HOME`). citeturn6view0  

Crucially, rembg is no longer “just U²-Net.” It includes higher-quality and more specialized choices like:

- `isnet-general-use`, `isnet-anime` citeturn6view0  
- `birefnet-*` family citeturn6view0  
- `bria-rmbg` (“state-of-the-art background removal model by BRIA AI”) citeturn6view0  
- `sam` (encoder/decoder checkpoints) citeturn6view0

Trade-off summary: **rembg is the best “Magic Select step” substrate** because it gives you a stable interface and the ability to swap better models without touching TS code (beyond a model string).

### Segment Anything Model (SAM)

SAM is a promptable segmentation foundation model released by Meta, with code published in `facebookresearch/segment-anything` under **Apache-2.0**. citeturn0search1  
The ICCV 2023 paper describes SAM as a promptable model trained with a large-scale data engine, and highlights broad zero-shot segmentation capability. citeturn1search2

Strengths:
- Can segment diverse objects across distributions; strong generality. citeturn1search2

Weaknesses in your renderer context:
- Without user prompts, you must either guess prompts (bounding box/point) or run automatic mask generation, which is typically heavier than saliency-based models.
- There are real-world failure modes (for example, the literature notes SAM can struggle in certain concealed/camouflaged scenarios). citeturn1search8
- Runtime/memory cost is widely higher than U²-Net-style background removal, which matters on serverless or latency-sensitive endpoints.

Practical recommendation: **use SAM as an optional high-quality fallback** (or for interactive tooling), not as the default for every token render.

### U2Seg

U2Seg is positioned as “Unsupervised Universal Image Segmentation” (CVPR 2024). citeturn0search2  
Licensing is complicated: the repo states it is Apache-licensed overall, but **portions/dependencies are available under CC-BY-NC** (and other licenses). citeturn0search2

This makes U2Seg a poor fit for:
- A production token renderer embedded in a commercial product (CC-BY-NC can be a blocker).
- A simple “foreground mask” use case (U2Seg is aimed at broader “universal segmentation,” often with heavier pipelines). citeturn0search2

Recommendation: do not integrate U2Seg into the runtime renderer. If ever used, it would be offline experimentation only.

### Best-fit recommendation matrix

For a premium icon renderer that must handle **photos, illustrations, and pixel art**, the best route is:

- Primary: **rembg** (MIT) using a modern general model (`bria-rmbg`, `birefnet-general`, or `isnet-general-use`) and alpha matting when needed. citeturn6view0turn5view0  
- Secondary: **source alpha** and hero cutouts (if provided) as the most faithful mask when available (already supported in the premium renderer). fileciteturn22file0L1-L1  
- Optional high-precision mode: rembg’s `sam` model with programmatic prompts (or future interactive tooling). citeturn5view0turn6view0  
- Pixel art: prefer transparency-based masks; if absent, use a heuristic “corner-background flood/colorkey” last resort (more predictable than saliency models for pixel art).

## Integration design for Magic Select–style masks and precise top alignment

### Goals and constraints

Your requirement is not just “create a mask”; it’s:

- Extract a **subject mask** good enough to represent the top-of-subject contours.
- Use that mask to **align the top portion** inside the premium chamber (so the “op/top portion” lands predictably).
- Use the same mask to decide if breakout should render at all (do **not** force breakout on every picture).
- Keep production behavior safe: segmentation failures should degrade to **no-breakout** by default.

The existing premium renderer already has the primary lever you need: `renderBreakoutLayer` can accept a `subjectMaskSourceImage` (alpha reference) and can optionally show a fallback band behind an env flag. fileciteturn22file0L1-L1

### Proposed pipeline steps

This pipeline assumes you are rendering via the premium path (`renderPremiumTokenIcon`), and you want “Magic Select + align” to affect both the contained hero art and breakout.

**Step: Normalize source artwork**
- Continue normalizing with sharp rotation + PNG conversion (existing `normalizeSourceImage` in premium renderer; deterministic renderer has a similar `normalizeImageToPng`). fileciteturn22file0L1-L1 fileciteturn23file0L1-L1

**Step: Analyze source style**
- Keep the current analysis/classification logic to avoid doing segmentation on “bright badge” or low-res assets where it’s unlikely to help. fileciteturn22file0L1-L1

**Step: Generate a subject mask (Magic Select step)**
- New helper: `generateSegmentationMask(imageBytes, options)` that returns one of:
  - `maskPngRgba`: a PNG where alpha contains the mask (RGB can be white), suitable for later alpha-bound computations.
  - `cutoutPng`: an RGBA cutout (optional), suitable as `subjectMaskSourceImage` for breakout.
- Prefer: rembg with a quality model (default `bria-rmbg` or `birefnet-general`) and optionally `-a` alpha matting. citeturn6view0turn5view0

**Where to call segmentation**
- Call **after normalization**, before computing final placement and breakout, because you need the mask to compute top alignment and breakout potential.
- Do **not** call pre-normalization unless you also reapply the exact same transformations to the mask. Post-normalization is simpler and keeps coordinates consistent.

**Step: Compute top alignment bias from the mask**
- Render the **mask reference** through the same placement function used for art (same scale/fit).
- Compute the top-most relevant alpha in the chamber and calculate a `topBiasPx` update so the subject’s top aligns to a configurable target (for example `layout.chamberY + chamberSize * 0.04`).
- This is the most “Magic Select–like” part: you’re using the mask to reposition the subject into a premium composition reliably.

**Step: Decide breakout using mask-derived breakout potential**
- Compute `breakoutPotential = maskAlphaCoverageInBreakoutBand`.
- Only draw breakout if this is above a threshold.
- This prevents “forced breakout” on images that don’t actually have meaningful overlap.

**Step: Render layers**
- Render the regular artwork layer using the aligned `topBiasPx`.
- If breakout is enabled, call `renderBreakoutLayer` and pass `subjectMaskSourceImage` (hero cutout or rembg cutout), plus `allowFallbackBand` only when explicitly enabled (debug). fileciteturn22file0L1-L1

### Passing mask bytes into `renderBreakoutLayer`

The premium renderer already supports passing `subjectMaskSourceImage`, which is normalized and rendered into a reference canvas for mask extraction. fileciteturn22file0L1-L1  
Your new segmentation helper should return bytes that satisfy the assumptions in the breakout mask logic:

- If `createTopBreakoutSubjectMask` expects to read meaningful alpha, the safest approach is to pass a real RGBA cutout (rembg default output) rather than a grayscale mask with no alpha. citeturn5view0  
- If you do use `-om` (mask-only), you must convert it into a PNG with alpha populated from the mask pixels (otherwise `.ensureAlpha()` would create alpha=255 everywhere, defeating the mask).

### Align/crop the extracted subject’s “top portion” inside the frame

The cleanest implementation uses a deterministic calculation:

1. Place the mask reference into a “probe canvas” using the same placement logic as the artwork.
2. Extract alpha bounds and find `subjectTopY` in chamber coordinates.
3. Compute `delta = subjectTopY - targetTopY`.
4. Update `topBiasPx = clamp(topBiasPx + delta, 0, biasMax)` and optionally rerun once for convergence.

This approach has two advantages:
- It remains consistent across photos and illustrations (because it relies on alpha geometry, not heuristics).
- It aligns the subject “top” relative to the premium chamber independent of source dimensions.

## Concrete code changes

This section provides diff-style changes and new files. Because your repo already contains both the deterministic rembg workflow (`extractForeground(...)`) and premium breakout hooks (`subjectMaskSourceImage`), the main work is: **(a) factor a segmentation helper, (b) integrate top alignment, (c) gate breakout by mask coverage.**

### New helper module for segmentation

Create a new file:

`frontend/api/_handlers/token/_segmentation.ts`

```diff
+import fs from 'node:fs/promises'
+import path from 'node:path'
+import { execFile } from 'node:child_process'
+import { randomUUID } from 'node:crypto'
+import { tmpdir } from 'node:os'
+import { promisify } from 'node:util'
+import sharp from 'sharp'
+
+const execFileP = promisify(execFile)
+
+export type SegmentationModel =
+  | 'bria-rmbg'
+  | 'birefnet-general'
+  | 'birefnet-portrait'
+  | 'isnet-general-use'
+  | 'isnet-anime'
+  | 'u2net'
+  | 'u2netp'
+  | 'u2net_human_seg'
+  | 'sam'
+
+export type GenerateSegmentationMaskOptions = {
+  model: SegmentationModel
+  /**
+   * When true, pass `-a` to rembg (alpha matting) for higher quality edge transitions.
+   * This is typically helpful for portraits/hair.
+   */
+  alphaMatting?: boolean
+  /**
+   * If set, rembg will output only the mask (`-om`), which we then convert to an RGBA-alpha PNG.
+   * If false/omitted, we will use the standard cutout output and derive alpha from it.
+   */
+  maskOnly?: boolean
+  timeoutMs?: number
+  /**
+   * Optional: additional JSON payload for rembg `-x` (e.g., SAM prompt).
+   * Note: This is advanced; in most cases you should keep this undefined.
+   */
+  extraParamsJson?: string
+}
+
+export type SegmentationResult = {
+  provider: 'rembg'
+  model: SegmentationModel
+  /** PNG with alpha channel representing mask (RGB is white). */
+  maskPngRgba: Buffer
+  /** Optional cutout output from rembg (RGBA subject). */
+  cutoutPng?: Buffer
+}
+
+const REMBG_BIN_CANDIDATES = [
+  process.env.REMBG_BIN,
+  '/tmp/rembg-env/bin/rembg',
+  '/usr/local/bin/rembg',
+  '/usr/bin/rembg',
+  'rembg',
+].filter((bin): bin is string => typeof bin === 'string' && bin.trim().length > 0)
+
+function firstNonEmpty(value: unknown): string | null {
+  if (typeof value !== 'string') return null
+  const t = value.trim()
+  return t.length ? t : null
+}
+
+export async function generateSegmentationMask(
+  pngBytes: Buffer,
+  options: GenerateSegmentationMaskOptions,
+): Promise<SegmentationResult | null> {
+  const timeoutMs = options.timeoutMs ?? Number(process.env.TOKEN_PREMIUM_REMBG_TIMEOUT_MS ?? 30_000)
+  if (REMBG_BIN_CANDIDATES.length === 0) return null
+
+  const id = randomUUID()
+  const inPath = path.join(tmpdir(), `seg-in-${id}.png`)
+  const outPath = path.join(tmpdir(), `seg-out-${id}.png`)
+
+  try {
+    await fs.writeFile(inPath, pngBytes)
+
+    const args: string[] = ['i']
+    // Model selection: `rembg i -m <model> ...` citeturn5view0
+    args.push('-m', options.model)
+    // Optional alpha matting: `-a` citeturn5view0
+    if (options.alphaMatting) args.push('-a')
+    // Optional: mask-only output `-om` citeturn5view0
+    if (options.maskOnly) args.push('-om')
+    // Optional: extra params JSON (SAM prompt or custom model), `-x` citeturn5view0
+    const extraJson = firstNonEmpty(options.extraParamsJson)
+    if (extraJson) args.push('-x', extraJson)
+
+    args.push(inPath, outPath)
+
+    let lastErr: unknown = null
+    for (const bin of REMBG_BIN_CANDIDATES) {
+      try {
+        await execFileP(bin, args, { timeout: timeoutMs })
+        const out = await fs.readFile(outPath)
+
+        if (!options.maskOnly) {
+          // Derive alpha mask from cutout output.
+          const alpha = await sharp(out).ensureAlpha().extractChannel('alpha').png().toBuffer()
+          const { data, info } = await sharp(alpha).raw().toBuffer({ resolveWithObject: true })
+          const px = info.width * info.height
+          const rgba = Buffer.alloc(px * 4, 255)
+          for (let i = 0; i < px; i += 1) rgba[i * 4 + 3] = data[i] ?? 0
+          const maskPngRgba = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
+            .png()
+            .toBuffer()
+
+          return { provider: 'rembg', model: options.model, maskPngRgba, cutoutPng: out }
+        }
+
+        // maskOnly: output is a mask image (often grayscale). Convert to RGBA alpha.
+        const { data, info } = await sharp(out)
+          .toColourspace('b-w')
+          .raw()
+          .toBuffer({ resolveWithObject: true })
+
+        const px = info.width * info.height
+        const rgba = Buffer.alloc(px * 4, 255)
+        for (let i = 0; i < px; i += 1) rgba[i * 4 + 3] = data[i] ?? 0
+        const maskPngRgba = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
+          .png()
+          .toBuffer()
+
+        return { provider: 'rembg', model: options.model, maskPngRgba }
+      } catch (err) {
+        lastErr = err
+        const code =
+          typeof err === 'object' && err && 'code' in err ? String((err as any).code ?? '') : ''
+        if (code === 'ENOENT') continue
+      }
+    }
+
+    // Could add logging here; keep silent by default (premium renderer controls logging).
+    void lastErr
+    return null
+  } finally {
+    await Promise.all([
+      fs.unlink(inPath).catch(() => {}),
+      fs.unlink(outPath).catch(() => {}),
+    ])
+  }
+}
```

Why this structure:

- It directly follows rembg’s supported CLI interface: model selection (`-m`), mask-only output (`-om`), alpha matting (`-a`), and extra JSON params (`-x`). citeturn5view0turn6view0  
- It returns **mask bytes in a renderer-friendly format** (alpha is meaningful), which is essential for your top alignment and breakout systems.

### Integrating segmentation + top alignment into the premium pipeline

Below is a focused diff sketch for `frontend/api/_handlers/token/_premiumTokenIconRenderer.ts` (path confirmed in repo). fileciteturn21file0L1-L1  
Because your fetched snapshot already includes breakout hooks and/or rembg logic in some branches, treat this as the canonical “After” design—merge with your exact current file contents.

#### Add imports and tunables

```diff
 import sharp from 'sharp'
+import { generateSegmentationMask, type SegmentationModel } from './_segmentation.js'
```

Add tunables near the top (names chosen to match your existing env-flag patterns used elsewhere in wenakita/4626):

```diff
+const PREMIUM_SEGMENTATION_ENABLED =
+  process.env.TOKEN_PREMIUM_SEGMENTATION !== '0'
+
+const PREMIUM_SEGMENTATION_MODEL_PHOTO =
+  (process.env.TOKEN_PREMIUM_SEGMENTATION_MODEL_PHOTO as SegmentationModel | undefined) ?? 'bria-rmbg'
+const PREMIUM_SEGMENTATION_MODEL_ILLUSTRATION =
+  (process.env.TOKEN_PREMIUM_SEGMENTATION_MODEL_ILLUSTRATION as SegmentationModel | undefined) ?? 'isnet-general-use'
+const PREMIUM_SEGMENTATION_MODEL_PIXEL =
+  (process.env.TOKEN_PREMIUM_SEGMENTATION_MODEL_PIXEL as SegmentationModel | undefined) ?? 'u2netp'
+
+// Top alignment target: where we want the subject’s topmost pixel to land inside the chamber.
+// Keep these conservative; you can tune after visual goldens.
+const PREMIUM_ALIGN_TARGET_TOP_RATIO =
+  Number(process.env.TOKEN_PREMIUM_ALIGN_TARGET_TOP_RATIO ?? 0.04)
+const PREMIUM_ALIGN_MAX_BIAS_RATIO =
+  Number(process.env.TOKEN_PREMIUM_ALIGN_MAX_BIAS_RATIO ?? 0.09)
+
+// Breakout gating based on mask occupancy in the breakout band.
+const PREMIUM_BREAKOUT_MASK_MIN_COVERAGE =
+  Number(process.env.TOKEN_PREMIUM_BREAKOUT_MASK_MIN_COVERAGE ?? 0.004)
```

Model choice rationale:
- rembg’s model list explicitly includes `bria-rmbg`, `isnet-general-use`, `u2netp`, and more. citeturn6view0  
- `isnet-general-use` is commonly used as a high-accuracy general model in rembg-based tools. citeturn6view0turn1search7  
- `u2netp` is a small/fast fallback; by analogy, U²-Net’s small checkpoint is 4.7MB in the original repo. citeturn4view0

#### Add helper to compute top alignment bias from a mask

```diff
+async function computeAlignedTopBiasPx(params: {
+  layout: PremiumLayout
+  baseTopBiasPx: number
+  scale: number
+  fit: ArtworkFitMode
+  sourceClass: SourceClass
+  // Must be a PNG with meaningful alpha channel
+  maskRgbaPng: Buffer
+}): Promise<number> {
+  const { layout } = params
+  if (params.fit !== 'cover') return params.baseTopBiasPx
+
+  // Render the mask through the same placement logic as the art.
+  const maskCanvas = await renderPlacedSourceCanvas({
+    sourceImage: params.maskRgbaPng,
+    layout,
+    scale: params.scale,
+    fit: 'cover',
+    topBiasPx: params.baseTopBiasPx,
+    sourceClass: params.sourceClass,
+    maxTopBiasRatio: PREMIUM_ALIGN_MAX_BIAS_RATIO,
+  })
+
+  const { data, info } = await sharp(maskCanvas)
+    .ensureAlpha()
+    .raw()
+    .toBuffer({ resolveWithObject: true })
+
+  // Reuse your existing alpha bounds scanner pattern (used elsewhere in the file).
+  const bounds = getAlphaBounds(data, info.width, info.height, info.channels)
+  if (!bounds) return params.baseTopBiasPx
+
+  const targetTop = Math.round(layout.chamberY + layout.chamberSize * PREMIUM_ALIGN_TARGET_TOP_RATIO)
+  const delta = bounds.minY - targetTop
+
+  // Positive delta means subject is too low; increase topBias to lift it.
+  const next = params.baseTopBiasPx + Math.max(0, delta)
+  const maxBiasPx = Math.round(layout.chamberSize * PREMIUM_ALIGN_MAX_BIAS_RATIO)
+  return clamp(next, 0, maxBiasPx)
+}
```

This is the core “Magic Select → align” mechanic: it uses the extracted subject matte to compute an optical composition shift, instead of guessing based on texture/occupancy heuristics alone.

#### Add helper to decide if breakout is warranted from the mask

```diff
+async function measureBreakoutMaskCoverage(params: {
+  size: number
+  layout: PremiumLayout
+  scale: number
+  topBiasPx: number
+  sourceClass: SourceClass
+  maskRgbaPng: Buffer
+}): Promise<number> {
+  const maskCanvas = await renderPlacedSourceCanvas({
+    sourceImage: params.maskRgbaPng,
+    layout: params.layout,
+    scale: params.scale,
+    fit: 'cover',
+    topBiasPx: params.topBiasPx,
+    sourceClass: params.sourceClass,
+    maxTopBiasRatio: PREMIUM_ALIGN_MAX_BIAS_RATIO,
+  })
+
+  // Only look inside the “breakout band” region (roughly above the chamber top, centered).
+  const { data, info } = await sharp(maskCanvas)
+    .ensureAlpha()
+    .raw()
+    .toBuffer({ resolveWithObject: true })
+
+  const x0 = Math.max(0, params.layout.breakoutX)
+  const x1 = Math.min(info.width, params.layout.breakoutX + params.layout.breakoutWidth)
+  const y0 = Math.max(0, params.layout.breakoutY)
+  const y1 = Math.min(info.height, params.layout.breakoutY + params.layout.breakoutHeight)
+
+  let on = 0
+  let total = 0
+  for (let y = y0; y < y1; y += 1) {
+    for (let x = x0; x < x1; x += 1) {
+      total += 1
+      const a = data[(y * info.width + x) * info.channels + 3] ?? 0
+      if (a > 32) on += 1
+    }
+  }
+  if (total <= 0) return 0
+  return on / total
+}
```

This is what stops you from “forcing breakout on everything.”

#### Use segmentation + alignment in `renderPremiumTokenIcon`

Here is a conceptual “Before/After” for the part where top bias and breakout are decided.

**BEFORE (typical current pattern):**
```ts
const topBiasPx =
  analysis.fitMode === 'cover' && analysis.sourceClass === 'portraitPhoto'
    ? Math.max(1, Math.round(layout.chamberSize * 0.018))
    : 0
```

**AFTER (mask-driven alignment + breakout gating):**
```diff
-const topBiasPx =
-  analysis.fitMode === 'cover' && analysis.sourceClass === 'portraitPhoto'
-    ? Math.max(1, Math.round(layout.chamberSize * 0.018))
-    : 0
+let topBiasPx =
+  analysis.fitMode === 'cover' && analysis.sourceClass === 'portraitPhoto'
+    ? Math.max(1, Math.round(layout.chamberSize * 0.018))
+    : 0
+
+let segmentationMaskRgba: Buffer | null = null
+let segmentationCutout: Uint8Array | null = null
+
+if (PREMIUM_SEGMENTATION_ENABLED && normalizedSource && analysis) {
+  const wantSeg =
+    analysis.fitMode === 'cover' &&
+    !analysis.brightBadgeLike &&
+    !analysis.lowResolution &&
+    (analysis.sourceClass === 'portraitPhoto' ||
+      analysis.sourceClass === 'illustration' ||
+      analysis.sourceClass === 'generic')
+
+  if (wantSeg) {
+    const model: SegmentationModel =
+      analysis.sourceClass === 'portraitPhoto'
+        ? PREMIUM_SEGMENTATION_MODEL_PHOTO
+        : analysis.sourceClass === 'illustration'
+          ? PREMIUM_SEGMENTATION_MODEL_ILLUSTRATION
+          : PREMIUM_SEGMENTATION_MODEL_PHOTO
+
+    const seg = await generateSegmentationMask(
+      Buffer.from(normalizedSource),
+      {
+        model,
+        // Alpha matting improves edge quality (hair/fur), mirroring “premium” expectations. citeturn5view0
+        alphaMatting: analysis.sourceClass === 'portraitPhoto',
+        // Prefer cutout output (so we have actual alpha), and derive a mask from it.
+        maskOnly: false,
+        timeoutMs: 30_000,
+      },
+    )
+
+    if (seg?.maskPngRgba) {
+      segmentationMaskRgba = seg.maskPngRgba
+      if (seg.cutoutPng && seg.cutoutPng.length > 0) {
+        segmentationCutout = new Uint8Array(seg.cutoutPng)
+      }
+
+      // Align: update topBiasPx based on mask geometry.
+      topBiasPx = await computeAlignedTopBiasPx({
+        layout,
+        baseTopBiasPx: topBiasPx,
+        scale: renderScale,
+        fit: analysis.fitMode,
+        sourceClass: analysis.sourceClass,
+        maskRgbaPng: seg.maskPngRgba,
+      })
+    }
+  }
+}
```

Now, incorporate breakout gating:

```diff
-let shouldRenderBreakout = false
+let shouldRenderBreakout = false
+let maskBreakoutCoverage = 0
+
+if (segmentationMaskRgba && analysis.fitMode === 'cover') {
+  maskBreakoutCoverage = await measureBreakoutMaskCoverage({
+    size,
+    layout,
+    scale: breakoutScale,
+    topBiasPx: breakoutTopBiasPx,
+    sourceClass: analysis.sourceClass,
+    maskRgbaPng: segmentationMaskRgba,
+  })
+}
+
+const breakoutWorthIt =
+  maskBreakoutCoverage >= PREMIUM_BREAKOUT_MASK_MIN_COVERAGE
+
+// Only allow “segmentation-based breakout” if the mask says there’s meaningful content in the breakout band.
+// This avoids forcing breakout on every picture.
```

Finally, when populating `subjectMaskSourceImage` for breakout:

```diff
-} else if (breakoutPlan.mode === 'rembgCutout') {
-  const rembgCutout = await extractForegroundRembg(normalizedSource)
-  if (rembgCutout && rembgCutout.length > 0) {
-    subjectMaskSourceImage = new Uint8Array(rembgCutout)
-    shouldRenderBreakout = true
-  } else if (ALLOW_PREMIUM_FALLBACK_BAND) {
-    allowFallbackBand = true
-    shouldRenderBreakout = true
-  }
-}
+} else if (/* segmentation path */ segmentationCutout && breakoutWorthIt) {
+  subjectMaskSourceImage = segmentationCutout
+  shouldRenderBreakout = true
+} else if (ALLOW_PREMIUM_FALLBACK_BAND && /* debug */ breakoutPlan.breakoutRequested) {
+  allowFallbackBand = true
+  shouldRenderBreakout = true
+}
```

This yields your requested behavior:
- breakout **exists** (feature capability is present),
- breakout is **controlled** (only when the mask band indicates meaningful overlap),
- breakout is **not forced** for every image,
- and top alignment becomes deterministic.

### Update `renderBreakoutLayer` interface (if not already present)

Your repo snapshot indicates a premium breakout layer can accept a separate `subjectMaskSourceImage` and `allowFallbackBand`. fileciteturn22file0L1-L1  
If your local branch does not have these yet, here is the signature delta:

```diff
 export async function renderBreakoutLayer(params: {
   size: number
   layout: PremiumLayout
   sourceImage?: Uint8Array
+  subjectMaskSourceImage?: Uint8Array
+  allowFallbackBand?: boolean
   opacity?: number
   scale?: number
   topBiasPx?: number
   sourceClass?: SourceClass
 }): Promise<Buffer> {
```

Then ensure the internal breakout subject-mask logic uses `subjectMaskSourceImage` as the alpha reference (exactly as your current design intent suggests). fileciteturn22file0L1-L1

## Fallback behavior and parameter tuning

### Fallback behavior when segmentation fails

You asked for three fallback tiers:

- Production default: **no-breakout**  
- Optional debug fallback band (env var)  
- Last-resort fast heuristic mask (color-key/edge-based)

This maps naturally to:

**Tier A: Production default**
- If `generateSegmentationMask(...)` returns null (or an unusable mask), do not render breakout. This is already a safe behavior pattern in the premium renderer design (when there is no usable subject mask and fallback band is disabled). fileciteturn22file0L1-L1

**Tier B: Debug fallback band**
- Preserve `TOKEN_PREMIUM_BREAKOUT_FALLBACK_BAND` as an opt-in debug/QA tool. The deterministic path already has similar “only top band” breakout masking (`createTopBreakoutMask`, `applyBreakoutAlphaMask`). fileciteturn23file0L1-L1

**Tier C: Last-resort heuristic mask**
Add an internal helper like:

- Sample corner colors (or edge bands) from the normalized image.
- Build a distance mask (foreground if far from background color).
- Optionally keep the largest connected component near the center/top.
- Morphology + small blur to avoid jagged edges.

This is specifically useful for:
- Pixel art without alpha (segmentation models often misbehave here).
- Illustrations with flat single-color backgrounds.

### Parameter tuning table

The table below includes parameters you can tune for mask quality, breakout gating, and “top portion alignment.” “Old value” reflects what’s already visible in repo patterns (deterministic breakout config and mask postprocessing), while “New value” reflects proposed additions in this report. Where the exact old value varies by branch, it is marked as unspecified.

| Parameter | Old value (repo) | Proposed value | Rationale |
|---|---:|---:|---|
| rembg model used for foreground | Unspecified / default `rembg i ...` in deterministic path fileciteturn23file0L1-L1 | `bria-rmbg` (photos) or `isnet-general-use` (illustrations) | rembg explicitly offers these higher-quality options for general use; improves mask fidelity. citeturn6view0 |
| rembg alpha matting | Not used in existing calls (appears as baseline) fileciteturn23file0L1-L1 | Enable `-a` for portraits | rembg documents `-a` for alpha matting; improves edge transitions (hair/fur). citeturn5view0 |
| Mask-only output | Not used in existing calls | Prefer cutout output, derive alpha; optional `-om` | Cutout preserves alpha and is directly usable as `subjectMaskSourceImage`. Mask-only requires conversion to alpha. citeturn5view0 |
| Top alignment target ratio | Unspecified | `0.04` (chamber size) | Keeps subject top slightly below chamber top for a premium “headroom” feel; tune with visual goldens. |
| Max auto top-bias ratio | Unspecified | `0.09` (chamber size) | Prevents extreme shifts that break composition; still allows meaningful up-lift for portraits. |
| Breakout minimum mask coverage | Unspecified | `0.004` | Prevents forced breakout: only render breakout when the subject actually occupies the breakout band. |
| Deterministic breakout riseAboveFrameRatio | `0.21` fileciteturn23file0L1-L1 | keep `0.21` initially | Already tuned for existing breakout behavior; premium can diverge later after goldens. |
| Deterministic breakout visibleBelowFrameRatio | `0.055` fileciteturn23file0L1-L1 | keep `0.055` initially | Maintains continuity. |
| Alpha reference mask thresholding | e.g., threshold around `58`, erode/dilate, blur ~`0.45–0.8` in deterministic helpers fileciteturn23file0L1-L1 | Slightly stronger blur for photo masks; lower blur for pixel | Photos benefit from smoother mattes; pixel art demands hard edges (avoid blur). |
| Breakout topOccupancy heuristic reliance | Present in deterministic classification/breakout evaluation fileciteturn23file0L1-L1 | Reduce reliance; prefer mask-based `breakoutCoverage` | Once segmentation exists, use alpha geometry rather than texture heuristics for deciding breakout. |

## Test and validation strategy

### Visual validation checklist

Add a small curated set of test cases that cover the entire style envelope:

- Portrait photo with hair/fur (tests alpha matting benefit)
- Pet portrait (ears often drive breakout)
- Illustration with clear subject/background
- Anime-style illustration (optional `isnet-anime`)
- Pixel art with transparency
- Pixel art without transparency (tests heuristic fallback)
- Bright badge/logo (should prefer contain/no breakout)

Pass criteria (examples):
- The subject’s top-most alpha pixel inside the chamber lands within ±2% of `PREMIUM_ALIGN_TARGET_TOP_RATIO`.
- Breakout renders only when `breakoutCoverage >= PREMIUM_BREAKOUT_MASK_MIN_COVERAGE`.
- Breakout never renders in production when segmentation fails and fallback band is disabled.
- No visual seams at the frame boundary (alpha continuity check).

### Automated tests

Leverage the existing Vitest + Sharp synthetic-image strategy (already used in `tokenImageRenderer.test.ts`). fileciteturn29file0L1-L1

Recommended test layers:

**Unit tests**
- `generateSegmentationMask`:
  - When rembg binary missing, returns null (no-throw).
  - When given a synthetic “cutout-like” PNG, the returned `maskPngRgba` has nonzero alpha.
- `computeAlignedTopBiasPx`:
  - Use a synthetic mask with a rectangle near the top; verify bias decreases the measured top offset.
- `measureBreakoutMaskCoverage`:
  - For a mask with content in the breakout rectangle, coverage > threshold; for content below, coverage ~0.

**Integration tests**
- Render a premium icon with segmentation mocked/stubbed:
  - Provide a known alpha mask and verify `topBiasPx` changes (you can expose the helper under `__testables` similar to `_image.ts` design). fileciteturn23file0L1-L1
- “Golden” rendering:
  - Save outputs for deterministic synthetic inputs and compare with `pixelmatch` (tolerance-based). Keep separate goldens for `standard`, `hero`, and `pixel` presets.

**Test images**
- Prefer **procedurally generated** PNGs (Sharp create + composite) to avoid licensing risk. The repo already does this pattern to create sources and hero cutouts. fileciteturn29file0L1-L1  
- For realism, you can add 1–2 CC0 assets later, but keep them out of core CI until licensing is vetted.

## Mermaid diagrams

### Rendering + segmentation flow

```mermaid
flowchart TD
  A[Input artwork bytes] --> B[Normalize to PNG<br/>rotate + ensure decode]
  B --> C[Analyze source<br/>classify: portrait/illustration/pixel/badge]
  C -->|not candidate| D[Heuristic placement<br/>scale + topBias defaults]
  C -->|candidate| E[Generate subject mask<br/>rembg -m MODEL (-a optional)]
  E -->|success| F[Compute top alignment<br/>mask geometry -> topBiasPx]
  E -->|fail| G[Segmentation failed]
  G -->|prod default| H[No breakout<br/>continue]
  G -->|debug env| I[Fallback band breakout]
  G -->|last resort| J[Heuristic mask<br/>corner colorkey/flood]
  F --> K[Render artwork layer<br/>with aligned topBias]
  D --> K
  H --> K
  J --> F
  K --> L[Breakout decision<br/>mask breakout coverage]
  L -->|coverage >= threshold| M[Render breakout layer<br/>subjectMaskSourceImage]
  L -->|coverage < threshold| N[No breakout layer]
  M --> O[Composite layers<br/>outer glow + frame + signature]
  N --> O
  O --> P[Final PNG]
```

### Breakout decision path

```mermaid
flowchart TD
  S[Breakout requested?] -->|no| X[No breakout]
  S -->|yes| A[Is breakout suppressed?]
  A -->|yes| X
  A -->|no| B[Have hero cutout?]
  B -->|yes| C[Use hero cutout alpha]
  B -->|no| D[Has usable source alpha?]
  D -->|yes| E[Use source alpha]
  D -->|no| F[Have segmentation mask?]
  F -->|no| G{Fallback band enabled?}
  G -->|yes| H[Fallback band breakout<br/>(debug only)]
  G -->|no| X
  F -->|yes| I[Measure mask coverage<br/>in breakout band]
  I -->|>= threshold| J[Render breakout layer<br/>with segmentation cutout alpha]
  I -->|< threshold| X
```

## External references used

- rembg (MIT) official repo: models list, CLI options (`-m`, `-om`, `-a`, `-x`), model cache behavior. citeturn6view0turn5view0  
- U²-Net official repo: model sizes, usage, licensing, and known limitations on certain human segmentation accuracy. citeturn4view0turn4view2  
- Segment Anything (SAM): official GitHub repo license and ICCV paper description. citeturn0search1turn1search2  
- U2Seg: repo description and licensing caveats (CC-BY-NC dependencies). citeturn0search2  
- wenakita/4626 internal files (paths and implementation snapshots): premium renderer, deterministic renderer, and existing tests. fileciteturn21file0L1-L1 fileciteturn22file0L1-L1 fileciteturn23file0L1-L1 fileciteturn29file0L1-L1