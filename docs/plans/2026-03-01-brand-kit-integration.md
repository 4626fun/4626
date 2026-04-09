# 4626 Brand Kit Integration Implementation Plan

> **Execution note:** Follow this plan task-by-task.

**Goal:** Move the Brand Kit source of truth into this monorepo and make the current app consume shared brand tokens/primitives without breaking routes or behavior.

**Architecture:** Create a frontend-local workspace package at `frontend/packages/brand-kit` and keep `frontend/src/components/ui/*` as compatibility wrappers. Migrate tokens/CSS and `Button`/`Card` first, then adopt remaining primitives incrementally. Preserve existing class contracts (`brand.*`, `vault.*`) during migration.

**Tech Stack:** Vite 7, React 19, TypeScript, Tailwind 4, Vitest (node), pnpm.

---

### Task 1: Frontend Workspace Scaffolding

**Files:**
- Create: `frontend/pnpm-workspace.yaml`
- Create: `frontend/packages/brand-kit/package.json`
- Create: `frontend/packages/brand-kit/tsconfig.json`
- Create: `frontend/packages/brand-kit/src/index.ts`
- Modify: `frontend/package.json`
- Test: `frontend/src/brand-kit/brandKitWorkspace.test.ts`

**Step 1: Write the failing test**

```ts
// frontend/src/brand-kit/brandKitWorkspace.test.ts
import { describe, expect, it } from 'vitest'
import { BRAND_KIT_VERSION } from '@4626/brand-kit'

describe('brand kit workspace package', () => {
  it('resolves local package exports', () => {
    expect(BRAND_KIT_VERSION).toBeTypeOf('string')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend test -- src/brand-kit/brandKitWorkspace.test.ts`
Expected: FAIL with module resolution error for `@4626/brand-kit`.

**Step 3: Write minimal implementation**

- Add frontend workspace file:
  - `frontend/pnpm-workspace.yaml`
  - packages:
    - `.`
    - `packages/*`
- Add `frontend/packages/brand-kit/package.json` with:
  - `name: "@4626/brand-kit"`
  - `type: "module"`
  - `exports` for `"."`
- Add `BRAND_KIT_VERSION` export in `frontend/packages/brand-kit/src/index.ts`.
- Add dependency in `frontend/package.json`:
  - `"@4626/brand-kit": "workspace:*"`

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend install && pnpm -C frontend test -- src/brand-kit/brandKitWorkspace.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/pnpm-workspace.yaml frontend/packages/brand-kit frontend/package.json frontend/src/brand-kit/brandKitWorkspace.test.ts
git commit -m "chore(brand-kit): scaffold frontend local workspace package"
```

---

### Task 2: Token Contract + Tailwind Preset

**Files:**
- Create: `frontend/packages/brand-kit/src/tokens/colors.ts`
- Create: `frontend/packages/brand-kit/src/tokens/typography.ts`
- Create: `frontend/packages/brand-kit/src/tokens/index.ts`
- Create: `frontend/packages/brand-kit/tailwind.preset.js`
- Modify: `frontend/packages/brand-kit/src/index.ts`
- Modify: `frontend/tailwind.config.js`
- Test: `frontend/src/brand-kit/tokenContract.test.ts`

**Step 1: Write the failing test**

```ts
// frontend/src/brand-kit/tokenContract.test.ts
import { describe, expect, it } from 'vitest'
import { brandTokens } from '@4626/brand-kit/tokens'

