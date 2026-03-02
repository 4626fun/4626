# @4626/brand-kit

Shared UI foundation for the 4626 frontend.

## Ownership

- Source of truth for design tokens and primitives lives in `frontend/packages/brand-kit`.
- App-level wrapper components in `frontend/src/components/ui` should re-export package primitives instead of redefining styles.

## Exports

- `@4626/brand-kit` - root package entry
- `@4626/brand-kit/tokens` - brand and typography token contract
- `@4626/brand-kit/tailwind-preset` - shared Tailwind preset
- `@4626/brand-kit/styles` - CSS variable and utility contract
- `@4626/brand-kit/components` - shared `Button` and `Card` primitives

## Usage

```ts
import { brandTokens } from '@4626/brand-kit/tokens'
import { Button, Card } from '@4626/brand-kit/components'
import brandKitPreset from '@4626/brand-kit/tailwind-preset'
import '@4626/brand-kit/styles'
```

## Contribution Rules

- Add or update visual primitives in this package first.
- Keep app wrappers as lightweight compatibility bridges.
