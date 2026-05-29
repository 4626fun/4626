# Marketing hero vault (legacy iron cube)

Production marketing hero: [`frontend/public/immersive/vault.js`](../../frontend/public/immersive/vault.js) on `4626.fun/`, mounted on `#vault-canvas` in [`index.html`](../../frontend/public/immersive/index.html).

## What it is

- Chamfered PBR iron cube with `assets/vault_{basecolor,normal,roughness,emissive}.jpg`
- Procedural studio environment map, subtle bloom, mouse parallax, scroll bob
- Lightning sync via `window` event `vault:lightning` (fired from the hero storm script in `index.html`)

No GLB modes, scroll-open sequences, or alternate vault art directions are supported in production.

## Local preview

Because `index.html` uses `<base href="/immersive/">`, serve from `frontend/public`:

```bash
cd frontend/public && python3 -m http.server 8780
# http://localhost:8780/immersive/
```

Or Vite marketing shell with `VITE_HOST_MODE_OVERRIDE=marketing` in `frontend/.env`.

## Acceptance check

- Cube reads clearly on black with beveled edges and restrained emissive seams
- Slow rotation + parallax; reduced motion disables spin/bob
- Lightning flashes boost emissive briefly without washing out the iron substrate
