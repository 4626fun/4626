# Obsidian Vault — Blender-to-Web Pipeline

Production marketing hero: [`frontend/public/immersive/vault.js`](../../frontend/public/immersive/vault.js) on `4626.fun/`.

## Art direction

Make the object expensive by making **less** of it visible. Black mass, beveled silhouette, smoked depth, rim-line detail only. No bright front lighting, neon, loud bloom, or sci-fi symbols.

## Modes

| Mode | How to enable |
|------|----------------|
| **Procedural** (default) | `#vault-canvas` with `data-vault-src="procedural"` or omit attribute |
| **GLB** | `data-vault-src="glb"` + file at `assets/models/obsidian-vault.glb` |
| **Legacy** (QA fallback) | URL `?vault=legacy` or `data-vault-src="legacy"` |

## Generate GLB

```bash
blender --background --python frontend/public/immersive/blender/create_obsidian_vault.py -- \
  frontend/public/immersive/assets/models/obsidian-vault.glb
```

**Ubuntu apt Blender note:** if export fails with `No module named 'numpy'`, install once (PEP 668 systems need `--break-system-packages`):

```bash
python3.12 -m pip install numpy --break-system-packages
# or: sudo apt install python3-numpy
```

The script also attempts auto-install. Draco compression is **off** by default (apt builds often lack `libextern_draco.so`). Opt in with `OBSIDIAN_VAULT_GLTF_DRACO=1`.

Inspect in Blender under **black studio** lighting — not bright viewport defaults.

### Model structure (material slots)

1. `obsidian_vault_core` — rounded cube, near-black metal/clearcoat
2. `smoked_glass_outer_shell` — slightly larger shell, low-alpha transmission
3. `vault_*_seam_*` — inset panel bars, black chrome
4. `hidden_4626_mark` — barely visible front engraving

## Optional web optimization

```bash
npx @gltf-transform/cli optimize \
  frontend/public/immersive/assets/models/obsidian-vault.glb \
  frontend/public/immersive/assets/models/obsidian-vault.optimized.glb \
  --compress meshopt
```

Point `data-vault-glb` at the optimized file if desired.

## Local preview

```bash
cd frontend/public/immersive && python3 -m http.server 8780
# http://localhost:8780/
```

Or Vite marketing shell with `VITE_HOST_MODE_OVERRIDE=marketing` in `frontend/.env`.

## React Three Fiber mirror

For SPA routes (not the static immersive page), use:

- [`frontend/src/components/marketing/VaultHero.tsx`](../../frontend/src/components/marketing/VaultHero.tsx)
- Shared tokens: [`frontend/src/lib/vault/obsidianVaultTokens.ts`](../../frontend/src/lib/vault/obsidianVaultTokens.ts)

```tsx
import { VaultHero } from '@/components/marketing/VaultHero'

<VaultHero mode="procedural" />
// or
<VaultHero mode="glb" modelUrl="/immersive/assets/models/obsidian-vault.glb" />
```

## Acceptance check

- Nearly disappears on black but bevels still read
- Front face not brightly lit
- Shell gives depth without ghost appearance
- Glow discovered only in seams at glancing angles
- Silhouette feels heavy, precise, expensive
