# Generated GLB placement

## Dynamic hero (opt-in — `?vault=dynamic`)

`ethereum-obsidian-vault.glb` — Blender-authored scroll-opening vault (28 mesh parts, embedded textures). Regenerate with:

From repo root:

```bash
blender --background --python frontend/public/immersive/blender/create_ethereum_obsidian_vault.py -- \
  frontend/public/immersive/assets/models/ethereum-obsidian-vault.glb
```

From `frontend/public/`:

```bash
blender --background --python immersive/blender/create_ethereum_obsidian_vault.py -- \
  immersive/assets/models/ethereum-obsidian-vault.glb
```

Used by `vault.js` when `data-vault-src="dynamic"`.

`ethereum-obsidian-vault.procedural.glb` — lightweight geometry scaffold from the original package (fallback reference only).

Regenerate via (from repo root):

```bash
blender --background --python frontend/public/immersive/blender/create_ethereum_obsidian_vault.py -- \
  frontend/public/immersive/assets/models/ethereum-obsidian-vault.procedural.glb
```

## Legacy rounded-cube GLB

`obsidian-vault.glb` — optional asset from the original Blender script. Not used by default dynamic mode.

```bash
blender --background --python frontend/public/immersive/blender/create_obsidian_vault.py -- \
  frontend/public/immersive/assets/models/obsidian-vault.glb
```

If the dynamic GLB fails to load, vault.js uses an inline procedural fallback (no file required).

Enable legacy iron cube on the landing page:

```
?vault=legacy
```

Or:

```html
<div id="vault-canvas" data-vault-src="legacy" ...></div>
```
