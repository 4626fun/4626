import { useEffect, useRef, useState } from 'react'
import { isAddress } from 'viem'

import {
  associateImageProjectToVault,
  autoProvisionProjectAssets,
  createImageGenerationProject,
  directComposeProject,
  getVaultImage,
} from '@/lib/imageGenerationApi'

type Props = {
  vaultAddress: string
  creatorCoinAddress: string
  tokenSymbol?: string
}

type Phase = 'idle' | 'checking' | 'fetching' | 'compositing' | 'saving' | 'done' | 'error'

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  checking: 'Checking for existing vault icon…',
  fetching: 'Fetching creator coin image…',
  compositing: 'Compositing vault icon…',
  saving: 'Saving vault icon…',
  done: '',
  error: '',
}

export function VaultImageGenerator({ vaultAddress, creatorCoinAddress, tokenSymbol }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Tracks whether a generation is currently running to prevent concurrent calls
  // (e.g. double-click on Regenerate or React StrictMode remount in dev).
  const runningRef = useRef(false)
  // Allows in-flight async work to detect component unmount and bail out of
  // setState calls, preventing React's "update on unmounted component" warning.
  const mountedRef = useRef(true)

  const safeSetPhase = (value: Phase) => {
    if (mountedRef.current) setPhase(value)
  }

  const safeSetOutputUrl = (value: string | null) => {
    if (mountedRef.current) setOutputUrl(value)
  }

  const safeSetError = (value: string | null) => {
    if (mountedRef.current) setError(value)
  }

  const runGeneration = async () => {
    if (runningRef.current) return
    runningRef.current = true

    try {
      safeSetPhase('fetching')
      safeSetError(null)

      const project = await createImageGenerationProject({
        instruction: tokenSymbol ? `Vault icon for $${tokenSymbol}` : 'Vault icon',
        stylePreset: 'modern_elegant',
        brandContext: ['creator coin', 'ERC-4626 vault icon'],
      })

      await autoProvisionProjectAssets({ projectId: project.id, creatorCoinAddress })

      safeSetPhase('compositing')
      const { outputBlobUrl } = await directComposeProject(project.id)
      safeSetOutputUrl(outputBlobUrl)

      safeSetPhase('saving')
      await associateImageProjectToVault({ projectId: project.id, vaultAddress })

      safeSetPhase('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      safeSetError(message)
      safeSetPhase('error')
    } finally {
      runningRef.current = false
    }
  }

  useEffect(() => {
    mountedRef.current = true

    // Skip if the coin address hasn't resolved yet — parent will re-render once
    // the address is known, triggering this effect again.
    if (!creatorCoinAddress || !isAddress(creatorCoinAddress)) return
    if (!vaultAddress || !isAddress(vaultAddress)) return

    void (async () => {
      safeSetPhase('checking')
      try {
        const existing = await getVaultImage(vaultAddress)
        if (!mountedRef.current) return

        if (existing) {
          safeSetOutputUrl(existing.outputBlobUrl)
          safeSetPhase('done')
          return
        }

        await runGeneration()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        safeSetError(message)
        safeSetPhase('error')
      }
    })()

    return () => {
      mountedRef.current = false
    }
    // vaultAddress and creatorCoinAddress are stable after deploy — deps are
    // intentionally limited to avoid re-triggering on unrelated parent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultAddress, creatorCoinAddress])

  const handleRegenerate = () => {
    setOutputUrl(null)
    setError(null)
    void runGeneration()
  }

  const busy = phase === 'checking' || phase === 'fetching' || phase === 'compositing' || phase === 'saving'

  // The stable canonical image URL that protocols like Uniswap will resolve via
  // the on-chain contractURI(). Always points to api.4626.fun regardless of the
  // underlying Supabase storage URL.
  const canonicalImageUrl = isAddress(vaultAddress)
    ? `https://api.4626.fun/v1/token/${vaultAddress}/image`
    : null

  return (
    <div className="space-y-5">
      {busy ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <svg
            className="h-4 w-4 animate-spin shrink-0 text-brand-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span className="text-sm text-zinc-300">{PHASE_LABEL[phase]}</span>
        </div>
      ) : null}

      {outputUrl ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 overflow-hidden aspect-square max-w-xs mx-auto bg-black/20">
            <img src={outputUrl} alt="Vault icon" className="w-full h-full object-contain" />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 space-y-1">
            <div className="text-xs font-medium text-zinc-400">Permanent image URL</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-zinc-300 font-mono">
                {canonicalImageUrl}
              </code>
              {canonicalImageUrl ? (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(canonicalImageUrl)}
                  className="shrink-0 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Copy
                </button>
              ) : null}
            </div>
            <p className="text-xs text-zinc-600">
              Embedded in your vault's on-chain <code className="text-zinc-500">contractURI()</code> — readable by Uniswap, DEXs, and wallets.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={busy}
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
            >
              Regenerate
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={busy}
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-40"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
