import { readServerEnvVar } from '../infra/serverEnv.js'
import { fetchRemoteAi, prepareRemoteAiText } from '../agentControl/remoteAi.js'

declare const process: { env: Record<string, string | undefined> }

export type ImageEvaluation = {
  insideFrame: number
  frameProminence: number
  subjectProminence: number
  modernElegantStyle: number
  cleanliness: number
  brandFit: number
  pass: boolean
  reasons: string[]
  breakoutApplied?: boolean
}

type GenerateParams = {
  subjectBytes: Uint8Array
  subjectContentType: string
  prompt: string
  previousResponseId?: string | null
}

type EvaluateParams = {
  brief: string
  outputBytes: Uint8Array
  outputContentType: string
  frameBytes: Uint8Array
  frameContentType: string
  subjectBytes: Uint8Array
  subjectContentType: string
}

function parseEnvBool(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function requireOpenAiApiKey(): string {
  const apiKey = readServerEnvVar('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return apiKey
}

function getResponsesModel(): string {
  const configured = String(process.env.OPENAI_RESPONSES_MODEL ?? '').trim()
  return configured || 'gpt-5.4'
}

function getOpenAiImageTimeoutMs(): number {
  const raw = Number(String(process.env.OPENAI_IMAGE_TIMEOUT_MS ?? '').trim())
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return 45_000
}

export function shouldRunImageEvaluation(): boolean {
  return parseEnvBool(process.env.OPENAI_IMAGE_EVAL_ENABLED)
}

function toDataUrl(bytes: Uint8Array, contentType: string): string {
  return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
}

async function postResponsesApi(body: Record<string, unknown>): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getOpenAiImageTimeoutMs())
  try {
    const response = await fetchRemoteAi('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireOpenAiApiKey()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`openai_responses_failed(${response.status}): ${text || 'unknown_error'}`)
    }

    return await response.json()
  } catch (error) {
    const name = String((error as any)?.name ?? '')
    const message = error instanceof Error ? error.message : String(error ?? '')
    const lower = message.toLowerCase()
    if (name === 'AbortError' || lower.includes('aborted')) {
      throw new Error('Image generation timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function getStyleDirections(stylePreset: string | null | undefined): string[] {
  switch (stylePreset) {
    case 'luxury_tech':
      return ['luxury-tech', 'sleek', 'high-end', 'refined lighting', 'clean geometry']
    case 'minimal':
      return ['minimal', 'clean', 'reduced detail', 'simple background', 'strong silhouette']
    case 'modern_elegant':
    default:
      return ['modern', 'elegant', 'premium', 'minimal', 'dark negative space', 'subtle blue glow', 'clean contrast']
  }
}

export function buildImageGenerationPrompt(input: {
  instruction: string
  stylePreset?: string | null
  brandContext?: string[]
  retryReasons?: string[]
}): string {
  const instruction = String(input.instruction ?? '').trim()
  const brandContext = Array.isArray(input.brandContext) && input.brandContext.length > 0
    ? input.brandContext.join(', ')
    : 'token icon'
  const styleDirections = getStyleDirections(input.stylePreset ?? null).join(', ')
  const retryReasons = Array.isArray(input.retryReasons) && input.retryReasons.length > 0
    ? `\nCorrections for this retry:\n- ${input.retryReasons.join('\n- ')}`
    : ''

  return [
    'Generate premium inner artwork using the subject reference for a fixed frame layout that is rendered later in code.',
    instruction,
    'The frame layout is fixed and rendered in code.',
    'Generate premium inner artwork only inside that fixed layout.',
    'Use a dark background with clean negative space and a centered subject.',
    'Keep the subject iconic, token-like, and compositionally clean.',
    'Do not redraw, restyle, or redesign the frame.',
    `Style direction: ${styleDirections}.`,
    `Brand feel: ${brandContext}.`,
    'Avoid: text, clutter, extra symbols, busy background, collage feel, cartoon styling.',
    'Output a single square icon.',
    retryReasons,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function generateImageWithOpenAi(params: GenerateParams): Promise<{
  responseId: string
  revisedPrompt: string | null
  imageBytes: Uint8Array
}> {
  const safePrompt = prepareRemoteAiText(params.prompt, {
    maxStringLength: 3_500,
    maskAddresses: true,
  })
  const json = await postResponsesApi({
    model: getResponsesModel(),
    previous_response_id: params.previousResponseId ?? undefined,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: safePrompt },
          { type: 'input_image', image_url: toDataUrl(params.subjectBytes, params.subjectContentType) },
        ],
      },
    ],
    tools: [
      {
        type: 'image_generation',
        action: 'edit',
        input_fidelity: 'high',
        size: '1024x1024',
        quality: 'high',
        background: 'opaque',
      },
    ],
    tool_choice: { type: 'image_generation' },
  })

  const imageCall = Array.isArray(json?.output)
    ? json.output.find((item: any) => item?.type === 'image_generation_call')
    : null
  const imageBase64 = typeof imageCall?.result === 'string' ? imageCall.result : ''
  if (!imageBase64) throw new Error('openai_image_generation_missing_result')

  return {
    responseId: String(json?.id ?? ''),
    revisedPrompt: imageCall?.revised_prompt ? String(imageCall.revised_prompt) : null,
    imageBytes: new Uint8Array(Buffer.from(imageBase64, 'base64')),
  }
}

function extractOutputText(json: any): string {
  const outputs = Array.isArray(json?.output) ? json.output : []
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const entry of content) {
      if (entry?.type === 'output_text' && typeof entry?.text === 'string') return entry.text
    }
  }
  throw new Error('openai_evaluation_missing_text')
}

