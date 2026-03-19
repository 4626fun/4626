import { apiFetch } from './apiBase'

type ProjectStatus = 'draft' | 'queued' | 'generating' | 'evaluating' | 'completed' | 'failed'
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ImageGenerationProject = {
  id: string
  status: ProjectStatus
  assets?: Array<{
    id: string
    role: 'frame' | 'subject' | 'output'
    blobUrl: string
    mimeType: string
    filename: string | null
  }>
  attempts?: Array<{
    id: string
    score: number | null
    passed: boolean | null
  }>
}

export type ImageGenerationJob = {
  id: string
  status: JobStatus
  latestError?: string | null
}

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json()
  if (!response.ok || json?.success !== true) {
    throw new Error(String(json?.error ?? 'Request failed'))
  }
  return json.data as T
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary)
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  return bytesToBase64(new Uint8Array(buffer))
}

export async function createImageGenerationProject(input: {
  instruction: string
  stylePreset?: string | null
  brandContext?: string[]
}): Promise<ImageGenerationProject> {
  const response = await apiFetch('/api/image/projects/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await readJson<{ project: ImageGenerationProject }>(response)
  return data.project
}

export async function uploadImageGenerationAsset(input: {
  projectId: string
  role: 'frame' | 'subject'
  file: File
}): Promise<void> {
  const dataBase64 = await fileToBase64(input.file)
  const response = await apiFetch('/api/image/projects/assets/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: input.projectId,
      role: input.role,
      filename: input.file.name,
      contentType: input.file.type || 'application/octet-stream',
      dataBase64,
    }),
  })
  await readJson<{ asset: unknown }>(response)
}

export async function enqueueImageGeneration(projectId: string): Promise<ImageGenerationJob> {
  const response = await apiFetch('/api/image/projects/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
  const data = await readJson<{ job: ImageGenerationJob }>(response)
  return data.job
}

export async function enqueueImageRefine(input: {
  projectId: string
  refineInstruction: string
}): Promise<ImageGenerationJob> {
  const response = await apiFetch('/api/image/projects/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await readJson<{ job: ImageGenerationJob }>(response)
  return data.job
}

export async function getImageGenerationJob(jobId: string): Promise<ImageGenerationJob> {
  const response = await apiFetch(`/api/image/jobs/status?jobId=${encodeURIComponent(jobId)}`)
  const data = await readJson<{ job: ImageGenerationJob }>(response)
  return data.job
}

export async function getImageGenerationProject(projectId: string): Promise<ImageGenerationProject> {
  const response = await apiFetch(`/api/image/projects/get?projectId=${encodeURIComponent(projectId)}`)
  const data = await readJson<{ project: ImageGenerationProject }>(response)
  return data.project
}

export async function directComposeProject(projectId: string): Promise<{
  outputBlobUrl: string
  breakoutApplied: boolean
}> {
  const response = await apiFetch('/api/image/projects/direct-compose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
  const data = await readJson<{ outputBlobUrl: string; breakoutApplied: boolean }>(response)
  return data
}

export async function autoProvisionProjectAssets(input: {
  projectId: string
  creatorCoinAddress: string
  chainId?: number
}): Promise<{ subjectImageUrl: string }> {
  const response = await apiFetch('/api/image/projects/auto-assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await readJson<{ subjectImageUrl: string }>(response)
  return data
}

export async function getVaultImage(vaultAddress: string): Promise<{
  outputBlobUrl: string
} | null> {
  const response = await apiFetch(
    `/api/image/projects/vault-image?vaultAddress=${encodeURIComponent(vaultAddress)}`,
  )
  const data = await readJson<{ outputBlobUrl: string } | null>(response)
  return data
}
export async function associateImageProjectToVault(input: {
  projectId: string
  vaultAddress: string
}): Promise<void> {
  const response = await apiFetch('/api/image/projects/associate-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  await readJson<{ projectId: string; vaultAddress: string }>(response)
}
