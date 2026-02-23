import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Coins, Loader2, CheckCircle2, Upload, AlertCircle } from 'lucide-react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import type { Address, Hex } from 'viem'
import { isAddress, getAddress } from 'viem'

import { uploadImmutableBlob, uploadImmutableJson } from '@/lib/lens/grove'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { logger } from '@/lib/logger'
import { getZoraPlatformReferrerAddress } from '@/lib/zora/referrals'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_REFERRER = getZoraPlatformReferrerAddress()

const GROVE_BASE_CHAIN_ID = 8453 // Base mainnet for immutable uploads

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

const baseEase = [0.4, 0, 0.2, 1] as const
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: baseEase },
}

type LaunchStep = 'form' | 'uploading' | 'signing' | 'confirming' | 'done' | 'error'

type LaunchCoinCardProps = {
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
        description: description.trim() || `${effectiveName} Creator Coin on CreatorVault`,
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
        walletClient: walletClient as any,
        bundlerUrl,
        smartWallet: getAddress(smartWalletAddress) as Address,
        ownerAddress: getAddress(ownerAddress) as Address,
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
    imageFile,
    onCoinCreated,
    ownerAddress,
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
            <span className="text-zinc-500 shrink-0">Coin</span>
            <span className="font-mono truncate">${symbolClean}</span>
          </div>
          {createdCoinAddress && (
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-500 shrink-0">Address</span>
              <a
                href={`https://zora.co/coin/base:${createdCoinAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono truncate text-[#0052FF] hover:text-[#3373FF] transition-colors"
              >
                {createdCoinAddress.slice(0, 6)}...{createdCoinAddress.slice(-4)}
              </a>
            </div>
          )}
          {txHash && (
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-500 shrink-0">Tx</span>
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono truncate text-[#0052FF] hover:text-[#3373FF] transition-colors"
              >
                {txHash.slice(0, 10)}...
              </a>
            </div>
          )}
        </div>
        <div className="text-[11px] text-zinc-600 pt-1">
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
        <div className="w-9 h-9 rounded-xl bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center">
          <Coins className="w-4.5 h-4.5 text-[#0052FF]" />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-white">{isOneClick ? 'Create your Creator Coin' : 'Launch Your Creator Coin'}</div>
          <div className="text-[11px] text-zinc-500">Free to create — gas is sponsored</div>
        </div>
      </div>

      {isOneClick ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-600">Prefilled</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] text-white font-medium truncate">{effectiveName || '--'}</div>
              <div className="text-[12px] text-zinc-500 font-mono truncate">${symbolClean || '--'}</div>
            </div>
            <div className="text-[11px] text-zinc-600 text-right">Uses your username</div>
          </div>
        </div>
      ) : (
        /* Form */
        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Akita"
              disabled={isBusy}
              maxLength={64}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[14px] placeholder:text-zinc-600 focus:outline-none focus:border-[#0052FF]/40 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Symbol */}
          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">Symbol</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[14px]">$</span>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="e.g. AKITA"
                disabled={isBusy}
                maxLength={8}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[14px] placeholder:text-zinc-600 focus:outline-none focus:border-[#0052FF]/40 transition-colors disabled:opacity-50 uppercase"
              />
            </div>
          </div>

          {/* Description (optional) */}
          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">
              Description <span className="text-zinc-700">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your coin about?"
              disabled={isBusy}
              maxLength={280}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder:text-zinc-600 focus:outline-none focus:border-[#0052FF]/40 transition-colors disabled:opacity-50 resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-1">
              Image <span className="text-zinc-700">(optional)</span>
            </label>
            <input
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
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] text-zinc-500 text-[13px] hover:border-white/[0.12] hover:text-zinc-400 transition-colors disabled:opacity-50 cursor-pointer"
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
                className="text-[#0052FF] hover:text-[#3373FF] mt-1 text-[11px] font-medium transition-colors"
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
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0052FF] shrink-0" />
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
              ? 'bg-[#0052FF] text-white hover:bg-[#1a66ff] cursor-pointer shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_6px_24px_-6px_rgba(0,82,255,0.4)]'
              : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed',
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
