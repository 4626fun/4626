# CRE Template Mapping (Locked Adaptation Boundaries)

This file defines the allowed source templates and adaptation boundaries for the runtime orchestration layer.

## Workflow -> template source

## Runtime constraints (TypeScript in CRE)

- TS workflows run in QuickJS compiled to WASM.
- Do not use Node built-ins in CRE runtime code paths (`node:crypto`, `node:http`, `stream`, AWS SDK).
- Use pure JS signing/hashing patterns (`@noble/hashes`) for SigV4.
- Use fixed execution order and explicit aggregation calls.

## App bridge pattern source

This runtime-template mapping section is retired as part of CRE runtime lane sunset.
Keeper workflow adaptation continues to follow:

- `frontend/api/_handlers/keeper/*.ts`
- `frontend/api/_handlers/_routes.ts`
