export {}

// Type-only overrides for API-side compilation.
// These loosen strict signature requirements for runtime-safe code paths.

declare module 'viem/accounts' {
  export function toAccount(params: any): any
}

declare module 'viem/account-abstraction' {
  export function toCoinbaseSmartAccount(params: any): Promise<any>
}

declare module '@vercel/blob' {
  export function put(pathname: string, body: Uint8Array, options?: any): Promise<any>
}
