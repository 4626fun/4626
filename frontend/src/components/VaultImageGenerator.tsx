import { useEffect, useMemo, useState } from 'react'

import {
  associateImageProjectToVault,
  createImageGenerationProject,
  enqueueImageGeneration,
  enqueueImageRefine,
  getImageGenerationJob,
  getImageGenerationProject,
  uploadImageGenerationAsset,
} from '@/lib/imageGenerationApi'

type Props = {
  vaultAddress: string
  tokenSymbol?: string
}

type JobStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed'

function latestOutputUrl(project: Awaited<ReturnType<typeof getImageGenerationProject>> | null): string | null {
  if (!project?.assets?.length) return null
  return project.assets.find((a) => a.role === 'output')?.blobUrl ?? null
}

export function VaultImageGenerator({ vaultAddress, tokenSymbol }: Props) {
  const defaultInstruction = tokenSymbol
    ? `Create a premium vault token icon for $${tokenSymbol}. Place the subject inside the branded frame. Modern, elegant, high contrast.`
    : 'Create a premium vault token icon. Place the subject inside the branded frame. Modern, elegant, high contrast.'

  const [instruction, setInstruction] = useState(defaultInstruction)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [frameFile, setFrameFile] = useState<File | null>(null)
  const [subjectFile, setSubjectFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle')
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!jobId || !projectId) return
    let cancelled = false

    const poll = async () => {
      try {
        const job = await getImageGenerationJob(jobId)
        if (cancelled) return
        setJobStatus(job.status as JobStatus)
        if (job.status === 'completed' || job.status === 'failed') {
          const project = await getImageGenerationProject(projectId)
          if (cancelled) return
          setOutputUrl(latestOutputUrl(project))
          if (job.status === 'failed') setError(job.latestError ?? 'Generation failed')
          return
        }
        window.setTimeout(() => { void poll() }, 1500)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }

    void poll()
    return () => { cancelled = true }
  }, [jobId, projectId])

  const canGenerate = Boolean(frameFile && subjectFile && instruction.trim()) && !busy
  const canRefine = Boolean(projectId && refineInstruction.trim()) && !busy && jobStatus === 'completed'
  const canSave = Boolean(projectId && outputUrl && !saved) && !busy && jobStatus === 'completed'

  const statusLabel = useMemo(() => {
    switch (jobStatus) {
      case 'pending': return 'Queued…'
      case 'processing': return 'Generating…'
      case 'completed': return 'Done'
      case 'failed': return 'Failed'
      default: return null
    }
  }, [jobStatus])

  const handleGenerate = async () => {
    if (!frameFile || !subjectFile) return
    setBusy(true)
    setError(null)
    setOutputUrl(null)
    setSaved(false)
    try {
      const project = await createImageGenerationProject({
        instruction: instruction.trim(),
        stylePreset: 'modern_elegant',
        brandContext: ['creator coin', 'ERC-4626 vault icon', 'token icon'],
      })
      setProjectId(project.id)
      await uploadImageGenerationAsset({ projectId: project.id, role: 'frame', file: frameFile })
      await uploadImageGenerationAsset({ projectId: project.id, role: 'subject', file: subjectFile })
      const job = await enqueueImageGeneration(project.id)
      setJobId(job.id)
      setJobStatus(job.status as JobStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRefine = async () => {
    if (!projectId || !refineInstruction.trim()) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const job = await enqueueImageRefine({ projectId, refineInstruction: refineInstruction.trim() })
      setJobId(job.id)
      setJobStatus(job.status as JobStatus)
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2 cursor-pointer">
          <div className="text-sm font-medium text-zinc-100">Frame reference</div>
          <div className="text-xs text-zinc-500">Your vault border / frame template</div>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFrameFile(e.target.files?.[0] ?? null)} />
          <div className="text-xs text-zinc-400 truncate">{frameFile?.name ?? 'Click to upload'}</div>
        </label>

        <label className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2 cursor-pointer">
          <div className="text-sm font-medium text-zinc-100">Subject reference</div>
          <div className="text-xs text-zinc-500">Your mascot, photo, or logo</div>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => setSubjectFile(e.target.files?.[0] ?? null)} />
          <div className="text-xs text-zinc-400 truncate">{subjectFile?.name ?? 'Click to upload'}</div>
        </label>
      </div>

      <label className="block space-y-1.5">
        <div className="text-xs font-medium text-zinc-400">Instruction</div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 resize-none"
        />
      </label>

      <div className="flex items-center justify-between gap-4">
        {statusLabel ? (
          <span className="text-xs text-zinc-500">{statusLabel}</span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!canGenerate}
          className="inline-flex items-center justify-center rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-sm text-zinc-100 disabled:opacity-40"
        >
          {busy && jobStatus === 'idle' ? 'Starting…' : 'Generate'}
        </button>
      </div>

      {outputUrl ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 overflow-hidden aspect-square max-w-xs mx-auto bg-black/20">
            <img src={outputUrl} alt="Generated vault icon" className="w-full h-full object-contain" />
          </div>

          <label className="block space-y-1.5">
            <div className="text-xs font-medium text-zinc-400">Refine (optional)</div>
            <textarea
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              rows={2}
              placeholder="Make the glow subtler. Center the subject more."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 resize-none"
            />
          </label>

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => void handleRefine()}
              disabled={!canRefine}
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-40"
            >
              Refine
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave}
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
