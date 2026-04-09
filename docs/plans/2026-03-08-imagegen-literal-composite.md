# Literal Subject Composite Implementation Plan

> **Execution note:** Follow this plan task-by-task.

**Goal:** Replace the default imagegen runtime path with deterministic literal subject compositing so the uploaded subject image is used directly inside the locked frame instead of being redrawn by OpenAI.

**Architecture:** The runner should stop calling OpenAI for the default uploaded frame + subject flow. Instead, it should download the real subject asset, extract and refine the foreground from that image, render a deterministic dark inner background plus placed subject layer, and pass those deterministic layers into the locked-frame compositor. Breakout remains optional and uses the real subject cutout only.

**Tech Stack:** TypeScript, Sharp, Vitest, Supabase Storage, rembg

---

### Task 1: Add deterministic literal subject renderer

**Files:**
- Create: `frontend/server/_lib/literalSubjectRenderer.ts`
- Create: `frontend/server/_lib/literalSubjectRenderer.test.ts`

**Step 1: Write the failing test**

Add tests for a helper that:

- accepts uploaded subject bytes
- renders a dark inner background
- fits the real subject image into the fixed content box
- preserves the literal subject pixels instead of inventing new artwork

Include one test that samples the rendered subject region and proves the result still comes from the original subject asset rather than a generated substitute.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/literalSubjectRenderer.test.ts`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Create `literalSubjectRenderer.ts` with a helper that:

- loads the subject image with Sharp
- creates a deterministic dark inner background
- resizes the subject with `fit: contain`
- composites the real subject into a fixed content box
- returns the rendered interior layer plus the resolved content box

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/literalSubjectRenderer.test.ts`

Expected: PASS.

### Task 2: Reuse real subject extraction for literal composite mode

**Files:**
- Modify: `frontend/server/_lib/imageForegroundExtraction.test.ts`
- Modify: `frontend/server/_lib/imageForegroundExtraction.ts`

**Step 1: Write the failing test**

Add a test proving the extraction helper can be used directly on the uploaded subject image bytes for literal composite mode and still returns a refined cutout or `null` safely.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/imageForegroundExtraction.test.ts`

Expected: FAIL because the current helper contract or test coverage does not yet prove the subject-driven path explicitly.

**Step 3: Write minimal implementation**

Adjust the helper only as needed so the contract is clearly valid for original subject asset bytes:

- preserve PNG normalization
- preserve `rembg` usage and timeout
- preserve safe `null` fallback

Do not over-generalize.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/imageForegroundExtraction.test.ts`

Expected: PASS.

### Task 3: Teach the compositor to accept deterministic interior layer

**Files:**
- Modify: `frontend/server/_lib/imageCompositor.test.ts`
- Modify: `frontend/server/_lib/imageCompositor.ts`

**Step 1: Write the failing test**

Add tests proving the compositor can:

- accept a pre-rendered deterministic interior artwork layer
- still overlay the exact frame asset unchanged
- still allow optional breakout from the real extracted cutout
- still fallback cleanly to fully in-frame output

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/imageCompositor.test.ts`

Expected: FAIL because the compositor currently assumes the input is model artwork to be resized directly.

**Step 3: Write minimal implementation**

Update the compositor so it can compose:

- deterministic interior layer
- frame
- optional breakout cutout
- glow

Keep the fixed content window and silhouette heuristics intact.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/imageCompositor.test.ts`

Expected: PASS.

### Task 4: Replace OpenAI generation in runner default path

**Files:**
- Modify: `frontend/server/_lib/imageGenerationRunner.test.ts`
- Modify: `frontend/server/_lib/imageGenerationRunner.ts`

**Step 1: Write the failing test**

Add runner tests proving that the default uploaded frame + subject path:

- does not call `generateImageWithOpenAi(...)`
- renders from the real subject image instead
- still stores the final composited asset
- still records breakout metadata and safe fallback behavior

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/imageGenerationRunner.test.ts`

Expected: FAIL because the runner still calls OpenAI and treats generated artwork as the source layer.

**Step 3: Write minimal implementation**

Update the runner so it:

- downloads frame asset
- downloads subject asset
- extracts foreground from the real subject asset
- renders deterministic literal interior artwork
- passes that deterministic layer plus optional real cutout into the compositor
- stores the final composited output

Leave existing job failure semantics intact.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/imageGenerationRunner.test.ts`

Expected: PASS.

### Task 5: Bypass model-oriented evaluation for literal composite mode

**Files:**
- Modify: `frontend/server/_lib/openaiImage.test.ts`
- Modify: `frontend/server/_lib/openaiImage.ts`
- Modify: `frontend/server/_lib/imageGenerationRunner.test.ts`
- Modify: `frontend/server/_lib/imageGenerationRunner.ts`

**Step 1: Write the failing test**

Add tests proving the literal composite path no longer depends on OpenAI evaluation guidance to decide whether the subject or frame were preserved.

The test should assert that default literal-composite success depends on deterministic rendering completion, not model-behavior scoring.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_lib/openaiImage.test.ts server/_lib/imageGenerationRunner.test.ts`

Expected: FAIL because the current runner still applies the old model-oriented evaluation contract.

**Step 3: Write minimal implementation**

Update the runtime path so literal composite mode:

- bypasses or minimizes model-specific evaluation
- records deterministic metadata such as breakout used / fallback used
- keeps existing failure behavior for genuinely unusable assets

Do not redesign unrelated APIs.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_lib/openaiImage.test.ts server/_lib/imageGenerationRunner.test.ts`

Expected: PASS.

### Task 6: Verify literal composite output with real reference assets

**Files:**
- Modify: `frontend/src/pages/AdminImageGeneration.test.ts` only if needed for expectations
- No required production file changes unless verification exposes a bug

**Step 1: Write the failing test**

Only if a small regression test is needed for a verification-discovered issue.

**Step 2: Run focused verification**

Run:

- `pnpm vitest run server/_lib/literalSubjectRenderer.test.ts`
- `pnpm vitest run server/_lib/imageForegroundExtraction.test.ts`
- `pnpm vitest run server/_lib/imageCompositor.test.ts`
- `pnpm vitest run server/_lib/imageGenerationRunner.test.ts`

Then run:

- `pnpm lint`
- `pnpm typecheck`

Expected:

- focused tests PASS
- lint PASS
- typecheck may still show unrelated pre-existing failures; report them explicitly if so

**Step 3: Run localhost smoke test with real images**

Use the real frame and dog assets used in this discussion.

Expected:

- job completes
- final output uses the actual dog image, not an AI-redrawn dog
- breakout is optional and may be true or false depending on the real silhouette

**Step 4: Review visual result**

Verify:

- dog remains recognizably the same dog
- frame remains identical
- background is darker and cleaner
- output no longer looks like a hallucinated mascot
