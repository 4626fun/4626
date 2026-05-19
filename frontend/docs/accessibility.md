# Frontend accessibility checklist

4626 ships as a **React + Vite** web app (including Base App and Telegram WebViews). Native Android/iOS accessibility samples do not apply to this codebase; use this doc when adding or reviewing UI.

## Quick checks before merge

- [ ] **Real controls** — Use `<button type="button">` or `<a href>`. Avoid `div`/`span` with `onClick` unless you add `role`, keyboard handlers, and focus styling.
- [ ] **Names** — Every input has a visible `<label>` or `sr-only` label. Icon-only buttons have `aria-label` (or visible text).
- [ ] **Images** — Meaningful images get `alt`; decorative images use `alt=""` and/or `aria-hidden="true"`.
- [ ] **Status** — Loading and errors use `role="status"` or `role="alert"` with `aria-live` where content updates without focus moving.
- [ ] **Focus** — `:focus-visible` is visible (do not remove outline without a replacement). Modals trap focus and return focus on close (CDS `Modal` / Radix patterns).
- [ ] **Motion** — Respect `prefers-reduced-motion` for large animations (see `index.css` and vault-flow helpers).
- [ ] **Keyboard** — Tab through the flow once: no traps, no unreachable controls, logical order.

## Automation in this repo

| Command | Purpose |
| -------- | -------- |
| `pnpm -C frontend lint:a11y` | ESLint with `eslint-plugin-jsx-a11y` (**warn** today; promote to error in main `lint` when noise is low) |
| `pnpm -C frontend smoke:a11y -- --serve` | Playwright + axe on `/faq`, `/faq/how-it-works`, `/swap` (fails on **serious/critical** only) |

CI runs both in [`.github/workflows/accessibility.yml`](../../.github/workflows/accessibility.yml) as **non-blocking** until the team flips `A11Y_CI_BLOCKING=true` on the workflow (or removes `continue-on-error`).

**Note:** `eslint-plugin-jsx-a11y` needs `minimatch@3` under the plugin (see `pnpm.overrides` `eslint-plugin-jsx-a11y>minimatch`) because the repo pins `minimatch@10` elsewhere.

### Running smoke against production

```bash
A11Y_BASE_URL=https://4626.fun pnpm -C frontend smoke:a11y -- --paths /faq,/faq/how-it-works
```

Use preview/staging when validating a PR; production is useful for periodic audits only.

## High-risk surfaces

Prioritize manual keyboard + screen reader passes on:

- Waitlist / account setup (`WaitlistFlow`, `AccountSetupWorkspaceView`)
- Swap (`Swap.tsx`, `SwapCard`, token modals)
- Deploy vault wizard (`DeployVault.tsx`)
- Explore 3D gallery and charts (often need text alternatives beyond color)
- Chat rail (`ChatAvailabilityRail`, `ChatWindow`)

## Promoting jsx-a11y from warn → error

1. Drive `pnpm -C frontend lint:a11y` toward zero warnings (fix or narrowly disable with a comment).
2. Move rules from `eslint.a11y.config.js` into `eslint.config.js` as `'error'`.
3. Remove the separate `lint:a11y` script or keep it as an alias.
4. Set `A11Y_CI_BLOCKING=true` in the accessibility workflow.

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/)
- Layout skip link: `frontend/src/components/layout/Layout.tsx`
- Shared modal wrapper: `frontend/src/components/ui/Modal.tsx`
