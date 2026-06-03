# Marketing hero vault (obsidian GLB + R3F island)

Production marketing hero: [`frontend/public/immersive/index.html`](../../frontend/public/immersive/index.html) on `4626.fun/`, `#vault-canvas`.

## What it is

| Layer | Implementation |
|-------|----------------|
| **Mesh** | Blender-exported `ethereum_vault.glb` (obsidian octahedron, purple equator emissive) |
| **Default runtime** | R3F island [`frontend/src/marketing/MarketingVaultHero.tsx`](../../frontend/src/marketing/MarketingVaultHero.tsx) → `public/immersive/vault-hero/vault-hero.js` |
| **FX** | Force-shield GLSL (adapted from [flow-shield-effect](https://github.com/cortiz2894/flow-shield-effect)) + WebGL particle field + bloom |
| **Fallback** | Vanilla [`vault.js`](../../frontend/public/immersive/vault.js) (GLB + legacy iron cube) on bundle error or `?hero=legacy` |
| **Reduced motion** | Static poster `assets/vault/ethereum_vault_poster.png` |
| **Storm sync** | Existing `hero_loop.mp4`, SVG lightning, `window` event `vault:lightning` |

**Not used:** gold kintsugi / marble ChatGPT references in `tools/vault-images/ChatGPT Image*.png` (composition only).

## Offline asset pipeline

See [`tools/vault-images/README.md`](../../tools/vault-images/README.md).

```bash
# Regenerate GLB + preview (Blender 4.x)
pnpm -C frontend build:vault-glb

# Publish into immersive static assets
mkdir -p frontend/public/immersive/assets/vault
cp tools/vault-images/ethereum_vault.glb frontend/public/immersive/assets/vault/
cp tools/vault-images/ethereum_vault_preview.png frontend/public/immersive/assets/vault/ethereum_vault_poster.png
```

## Build R3F island

```bash
pnpm -C frontend build:marketing-vault
```

Outputs `frontend/dist/marketing-vault-hero/vault-hero.js`, copied to `frontend/public/immersive/vault-hero/`. Included in main `pnpm -C frontend build`.

## Local preview

Because `index.html` uses `<base href="/immersive/">`:

```bash
cd frontend/public && python3 -m http.server 8780
# http://localhost:8780/immersive/
```

After changing R3F sources, rebuild the island before refreshing. Without a bundle, the page falls back to `vault.js`.

### Troubleshooting `Failed to fetch dynamically imported module`

1. **Serve from `frontend/public`**, not the repo root: `cd frontend/public && python3 -m http.server 8780` → `http://localhost:8780/immersive/` (any free port is fine; use the same port in the browser).
2. **GLTFLoader utils:** `vault.js` needs `vendor/three/addons/utils/BufferGeometryUtils.js` and `SkeletonUtils.js`. Regenerate with `pnpm -C frontend exec node scripts/sync-immersive-three-vendor.mjs` (also runs before `build:marketing-vault`).
3. **Network tab:** if `vault.js` returns 200 but the error persists, look for a **404 on a sub-import** (utils, `three.module.js`, postprocessing). Browsers often attribute that failure to `vault.js`.
4. **R3F primary path:** `?hero=legacy` forces vanilla `vault.js` only; default loads `/immersive/vault-hero/vault-hero.js` (rebuild after TSX changes).

Marketing Vite dev with immersive landing:

```bash
# frontend/.env
VITE_HOST_MODE_OVERRIDE=marketing
VITE_MARKETING_ORIGIN=http://localhost:5173
pnpm -C frontend dev
# open http://localhost:5173/  (serves immersive/index.html)
```

## Query flags

| URL | Behavior |
|-----|----------|
| `/` (default) | Load `./vault-hero/vault-hero.js` (R3F) |
| `/?hero=legacy` | Load `./vault.js` only |

## Acceptance check

- Hero reads as dark crystal octahedron with purple waist glow (not gold marble)
- Shield + particles visible on desktop; particle count reduced when `navigator.deviceMemory < 4`
- Lightning flashes boost vault emissive + trigger shield hit rings
- `prefers-reduced-motion: reduce` shows poster only (no WebGL loop)
- No new CSP `connect-src` hosts (assets under `/immersive/`)

## Third-party

Shield shaders: [`tools/vault-images/NOTICE.md`](../../tools/vault-images/NOTICE.md).
