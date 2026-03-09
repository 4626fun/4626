# Locked Frame + Smart Breakout Design

**Date:** 2026-03-08

**Goal:** Make the frame identical across all generated token images while preserving premium subject treatment for arbitrary Zora token artwork.

## Problem

The current image generation flow passes the frame as a reference image and asks the model to preserve it. That improves direction, but it does not guarantee consistency. The model can still redraw the frame differently across generations, which breaks brand consistency.

The subject input is also unconstrained. A Zora token image can be a portrait, mascot, logo, abstract mark, or busy collage. That means any composition trick that assumes a clean foreground subject must fail safely.

## Decision

Use a hybrid pipeline:

- The **frame, glow, and outer background** are deterministic and code-driven.
- The **model generates only the inner artwork treatment**.
- **Breakout is optional** and only enabled when a foreground extraction step indicates a real subject with a usable silhouette.

This makes the frame the stable brand anchor and treats breakout as a quality enhancement, not a requirement.

## Desired Visual Result

Every output should share the same structural traits:

- identical frame asset
- identical frame geometry
- identical border thickness
- identical outer glow treatment
- dark outer canvas
- centered inner composition
- premium, minimal, token-style feel

Subject-specific variation should come from the generated inner artwork, not the frame.

## Rendering Model

The final image should be built in layers:

1. Outer dark canvas
2. Inner generated artwork, fitted to a fixed content window
3. Locked frame asset, composited unchanged
4. Optional breakout foreground silhouette above the frame
5. Deterministic glow based on the same frame mask every time

The base composition must already look correct without breakout.

## Smart Breakout Policy

Breakout is allowed only when confidence is high.

Safe breakout indicators:

- extracted foreground has meaningful alpha coverage
- the top region contains a coherent silhouette
- the mask is not fragmented or noisy
- the source does not look like a flat logo or abstract mark

If those checks fail, fallback is simple:

- keep the subject fully inside the frame
- skip breakout entirely

This keeps arbitrary token images from producing awkward cutouts or messy edges.

## Model Responsibilities

The model should be responsible for:

- stylizing or improving the subject treatment
- producing a dark, clean inner background
- centering the subject within the intended content area
- maintaining a premium visual tone

The model should not be trusted with:

- final frame rendering
- final glow rendering
- consistent border geometry
- deterministic output structure

## Evaluation Changes

Once the frame is deterministic, evaluation no longer needs to score frame preservation as a model behavior.

Evaluation should focus on:

- subject fit within the inner window
- subject prominence
- background darkness and cleanliness
- premium visual quality
- breakout naturalness when breakout is enabled

The frame can be treated as structurally correct by construction.

## Failure Modes

Expected failure handling:

- If generation succeeds but breakout confidence is low, export the non-breakout composition.
- If generation is weak but valid, retries should target subject treatment and cleanliness, not frame preservation.
- If generation fails entirely, preserve the existing failed job behavior.

## Files Likely To Change

- `frontend/server/_lib/openaiImage.ts`
- `frontend/server/_lib/imageGenerationRunner.ts`
- `frontend/server/_lib/imageProjects.ts` or adjacent storage/project helpers only if an extra intermediate asset is needed
- new server-side compositor helper, likely under `frontend/server/_lib/`
- image generation tests covering composition and fallback behavior

## Recommendation

Implement the locked frame as the default final renderer and treat smart breakout as a post-processing enhancement. This is the best balance of consistency, quality, and resilience for arbitrary token images.
