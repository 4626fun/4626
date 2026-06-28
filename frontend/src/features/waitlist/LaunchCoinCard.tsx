import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Coins, CheckCircle2, Upload, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useWallets } from '@privy-io/react-auth'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import type { Address, Hex } from 'viem'
import { isAddress, getAddress, toHex } from 'viem'

import { uploadImmutableBlob, uploadImmutableJson } from '@/lib/lens/grove'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { logger } from '@/lib/observability/logger'
import { Spinner } from '@/components/ui/Spinner'
import { ensureProviderOnBase } from '@/lib/wallet/safeSwitchToBase'
import { getZoraPlatformReferrerAddress } from '@/lib/zora/referrals'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_REFERRER = getZoraPlatformReferrerAddress()

const GROVE_BASE_CHAIN_ID = 8453 // Base mainnet for immutable uploads

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const baseEase = [0.4, 0, 0.2, 1] as const
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: baseEase },
}

type LaunchStep = 'form' | 'uploading' | 'signing' | 'confirming' | 'done' | 'error'

export type LaunchCoinCardProps = {
  /** UI mode: full form (default) or 1-click prefilled */
  mode?: 'form' | 'one-click'
  /** Prefill coin name (used in one-click mode) */
  defaultName?: string | null
  /** Prefill coin symbol seed (used in one-click mode) */
  defaultSymbol?: string | null
  /** The user's Coinbase Smart Wallet address (coin creator) */
  smartWalletAddress: string | null
  /** The EOA owner address that will sign the UserOp */
  ownerAddress: string | null
  /** Callback when coin is successfully created */
  onCoinCreated?: (coinAddress: string, symbol: string) => void
}

function isHexSignature(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)
}

