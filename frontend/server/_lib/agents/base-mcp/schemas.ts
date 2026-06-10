import { z } from 'zod'

export const BASE_CHAIN_ID = 8453

export const HexAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Expected 0x-prefixed 20-byte hex address')

export const RequestedModeSchema = z.enum(['canonical', 'eoa']).default('canonical')

const BaseRequestFields = {
  userId: z.string().min(1),
  chainId: z.literal(BASE_CHAIN_ID),
  clientRequestId: z.string().min(1),
  requestedMode: RequestedModeSchema.optional(),
}

export const PrepareSwapRequestSchema = z.object({
  action: z.literal('prepareSwap'),
  ...BaseRequestFields,
  sellToken: HexAddressSchema,
  buyToken: HexAddressSchema,
  sellAmount: z.string().regex(/^\d+$/, 'sellAmount must be an integer string in base units'),
  maxSlippageBps: z.number().int().min(1).max(10_000),
  quoteTtlSeconds: z.number().int().min(1).max(300),
})

export const PrepareTransferRequestSchema = z.object({
  action: z.literal('prepareTransfer'),
  ...BaseRequestFields,
  token: HexAddressSchema,
  amount: z.string().regex(/^\d+$/, 'amount must be an integer string in base units'),
  recipient: HexAddressSchema,
})

export const PrepareRequestSchema = z.discriminatedUnion('action', [PrepareSwapRequestSchema, PrepareTransferRequestSchema])

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired'])

export type PrepareSwapRequest = z.infer<typeof PrepareSwapRequestSchema>
export type PrepareTransferRequest = z.infer<typeof PrepareTransferRequestSchema>
export type PrepareRequest = z.infer<typeof PrepareRequestSchema>
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>
