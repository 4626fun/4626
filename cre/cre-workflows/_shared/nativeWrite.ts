import { EVMClient, bytesToHex, type Runtime } from "@chainlink/cre-sdk"
import { encodeJsonBody } from "./http"

export type NativeWriteConfig = {
  nativeWriteEnabled?: boolean
  nativeReceiver?: `0x${string}`
  nativeEncoderName?: string
  nativeSigningAlgo?: string
  nativeHashingAlgo?: string
  nativeGasLimit?: string
}

export type NativeWriteAttempt = {
  attempted: boolean
  success: boolean
  txHash?: string
  error?: string
}

export function tryNativeWriteReport<Config extends NativeWriteConfig>(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  payload: Record<string, unknown>,
): NativeWriteAttempt {
  if (!runtime.config.nativeWriteEnabled) {
    return { attempted: false, success: false, error: "native_write_disabled" }
  }
  if (!runtime.config.nativeReceiver) {
    return { attempted: false, success: false, error: "native_receiver_missing" }
  }

  try {
    const report = runtime
      .report({
        encodedPayload: encodeJsonBody(payload),
        encoderName: runtime.config.nativeEncoderName ?? "json",
        signingAlgo: runtime.config.nativeSigningAlgo ?? "bls",
        hashingAlgo: runtime.config.nativeHashingAlgo ?? "keccak256",
      })
      .result()

    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: runtime.config.nativeReceiver,
        report,
        ...(runtime.config.nativeGasLimit
          ? { gasConfig: { gasLimit: runtime.config.nativeGasLimit } }
          : {}),
      })
      .result()

    const txHash = writeResult.txHash ? bytesToHex(writeResult.txHash) : undefined
    const success = Boolean(txHash) && !writeResult.errorMessage

    return {
      attempted: true,
      success,
      ...(txHash ? { txHash } : {}),
      ...(writeResult.errorMessage ? { error: writeResult.errorMessage } : {}),
    }
  } catch (error) {
    return {
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