function ensureSignatureHex(value: unknown, context: string): Hex {
  if (isHexSignature(value)) return value
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const direct = record?.signature ?? record?.sig
  if (isHexSignature(direct)) return direct
  const nested = record?.result
  if (nested && typeof nested === 'object') {
    const nestedSig = (nested as Record<string, unknown>).signature
    if (isHexSignature(nestedSig)) return nestedSig
  }
  throw new Error(`Invalid signature returned from ${context}`)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LaunchCoinCard = memo(function LaunchCoinCard({
  mode = 'form',
  defaultName,
  defaultSymbol,
  smartWalletAddress,
  ownerAddress,
  onCoinCreated,
}: LaunchCoinCardProps) {
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { wallets: privyWallets } = useWallets()

  const normalizedSmartWalletAddress = useMemo(() => {
    if (!smartWalletAddress || !isAddress(smartWalletAddress)) return null
    return getAddress(smartWalletAddress as Address)
  }, [smartWalletAddress])

  const privyEmbeddedEoaWallet = useMemo(() => {
    const wallets = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return (
      wallets.find((wallet) => {
        const walletType = String(
          wallet?.wallet_client_type ?? wallet?.walletClientType ?? wallet?.connector_type ?? wallet?.type ?? '',
        )
          .trim()
          .toLowerCase()
        if (!(walletType === 'privy' || walletType.includes('privy') || walletType.includes('embedded'))) return false
        const rawAddress = typeof wallet?.address === 'string' ? String(wallet.address).trim() : ''
        if (!rawAddress || !isAddress(rawAddress)) return false
        if (normalizedSmartWalletAddress && rawAddress.toLowerCase() === normalizedSmartWalletAddress.toLowerCase()) return false
        return true
      }) ?? null
    )
  }, [normalizedSmartWalletAddress, privyWallets])

  const privyEmbeddedEoaAddress = useMemo(() => {
    const rawAddress = typeof (privyEmbeddedEoaWallet as any)?.address === 'string'
      ? String((privyEmbeddedEoaWallet as any).address).trim()
      : ''
    if (!rawAddress || !isAddress(rawAddress)) return null
    return getAddress(rawAddress as Address)
  }, [privyEmbeddedEoaWallet])

  const privyEmbeddedEoaCanSign = useMemo(() => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return false
    if (typeof walletAny?.request === 'function') return true
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return true
    if (typeof walletAny?.getEthereumProvider === 'function') return true
    if (typeof walletAny?.signMessage === 'function') return true
    return false
  }, [privyEmbeddedEoaWallet])

  const privyEmbeddedEoaCanOperateCanonicalQuery = useQuery({
    queryKey: ['launch-coin', 'privy-embedded-can-operate-canonical', normalizedSmartWalletAddress, privyEmbeddedEoaAddress],
    enabled: Boolean(normalizedSmartWalletAddress && privyEmbeddedEoaAddress && publicClient),
    staleTime: 10_000,
    queryFn: async () => {
      if (!normalizedSmartWalletAddress || !privyEmbeddedEoaAddress || !publicClient) return false
      try {
        const isOwner = (await (publicClient as any).readContract({
          address: normalizedSmartWalletAddress,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [privyEmbeddedEoaAddress],
        })) as boolean
        return isOwner === true
      } catch {
        return false
      }
    },
  })

  const getPrivyEmbeddedEoaProvider = useCallback(async () => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return null
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return walletAny.provider
    if (typeof walletAny.getEthereumProvider === 'function') {
      const provider = await walletAny.getEthereumProvider().catch(() => null)
      if (provider && typeof provider.request === 'function') return provider
    }
    if (typeof walletAny.request === 'function') {
      return { request: walletAny.request.bind(walletAny) }
    }
    return null
  }, [privyEmbeddedEoaWallet])

  // Form state
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Progress state
  const [step, setStep] = useState<LaunchStep>('form')
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createdCoinAddress, setCreatedCoinAddress] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Derived
  const isOneClick = mode === 'one-click'
  const effectiveName = useMemo(() => {
    const raw = isOneClick ? String(defaultName ?? '') : name
    return raw.trim()
  }, [defaultName, isOneClick, name])
  const effectiveSymbolRaw = useMemo(() => {
    return isOneClick ? String(defaultSymbol ?? '') : symbol
  }, [defaultSymbol, isOneClick, symbol])
  const symbolClean = useMemo(() => {
    return effectiveSymbolRaw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  }, [effectiveSymbolRaw])
  const canSubmit =
    effectiveName.length >= 2 &&
    symbolClean.length >= 2 &&
    step === 'form' &&
    !!smartWalletAddress &&
    !!ownerAddress &&
    !!publicClient &&
    !!walletClient

  // Image handling
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Please select a PNG, JPEG, GIF, WebP, or SVG image.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Image must be under 5 MB.')
      return
    }
    setError(null)
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  // Main creation flow
  const handleCreate = useCallback(async () => {
    if (!canSubmit || !publicClient || !walletClient) return
    if (!smartWalletAddress || !isAddress(smartWalletAddress)) return
    if (!ownerAddress || !isAddress(ownerAddress)) return

    setError(null)

    try {
      // ---------------------------------------------------------------
      // Step 1: Upload image (or use default)
      // ---------------------------------------------------------------
      setStep('uploading')
      setStatusText('Uploading metadata...')

      let imageUri = ''
      if (imageFile) {
        const blob = new Blob([imageFile], { type: imageFile.type })
        const imageResult = await uploadImmutableBlob(blob, imageFile.type, GROVE_BASE_CHAIN_ID)
        imageUri = imageResult.gatewayUrl || imageResult.lensUri
        logger.info('[LaunchCoin] Image uploaded', { uri: imageUri })
      }

      // ---------------------------------------------------------------
      // Step 2: Upload metadata JSON
      // ---------------------------------------------------------------
      const metadata = {
        name: effectiveName,
        description: description.trim() || `${effectiveName} Creator Coin on 4626`,
        ...(imageUri ? { image: imageUri } : {}),
        properties: {
          symbol: symbolClean,
          platform: '4626.fun',
          category: 'social',
        },
      }
      const metadataResult = await uploadImmutableJson(metadata, GROVE_BASE_CHAIN_ID)
      const metadataUri = metadataResult.gatewayUrl || metadataResult.lensUri
      logger.info('[LaunchCoin] Metadata uploaded', { uri: metadataUri })

      // ---------------------------------------------------------------
      // Step 3: Get coin creation calldata from Zora SDK
      // ---------------------------------------------------------------
      setStatusText('Preparing transaction...')
      const { createCoinCall } = await import('@zoralabs/coins-sdk')

      const callResult = await createCoinCall({
        creator: smartWalletAddress,
        name: effectiveName,
        symbol: symbolClean,
        metadata: { type: 'RAW_URI', uri: metadataUri },
        currency: 'ETH',
        chainId: base.id,
        platformReferrer: PLATFORM_REFERRER,
        payoutRecipientOverride: getAddress(smartWalletAddress) as Address,
        skipMetadataValidation: true,
      })

      logger.info('[LaunchCoin] Coin creation calldata ready', {
        predictedAddress: callResult.predictedCoinAddress,
        callCount: callResult.calls.length,
      })

      // ---------------------------------------------------------------
      // Step 4: Send as gas-sponsored UserOp
      // ---------------------------------------------------------------
      setStep('signing')
      setStatusText('Sign the transaction in your wallet...')

      const paymasterUrl = resolveCdpPaymasterUrl(
        import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined,
      )
      const bundlerUrl = paymasterUrl || '/api/paymaster'
      let userOpWalletClient: any = walletClient as any
      let userOpOwnerAddress = getAddress(ownerAddress as Address) as Address

      if (
        privyEmbeddedEoaCanSign &&
        privyEmbeddedEoaAddress &&
        privyEmbeddedEoaCanOperateCanonicalQuery.data === true
      ) {
        const embeddedProvider = await getPrivyEmbeddedEoaProvider()
        if (embeddedProvider?.request) {
          await ensureProviderOnBase({ provider: embeddedProvider, label: 'Privy embedded EOA' })
          userOpOwnerAddress = getAddress(privyEmbeddedEoaAddress as Address)
          userOpWalletClient = {
            request: async (args: { method: string; params?: any[] }) => {
              if (args?.method === 'eth_sign') {
                const params = Array.isArray(args.params) ? args.params : []
                const hashCandidate =
                  params.find((value): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)) ??
                  ''
                if (hashCandidate) {
                  try {
                    const rawSig = await embeddedProvider.request({
                      method: 'secp256k1_sign',
                      params: [hashCandidate],
                    })
                    return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.secp256k1_sign')
                  } catch {
                    // Fall through to provider eth_sign when secp256k1_sign is unavailable.
                  }
                }
              }
              return await embeddedProvider.request(args as any)
            },
            signMessage: async (args: { message: unknown }) => {
              const raw =
                typeof args?.message === 'object' && args.message !== null && 'raw' in (args.message as Record<string, unknown>)
                  ? (args.message as Record<string, unknown>).raw
                  : args?.message
              const msgHex = typeof raw === 'string' && raw.startsWith('0x') ? raw : toHex(String(raw ?? ''))
              const rawSig = await embeddedProvider.request({
                method: 'personal_sign',
                params: [msgHex, userOpOwnerAddress],
              })
              return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.personal_sign')
            },
            signTypedData: async (typedData: unknown) => {
              const rawSig = await embeddedProvider.request({
                method: 'eth_signTypedData_v4',
                params: [userOpOwnerAddress, JSON.stringify(typedData)],
              })
              return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
            },
          }
        }
      }

      // Map Zora SDK calls to UserOp calls
      const calls = callResult.calls.map((c) => ({
        to: c.to as Address,
        data: c.data as Hex,
        value: c.value,
      }))

      setStep('confirming')
      setStatusText('Confirming on Base...')

      const result = await sendCoinbaseSmartWalletUserOperation({
        publicClient: publicClient as any,
        walletClient: userOpWalletClient,
        bundlerUrl,
        smartWallet: getAddress(smartWalletAddress) as Address,
        ownerAddress: userOpOwnerAddress,
        calls,
        version: '1',
      })

      // ---------------------------------------------------------------
      // Step 5: Success
      // ---------------------------------------------------------------
      setStep('done')
      setCreatedCoinAddress(callResult.predictedCoinAddress)
      setTxHash(result.transactionHash)
      setStatusText('')

      logger.info('[LaunchCoin] Coin created!', {
        coinAddress: callResult.predictedCoinAddress,
        txHash: result.transactionHash,
        platformReferrer: PLATFORM_REFERRER,
      })

      onCoinCreated?.(callResult.predictedCoinAddress, symbolClean)
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      logger.error('[LaunchCoin] Creation failed', err)

      // User rejection is not an error
      if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
        setStep('form')
        return
      }

      setStep('error')
      setError(msg.length > 300 ? msg.slice(0, 300) + '...' : msg)
    }
  }, [
    canSubmit,
    description,
    effectiveName,
    getPrivyEmbeddedEoaProvider,
    imageFile,
    onCoinCreated,
    ownerAddress,
    privyEmbeddedEoaAddress,
    privyEmbeddedEoaCanOperateCanonicalQuery.data,
    privyEmbeddedEoaCanSign,
    publicClient,
    smartWalletAddress,
    symbolClean,
    walletClient,
  ])

  // Reset to form
  const handleRetry = useCallback(() => {
    setStep('form')
    setError(null)
    setStatusText('')
  }, [])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (step === 'done') {
    return (
      <motion.div {...fadeUp} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-[15px] font-semibold text-emerald-300">Creator Coin Launched!</span>
        </div>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-zinc-400 shrink-0">Coin</span>
            <span className="font-mono truncate">${symbolClean}</span>
          </div>
          {createdCoinAddress && (
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-400 shrink-0">Address</span>
              <a
                href={`https://zora.co/coin/base:${createdCoinAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono truncate text-[rgb(var(--brand-primary))] hover:text-[rgb(var(--brand-hover))] transition-colors"
              >
                {createdCoinAddress.slice(0, 6)}...{createdCoinAddress.slice(-4)}
              </a>
            </div>
          )}
          {txHash && (
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-400 shrink-0">Tx</span>
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono truncate text-[rgb(var(--brand-primary))] hover:text-[rgb(var(--brand-hover))] transition-colors"
              >
                {txHash.slice(0, 10)}...
              </a>
            </div>
          )}
        </div>
        <div className="text-[11px] text-zinc-400 pt-1">
          Your coin is live on Zora. Gas was on us.
        </div>
      </motion.div>
    )
  }

  const isBusy = step === 'uploading' || step === 'signing' || step === 'confirming'
  const createLabel = isOneClick && symbolClean ? `Create $${symbolClean}` : 'Create Coin'

  return (
    <motion.div {...fadeUp} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[rgb(var(--brand-primary)/0.1)] border border-[rgb(var(--brand-primary)/0.2)] flex items-center justify-center">
          <Coins className="w-4.5 h-4.5 text-[rgb(var(--brand-primary))]" />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-white">{isOneClick ? 'Create your Creator Coin' : 'Launch Your Creator Coin'}</div>
          <div className="text-[11px] text-zinc-400">Free to create — gas is sponsored</div>
        </div>
      </div>

      {isOneClick ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">Prefilled</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] text-white font-medium truncate">{effectiveName || '--'}</div>
              <div className="text-[12px] text-zinc-400 font-mono truncate">${symbolClean || '--'}</div>
            </div>
            <div className="text-[11px] text-zinc-400 text-right">Uses your username</div>
          </div>
        </div>
      ) : (
        /* Form */
        <div className="space-y-3">
          {/* Name */}
          <div>
            <label htmlFor="launch-coin-name" className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-1">Name</label>
            <input
              id="launch-coin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Akita"
              disabled={isBusy}
              maxLength={64}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[14px] placeholder:text-zinc-400 focus:outline-none focus:border-[rgb(var(--brand-primary)/0.4)] transition-colors disabled:opacity-50"
            />
          </div>

          {/* Symbol */}
          <div>
            <label htmlFor="launch-coin-symbol" className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-1">Symbol</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[14px]">$</span>
              <input
                id="launch-coin-symbol"
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="e.g. AKITA"
                disabled={isBusy}
                maxLength={8}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[14px] placeholder:text-zinc-400 focus:outline-none focus:border-[rgb(var(--brand-primary)/0.4)] transition-colors disabled:opacity-50 uppercase"
              />
            </div>
          </div>

          {/* Description (optional) */}
          <div>
            <label htmlFor="launch-coin-description" className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-1">
              Description <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="launch-coin-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your coin about?"
              disabled={isBusy}
              maxLength={280}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder:text-zinc-400 focus:outline-none focus:border-[rgb(var(--brand-primary)/0.4)] transition-colors disabled:opacity-50 resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <label htmlFor="launch-coin-image" className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-1">
              Image <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="launch-coin-image"
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] text-zinc-400 text-[13px] hover:border-white/[0.12] hover:text-zinc-400 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {imagePreview ? (
                <div className="flex items-center gap-2">
                  <img src={imagePreview} alt="preview" className="w-6 h-6 rounded object-cover" />
                  <span className="truncate max-w-[180px]">{imageFile?.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload image</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {(error || step === 'error') && (
        <div className="flex items-start gap-2 text-[12px] text-red-400/90 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="break-words">{error || 'Something went wrong.'}</div>
            {step === 'error' && (
              <button
                type="button"
                onClick={handleRetry}
                className="text-[rgb(var(--brand-primary))] hover:text-[rgb(var(--brand-hover))] mt-1 text-[11px] font-medium transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status */}
      {isBusy && (
        <div className="flex items-center gap-2 text-[12px] text-zinc-400">
          <Spinner className="shrink-0 text-[rgb(var(--brand-primary))]" size="sm" />
          <span>{statusText}</span>
        </div>
      )}

      {/* Submit */}
      {step === 'form' && (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleCreate}
          className={[
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[14px] font-semibold transition-all duration-200',
            canSubmit
              ? 'bg-[rgb(var(--brand-primary))] text-white hover:bg-[rgb(var(--brand-hover))] cursor-pointer shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_6px_24px_-6px_rgb(var(--brand-primary)/0.4)]'
              : 'bg-white/[0.04] text-zinc-400 cursor-not-allowed',
          ].join(' ')}
        >
          <Coins className="w-4 h-4" />
          {createLabel}
        </button>
      )}

      {/* Fine print */}
      <div className="text-[10px] text-zinc-700 text-center">
        Creates a Zora Creator Coin on Base. No gas fees required.
      </div>
    </motion.div>
  )
})

export default LaunchCoinCard
