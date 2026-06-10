export type ResultWrapper<T> = {
  result(): T
}

function wrapResult<T>(value: T): ResultWrapper<T> {
  return {
    result: () => value,
  }
}

export interface Runtime<Config = unknown> {
  config: Config
  now(): Date
  log(message: string): void
  report(params: {
    encodedPayload: string
    encoderName: string
    signingAlgo: string
    hashingAlgo: string
  }): ResultWrapper<unknown>
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
      cacheSettings?: { store: boolean; maxAge: string }
    },
  ): ResultWrapper<{ statusCode: number; body: Uint8Array }> {
    void runtime
    void request
    throw new Error('kpr_runtime_httpclient_sendrequest_not_available')
  }
}

export class EVMClient {
  static SUPPORTED_CHAIN_SELECTORS: Record<string, string | number | bigint> = {
    'ethereum-mainnet': 1n,
    'ethereum-mainnet-base-1': 8453n,
    'ethereum-testnet-sepolia-1': 11155111n,
    'ethereum-testnet-base-sepolia-1': 84532n,
  }

  constructor(selector: string | number | bigint) {
    void selector
  }

  callContract<Config = unknown>(
    runtime: Runtime<Config>,
    params: { call: unknown; blockNumber?: unknown },
  ): ResultWrapper<{ data: Uint8Array }> {
    void runtime
    void params
    throw new Error('kpr_runtime_evmclient_callcontract_not_available')
  }

  writeReport<Config = unknown>(
    runtime: Runtime<Config>,
    params: {
      receiver: `0x${string}`
      report: unknown
      gasConfig?: { gasLimit?: string }
    },
  ): ResultWrapper<{ txHash?: Uint8Array; errorMessage?: string }> {
    void runtime
    void params
    throw new Error('kpr_runtime_evmclient_writereport_not_available')
  }
}

export class CronCapability {
  trigger(params: { schedule: string }): { type: 'cron'; schedule: string } {
    return { type: 'cron', schedule: params.schedule }
  }
}

export function handler<TTrigger, TPayload, TResult>(
  trigger: TTrigger,
  callback: (runtime: Runtime, payload: TPayload) => TResult,
): { trigger: TTrigger; callback: (runtime: Runtime, payload: TPayload) => TResult } {
  return { trigger, callback }
}

export class Runner<Config = unknown> {
  static async newRunner<Config = unknown>(): Promise<Runner<Config>> {
    return new Runner<Config>()
  }

  async run(
    initWorkflow: (config: Config) => unknown,
  ): Promise<void> {
    void initWorkflow
    throw new Error('kpr_runtime_runner_not_available')
  }
}

export const LAST_FINALIZED_BLOCK_NUMBER = 'finalized'

export function encodeCallMsg(params: {
  from: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
}): { from: `0x${string}`; to: `0x${string}`; data: `0x${string}` } {
  return params
}

export function bytesToHex(value: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(value).toString('hex')}`
}

export function consensusIdenticalAggregation(): 'consensus-identical' {
  return 'consensus-identical'
}
