import sharp from 'sharp'

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
  targetBytes: Uint8Array
  targetContentType: string
  referenceBytes: Uint8Array
  referenceContentType: string
  prompt: string
  runBreakoutEnhancementPass?: boolean
}

type ShareTokenNeonBreakoutParams = {
  subjectBytes: Uint8Array
  subjectContentType: string
  frameBytes: Uint8Array
  frameContentType: string
  retryReasons?: string[]
  runBreakoutEnhancementPass?: boolean
}

const SHARE_TOKEN_OUTPUT_SIZE = 1024
const BREAKOUT_ENHANCEMENT_PROMPT =
  'Make the breakout more obvious. Keep the frame unchanged.'

function parseEnvBool(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function requireOpenAiApiKey(): string {
  const apiKey = readServerEnvVar('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return apiKey
}

function getImageEditModel(): string {
  const configured = String(process.env.OPENAI_IMAGE_MODEL ?? '').trim()
  return configured || 'gpt-image-1'
}

function getOpenAiImageTimeoutMs(): number {
  const raw = Number(String(process.env.OPENAI_IMAGE_TIMEOUT_MS ?? '').trim())
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return 45_000
}

export function shouldRunImageEvaluation(): boolean {
  return parseEnvBool(process.env.OPENAI_IMAGE_EVAL_ENABLED)
}

export function shouldRunBreakoutEnhancementPass(): boolean {
  const configured = String(process.env.OPENAI_IMAGE_BREAKOUT_SECOND_PASS ?? '').trim()
  if (configured.length > 0) return parseEnvBool(configured)
  return true
}

export async function cropImageToSquare(bytes: Uint8Array): Promise<Uint8Array> {
  const metadata = await sharp(Buffer.from(bytes)).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const minDim = Math.min(width, height)
  if (minDim <= 0) throw new Error('invalid_image_dimensions')

  if (width === height) {
    return new Uint8Array(
      await sharp(Buffer.from(bytes))
        .png()
        .toBuffer(),
    )
  }

  const left = Math.floor((width - minDim) / 2)
  const top = Math.floor((height - minDim) / 2)
  return new Uint8Array(
    await sharp(Buffer.from(bytes))
      .extract({ left, top, width: minDim, height: minDim })
      .png()
      .toBuffer(),
  )
}

async function normalizeReferenceFrame(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp(Buffer.from(bytes))
      .resize(SHARE_TOKEN_OUTPUT_SIZE, SHARE_TOKEN_OUTPUT_SIZE, { fit: 'fill' })
      .png()
      .toBuffer(),
  )
}

async function normalizeTargetImage(bytes: Uint8Array): Promise<Uint8Array> {
  const squared = await cropImageToSquare(bytes)
  return new Uint8Array(
    await sharp(Buffer.from(squared))
      .resize(SHARE_TOKEN_OUTPUT_SIZE, SHARE_TOKEN_OUTPUT_SIZE, { fit: 'cover' })
      .png()
      .toBuffer(),
  )
}

export function buildNeonBreakoutEditPrompt(retryReasons: string[] = []): string {
  const retryBlock =
    retryReasons.length > 0
      ? `\nCorrections for this retry:\n- ${retryReasons.join('\n- ')}`
      : ''

  return [
    'Edit the first image as the main target. Use the second image only as a framing/style reference.',
    '',
    'Transform the first image into a centered icon-style portrait with a glowing rounded-square frame. Preserve the original subject, pose, expression, clothing, accessories, and key background details.',
    '',
    'Add a thick luminous rounded-square border around the subject, similar to the reference image. The border should have a white-to-electric-blue neon gradient with a soft blue outer glow. Make the area outside the frame dark black with a subtle vignette so the frame feels dramatic and modern.',
    '',
    'Keep the original scene visible inside the frame. Make the top of the subject break out above the top edge of the frame. The breakout should be clear and intentional, with the head/hair/top of the subject extending beyond the frame while the lower body remains inside.',
    '',
    'The final image should be square, polished, high-contrast, elegant, modern, and visually similar to the reference frame style. Do not add text.',
    retryBlock,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildImageGenerationPrompt(input: {
  instruction: string
  stylePreset?: string | null
  brandContext?: string[]
  retryReasons?: string[]
}): string {
  const instruction = String(input.instruction ?? '').trim()
  const retryReasons = Array.isArray(input.retryReasons) ? [...input.retryReasons] : []
  if (instruction) {
    retryReasons.unshift(`Project instruction: ${instruction}`)
  }
  return buildNeonBreakoutEditPrompt(retryReasons)
}

async function postImagesEdit(params: {
  targetBytes: Uint8Array
  referenceBytes: Uint8Array
  prompt: string
}): Promise<{ imageBytes: Uint8Array; revisedPrompt: string | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getOpenAiImageTimeoutMs())

  try {
    const safePrompt = prepareRemoteAiText(params.prompt, {
      maxStringLength: 3_500,
      maskAddresses: true,
    })
    const form = new FormData()
    form.append('model', getImageEditModel())
    form.append(
      'image[]',
      new Blob([Buffer.from(params.targetBytes)], { type: 'image/png' }),
      'target.png',
    )
    form.append(
      'image[]',
      new Blob([Buffer.from(params.referenceBytes)], { type: 'image/png' }),
      'reference.png',
    )
    form.append('prompt', safePrompt)
    form.append('size', `${SHARE_TOKEN_OUTPUT_SIZE}x${SHARE_TOKEN_OUTPUT_SIZE}`)
    form.append('quality', 'high')

    const response = await fetchRemoteAi('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requireOpenAiApiKey()}`,
      },
      body: form,
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`openai_images_edit_failed(${response.status}): ${text || 'unknown_error'}`)
    }

    const json = await response.json()
    const imageBase64 = typeof json?.data?.[0]?.b64_json === 'string' ? json.data[0].b64_json : ''
    if (!imageBase64) throw new Error('openai_image_edit_missing_result')

    return {
      imageBytes: new Uint8Array(Buffer.from(imageBase64, 'base64')),
      revisedPrompt:
        typeof json?.data?.[0]?.revised_prompt === 'string' ? json.data[0].revised_prompt : null,
    }
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

export async function generateImageWithOpenAi(params: GenerateParams): Promise<{
  responseId: string
  revisedPrompt: string | null
  imageBytes: Uint8Array
  breakoutApplied: boolean
}> {
  const targetBytes = await normalizeTargetImage(params.targetBytes)
  const referenceBytes = await normalizeReferenceFrame(params.referenceBytes)

  const firstPass = await postImagesEdit({
    targetBytes,
    referenceBytes,
    prompt: params.prompt,
  })

  const shouldEnhanceBreakout = params.runBreakoutEnhancementPass ?? shouldRunBreakoutEnhancementPass()
  if (!shouldEnhanceBreakout) {
    return {
      responseId: `edit_${Date.now()}`,
      revisedPrompt: firstPass.revisedPrompt,
      imageBytes: firstPass.imageBytes,
      breakoutApplied: true,
    }
  }

  const secondPass = await postImagesEdit({
    targetBytes: firstPass.imageBytes,
    referenceBytes,
    prompt: BREAKOUT_ENHANCEMENT_PROMPT,
  })

  return {
    responseId: `edit_${Date.now()}`,
    revisedPrompt: secondPass.revisedPrompt ?? firstPass.revisedPrompt,
    imageBytes: secondPass.imageBytes,
    breakoutApplied: true,
  }
}

export async function generateShareTokenNeonBreakoutImage(
  params: ShareTokenNeonBreakoutParams,
): Promise<{
  responseId: string
  revisedPrompt: string | null
  imageBytes: Uint8Array
  breakoutApplied: boolean
}> {
  const prompt = buildNeonBreakoutEditPrompt(params.retryReasons ?? [])
  return await generateImageWithOpenAi({
    targetBytes: params.subjectBytes,
    targetContentType: params.subjectContentType,
    referenceBytes: params.frameBytes,
    referenceContentType: params.frameContentType,
    prompt,
    runBreakoutEnhancementPass: params.runBreakoutEnhancementPass,
  })
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

export async function evaluateImageGenerationOutput(params: {
  brief: string
  outputBytes: Uint8Array
  outputContentType: string
  frameBytes: Uint8Array
  frameContentType: string
  subjectBytes: Uint8Array
  subjectContentType: string
}): Promise<ImageEvaluation> {
  const safeBrief = prepareRemoteAiText(params.brief, {
    maxStringLength: 2_000,
    maskAddresses: true,
  })
  const rubricPrompt = [
    'You are evaluating whether a generated share token icon matches the brief.',
    `Original brief: ${safeBrief}`,
    'Image 1 is the generated output.',
    'Image 2 is the frame style reference.',
    'Image 3 is the original subject reference.',
    'Focus on whether the subject is preserved with pose, expression, clothing, and key details intact.',
    'Focus on whether the neon rounded-square frame matches the reference style.',
    'Focus on whether the top of the subject clearly breaks out above the top edge of the frame.',
    'Focus on whether the background outside the frame is dark, clean, and dramatic.',
    'Return strict JSON only with keys: insideFrame, frameProminence, subjectProminence, modernElegantStyle, cleanliness, brandFit, pass, reasons.',
  ].join('\n')

  const json = await postResponsesApi({
    model: String(process.env.OPENAI_RESPONSES_MODEL ?? '').trim() || 'gpt-5.4',
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
    reasons.push('Keep the original scene visible inside the frame while preserving the subject.')
  }
  if (evaluation.frameProminence < 4) {
    reasons.push('Make the neon rounded-square frame more prominent and closer to the reference style.')
  }
  if (evaluation.subjectProminence < 4) {
    reasons.push('Preserve the original subject more clearly and keep it centered within the frame.')
  }
  if (evaluation.modernElegantStyle < 4) {
    reasons.push('Make the result feel more polished, high-contrast, elegant, and modern.')
  }
  if (evaluation.cleanliness < 4) {
    reasons.push('Darken the area outside the frame and simplify the background.')
  }
  if (evaluation.brandFit < 4) {
    reasons.push('Make the result feel more like a polished 4626 share token icon.')
  }
  if (evaluation.breakoutApplied !== false && evaluation.frameProminence < 4) {
    reasons.push('Make the top of the subject clearly break out above the top edge of the frame.')
  }

  return reasons
}
