declare module "@chainlink/cre-sdk" {
  export type ResultWrapper<T> = {
    result(): T
  }

  export interface Runtime<Config = unknown> {
    config: Config
    now(): Date
    log(message: string): void
    getSecret(params: { id: string }): ResultWrapper<{ value: string }>
    runInNodeMode<T>(
      fn: (runtime: NodeRuntime<Config>) => T,
      aggregation?: unknown,
    ): () => ResultWrapper<T>
  }

  export interface NodeRuntime<Config = unknown> extends Runtime<Config> {}

  export class HTTPClient {
    sendRequest<Config = unknown>(
      runtime: NodeRuntime<Config>,
      request: {
        url: string
        method: string
        headers?: Record<string, string>
        body?: string
      },
    ): ResultWrapper<{ statusCode: number; body: Uint8Array }>
  }

  export class EVMClient {
    static SUPPORTED_CHAIN_SELECTORS: Record<string, string | number | bigint>
    constructor(selector: string | number | bigint)
    callContract<Config = unknown>(
      runtime: Runtime<Config>,
      params: { call: unknown; blockNumber?: unknown },
    ): ResultWrapper<{ data: Uint8Array }>
  }

  export const LAST_FINALIZED_BLOCK_NUMBER: unknown

  export function encodeCallMsg(params: {
    from: `0x${string}`
    to: `0x${string}`
    data: `0x${string}`
  }): unknown

  export function bytesToHex(value: Uint8Array): `0x${string}`
  export function consensusIdenticalAggregation(): unknown
}
