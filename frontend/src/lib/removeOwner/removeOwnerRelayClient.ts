import { createOwnerMutationRelayClient } from '@/lib/relay/ownerMutationRelayKit'

export function createRemoveOwnerRelayClient() {
  return createOwnerMutationRelayClient('4626-remove-owner')
}
