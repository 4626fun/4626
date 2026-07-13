import { Client, type Signer } from '@xmtp/browser-sdk'
import { isPrivyEmbeddedSignerAuthError } from '@/lib/auth/privyEmbeddedSignerAuthErrors'
import { retryOnOpfsAccessHandleError } from '@/lib/xmtp/xmtpHelpers'

type XmtpClient = Client

/** Wait after closing a built client before Client.create reopens the same OPFS dbPath. */
export const XMTP_REGISTRATION_PEER_RELEASE_WAIT_MS = 1_200

/**
 * Fail closed unless restoreOptions.dbPath clearly targets the restored inbox.
 * Prevents Client.create from opening a different/auto path and minting a
 * replacement installation.
 */
export function resolveRestoredRegistrationDbPath(input: {
  restoreDbPath: unknown
  inboxId: string
}): string {
  const inboxId = String(input.inboxId ?? '').trim()
  if (!inboxId) {
    throw new Error('XMTP registration requires a restored inbox id')
  }
  const restoreDbPath =
    typeof input.restoreDbPath === 'string' ? input.restoreDbPath.trim() : ''
  if (!restoreDbPath) {
    throw new Error(
      'XMTP registration requires dbPath so Client.create reuses the restored OPFS installation',
    )
  }
  // Expected shape: xmtp-{env}-{inboxId}.db3 — require the inbox id stem so a
  // mismatched path cannot silently provision a new install.
  if (!restoreDbPath.includes(inboxId)) {
    throw new Error(
      `XMTP registration dbPath "${restoreDbPath}" does not match restored inbox id`,
    )
  }
  return restoreDbPath
}

/**
 * Client.build restores OPFS state without an attached signer. When the local
 * installation is not registered on the network, inbox registration must use
 * Client.create → client.registerIdentity — NOT unsafe_applySignatureRequest
 * (that path returns "Unknown signer" for createInboxSignatureText requests).
 *
 * The create call MUST target the same `dbPath` as the restored client so we
 * register the existing local installation instead of provisioning a replacement.
 */
export async function registerBuiltClientInboxViaCreate(input: {
  buildClient: XmtpClient
  signers: Signer[]
  restoreOptions: Record<string, unknown>
  peerReleaseWaitMs?: number
}): Promise<{ client: XmtpClient; signer: Signer }> {
  if (await input.buildClient.isRegistered()) {
    const primary = input.signers[0]
    if (!primary) {
      throw new Error('XMTP registration requires at least one signer')
    }
    return { client: input.buildClient, signer: primary }
  }

  const uniqueSigners: Signer[] = []
  for (const candidate of input.signers) {
    if (!uniqueSigners.some((existing) => existing.type === candidate.type)) {
      uniqueSigners.push(candidate)
    }
  }
  if (uniqueSigners.length === 0) {
    throw new Error('XMTP registration requires at least one signer')
  }

  const priorInstallationId = input.buildClient.installationId
  const priorInboxId = String(input.buildClient.inboxId ?? '').trim()
  const restoreDbPath = resolveRestoredRegistrationDbPath({
    restoreDbPath: input.restoreOptions.dbPath,
    inboxId: priorInboxId,
  })

  input.buildClient.close()

  // client.close() returns before the worker releases its OPFS sync access
  // handle. Creating on the same dbPath immediately races that handle and can
  // mint a replacement installation under contention.
  const peerReleaseWaitMs =
    typeof input.peerReleaseWaitMs === 'number' && input.peerReleaseWaitMs >= 0
      ? input.peerReleaseWaitMs
      : XMTP_REGISTRATION_PEER_RELEASE_WAIT_MS
  if (peerReleaseWaitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, peerReleaseWaitMs))
  }

  const registrationOptions = {
    ...input.restoreOptions,
    dbPath: restoreDbPath,
    disableAutoRegister: false,
  }

  let lastError: unknown = null
  for (const registrationSigner of uniqueSigners) {
    try {
      const createdClient = (await retryOnOpfsAccessHandleError(
        () =>
          Client.create(registrationSigner, {
            ...registrationOptions,
          } as Parameters<typeof Client.create>[1]) as Promise<XmtpClient>,
      )) as XmtpClient

      if (!(await createdClient.isRegistered())) {
        closeClientSafe(createdClient)
        throw new Error(
          `XMTP identity registration did not complete (${registrationSigner.type} signer)`,
        )
      }

      if (
        priorInstallationId &&
        createdClient.installationId &&
        createdClient.installationId !== priorInstallationId
      ) {
        // First-time registration of a locally built install may mint the
        // network-visible installation id. Treat as a one-shot transition —
        // never as permission to create another fallback install.
        console.warn('[xmtp] Client.create registration changed installation id', {
          before: priorInstallationId,
          after: createdClient.installationId,
          inboxId: priorInboxId,
          dbPath: restoreDbPath,
        })
      }

      return { client: createdClient, signer: registrationSigner }
    } catch (registerErr) {
      lastError = registerErr
      const registerMsg = registerErr instanceof Error ? registerErr.message : String(registerErr)
      if (isPrivyEmbeddedSignerAuthError(registerMsg)) {
        throw new Error(
          'Embedded signer session expired. Sign out and sign in with email OTP again, then retry Connect Messaging.',
        )
      }
      if (/reject|denied|cancel|user rejected/i.test(registerMsg)) {
        throw registerErr
      }
      console.warn(
        `[xmtp] Client.create registration with ${registrationSigner.type} signer failed; trying next signer if available…`,
        registerMsg,
      )
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'XMTP identity registration failed for all signer types'))
}

function closeClientSafe(client: XmtpClient | null | undefined): void {
  if (!client) return
  try {
    client.close()
  } catch {
    // ignore close errors
  }
}
