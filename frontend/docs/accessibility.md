# Frontend accessibility checklist

4626 ships as a **React + Vite** web app (including Base App and Telegram WebViews). Native Android/iOS accessibility samples do not apply to this codebase; use this doc when adding or reviewing UI.

## Quick checks before merge

- [ ] **Real controls** — Use `<button type="button">` or `<a href>`. Avoid `div`/`span` with `onClick` unless you add `role`, keyboard handlers, and focus styling.
- [ ] **Names** — Every input has a visible `<label>` or `sr-only` label. Icon-only buttons have `aria-label` (or visible text).
- [ ] **Images** — Meaningful images get `alt`; decorative images use `alt=""` and/or `aria-hidden="true"`.
- [ ] **Status** — Loading and errors use `role="status"` or `role="alert"` with `aria-live` where content updates without focus moving.
- [ ] **Focus** — `:focus-visible` is visible (do not remove outline without a replacement). Modals trap focus and return focus on close (`@/components/ui/Modal` / Radix dialog patterns).
- [ ] **Motion** — Respect `prefers-reduced-motion` for large animations (see `index.css` and vault-flow helpers).
- [ ] **Keyboard** — Tab through the flow once: no traps, no unreachable controls, logical order.
- [ ] **Marketing contrast** — On dark `glass-card` / charcoal backgrounds (`4626.fun`), prefer `text-zinc-400` for `text-sm` and smaller secondary copy; `text-zinc-500` / `text-zinc-600` often fail axe `color-contrast`. Static immersive landing copy uses `--ink-3` in `public/immersive/styles.css` — keep tertiary text at or above that contrast level.
- [ ] **Marketing host + wagmi** — `4626.fun` routes in `MARKETING_ONLY_ROUTES` have **no** `WagmiProvider`. Do not mount `TokenImage` / `useReadContract` on those pages; use static assets or server-fetched metadata instead.

## Automation in this repo

| Command | Purpose |
| -------- | -------- |
| `pnpm -C frontend lint:a11y` | Alias of main `lint` — jsx-a11y rules at **error** in `eslint.config.js` |
| `pnpm -C frontend smoke:a11y -- --serve` | Playwright + axe on `/faq`, `/faq/how-it-works`, `/waitlist`, `/swap` (fails on **serious/critical** only). With `--serve`, restarts Vite per host shell (`marketing` vs `app`). |

CI runs both in [`.github/workflows/accessibility.yml`](../../.github/workflows/accessibility.yml). Set repository variable **`A11Y_CI_BLOCKING=true`** so the job fails PRs on regressions (default is non-blocking when the variable is unset).

**Note:** `eslint-plugin-jsx-a11y` needs `minimatch@3` under the plugin (see `pnpm.overrides` `eslint-plugin-jsx-a11y>minimatch`) because the repo pins `minimatch@10` elsewhere.

### Running smoke against production

```bash
A11Y_BASE_URL=https://4626.fun pnpm -C frontend smoke:a11y -- --paths /faq,/faq/how-it-works,/waitlist
A11Y_BASE_URL=https://app.4626.fun pnpm -C frontend smoke:a11y -- --paths /swap
```

Use preview/staging when validating a PR; production is useful for periodic audits only.

### Local serve (matches CI)

```bash
pnpm -C frontend smoke:a11y -- --serve
```

Paths are grouped automatically: FAQ/waitlist run under `VITE_HOST_MODE_OVERRIDE=marketing`; `/swap` runs under `app`.

## High-risk surfaces

Prioritize manual keyboard + screen reader passes on:

- Waitlist / account setup (`WaitlistFlow`, `AccountSetupWorkspaceView`)
- Swap (`Swap.tsx`, `SwapCard`, token modals)
- Deploy vault wizard (`DeployVault.tsx`)
- Explore 3D gallery and charts (often need text alternatives beyond color)
- Chat rail (`ChatAvailabilityRail`, `ChatWindow`)

## jsx-a11y in main lint

jsx-a11y **recommended** rules run at **error** severity in `eslint.config.js`. `pnpm -C frontend lint:a11y` is an alias of `pnpm lint`.

To fail CI on accessibility regressions, set repository variable **`A11Y_CI_BLOCKING=true`** in GitHub (Settings → Secrets and variables → Actions → Variables).

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/)
- Layout skip link: `frontend/src/components/layout/Layout.tsx`
- Shared modal wrapper: `frontend/src/components/ui/Modal.tsx`
- Explore charts: `frontend/src/components/explore/MetricChartPlot.tsx` (unit smoke in `MetricChartPlot.test.tsx`)
