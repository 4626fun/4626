import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../api/__tests__/helpers'

describe('openai image generation', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    restoreEnv = applyEnv({
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_RESPONSES_MODEL: 'gpt-5.4',
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

    expect(prompt).toContain('Edit the first reference image')
    expect(prompt).toContain('Put the dog inside the blue square.')
    expect(prompt).toContain('creator coin, ERC-4626 vault icon')
    expect(prompt).toContain('Avoid: text, clutter')
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
      frameBytes: new Uint8Array([1, 2, 3]),
      frameContentType: 'image/png',
      subjectBytes: new Uint8Array([4, 5, 6]),
      subjectContentType: 'image/png',
      prompt: 'Generate the icon.',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.responseId).toBe('resp_123')
    expect(result.revisedPrompt).toBe('Revised prompt')
    expect(Buffer.from(result.imageBytes).toString()).toBe('fake-png')
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
})
