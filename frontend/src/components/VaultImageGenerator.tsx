import { useState } from 'react'

import {
  associateImageProjectToVault,
  autoProvisionProjectAssets,
  createImageGenerationProject,
  directComposeProject,
} from '@/lib/imageGenerationApi'

type Props = {
  vaultAddress: string
  creatorCoinAddress: string
  tokenSymbol?: string
}

export function VaultImageGenerator({ vaultAddress, creatorCoinAddress, tokenSymbol }: Props) {
  const [subjectPreviewUrl, setSubjectPreviewUrl] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApplyFrame = async () => {
    setBusy(true)
    setError(null)
    setOutputUrl(null)
    setSaved(false)
    try {
      const project = await createImageGenerationProject({
        instruction: tokenSymbol ? `Vault icon for $${tokenSymbol}` : 'Vault icon',
        stylePreset: 'modern_elegant',
        brandContext: ['creator coin', 'ERC-4626 vault icon'],
      })
      setProjectId(project.id)

      const { subjectImageUrl } = await autoProvisionProjectAssets({
        projectId: project.id,
        creatorCoinAddress,
      })
      setSubjectPreviewUrl(subjectImageUrl)

      const { outputBlobUrl } = await directComposeProject(project.id)
      setOutputUrl(outputBlobUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    if (!projectId) return
    setBusy(true)
    setError(null)
    try {
      await associateImageProjectToVault({ projectId, vaultAddress })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Asset preview strip */}
      <div className="flex items-center gap-4">
        <div className="flex-1 rounded-xl border border-white/10 bg-black/20 p-3 space-y-1.5">
          <div className="text-xs font-medium text-zinc-400">Frame</div>
          <div className="flex items-center gap-2">
            <img src="/brand/4626fun.svg" alt="4626 frame" className="h-10 w-10 rounded-lg object-contain" />
            <span className="text-xs text-zinc-500">4626 branded frame</span>
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-white/10 bg-black/20 p-3 space-y-1.5">
          <div className="text-xs font-medium text-zinc-400">Subject</div>
          {subjectPreviewUrl ? (
            <div className="flex items-center gap-2">
              <img src={subjectPreviewUrl} alt="Creator coin" className="h-10 w-10 rounded-lg object-cover" />
              <span className="text-xs text-zinc-500">From Zora coin</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 opacity-50">
              <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-zinc-600 text-xs">?</span>
              </div>
              <span className="text-xs text-zinc-600">Auto-fetched from Zora</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleApplyFrame()}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-sm text-zinc-100 disabled:opacity-40"
        >
          {busy ? 'Compositing…' : 'Apply frame'}
        </button>
      </div>

      {outputUrl ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 overflow-hidden aspect-square max-w-xs mx-auto bg-black/20">
            <img src={outputUrl} alt="Vault icon" className="w-full h-full object-contain" />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saved || busy}
              className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-200 disabled:opacity-40"
            >
              {saved ? '✓ Saved as vault icon' : 'Save as vault icon'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}
    </div>
  )
}
