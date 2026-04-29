// Minimal ambient typings for `snarkjs` (≥0.7.x).
//
// snarkjs ships without TypeScript declarations and there is no @types
// package on DefinitelyTyped, so we declare only the surface we actually
// call. Keep this in sync with `SnarkjsLike` in `proveAmoeEntryPlonk.ts` —
// any drift between the two will surface here as a typecheck error.
//
// Why colocated and not in a global d.ts: snarkjs is only used from this
// directory (server-side PLONK proving). Putting the shim here keeps the
// declaration scoped and avoids polluting the project-wide type space.
declare module 'snarkjs' {
  export const plonk: {
    fullProve: (
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ) => Promise<{ proof: unknown; publicSignals: unknown }>
    exportSolidityCallData: (
      proof: unknown,
      publicSignals: unknown,
    ) => Promise<string>
    prove: (...args: unknown[]) => Promise<unknown>
    verify: (...args: unknown[]) => Promise<boolean>
    setup: (...args: unknown[]) => Promise<unknown>
  }
  export const groth16: {
    fullProve: (...args: unknown[]) => Promise<unknown>
    prove: (...args: unknown[]) => Promise<unknown>
    verify: (...args: unknown[]) => Promise<boolean>
    exportSolidityCallData: (...args: unknown[]) => Promise<string>
  }
}
