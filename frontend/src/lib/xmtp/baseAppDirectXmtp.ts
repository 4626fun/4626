import { getAddress, isAddress } from 'viem'

import { isCoinbaseWalletConnector } from './signerUtils'

export function normalizeXmtpEvmAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase()
}

export type BaseAppDirectCswInput = {
  connectedAddress: string | null | undefined
  canonicalCswAddress: string | null | undefined
  connector?: unknown
}

/** @deprecated Use `BaseAppDirectCswInput` */
export type BaseAppDirectXmtpInput = BaseAppDirectCswInput

export function isBaseAppDirectCswPath(input: BaseAppDirectCswInput): boolean {
  const connected = normalizeXmtpEvmAddress(input.connectedAddress)
  const canonical = normalizeXmtpEvmAddress(input.canonicalCswAddress)
  if (!connected || !canonical || connected !== canonical) return false
  return isCoinbaseWalletConnector(input.connector)
}

export type BaseAppDirectCswIdentity = {
  identityAddress: string
  isCanonicalSmartWallet: true
}

/** @deprecated Use `BaseAppDirectCswIdentity` */
export type BaseAppDirectXmtpIdentity = BaseAppDirectCswIdentity

export function resolveBaseAppDirectCswIdentity(
  input: BaseAppDirectCswInput,
): BaseAppDirectCswIdentity | null {
  if (!isBaseAppDirectCswPath(input)) return null
  const connected = normalizeXmtpEvmAddress(input.connectedAddress)!
  return { identityAddress: connected, isCanonicalSmartWallet: true }
}

/** @deprecated Use `isBaseAppDirectCswPath` */
export const isBaseAppDirectXmtpPath = isBaseAppDirectCswPath

/** @deprecated Use `resolveBaseAppDirectCswIdentity` */
export const resolveBaseAppDirectXmtpIdentity = resolveBaseAppDirectCswIdentity