describe('brand token contract', () => {
  it('uses canonical electric-blue palette', () => {
    expect(brandTokens.primary).toBe('#0052FF')
    expect(brandTokens.hover).toBe('#004AD9')
    expect(brandTokens.accent).toBe('#3B82F6')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend test -- src/brand-kit/tokenContract.test.ts`
Expected: FAIL because `@4626/brand-kit/tokens` export does not exist yet.

**Step 3: Write minimal implementation**

- Add token files with canonical values:
  - `primary=#0052FF`, `hover=#004AD9`, `accent=#3B82F6`
  - vault dark surface values (`#020202`, `#0A0A0A`, `#1F1F1F`, `#EDEDED`, `#666666`)
- Export tokens through `@4626/brand-kit/tokens`.
- Add `tailwind.preset.js` in package and import it in `frontend/tailwind.config.js` via `presets`.
- Keep existing color aliases backward-compatible (`brand.primary`, `brand.hover`, `brand.accent`, `vault.*`).

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend test -- src/brand-kit/tokenContract.test.ts && pnpm -C frontend typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/packages/brand-kit/src/tokens frontend/packages/brand-kit/tailwind.preset.js frontend/packages/brand-kit/src/index.ts frontend/tailwind.config.js frontend/src/brand-kit/tokenContract.test.ts
git commit -m "feat(brand-kit): add token contract and tailwind preset"
```

---

### Task 3: Shared Brand CSS Contract

**Files:**
- Create: `frontend/packages/brand-kit/src/styles/brand.css`
- Modify: `frontend/packages/brand-kit/src/index.ts`
- Modify: `frontend/src/main.tsx`
- Test: `frontend/src/brand-kit/brandCssContract.test.ts`

**Step 1: Write the failing test**

```ts
// frontend/src/brand-kit/brandCssContract.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('brand css contract', () => {
  it('defines stable semantic CSS variables', () => {
    const css = readFileSync(resolve(process.cwd(), 'packages/brand-kit/src/styles/brand.css'), 'utf8')
    expect(css).toContain('--brand-primary')
    expect(css).toContain('--vault-bg')
    expect(css).toContain('.glass-card')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend test -- src/brand-kit/brandCssContract.test.ts`
Expected: FAIL because file does not exist.

**Step 3: Write minimal implementation**

- Add `brand.css` with:
  - semantic variables
  - shared utility classes (`glass-card`, `card`, button base contract)
  - reduced-motion guard
- Import package CSS once in `frontend/src/main.tsx` before app-specific CSS.
- Re-export styles entry from package index for explicit import path.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend test -- src/brand-kit/brandCssContract.test.ts && pnpm -C frontend lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/packages/brand-kit/src/styles/brand.css frontend/packages/brand-kit/src/index.ts frontend/src/main.tsx frontend/src/brand-kit/brandCssContract.test.ts
git commit -m "feat(brand-kit): add shared css contract and app bootstrap import"
```

---

### Task 4: Migrate Button and Card to Brand-Kit Package

**Files:**
- Create: `frontend/packages/brand-kit/src/components/Button.tsx`
- Create: `frontend/packages/brand-kit/src/components/Card.tsx`
- Create: `frontend/packages/brand-kit/src/components/index.ts`
- Modify: `frontend/packages/brand-kit/src/index.ts`
- Modify: `frontend/src/components/ui/Button.tsx`
- Modify: `frontend/src/components/ui/Card.tsx`
- Test: `frontend/src/components/ui/buttonCardBridge.test.ts`

**Step 1: Write the failing test**

```ts
// frontend/src/components/ui/buttonCardBridge.test.ts
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

describe('ui bridge to brand kit primitives', () => {
  it('renders button/card with expected base classes', () => {
    const buttonHtml = renderToStaticMarkup(Button({ children: 'Go' } as any))
    const cardHtml = renderToStaticMarkup(Card({ children: 'X' } as any))
    expect(buttonHtml).toContain('focus-visible:ring-brand-primary')
    expect(cardHtml).toContain('glass-card')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend test -- src/components/ui/buttonCardBridge.test.ts`
Expected: FAIL before bridge/re-export implementation is complete.

**Step 3: Write minimal implementation**

- Move current `Button` and `Card` implementations into package components.
- Re-export package versions from `frontend/src/components/ui/Button.tsx` and `Card.tsx`.
- Keep public prop types unchanged to avoid route-level refactors.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend test -- src/components/ui/buttonCardBridge.test.ts && pnpm -C frontend typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/packages/brand-kit/src/components frontend/packages/brand-kit/src/index.ts frontend/src/components/ui/Button.tsx frontend/src/components/ui/Card.tsx frontend/src/components/ui/buttonCardBridge.test.ts
git commit -m "refactor(ui): bridge Button and Card through @4626/brand-kit"
```

---

### Task 5: Compatibility Sweep + Targeted Route Verification

**Files:**
- Modify: `frontend/src/components/ui/index.ts`
- Modify: `frontend/src/pages/Swap.tsx` (if import adjustments needed)
- Modify: `frontend/src/pages/Vault.tsx` (if import adjustments needed)
- Modify: `frontend/src/pages/Portfolio.tsx` (if import adjustments needed)
- Modify: `frontend/src/pages/DeployVault.tsx` (if import adjustments needed)
- Test: existing frontend test files

**Step 1: Write failing verification check**

- Run a targeted route smoke test list (manual) and capture any regression:
  - `/swap`
  - `/vault/:address`
  - `/portfolio`
  - `/deploy`

**Step 2: Run automated checks to identify failures**

Run:
- `pnpm -C frontend typecheck`
- `pnpm -C frontend lint`
- `pnpm -C frontend test -- src/brand-kit/tokenContract.test.ts src/brand-kit/brandCssContract.test.ts src/components/ui/buttonCardBridge.test.ts`

Expected: any import/typing regressions surfaced.

**Step 3: Write minimal fixes**

- Update `frontend/src/components/ui/index.ts` exports if needed.
- Fix any import path drift or prop type mismatches.
- Avoid broad style rewrites; preserve existing route behavior.

**Step 4: Re-run full verification**

Run:
- `pnpm -C frontend typecheck`
- `pnpm -C frontend lint`
- `pnpm -C frontend test`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/components/ui/index.ts frontend/src/pages/Swap.tsx frontend/src/pages/Vault.tsx frontend/src/pages/Portfolio.tsx frontend/src/pages/DeployVault.tsx
git commit -m "chore(brand-kit): finalize compatibility sweep and verification"
```

---

### Task 6: Documentation and Ownership

**Files:**
- Create: `frontend/packages/brand-kit/README.md`
- Modify: `docs/plans/2026-03-01-brand-kit-integration-design.md`
- Modify: `frontend/README.md` (if brand-kit section exists/add one)

**Step 1: Write failing doc checklist**

- Missing documentation to onboard contributors:
  - package usage
  - token contract
  - migration policy
  - naming policy (`Creator-Vaults-Brand-Kit` to `4626 Brand Kit` note)

**Step 2: Verify documentation gap**

Run: `rg "brand-kit|@4626/brand-kit|tokens" frontend/README.md frontend/packages/brand-kit/README.md docs/plans/2026-03-01-brand-kit-integration-design.md`
Expected: missing package docs before changes.

**Step 3: Write minimal docs**

- Add package README with:
  - install/use in frontend
  - exports
  - token conventions
  - how to migrate a component
- Update design doc with implementation status checklist.

**Step 4: Verify docs**

Run: `rg "workspace|@4626/brand-kit|brand tokens|migration" frontend/packages/brand-kit/README.md docs/plans/2026-03-01-brand-kit-integration-design.md`
Expected: matches found for each section.

**Step 5: Commit**

```bash
git add frontend/packages/brand-kit/README.md docs/plans/2026-03-01-brand-kit-integration-design.md frontend/README.md
git commit -m "docs(brand-kit): add package ownership and migration guidance"
```

---

## Final Verification Gate

Run in order:

1. `pnpm -C frontend install`
2. `pnpm -C frontend typecheck`
3. `pnpm -C frontend lint`
4. `pnpm -C frontend test`
5. Manual UI sweep on `/swap`, `/vault/:address`, `/portfolio`, `/deploy`.

Only after all pass, open PR.
