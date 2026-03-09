# Locked Frame + Smart Breakout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the frame identical across generated token images by moving frame rendering into deterministic code, while allowing breakout only when a subject image supports it.

**Architecture:** Keep OpenAI responsible for generating premium inner artwork only. Add a server-side compositor that renders the final image from deterministic layers: dark canvas, generated artwork fitted into a fixed content window, locked frame overlay, deterministic glow, and optional smart breakout based on foreground extraction quality checks.

**Tech Stack:** TypeScript, Sharp, OpenAI Responses API, Supabase Storage, Vitest

---

### Task 1: Define the deterministic composition contract

**Files:**
- Modify: `frontend/server/_lib/openaiImage.test.ts`
- Modify: `frontend/server/_lib/openaiImage.ts`

**Step 1: Write the failing test**

Add a test asserting that the model prompt no longer asks for the frame to be the final source of truth, and instead instructs the model to generate inner artwork for a fixed frame layout.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/openaiImage.test.ts`

Expected: FAIL because the current prompt still tells the model to preserve the frame as the dominant visual identity.

**Step 3: Write minimal implementation**

Update `buildImageGenerationPrompt()` so it:

- describes the frame as fixed and code-rendered
- asks for premium inner artwork only
- emphasizes dark background, centered subject, clean negative space
- avoids asking the model to redraw or restyle the frame

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/openaiImage.test.ts`

Expected: PASS.

### Task 2: Add a server-side locked-frame compositor

**Files:**
- Create: `frontend/server/_lib/imageCompositor.ts`
- Create: `frontend/server/_lib/imageCompositor.test.ts`

**Step 1: Write the failing test**

Add tests for a compositor function that:

- places generated artwork in a fixed inner content box
- overlays the exact same frame asset every time
- produces deterministic outer background and glow

Include at least one assertion that a supplied frame asset survives unchanged in the final layer ordering.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/imageCompositor.test.ts`

Expected: FAIL because the compositor helper does not exist yet.

**Step 3: Write minimal implementation**

Create a compositor helper that:

- accepts generated artwork bytes
- accepts frame bytes
- resizes artwork into a fixed inner region
- renders a dark base canvas
- composites artwork
- composites the locked frame asset unchanged
- adds deterministic glow

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/imageCompositor.test.ts`

Expected: PASS.

### Task 3: Add smart breakout classification and fallback

**Files:**
- Modify: `frontend/server/_lib/imageCompositor.test.ts`
- Modify: `frontend/server/_lib/imageCompositor.ts`

**Step 1: Write the failing test**

Add tests for:

- skipping breakout when extracted foreground is weak, fragmented, or logo-like
- enabling breakout only when top-region silhouette quality is high
- falling back to fully-in-frame composition without throwing

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/imageCompositor.test.ts`

Expected: FAIL because breakout classification and fallback do not exist yet.

**Step 3: Write minimal implementation**

Extend the compositor with:

- foreground extraction input
- simple confidence heuristics
- a soft top-region breakout mask
- deterministic fallback to no-breakout

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/imageCompositor.test.ts`

Expected: PASS.

### Task 4: Wire the compositor into the generation runner

**Files:**
- Modify: `frontend/server/_lib/imageGenerationRunner.test.ts`
- Modify: `frontend/server/_lib/imageGenerationRunner.ts`

**Step 1: Write the failing test**

Add a runner test asserting that after model generation completes, the final stored output comes from the compositor, not raw model bytes.

Also add a test showing that a weak breakout candidate still results in a completed job using the non-breakout fallback.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/imageGenerationRunner.test.ts`

Expected: FAIL because the runner currently stores raw model output directly.

**Step 3: Write minimal implementation**

Update the runner so it:

- downloads the locked frame asset
- passes generated artwork through the compositor
- stores the composited result as the output asset
- records whether breakout was used, if that metadata is useful for retries or debugging

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/imageGenerationRunner.test.ts`

Expected: PASS.

### Task 5: Adjust evaluation to match deterministic frame rendering

**Files:**
- Modify: `frontend/server/_lib/openaiImage.test.ts`
- Modify: `frontend/server/_lib/openaiImage.ts`

**Step 1: Write the failing test**

Add a test asserting that evaluation guidance focuses on subject fit, premium treatment, background darkness, and cleanliness rather than asking whether the model preserved the frame.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/openaiImage.test.ts`

Expected: FAIL because evaluation still assumes the frame is a model responsibility.

**Step 3: Write minimal implementation**

Update the evaluation rubric and retry-reason shaping so retries target:

- subject composition
- darkness / cleanliness
- premium look
- breakout naturalness when enabled

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/openaiImage.test.ts`

Expected: PASS.

### Task 6: Make local `/admin/imagegen` testing work in Vite dev

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/pages/AdminImageGeneration.test.ts`

**Step 1: Write the failing test**

Add a test or assertion-backed change note ensuring local testing expectations include the imagegen endpoints. If the config is not directly unit-tested, add a page-level note or route coverage test that documents the local path.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/pages/AdminImageGeneration.test.ts`

Expected: FAIL if the new expectation is not yet represented.

**Step 3: Write minimal implementation**

Add the imagegen API handlers to the local Vite API route map so browser-based localhost testing of `/admin/imagegen` works.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/pages/AdminImageGeneration.test.ts`

Expected: PASS.

### Task 7: Verify the full locked-frame pipeline

**Files:**
- No new production files required

**Step 1: Run focused tests**

Run:

- `pnpm vitest run server/_lib/openaiImage.test.ts`
- `pnpm vitest run server/_lib/imageCompositor.test.ts`
- `pnpm vitest run server/_lib/imageGenerationRunner.test.ts`
- `pnpm vitest run src/pages/AdminImageGeneration.test.ts`

Expected: all PASS.

**Step 2: Run repo verification**

Run:

- `pnpm typecheck`
- `pnpm lint`

Expected: all PASS.

**Step 3: Run runtime smoke test**

Run the same direct-handler smoke test used in this session against local env and confirm:

- project completes
- output asset exists
- public output URL exists
- frame remains fixed in exported result

**Step 4: Commit**

Only if explicitly requested by the user.
