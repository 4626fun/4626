# 4626.fun — 3D Vault Asset Pack

Extracted from the marketing home hero on `4626.fun` (`frontend/public/immersive/`).

## Quick start

Serve the folder over HTTP (ES modules + textures need a server):

```bash
cd hero-vault
python3 -m http.server 8765
# open http://localhost:8765/demo.html
```

Or open the live page: https://4626.fun/

## What's inside

| Path | Purpose |
| --- | --- |
| `hero-vault/vault.js` | Main Three.js scene: chamfered cube, PBR, bloom, parallax, lightning sync |
| `hero-vault/assets/vault_*.jpg` | PBR texture set (base color, normal, roughness, emissive) |
| `hero-vault/vendor/three/` | Vendored Three.js r0.183 + postprocessing addons used by `vault.js` |
| `hero-vault/demo.html` + `demo.css` | Minimal standalone preview |
| `hero-scene/assets/` | Storm backdrop layers (video, clouds, fog, lightning art) |
| `optional-vaults-cloth/vaults-cloth.js` | Alternate cloth-physics vault badge slider (not mounted on current home HTML) |
| `docs/lightning-integration.inline.js` | Homepage inline script that fires `vault:lightning` events |

## Hero vault ingredients (technical)

### Geometry
- **Procedural chamfered cube** — `makeChamferedCube(size=1.7, bevel=0.07, segs=6)` in `vault.js` (no external `.glb`)

### Materials
- `MeshPhysicalMaterial` with:
  - `vault_basecolor.jpg` (sRGB)
  - `vault_normal.jpg` (normalScale 2.2)
  - `vault_roughness.jpg` (also drives metalness)
  - `vault_emissive.jpg` (breathing + lightning-reactive glow)
  - clearcoat 0.85, metalness 0.92

### Lighting & environment
- Procedural **studio HDRI** via canvas → `PMREMGenerator` (`makeStudioEnv`)
- Key / rim / fill directional lights + low ambient

### Post-processing
- `EffectComposer` → `RenderPass` → `UnrealBloomPass` (subtle) → `OutputPass`

### Motion & interaction
- Slow Y rotation, mouse parallax, scroll bob, emissive breathing
- Listens for `window` event `vault:lightning` `{ detail: { intensity } }`

### DOM hook
- Mount target: `#vault-canvas` (production class: `.hero__cube`)

### Production wiring (4626.fun)
- Route: `/` → `frontend/public/immersive/index.html` via `frontend/vercel.json`
- Script: `<script type="module" src="./vault.js"></script>`
- Import map maps `three` → `./vendor/three/build/three.module.js`

## Source paths in repo

```
frontend/public/immersive/vault.js
frontend/public/immersive/assets/vault_{basecolor,normal,roughness,emissive}.jpg
frontend/public/immersive/vendor/three/
frontend/public/immersive/index.html  (#vault-canvas, lightning script)
frontend/public/immersive/styles.css  (.hero__cube*, storm parallax)
```

## License

Same as parent 4626 repository (MIT). Three.js is MIT.
