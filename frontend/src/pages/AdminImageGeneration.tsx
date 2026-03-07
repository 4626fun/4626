import { useEffect, useMemo, useState } from 'react'

import {
  createImageGenerationProject,
  enqueueImageGeneration,
  enqueueImageRefine,
  getImageGenerationJob,
  getImageGenerationProject,
  uploadImageGenerationAsset,
} from '@/lib/imageGenerationApi'

function latestOutputUrl(project: Awaited<ReturnType<typeof getImageGenerationProject>> | null): string | null {
  if (!project?.assets?.length) return null
  return project.assets.find((asset) => asset.role === 'output')?.blobUrl ?? null
}

export function AdminImageGeneration() {
  const [instruction, setInstruction] = useState('Put the dog inside the blue square. Keep it modern, elegant, and premium.')
  const [refineInstruction, setRefineInstruction] = useState('')
  const [frameFile, setFrameFile] = useState<File | null>(null)
  const [subjectFile, setSubjectFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string>('idle')
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!jobId || !projectId) return
    let cancelled = false
    const poll = async () => {
      try {
        const job = await getImageGenerationJob(jobId)
        if (cancelled) return
        setJobStatus(job.status)
        if (job.status === 'completed' || job.status === 'failed') {
          const project = await getImageGenerationProject(projectId)
          if (cancelled) return
          setOutputUrl(latestOutputUrl(project))
          if (job.status === 'failed') {
            setError(job.latestError ?? 'Image generation failed')
          }
          return
        }
        window.setTimeout(() => {
          void poll()
        }, 1500)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [jobId, projectId])

  const canGenerate = Boolean(frameFile && subjectFile && instruction.trim()) && !busy
  const canRefine = Boolean(projectId && refineInstruction.trim()) && !busy

  const statusLabel = useMemo(() => {
    switch (jobStatus) {
      case 'pending':
        return 'Queued'
      case 'processing':
        return 'Generating'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      default:
        return 'Idle'
    }
  }, [jobStatus])

  const handleGenerate = async () => {
    if (!frameFile || !subjectFile || !instruction.trim()) return
    setBusy(true)
    setError(null)
    setOutputUrl(null)
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
      setJobStatus(job.status)
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
    try {
      const job = await enqueueImageRefine({
        projectId,
        refineInstruction: refineInstruction.trim(),
      })
      setJobId(job.id)
      setJobStatus(job.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-black/30 p-6 space-y-5">
        <div className="space-y-2">
          <h1 className="font-display text-2xl text-white">Reference-guided image composition</h1>
          <p className="text-sm text-zinc-400">
            Upload the frame and subject references, generate one square image, then refine from the last result.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
            <div className="text-sm font-medium text-zinc-100">Vault / frame reference</div>
            <input type="file" accept="image/*" onChange={(event) => setFrameFile(event.target.files?.[0] ?? null)} />
            <div className="text-xs text-zinc-500">{frameFile?.name ?? 'No file selected'}</div>
          </label>

          <label className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
            <div className="text-sm font-medium text-zinc-100">Token mascot / subject reference</div>
            <input type="file" accept="image/*" onChange={(event) => setSubjectFile(event.target.files?.[0] ?? null)} />
            <div className="text-xs text-zinc-500">{subjectFile?.name ?? 'No file selected'}</div>
          </label>
        </div>

        <label className="block space-y-2">
          <div className="text-sm font-medium text-zinc-100">Instruction</div>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={5}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-500">Status: {statusLabel}</div>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            className="inline-flex items-center justify-center rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-sm text-zinc-100 disabled:opacity-50"
          >
            {busy ? 'Working...' : 'Generate'}
          </button>
        </div>

        {error ? <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg text-white">Output</h2>
            <p className="text-sm text-zinc-500">One output at a time, with a single refine box underneath.</p>
          </div>
          {projectId ? <div className="text-xs text-zinc-500">Project: {projectId}</div> : null}
        </div>

        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 min-h-[18rem] flex items-center justify-center overflow-hidden">
          {outputUrl ? (
            <img src={outputUrl} alt="Generated output" className="h-full w-full object-contain" />
          ) : (
            <div className="text-sm text-zinc-500">Generated image will appear here.</div>
          )}
        </div>

        <label className="block space-y-2">
          <div className="text-sm font-medium text-zinc-100">Refine output</div>
          <textarea
            value={refineInstruction}
            onChange={(event) => setRefineInstruction(event.target.value)}
            rows={3}
            placeholder="Make the glow subtler. Keep the dog centered."
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleRefine()}
            disabled={!canRefine}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 disabled:opacity-50"
          >
            Submit refine
          </button>
        </div>
      </section>
    </div>
  )
}

export default AdminImageGeneration
