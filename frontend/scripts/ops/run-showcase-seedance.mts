/**
 * One-shot Seedance 2.0 image-to-video for showcase beats A + D.
 * Usage: FAL_KEY=... pnpm exec tsx /tmp/4626-showcase-video/run-seedance.mts
 * Does not print the API key.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fal } from '@fal-ai/client'

const ROOT = '/home/akitav2/projects/4626'
const OUT = '/tmp/4626-showcase-video/beats'

const NEGATIVE = [
  'Strictly preserve the reference image composition, materials, and color grade.',
  'Photoreal product-cinematic look with elegant liquid-glass light behavior — soft refraction, restrained caustics, premium matte+gloss materials.',
  'Slow controlled camera only.',
  'No anime, no cartoon, no cel shading, no illustration style, no mascot, no characters, no hands, no faces.',
  'No purple neon haze, no magenta cyberpunk glow, no rainbow chrome, no holographic HUD, no fake UI screens, no unreadable terminal text, no watermark, no logo invention, no other brand marks, no stock-crypto clichés (gold coins, exploding charts).',
].join(' ')

const BEATS = [
  {
    id: 'a',
    still: path.join(ROOT, 'frontend/public/assets/product/og-preview-wide.png'),
    duration: '8',
    prompt: [
      'Animate this exact brand still as a modern luxury product-film cold open.',
      'Ultra-slow push-in toward the rim-lit mark.',
      'Introduce subtle liquid-glass light: soft refractive shimmer and slow caustic drift across matte surfaces without warping the mark.',
      'Keep typography and mark geometry locked — do not rewrite letters.',
      'Mood: elegant, provocative restraint, Base-native infrastructure.',
      'Camera: tripod millimeter push, no handheld shake.',
      NEGATIVE,
    ].join(' '),
  },
  {
    id: 'd',
    still: path.join(ROOT, 'frontend/public/assets/product/social-launch.png'),
    duration: '6',
    prompt: [
      'Animate this exact brand mark still as a professional outro settle.',
      'Ultra-slow push-out or settle that leaves clean negative space around the mark for a later caption.',
      'Keep the mark sharp, centered, and faithful to the reference geometry.',
      'Soft ambient liquid-glass light only — no particle storms, no lens-flare spam.',
      'Ending frame must remain readable for a github.com/4626fun/4626 title card overlay in edit.',
      NEGATIVE,
    ].join(' '),
  },
] as const

async function main() {
  if (!process.env.FAL_KEY?.trim()) {
    throw new Error('FAL_KEY missing')
  }
  await mkdir(OUT, { recursive: true })

  for (const beat of BEATS) {
    console.log(`[seedance] beat ${beat.id}: uploading still…`)
    const bytes = await readFile(beat.still)
    const file = new File([bytes], path.basename(beat.still), { type: 'image/png' })
    const imageUrl = await fal.storage.upload(file)
    if (!imageUrl) throw new Error(`upload failed for beat ${beat.id}`)
    console.log(`[seedance] beat ${beat.id}: generating…`)
    const result = await fal.subscribe('bytedance/seedance-2.0/image-to-video', {
      input: {
        prompt: beat.prompt,
        image_url: imageUrl,
        resolution: '720p',
        aspect_ratio: '16:9',
        duration: beat.duration,
        generate_audio: false,
        seed: 462600,
      },
      logs: true,
      onQueueUpdate(update) {
        if (update.status === 'IN_PROGRESS') {
          const last = update.logs?.slice(-1)?.[0]?.message
          if (last) console.log(`[seedance] ${beat.id}: ${last}`)
        }
      },
    })
    const videoUrl =
      (result.data as { video?: { url?: string } })?.video?.url ??
      (result.data as { video_url?: string })?.video_url
    if (!videoUrl) {
      await writeFile(path.join(OUT, `beat-${beat.id}-raw.json`), JSON.stringify(result, null, 2))
      throw new Error(`no video url for beat ${beat.id}`)
    }
    const res = await fetch(videoUrl)
    if (!res.ok) throw new Error(`download failed ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const outPath = path.join(OUT, `beat-${beat.id}.mp4`)
    await writeFile(outPath, buf)
    console.log(`[seedance] beat ${beat.id}: wrote ${outPath} (${buf.length} bytes)`)
  }
}

main().catch((err) => {
  console.error('[seedance] failed', err instanceof Error ? err.message : err)
  process.exit(1)
})
