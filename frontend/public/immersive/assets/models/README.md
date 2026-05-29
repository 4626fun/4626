# Generated GLB placement

Place `obsidian-vault.glb` here after running the Blender script. The hero works without this file — it uses a procedural fallback by default.

Generate:

```bash
blender --background --python frontend/public/immersive/blender/create_obsidian_vault.py -- \
  frontend/public/immersive/assets/models/obsidian-vault.glb
```

Enable GLB mode on the landing page:

```html
<div id="vault-canvas" data-vault-src="glb" ...></div>
```
