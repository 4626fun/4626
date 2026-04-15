import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'

describe('openai image generation', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    restoreEnv = applyEnv({
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_RESPONSES_MODEL: 'gpt-5.4',
      OPENAI_IMAGE_EVAL_ENABLED: 'false',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('builds a structured edit prompt from project inputs', async () => {
    const { buildImageGenerationPrompt } = await import('./openaiImage.ts')

    const prompt = buildImageGenerationPrompt({
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin', 'ERC-4626 vault icon'],
    })

    expect(prompt).not.toContain('Edit the first reference image')
    expect(prompt).not.toContain('using the subject from the second reference image')
    expect(prompt).toContain('Put the dog inside the blue square.')
    expect(prompt).toContain('creator coin, ERC-4626 vault icon')
    expect(prompt).toContain('Avoid: text, clutter')
  })

  it('builds a prompt for premium inner artwork within a fixed frame layout', async () => {
    const { buildImageGenerationPrompt } = await import('./openaiImage.ts')

    const prompt = buildImageGenerationPrompt({
      instruction: 'Put the dog inside the blue square.',
      stylePreset: 'modern_elegant',
      brandContext: ['creator coin', 'ERC-4626 vault icon'],
    })

    expect(prompt).not.toContain('preserving the frame as the dominant visual identity')
    expect(prompt).not.toContain('Keep the rounded square or frame as the dominant shape.')
    expect(prompt).toContain('The frame layout is fixed and rendered in code.')
    expect(prompt).toContain('Generate premium inner artwork only inside that fixed layout.')
    expect(prompt).toContain('Use a dark background with clean negative space and a centered subject.')
    expect(prompt).toContain('Do not redraw, restyle, or redesign the frame.')
  })

  it('calls the Responses API image_generation tool and decodes PNG bytes', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'resp_123',
        output: [
          {
            type: 'image_generation_call',
            result: Buffer.from('fake-png').toString('base64'),
            revised_prompt: 'Revised prompt',
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { generateImageWithOpenAi } = await import('./openaiImage.ts')
    const result = await generateImageWithOpenAi({
      subjectBytes: new Uint8Array([4, 5, 6]),
      subjectContentType: 'image/png',
      prompt: 'Generate the icon.',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fetchCalls = fetchMock.mock.calls as unknown as Array<[string, { body?: string }?]>
    const requestBody = JSON.parse(String(fetchCalls[0]?.[1]?.body ?? '{}'))
    const content = requestBody?.input?.[0]?.content ?? []
    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'input_text', text: 'Generate the icon.' })
    expect(content[1]).toEqual({
      type: 'input_image',
      image_url: `data:image/png;base64,${Buffer.from([4, 5, 6]).toString('base64')}`,
    })
    expect(result.responseId).toBe('resp_123')
    expect(result.revisedPrompt).toBe('Revised prompt')
    expect(Buffer.from(result.imageBytes).toString()).toBe('fake-png')
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
          subjectBytes: new Uint8Array([4, 5, 6]),
          subjectContentType: 'image/png',
          prompt: 'Generate the icon.',
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

  it('focuses evaluation and retries on composition, premium treatment, and clean darkness instead of frame preservation', async () => {
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
      brief: 'Create premium inner artwork for the dog token icon.',
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
    expect(rubricPrompt).toContain('Focus on subject fit and composition inside the fixed layout.')
    expect(rubricPrompt).toContain('Focus on whether the inner artwork looks premium and modern.')
    expect(rubricPrompt).toContain('Focus on whether the background is dark, clean, and uncluttered.')
    expect(rubricPrompt).toContain('Use frameProminence to score breakout naturalness only when breakout is present.')
    expect(rubricPrompt).toContain('If breakout is present, score whether it feels subtle and natural.')
    expect(rubricPrompt).toContain('If breakout is not present, use frameProminence to score whether the composition feels restrained and well-balanced within the fixed layout.')
    expect(rubricPrompt).toContain('Do not judge whether the model preserved, recreated, or emphasized the frame itself.')
    expect(rubricPrompt).not.toContain('Image 2 is the frame reference.')

    const retryReasons = getRetryReasonsFromEvaluation(evaluation)
    expect(retryReasons).toContain('Improve subject composition so it feels properly centered and sized within the fixed layout.')
    expect(retryReasons).toContain('Darken and simplify the background so the artwork feels cleaner.')
    expect(retryReasons).toContain('Make the inner artwork feel more premium, refined, and modern.')
    expect(retryReasons).toContain('Keep the composition more restrained and well-balanced within the fixed layout.')
    expect(retryReasons).not.toContain('Make the frame more visually dominant.')
  })

  it('uses breakout-specific retry guidance only when breakout was applied', async () => {
    const { getRetryReasonsFromEvaluation } = await import('./openaiImage.ts')

    const noBreakoutReasons = getRetryReasonsFromEvaluation({
      insideFrame: 4,
      frameProminence: 2,
      subjectProminence: 4,
      modernElegantStyle: 4,
      cleanliness: 4,
      brandFit: 4,
      pass: false,
      reasons: [],
    })

    expect(noBreakoutReasons).toContain('Keep the composition more restrained and well-balanced within the fixed layout.')
    expect(noBreakoutReasons).not.toContain('If breakout is used, keep it subtle and anatomically natural.')

    const breakoutReasons = getRetryReasonsFromEvaluation({
      insideFrame: 4,
      frameProminence: 2,
      subjectProminence: 4,
      modernElegantStyle: 4,
      cleanliness: 4,
      brandFit: 4,
      pass: false,
      reasons: [],
      breakoutApplied: true,
    })

    expect(breakoutReasons).toContain('If breakout is used, keep it subtle and anatomically natural.')
    expect(breakoutReasons).not.toContain('Keep the composition more restrained and well-balanced within the fixed layout.')
  })

  it('does not echo stale model reasons into retry guidance', async () => {
    const { getRetryReasonsFromEvaluation } = await import('./openaiImage.ts')

    const retryReasons = getRetryReasonsFromEvaluation({
      insideFrame: 4,
      frameProminence: 2,
      subjectProminence: 3,
      modernElegantStyle: 2,
      cleanliness: 2,
      brandFit: 4,
      pass: false,
      reasons: [
        'Make the frame more visually dominant.',
        'Preserve the frame exactly as shown in the reference.',
        'The result should pop more.',
      ],
    })

    expect(retryReasons).toContain('Keep the composition more restrained and well-balanced within the fixed layout.')
    expect(retryReasons).toContain('Improve subject composition so it feels properly centered and sized within the fixed layout.')
    expect(retryReasons).toContain('Make the inner artwork feel more premium, refined, and modern.')
    expect(retryReasons).toContain('Darken and simplify the background so the artwork feels cleaner.')
    expect(retryReasons).not.toContain('Make the frame more visually dominant.')
    expect(retryReasons).not.toContain('Preserve the frame exactly as shown in the reference.')
    expect(retryReasons).not.toContain('The result should pop more.')
  })

  it('disables evaluator gating by default for runtime generation', async () => {
    const { shouldRunImageEvaluation } = await import('./openaiImage.ts')

    expect(shouldRunImageEvaluation()).toBe(false)
  })
})
