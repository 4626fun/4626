import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock, uploadImageStorageObjectMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  uploadImageStorageObjectMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('./imageStorage.js', () => ({
  uploadImageStorageObject: uploadImageStorageObjectMock,
}))

function createImageDb() {
  const projects = new Map<string, any>()
  const assets = new Map<string, any>()
  const attempts = new Map<string, any>()
  const jobs = new Map<string, any>()

  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')

      if (text.includes('create table if not exists image_generation_')) return { rows: [] }
      if (text.includes('create index if not exists image_generation_')) return { rows: [] }
      if (text.includes('alter table image_generation_projects')) return { rows: [] }

      if (text.includes('insert into image_generation_projects')) {
        if (!text.includes('creator_address')) {
          throw new Error('image_generation_projects INSERT must include creator_address column')
        }
        const row = {
          id: String(values[0]),
          owner_address: values[1] == null ? null : String(values[1]),
          status: 'draft',
          instruction: String(values[2] ?? ''),
          style_preset: values[3] == null ? null : String(values[3]),
          brand_context_json: JSON.parse(String(values[4] ?? '[]')),
          last_response_id: null,
          latest_error: null,
          vault_address: null,
          creator_address: values[5] == null ? null : String(values[5]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        projects.set(row.id, row)
        return { rows: [row] }
      }

      if (text.includes('delete from image_generation_assets')) {
        const projectId = String(values[0] ?? '')
        const role = String(values[1] ?? '')
        for (const [id, row] of assets.entries()) {
          if (row.project_id === projectId && row.role === role) assets.delete(id)
        }
        return { rows: [] }
      }

      if (text.includes('insert into image_generation_assets')) {
        const row = {
          id: String(values[0]),
          project_id: String(values[1]),
          role: String(values[2]),
          filename: values[3] == null ? null : String(values[3]),
          mime_type: String(values[4]),
          blob_pathname: String(values[5]),
          blob_url: String(values[6]),
          byte_size: Number(values[7] ?? 0),
          created_at: new Date().toISOString(),
        }
        assets.set(row.id, row)
        return { rows: [row] }
      }

      if (text.includes('insert into image_generation_attempts')) {
        const row = {
          id: String(values[0]),
          project_id: String(values[1]),
          job_id: values[2] == null ? null : String(values[2]),
          attempt_number: Number(values[3] ?? 1),
          kind: String(values[4]),
          prompt: String(values[5]),
          revised_prompt: values[6] == null ? null : String(values[6]),
          response_id: values[7] == null ? null : String(values[7]),
          evaluation_json: values[8] ? JSON.parse(String(values[8])) : null,
          score: values[9] == null ? null : Number(values[9]),
          passed: values[10] == null ? null : Boolean(values[10]),
          output_asset_id: values[11] == null ? null : String(values[11]),
          created_at: new Date().toISOString(),
        }
        attempts.set(row.id, row)
        return { rows: [row] }
      }

      if (text.includes('select * from image_generation_projects')) {
        const projectId = String(values[0] ?? '')
        const row = projects.get(projectId)
        return { rows: row ? [row] : [] }
      }

      if (text.includes('select * from image_generation_assets')) {
        const projectId = String(values[0] ?? '')
        return {
          rows: [...assets.values()]
            .filter((row) => row.project_id === projectId)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        }
      }

      if (text.includes('select * from image_generation_attempts')) {
        const projectId = String(values[0] ?? '')
        return {
          rows: [...attempts.values()]
            .filter((row) => row.project_id === projectId)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        }
      }

      if (text.includes('select * from image_generation_jobs')) {
        const projectId = String(values[0] ?? '')
        return {
          rows: [...jobs.values()]
            .filter((row) => row.project_id === projectId)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, 1),
        }
      }

      if (text.includes('update image_generation_projects')) {
        const status = values[0] == null ? null : String(values[0])
        const lastResponseId = values[1] == null ? null : String(values[1])
        const latestError = values[2] == null ? null : String(values[2])
        const projectId = String(values[3] ?? '')
        const row = projects.get(projectId)
        if (row) {
          if (status) row.status = status
          if (lastResponseId) row.last_response_id = lastResponseId
          row.latest_error = latestError
          row.updated_at = new Date().toISOString()
        }
        return { rows: [] }
      }

      throw new Error(`Unhandled SQL: ${text}`)
    }),
    projects,
    assets,
    attempts,
    jobs,
  }
}

describe('image project storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadImageStorageObjectMock.mockResolvedValue({ url: 'https://supabase.example/frame.png' })
  })

  it('creates draft projects with style metadata', async () => {
    const db = createImageDb()
    getDbMock.mockResolvedValue(db)

    const { createImageGenerationProject } = await import('./imageProjects.ts')
    const project = await createImageGenerationProject({
      ownerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      creatorAddress: '0xB05CF01231CF2FF99499682E64D3780D57C80FDD',
      instruction: 'Put the dog in the square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin', 'vault icon'],
    })

    expect(project.status).toBe('draft')
    expect(project.instruction).toBe('Put the dog in the square.')
    expect(project.stylePreset).toBe('modern_elegant')
    expect(project.brandContext).toEqual(['creator coin', 'vault icon'])
    expect(project.creatorAddress).toBe('0xb05cf01231cf2ff99499682e64d3780d57c80fdd')
  })

  it('uploads reference assets through Supabase storage', async () => {
    const db = createImageDb()
    getDbMock.mockResolvedValue(db)

    const { attachImageGenerationAsset } = await import('./imageProjects.ts')
    const asset = await attachImageGenerationAsset({
      projectId: 'proj_123',
      role: 'frame',
      filename: 'frame.png',
      contentType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    })

    expect(uploadImageStorageObjectMock).toHaveBeenCalled()
    expect(asset.role).toBe('frame')
    expect(asset.blobUrl).toBe('https://supabase.example/frame.png')
    expect(asset.byteSize).toBe(3)
  })

  it('builds project snapshots with assets and attempts', async () => {
    const db = createImageDb()
    getDbMock.mockResolvedValue(db)

    const { createImageGenerationProject, attachImageGenerationAsset, recordImageGenerationAttempt, getImageGenerationProject } =
      await import('./imageProjects.ts')

    const project = await createImageGenerationProject({
      ownerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      instruction: 'Put the dog in the square.',
    })

    await attachImageGenerationAsset({
      projectId: project.id,
      role: 'frame',
      filename: 'frame.png',
      contentType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    })

    await recordImageGenerationAttempt({
      projectId: project.id,
      attemptNumber: 1,
      kind: 'generate',
      prompt: 'Use the frame and subject references.',
      score: 24,
      passed: true,
    })

    const snapshot = await getImageGenerationProject(project.id)

    expect(snapshot?.id).toBe(project.id)
    expect(snapshot?.assets).toHaveLength(1)
    expect(snapshot?.attempts).toHaveLength(1)
    expect(snapshot?.attempts[0]?.score).toBe(24)
  })
})