function parseEvaluationJson(text: string): ImageEvaluation {
  const raw = String(text ?? '').trim()
  try {
    return JSON.parse(raw) as ImageEvaluation
  } catch {
    const firstBrace = raw.indexOf('{')
    const lastBrace = raw.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as ImageEvaluation
    }
    throw new Error('openai_evaluation_invalid_json')
  }
}

export async function evaluateImageGenerationOutput(params: EvaluateParams): Promise<ImageEvaluation> {
  const safeBrief = prepareRemoteAiText(params.brief, {
    maxStringLength: 2_000,
    maskAddresses: true,
  })
  const rubricPrompt = [
    'You are evaluating whether a generated token icon matches the brief.',
    `Original brief: ${safeBrief}`,
    'Image 1 is the generated output.',
    'Image 2 is the locked frame reference for layout context only.',
    'Image 3 is the subject reference.',
    'Focus on subject fit and composition inside the fixed layout.',
    'Focus on whether the inner artwork looks premium and modern.',
    'Focus on whether the background is dark, clean, and uncluttered.',
    'Use frameProminence to score breakout naturalness only when breakout is present.',
    'If breakout is present, score whether it feels subtle and natural.',
    'If breakout is not present, use frameProminence to score whether the composition feels restrained and well-balanced within the fixed layout.',
    'Do not judge whether the model preserved, recreated, or emphasized the frame itself.',
    'Return strict JSON only with keys: insideFrame, frameProminence, subjectProminence, modernElegantStyle, cleanliness, brandFit, pass, reasons.',
  ].join('\n')

  const json = await postResponsesApi({
    model: getResponsesModel(),
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: rubricPrompt },
          { type: 'input_image', image_url: toDataUrl(params.outputBytes, params.outputContentType) },
          { type: 'input_image', image_url: toDataUrl(params.frameBytes, params.frameContentType) },
          { type: 'input_image', image_url: toDataUrl(params.subjectBytes, params.subjectContentType) },
        ],
      },
    ],
  })

  return parseEvaluationJson(extractOutputText(json))
}

export function getRetryReasonsFromEvaluation(evaluation: ImageEvaluation): string[] {
  const reasons: string[] = []

  if (evaluation.insideFrame < 4) {
    reasons.push('Improve subject composition so the main subject sits cleanly inside the fixed layout.')
  }
  if (evaluation.frameProminence < 4) {
    reasons.push(
      evaluation.breakoutApplied === true
        ? 'If breakout is used, keep it subtle and anatomically natural.'
        : 'Keep the composition more restrained and well-balanced within the fixed layout.',
    )
  }
  if (evaluation.subjectProminence < 4) {
    reasons.push('Improve subject composition so it feels properly centered and sized within the fixed layout.')
  }
  if (evaluation.modernElegantStyle < 4) {
    reasons.push('Make the inner artwork feel more premium, refined, and modern.')
  }
  if (evaluation.cleanliness < 4) {
    reasons.push('Darken and simplify the background so the artwork feels cleaner.')
  }
  if (evaluation.brandFit < 4) {
    reasons.push('Make the result feel more like a polished creator coin or vault icon.')
  }

  return reasons
}
