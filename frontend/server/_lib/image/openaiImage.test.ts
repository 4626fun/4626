import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

import { applyEnv } from '../../../api/__tests__/helpers'

let MIN_PNG_BYTES: Uint8Array

describe('openai image generation', () => {
  let restoreEnv: (() => void) | null = null

  beforeAll(async () => {
    MIN_PNG_BYTES = new Uint8Array(
      await sharp({
        create: {
          width: 64,
          height: 64,
          channels: 3,
          background: { r: 120, g: 80, b: 40 },
        },
      })
        .png()
        .toBuffer(),
    )
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    restoreEnv = applyEnv({
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_IMAGE_MODEL: 'gpt-image-1',
      OPENAI_RESPONSES_MODEL: 'gpt-5.4',
      OPENAI_IMAGE_EVAL_ENABLED: 'false',
      OPENAI_IMAGE_BREAKOUT_SECOND_PASS: 'false',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('builds the neon breakout edit prompt template', async () => {
    const { buildNeonBreakoutEditPrompt } = await import('./openaiImage.ts')

    const prompt = buildNeonBreakoutEditPrompt()

    expect(prompt).toContain('Edit the first image as the main target')
    expect(prompt).toContain('Use the second image only as a framing/style reference')
    expect(prompt).toContain('Make the top of the subject break out above the top edge of the frame')
    expect(prompt).toContain('Do not add text')
  })

  it('builds a structured edit prompt from project inputs', async () => {
    const { buildImageGenerationPrompt } = await import('./openaiImage.ts')

    const prompt = buildImageGenerationPrompt({
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin', 'ERC-4626 vault icon'],
    })

    expect(prompt).toContain('Project instruction: Put the dog inside the blue square.')
    expect(prompt).toContain('Edit the first image as the main target')
    expect(prompt).toContain('Make the top of the subject break out above the top edge of the frame')
  })

  it('calls the Images Edit API with target and reference images', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            b64_json: Buffer.from('fake-png').toString('base64'),
            revised_prompt: 'Revised prompt',
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { generateImageWithOpenAi } = await import('./openaiImage.ts')
    const result = await generateImageWithOpenAi({
      targetBytes: new Uint8Array(MIN_PNG_BYTES),
      targetContentType: 'image/png',
      referenceBytes: new Uint8Array(MIN_PNG_BYTES),
      referenceContentType: 'image/png',
      prompt: 'Generate the icon.',
      runBreakoutEnhancementPass: false,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fetchCalls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>
    expect(fetchCalls[0]?.[0]).toBe('https://api.openai.com/v1/images/edits')
    const requestInit = fetchCalls[0]?.[1]
    expect(requestInit?.method).toBe('POST')
    expect(requestInit?.body).toBeInstanceOf(FormData)
    const form = requestInit?.body as FormData
    expect(form.get('model')).toBe('gpt-image-1')
    expect(form.get('prompt')).toBe('Generate the icon.')
    expect(form.get('size')).toBe('1024x1024')
    expect(form.get('quality')).toBe('high')
    expect(result.revisedPrompt).toBe('Revised prompt')
    expect(Buffer.from(result.imageBytes).toString()).toBe('fake-png')
    expect(result.breakoutApplied).toBe(true)
  })

  it('runs a second breakout enhancement pass when enabled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ b64_json: Buffer.from('first-pass').toString('base64') }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ b64_json: Buffer.from('second-pass').toString('base64') }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const restoreSecondPass = applyEnv({
      OPENAI_IMAGE_BREAKOUT_SECOND_PASS: 'true',
    })

    try {
      const { generateImageWithOpenAi } = await import('./openaiImage.ts')
      const result = await generateImageWithOpenAi({
        targetBytes: new Uint8Array(MIN_PNG_BYTES),
        targetContentType: 'image/png',
        referenceBytes: new Uint8Array(MIN_PNG_BYTES),
        referenceContentType: 'image/png',
        prompt: 'Generate the icon.',
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      const secondForm = fetchMock.mock.calls[1]?.[1]?.body as FormData
      expect(secondForm.get('prompt')).toBe('Make the breakout more obvious. Keep the frame unchanged.')
      expect(Buffer.from(result.imageBytes).toString()).toBe('second-pass')
    } finally {
      restoreSecondPass()
    }
  })

  it('surfaces a friendly timeout error when image generation exceeds the request budget', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal
      return await new Promise((_resolve, reject) => {
        const onAbort = () => {
          const error = new Error('The operation was aborted')
          ;(error as any).name = 'AbortError'
          reject(error)
        }
        if (signal?.aborted) {
          onAbort()
          return
        }
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const restoreTimeoutEnv = applyEnv({
      OPENAI_IMAGE_TIMEOUT_MS: '5',
    })

    try {
      const { generateImageWithOpenAi } = await import('./openaiImage.ts')
      await expect(
        generateImageWithOpenAi({
          targetBytes: new Uint8Array(MIN_PNG_BYTES),
          targetContentType: 'image/png',
          referenceBytes: new Uint8Array(MIN_PNG_BYTES),
          referenceContentType: 'image/png',
          prompt: 'Generate the icon.',
          runBreakoutEnhancementPass: false,
        }),
      ).rejects.toThrow('Image generation timed out. Please try again.')
    } finally {
      restoreTimeoutEnv()
    }
  })

  it('supports structured evaluation parsing for retry decisions', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  insideFrame: 5,
                  frameProminence: 4,
                  subjectProminence: 4,
                  modernElegantStyle: 5,
                  cleanliness: 4,
                  brandFit: 4,
                  pass: true,
                  reasons: [],
                }),
              },
            ],
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { evaluateImageGenerationOutput } = await import('./openaiImage.ts')
    const evaluation = await evaluateImageGenerationOutput({
      brief: 'Put the dog inside the blue square.',
      outputBytes: new Uint8Array([7, 8, 9]),
      outputContentType: 'image/png',
      frameBytes: new Uint8Array([1, 2, 3]),
      frameContentType: 'image/png',
      subjectBytes: new Uint8Array([4, 5, 6]),
      subjectContentType: 'image/png',
    })

    expect(evaluation.pass).toBe(true)
    expect(evaluation.modernElegantStyle).toBe(5)
  })

  it('extracts JSON evaluation payloads from wrapped model text', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: `Here is the result:\n${JSON.stringify({
                  insideFrame: 4,
                  frameProminence: 4,
                  subjectProminence: 4,
                  modernElegantStyle: 4,
                  cleanliness: 4,
                  brandFit: 4,
                  pass: true,
                  reasons: [],
                })}`,
              },
            ],
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { evaluateImageGenerationOutput } = await import('./openaiImage.ts')
    const evaluation = await evaluateImageGenerationOutput({
      brief: 'Put the dog inside the blue square.',
      outputBytes: new Uint8Array([7, 8, 9]),
      outputContentType: 'image/png',
      frameBytes: new Uint8Array([1, 2, 3]),
      frameContentType: 'image/png',
      subjectBytes: new Uint8Array([4, 5, 6]),
      subjectContentType: 'image/png',
    })

    expect(evaluation.pass).toBe(true)
    expect(evaluation.insideFrame).toBe(4)
  })

  it('focuses evaluation and retries on breakout, frame style, and subject preservation', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  insideFrame: 3,
                  frameProminence: 2,
                  subjectProminence: 3,
                  modernElegantStyle: 2,
                  cleanliness: 2,
                  brandFit: 3,
                  pass: false,
                  reasons: [],
                }),
              },
            ],
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { evaluateImageGenerationOutput, getRetryReasonsFromEvaluation } = await import('./openaiImage.ts')
    const evaluation = await evaluateImageGenerationOutput({
      brief: 'Create premium share token artwork for the dog icon.',
      outputBytes: new Uint8Array([7, 8, 9]),
      outputContentType: 'image/png',
      frameBytes: new Uint8Array([1, 2, 3]),
      frameContentType: 'image/png',
      subjectBytes: new Uint8Array([4, 5, 6]),
      subjectContentType: 'image/png',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fetchCalls = fetchMock.mock.calls as unknown as Array<[string, { body?: string }?]>
    const requestBody = JSON.parse(String(fetchCalls[0]?.[1]?.body ?? '{}'))
    const rubricPrompt = String(requestBody?.input?.[0]?.content?.[0]?.text ?? '')
    expect(rubricPrompt).toContain('Focus on whether the top of the subject clearly breaks out above the top edge of the frame.')
    expect(rubricPrompt).toContain('Image 2 is the frame style reference.')

    const retryReasons = getRetryReasonsFromEvaluation(evaluation)
    expect(retryReasons).toContain('Make the top of the subject clearly break out above the top edge of the frame.')
    expect(retryReasons).toContain('Darken the area outside the frame and simplify the background.')
    expect(retryReasons).toContain('Make the result feel more polished, high-contrast, elegant, and modern.')
  })

  it('disables evaluator gating by default for runtime generation', async () => {
    const { shouldRunImageEvaluation } = await import('./openaiImage.ts')

    expect(shouldRunImageEvaluation()).toBe(false)
  })
})
