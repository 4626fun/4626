import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock, updateImageGenerationProjectMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  updateImageGenerationProjectMock: vi.fn(),
}))

vi.mock('./postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('./imageProjects.js', async () => {
  const actual = await vi.importActual<typeof import('./imageProjects.js')>('./imageProjects.js')
  return {
    ...actual,
    updateImageGenerationProject: updateImageGenerationProjectMock,
    getImageGenerationProject: vi.fn(async () => null),
  }
})

function createJobsDb() {
  const jobs = new Map<string, any>()

  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')

      if (text.includes('create table if not exists image_generation_')) return { rows: [] }
      if (text.includes('create index if not exists image_generation_')) return { rows: [] }

      if (text.includes('create table if not exists image_generation_')) return { rows: [] }
      if (text.includes('create index if not exists image_generation_')) return { rows: [] }

      if (text.includes('insert into image_generation_jobs')) {
        const row = {
          id: String(values[0]),
          project_id: String(values[1]),
          kind: String(values[2]),
          status: 'pending',
          refine_instruction: values[3] == null ? null : String(values[3]),
          attempts: 0,
          max_attempts: 3,
          latest_error: null,
          result_json: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: null,
        }
        jobs.set(row.id, row)
        return { rows: [row] }
      }

      if (text.includes('select * from image_generation_jobs')) {
        const jobId = String(values[0] ?? '')
        const row = jobs.get(jobId)
        return { rows: row ? [row] : [] }
      }

      if (text.includes('update image_generation_jobs')) {
        const status = values[0] == null ? null : String(values[0])
        const latestError = values[1] == null ? null : String(values[1])
        const resultJson = values[2] ? JSON.parse(String(values[2])) : null
        const completed = Boolean(values[3])
        const jobId = String(values[4] ?? '')
        const row = jobs.get(jobId)
        if (row) {
          if (status) row.status = status
          row.latest_error = latestError
          row.result_json = resultJson
          row.updated_at = new Date().toISOString()
          if (completed) row.completed_at = new Date().toISOString()
        }
        return { rows: [] }
      }

      throw new Error(`Unhandled SQL: ${text}`)
    }),
    jobs,
  }
}

describe('image generation jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enqueues a pending job and marks the project queued', async () => {
    const db = createJobsDb()
    getDbMock.mockResolvedValue(db)

    const { enqueueImageGenerationJob } = await import('./imageGenerationJobs.ts')
    const job = await enqueueImageGenerationJob({
      projectId: 'proj_123',
      kind: 'generate',
    })

    expect(job.status).toBe('pending')
    expect(updateImageGenerationProjectMock).toHaveBeenCalledWith({
      projectId: 'proj_123',
      status: 'queued',
      latestError: null,
    })
  })

  it('reads job status snapshots by id', async () => {
    const db = createJobsDb()
    getDbMock.mockResolvedValue(db)

    const { enqueueImageGenerationJob, getImageGenerationJob } = await import('./imageGenerationJobs.ts')
    const job = await enqueueImageGenerationJob({
      projectId: 'proj_123',
      kind: 'refine',
      refineInstruction: 'Make the glow subtler.',
    })

    const snapshot = await getImageGenerationJob(job.id)

    expect(snapshot?.id).toBe(job.id)
    expect(snapshot?.kind).toBe('refine')
    expect(snapshot?.refineInstruction).toBe('Make the glow subtler.')
  })
})
