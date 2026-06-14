import { Client, type Signer } from '@xmtp/browser-sdk'
import { isPrivyEmbeddedSignerAuthError } from '@/lib/xmtp/xmtpHelpers'

type XmtpClient = Client

/**
 * Client.build restores OPFS state without an attached signer. When the local
 * installation is not registered on the network, inbox registration must use
 * Client.create → client.registerIdentity — NOT unsafe_applySignatureRequest
 * (that path returns "Unknown signer" for createInboxSignatureText requests).
 */
export async function registerBuiltClientInboxViaCreate(input: {
  buildClient: XmtpClient
  signers: Signer[]
  restoreOptions: Record<string, unknown>
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
  const priorInboxId = input.buildClient.inboxId
  input.buildClient.close()

  let lastError: unknown = null
  for (const registrationSigner of uniqueSigners) {
    try {
      const createdClient = (await Client.create(registrationSigner, {
        ...input.restoreOptions,
        disableAutoRegister: false,
      } as Parameters<typeof Client.create>[1])) as XmtpClient

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
        console.warn('[xmtp] Client.create registration changed installation id', {
          before: priorInstallationId,
          after: createdClient.installationId,
          inboxId: priorInboxId,
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
