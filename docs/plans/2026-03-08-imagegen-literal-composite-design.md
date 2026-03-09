# Literal Subject Composite Design

**Date:** 2026-03-08

**Goal:** Replace the current AI-redraw path with a deterministic pipeline that uses the real uploaded subject image as the source of truth inside the locked frame.

## Problem

The current image generation flow is structurally better than the original frame-redraw approach, but it still asks a model to invent subject pixels. That produces results that can drift far away from the uploaded dog image and makes the final output feel random instead of faithful.

For the user's target, fidelity matters more than stylistic reinterpretation. The dog should look like the uploaded dog, not like a mascot loosely inspired by it.

## Decision

Switch the default imagegen path for uploaded frame + subject assets to a deterministic literal composite pipeline:

- The **uploaded frame** remains the exact rendered frame.
- The **uploaded subject image** becomes the exact source of truth for the dog.
- **Foreground extraction** runs on the real subject image, not on model output.
- **Breakout** is optional and can only come from the real extracted subject cutout.
- **Background cleanup and polish** are deterministic, lightweight, and code-driven.

The OpenAI path should no longer be the default for this flow. If it remains in the repo, it should be treated as a separate stylized mode, not the primary runtime path for literal subject compositing.

## Desired Visual Result

Every output should preserve the user's actual subject while still feeling premium:

- identical frame asset every time
- dark outer canvas
- dark, simplified inner background
- real uploaded dog image centered in the frame
- optional breakout only when the real silhouette is clean enough
- subtle deterministic glow
- no hallucinated reinterpretation of the dog's face or body

## Rendering Model

The final image should be built deterministically in layers:

1. Outer dark canvas
2. Darkened / simplified inner background
3. Real placed subject image inside the fixed content window
4. Locked frame asset composited unchanged
5. Optional breakout foreground cutout above the frame
6. Deterministic glow

The composition must look acceptable even when breakout is disabled.

## Subject Source Of Truth

The uploaded subject image should drive the result directly.

That means:

- no AI regeneration of the dog
- no AI reinterpretation of facial structure
- no model-dependent styling of fur, pose, or expression
- no dependency on model luck for fidelity

Any cleanup should be limited to deterministic operations such as:

- resize and fit
- background darkening
- contrast tuning
- slight feathering or alpha refinement
- subtle shadowing if needed

## Smart Breakout Policy

Breakout remains optional and should use the real subject cutout only.

Allowed:

- coherent real silhouette
- meaningful alpha coverage
- strong top-region subject shape

Fallback:

- if foreground extraction fails, render fully in-frame
- if the cutout is weak, render fully in-frame
- do not fail the whole job only because breakout is not possible

## Runtime Flow

The runtime path should change from:

- `subject -> OpenAI generation -> foreground extraction -> compositor`

to:

- `subject -> foreground extraction + deterministic placement -> compositor`

The frame still comes from the uploaded frame asset and is composited later exactly as-is.

## Evaluation Changes

Once the subject and frame are deterministic, most model-behavior evaluation becomes unnecessary for the default path.

Evaluation for literal composite mode should focus on:

- whether subject extraction succeeded
- whether breakout was applied
- whether fallback rendered safely
- whether the final asset was stored correctly

It does not need to score whether a model preserved the subject or frame, because those are controlled by construction.

## Failure Modes

Expected handling:

- If subject extraction succeeds and breakout is valid, render breakout.
- If subject extraction succeeds but breakout is invalid, render fully in-frame.
- If subject extraction fails but the raw subject image is still usable, render the non-breakout composition.
- If the subject image itself is unusable, fail the job.

## Files Likely To Change

- `frontend/server/_lib/imageGenerationRunner.ts`
- `frontend/server/_lib/imageCompositor.ts`
- `frontend/server/_lib/imageForegroundExtraction.ts`
- new deterministic subject placement helper under `frontend/server/_lib/`
- image generation tests covering literal subject compositing and fallback behavior

## Recommendation

Make deterministic literal subject compositing the default path for uploaded frame + subject image generation. This best matches the user's target, preserves the real subject, and removes the current failure mode where the model invents a bad dog instead of placing the actual one.
