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
}

type GenerateParams = {
  frameBytes: Uint8Array
  frameContentType: string
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

function requireOpenAiApiKey(): string {
  const apiKey = String(process.env.OPENAI_API_KEY ?? '').trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return apiKey
}

function getResponsesModel(): string {
  const configured = String(process.env.OPENAI_RESPONSES_MODEL ?? '').trim()
  return configured || 'gpt-5.4'
}

function toDataUrl(bytes: Uint8Array, contentType: string): string {
  return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
}

async function postResponsesApi(body: Record<string, unknown>): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireOpenAiApiKey()}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`openai_responses_failed(${response.status}): ${text || 'unknown_error'}`)
  }

  return await response.json()
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
    'Edit the first reference image by placing the subject from the second reference image inside the main frame while preserving the frame as the dominant visual identity.',
    instruction,
    'Keep the rounded square or frame as the dominant shape.',
    'Center the subject and keep it iconic, token-like, and compositionally clean.',
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
  const json = await postResponsesApi({
    model: getResponsesModel(),
    previous_response_id: params.previousResponseId ?? undefined,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: params.prompt },
          { type: 'input_image', image_url: toDataUrl(params.frameBytes, params.frameContentType) },
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

export async function evaluateImageGenerationOutput(params: EvaluateParams): Promise<ImageEvaluation> {
  const rubricPrompt = [
    'You are evaluating whether a generated token icon matches the brief.',
    `Original brief: ${params.brief}`,
    'Image 1 is the generated output.',
    'Image 2 is the frame reference.',
    'Image 3 is the subject reference.',
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

  return JSON.parse(extractOutputText(json)) as ImageEvaluation
}

export function getRetryReasonsFromEvaluation(evaluation: ImageEvaluation): string[] {
  const reasons = [...evaluation.reasons]

  if (evaluation.insideFrame < 4) {
    reasons.push('The subject must be fully contained within the main frame.')
  }
  if (evaluation.frameProminence < 4) {
    reasons.push('Make the frame more visually dominant.')
  }
  if (evaluation.subjectProminence < 4) {
    reasons.push('Scale the subject slightly larger and keep it centered.')
  }
  if (evaluation.modernElegantStyle < 4) {
    reasons.push('Increase the modern elegant premium feel.')
  }
  if (evaluation.cleanliness < 4) {
    reasons.push('Simplify and darken the background.')
  }
  if (evaluation.brandFit < 4) {
    reasons.push('Make the result feel more like a polished creator coin or vault icon.')
  }

  return reasons
}
