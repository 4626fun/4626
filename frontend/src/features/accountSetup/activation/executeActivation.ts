import type {
  ActivationStatusResponse,
  ProvisionAutomationOwnerResponse,
} from './activationApi'

export type ActivationExecutionStage =
  | 'visible_signature'
  | 'embedded_owner_confirmed'
  | 'silent_server_owner_install'
  | 'server_owner_confirmed'
  | 'xmtp_provisioning'
  | 'ready'

export type ActivationExecutionDependencies = {
  readStatus: () => Promise<ActivationStatusResponse>
  submitVisibleEmbeddedOwnerInstall: () => Promise<boolean>
  provisionServerOwner: () => Promise<ProvisionAutomationOwnerResponse>
  submitSilentServerOwnerInstall: (
    provisioned: ProvisionAutomationOwnerResponse,
  ) => Promise<void>
  completeXmtpProvisioning: (activationToken: string) => Promise<void>
  onStage?: (stage: ActivationExecutionStage) => void
}

export async function executeOneSignatureActivation(
  dependencies: ActivationExecutionDependencies,
): Promise<ActivationStatusResponse> {
  let status = await dependencies.readStatus()
  if (!status.embeddedOwnerConfirmed) {
    dependencies.onStage?.('visible_signature')
    const submitted = await dependencies.submitVisibleEmbeddedOwnerInstall()
    if (!submitted) throw new Error('visible_owner_install_not_submitted')
    status = await dependencies.readStatus()
    if (!status.embeddedOwnerConfirmed) throw new Error('embedded_owner_not_confirmed')
  }

  dependencies.onStage?.('embedded_owner_confirmed')
  const provisioned = await dependencies.provisionServerOwner()
  if (!provisioned.embeddedOwnerConfirmed) throw new Error('embedded_owner_not_confirmed')

  if (!provisioned.alreadyOwner) {
    dependencies.onStage?.('silent_server_owner_install')
    await dependencies.submitSilentServerOwnerInstall(provisioned)
  }

  status = await dependencies.readStatus()
  if (!status.serverOwnerConfirmed) throw new Error('server_owner_not_confirmed')
  dependencies.onStage?.('server_owner_confirmed')
  dependencies.onStage?.('xmtp_provisioning')
  await dependencies.completeXmtpProvisioning(provisioned.activationToken)
  status = await dependencies.readStatus()
  if (!status.xmtpProvisioned) throw new Error('xmtp_not_provisioned')
  dependencies.onStage?.('ready')
  return status
}
