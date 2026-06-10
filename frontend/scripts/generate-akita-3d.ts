/**
 * Image-to-3D generator for the AKITA hologram experiment.
 *
 * Turns the AKITA token logo (a photo of a red Shiba Inu) into a real, textured
 * 3D GLB via an image-to-3D AI service, then writes it into public/dev/ so the
 * /dev/tactical-map scene can project it as the hologram.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/generate-akita-3d.ts --provider meshy
 *   pnpm -C frontend exec tsx scripts/generate-akita-3d.ts --provider tripo
 *
 * Keys are read from env or frontend/.env:
 *   MESHY_API_KEY        (meshy.ai)
 *   TRIPO_API_KEY        (platform.tripo3d.ai)
 *
 * Options:
 *   --provider meshy|tripo   (required)
 *   --image <path>           source image (default: downloads the AKITA token photo)
 *   --out <path>             output GLB (default: public/dev/akita-<provider>.glb)
 */
import { Buffer } from 'node:buffer'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '..')
const AKITA_TOKEN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'

// --- tiny .env loader (frontend/.env) --------------------------------------
function loadEnv() {
  const envPath = resolve(FRONTEND_ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    if (process.env[key]) continue
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getSourceImage(imageArg?: string): Promise<{ bytes: Buffer; mime: string }> {
  if (imageArg) {
    const p = resolve(process.cwd(), imageArg)
    const bytes = readFileSync(p)
    const mime = p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
    return { bytes, mime }
  }
  // Default: pull the AKITA token photo from the local dev server.
  const url = `http://localhost:5173/api/token/image?address=${AKITA_TOKEN}&size=1024&style=raw`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not fetch AKITA token image (${res.status}). Pass --image <path> instead.`)
  const bytes = Buffer.from(await res.arrayBuffer())
  return { bytes, mime: 'image/png' }
}

// --- Meshy -----------------------------------------------------------------
async function runMeshy(img: { bytes: Buffer; mime: string }, out: string) {
  const key = process.env.MESHY_API_KEY
  if (!key) throw new Error('MESHY_API_KEY is not set (env or frontend/.env).')
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const dataUri = `data:${img.mime};base64,${img.bytes.toString('base64')}`

  console.log('[meshy] creating image-to-3d task…')
  const createRes = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      image_url: dataUri,
      should_texture: true,
      enable_pbr: true,
      should_remesh: true,
      target_formats: ['glb'],
    }),
  })
  if (!createRes.ok) throw new Error(`[meshy] create failed ${createRes.status}: ${await createRes.text()}`)
  const taskId = (await createRes.json()).result as string
  console.log(`[meshy] task ${taskId} — polling…`)

  for (let i = 0; i < 120; i++) {
    await sleep(5000)
    const t = await (
      await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`, { headers })
    ).json()
    process.stdout.write(`\r[meshy] ${t.status} ${t.progress ?? 0}%   `)
    if (t.status === 'SUCCEEDED') {
      const glbUrl = t.model_urls?.glb
      if (!glbUrl) throw new Error('[meshy] succeeded but no GLB url')
      const glb = Buffer.from(await (await fetch(glbUrl)).arrayBuffer())
      writeFileSync(out, glb)
      console.log(`\n[meshy] wrote ${out} (${(glb.length / 1024).toFixed(0)} KB)`)
      return
    }
    if (t.status === 'FAILED') throw new Error(`\n[meshy] failed: ${t.task_error?.message ?? 'unknown'}`)
  }
  throw new Error('[meshy] timed out')
}

// --- Tripo -----------------------------------------------------------------
async function runTripo(img: { bytes: Buffer; mime: string }, out: string) {
  const key = process.env.TRIPO_API_KEY
  if (!key) throw new Error('TRIPO_API_KEY is not set (env or frontend/.env).')
  const auth = { Authorization: `Bearer ${key}` }
  const ext = img.mime === 'image/jpeg' ? 'jpg' : 'png'

  console.log('[tripo] uploading image…')
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(img.bytes)], { type: img.mime }), `akita.${ext}`)
  const upRes = await fetch('https://api.tripo3d.ai/v2/openapi/upload', { method: 'POST', headers: auth, body: form })
  if (!upRes.ok) throw new Error(`[tripo] upload failed ${upRes.status}: ${await upRes.text()}`)
  const upJson = await upRes.json()
  const fileToken = upJson?.data?.image_token ?? upJson?.data?.file_token
  if (!fileToken) throw new Error(`[tripo] upload returned no token: ${JSON.stringify(upJson)}`)

  console.log('[tripo] creating image_to_model task…')
  const createRes = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'image_to_model',
      file: { type: ext, file_token: fileToken },
      texture_quality: 'detailed',
      pbr: true,
      auto_size: true,
    }),
  })
  if (!createRes.ok) throw new Error(`[tripo] create failed ${createRes.status}: ${await createRes.text()}`)
  const taskId = (await createRes.json())?.data?.task_id as string
  console.log(`[tripo] task ${taskId} — polling…`)

  for (let i = 0; i < 120; i++) {
    await sleep(5000)
    const t = (await (await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, { headers: auth })).json())?.data
    process.stdout.write(`\r[tripo] ${t?.status} ${t?.progress ?? 0}%   `)
    if (t?.status === 'success') {
      const o = t.output ?? {}
      const glbUrl = o.pbr_model || o.model || o.base_model
      if (!glbUrl) throw new Error(`\n[tripo] success but no model url: ${JSON.stringify(o)}`)
      const glb = Buffer.from(await (await fetch(glbUrl)).arrayBuffer())
      writeFileSync(out, glb)
      console.log(`\n[tripo] wrote ${out} (${(glb.length / 1024).toFixed(0)} KB)`)
      return
    }
    if (['failed', 'cancelled', 'unknown', 'banned', 'expired'].includes(t?.status)) {
      throw new Error(`\n[tripo] terminal status: ${t?.status}`)
    }
  }
  throw new Error('[tripo] timed out')
}

async function main() {
  loadEnv()
  const provider = arg('provider')
  if (provider !== 'meshy' && provider !== 'tripo') {
    throw new Error('Pass --provider meshy|tripo')
  }
  const out = resolve(process.cwd(), arg('out', `public/dev/akita-${provider}.glb`)!)
  const img = await getSourceImage(arg('image'))
  console.log(`[src] ${img.bytes.length} bytes ${img.mime}`)
  if (provider === 'meshy') await runMeshy(img, out)
  else await runTripo(img, out)
}

main().catch((e) => {
  console.error(String(e?.message ?? e))
  process.exit(1)
})
