import { Connection, Keypair, Transaction } from '@solana/web3.js'

/**
 * Send a legacy Solana transaction and confirm it through JSON-RPC polling.
 *
 * Some paid RPC providers expose HTTP JSON-RPC without the WebSocket
 * `signatureSubscribe` method. Using web3.js `sendAndConfirmTransaction` in
 * that environment can submit a transaction and then falsely report failure.
 * This helper preserves finalized confirmation while remaining HTTP-only.
 */
export async function sendAndConfirmSolanaTransactionOverHttp(params: {
  connection: Connection
  transaction: Transaction
  payer: Keypair
  timeoutMs?: number
}): Promise<string> {
  const { connection, transaction, payer } = params
  const latestBlockhash = await connection.getLatestBlockhash('confirmed')
  transaction.feePayer = payer.publicKey
  transaction.recentBlockhash = latestBlockhash.blockhash
  transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight
  transaction.sign(payer)
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: 'confirmed',
  })
  const deadline = Date.now() + Math.max(5_000, params.timeoutMs ?? 90_000)
  for (;;) {
    const status = (await connection.getSignatureStatuses([signature])).value[0]
    if (status?.err) {
      throw new Error(`solana_transaction_failed:${signature}:${JSON.stringify(status.err)}`)
    }
    if (status?.confirmationStatus === 'finalized') return signature
    if (Date.now() >= deadline) {
      throw new Error(`solana_transaction_confirmation_timeout:${signature}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500))
  }
}
