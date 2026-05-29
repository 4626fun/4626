# Obsidian Vault — Blender-to-Web Pipeline

Production marketing hero: [`frontend/public/immersive/vault.js`](../../frontend/public/immersive/vault.js) on `4626.fun/`.

Scroll animation helpers: [`frontend/public/immersive/vaultScrollAnimation.js`](../../frontend/public/immersive/vaultScrollAnimation.js).

## Art direction

Make the object expensive by making **less** of it visible. Black mass, beveled silhouette, smoked depth, rim-line detail only. No bright front lighting, neon, loud bloom, or sci-fi symbols.

The default vault is **Ethereum-inspired** (faceted halves, amber seam, inner core) — not a literal logo extrusion.

## Modes

| Mode | How to enable |
|------|----------------|
| **Legacy iron cube** (default) | default, or `data-vault-src="legacy"` |
| **Dynamic scroll-open GLB** | URL `?vault=dynamic` or `data-vault-src="dynamic"` + optional `data-vault-glb` |
| **Procedural fallback only** | URL `?vault=procedural` or `data-vault-src="procedural"` — cone placeholder, no GLB |

Production GLB (Blender 4.0.2 export, 28 named meshes, embedded obsidian/gold textures):

`frontend/public/immersive/assets/models/ethereum-obsidian-vault.glb`

The packaged `ethereum-obsidian-vault.procedural.glb` remains a lightweight geometry scaffold for scroll wiring tests only.

Dynamic mode loads `ethereum-obsidian-vault.glb` by default and applies the legacy iron PBR maps (`assets/vault_*.jpg`) on top for storm-hero readability.

Override path with `data-vault-glb="assets/models/your-file.glb"`.

If the GLB fails to load, vault.js falls back to a lightweight procedural Ethereum silhouette.

## Scroll-driven open phases

Progress is driven by normal page scroll from the hero through ~35% of the `.reveal` section (`getVaultOpenProgress` in `vaultScrollAnimation.js`). While opening (`progress > 0.04`), `#vault-canvas` gets `is-scroll-pinned` (fixed overlay) so the vault stays visually centered. At rest (`progress === 0`), the canvas stays in the normal hero placement (same slot as legacy).

| Scroll progress | Phase |
|-----------------|-------|
| 0–18% | Sealed artifact — slow rotation, seam barely visible |
| 18–45% | Recognition — camera moves in, rim reveals faceting |
| 45–78% | Opening — top/bottom halves separate, facets drift |
| 78–100% | Revealed core — inner core visible, camera close-up; canvas fades (`is-handoff`) |

With `prefers-reduced-motion: reduce`, progress stays at 0 (sealed beauty shot, no pin churn).

Lightning flashes from the hero storm sync via `vault:lightning` and boost seam/core emissive.

## GLB mesh naming (dynamic mode)

The Blender GLB exposes named parts for animation:

- `top_*`, `bottom_*` — opening halves
- `*_left_*`, `*_right_*` — side facet drift
- `seam_*` — center seam glow/compress
- `inner_core_*` — revealed core
- `*_vein_*` — gold vein emissive ramp

## Generate GLB (Blender)

**Ethereum faceted vault (package script):**

From **repo root**:

```bash
blender --background --python frontend/public/immersive/blender/create_ethereum_obsidian_vault.py -- \
  frontend/public/immersive/assets/models/ethereum-obsidian-vault.glb
```

From **`frontend/public/`** (do not prefix `frontend/public/` again):

```bash
blender --background --python immersive/blender/create_ethereum_obsidian_vault.py -- \
  immersive/assets/models/ethereum-obsidian-vault.glb
```

**Original rounded-cube vault:**

```bash
blender --background --python frontend/public/immersive/blender/create_obsidian_vault.py -- \
  frontend/public/immersive/assets/models/obsidian-vault.glb
```

**Ubuntu apt Blender note:** if export fails with `No module named 'numpy'`, install once (PEP 668 systems need `--break-system-packages`):

```bash
python3.12 -m pip install numpy --break-system-packages
# or: sudo apt install python3-numpy
```

Draco compression is **off** by default (apt builds often lack `libextern_draco.so`). Opt in with `OBSIDIAN_VAULT_GLTF_DRACO=1`.

Reference textures for Blender live at `frontend/public/immersive/assets/textures/vault/`. Art-direction PNGs at `frontend/public/immersive/assets/references/vault/`.

## Optional web optimization

```bash
npx @gltf-transform/cli optimize \
  frontend/public/immersive/assets/models/ethereum-obsidian-vault.glb \
  frontend/public/immersive/assets/models/ethereum-obsidian-vault.optimized.glb \
  --compress meshopt
```

Point `data-vault-glb` at the optimized file if desired.

## Local preview

Because `index.html` uses `<base href="/immersive/">`, serve from `frontend/public` (not from inside `immersive/`):

```bash
cd frontend/public && python3 -m http.server 8780
# http://localhost:8780/immersive/
# Legacy cube: http://localhost:8780/immersive/?vault=legacy
```

Or Vite marketing shell with `VITE_HOST_MODE_OVERRIDE=marketing` in `frontend/.env`.

## React Three Fiber mirror

For SPA routes (not the static immersive page), use:

- [`frontend/src/components/marketing/VaultHero.tsx`](../../frontend/src/components/marketing/VaultHero.tsx)
- Shared tokens: [`frontend/src/lib/vault/obsidianVaultTokens.ts`](../../frontend/src/lib/vault/obsidianVaultTokens.ts)

The immersive marketing home uses vanilla Three.js only; R3F `VaultHero.tsx` is unchanged in the dynamic-vault pass.

## Acceptance check

- Nearly disappears on black but bevels/facets still read
- Front face not brightly lit
- Scroll opens halves smoothly — ceremonial, not mechanical
- Glow discovered in seams/core at glancing angles and late scroll
- Silhouette feels heavy, precise, expensive
- `?vault=legacy` restores iron PBR cube
- Reduced motion: sealed static shot
