#!/usr/bin/env tsx
/**
 * Pin FriendKey metadata JSON (+ optional images) to IPFS via Pinata.
 *
 * Reads metadata/1659.json and metadata/collection.json, pins them,
 * writes public CIDs to metadata/ipfs.json (no private source URLs).
 *
 *   pnpm pin-metadata
 *   pnpm pin-metadata -- --token-image=./path.png --collection-image=./path.png
 *
 * Requires PINATA_JWT.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = resolve(__dirname, '..')
const META_DIR = resolve(PKG_ROOT, 'metadata')

const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(PKG_ROOT, '.env.local'))
loadEnvFile(resolve(PKG_ROOT, '.env'))

function getArg(name: string, fallback = ''): string {
  const eqPrefix = `${name}=`
  for (const arg of process.argv) {
    if (arg.startsWith(eqPrefix)) return arg.slice(eqPrefix.length).trim()
  }
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function pinataJwt(): string {
  const jwt = String(process.env.PINATA_JWT ?? '').trim()
  if (!jwt) throw new Error('PINATA_JWT required')
  return jwt
}

async function pinFileBytes(params: {
  jwt: string
  bytes: Buffer
  filename: string
  contentType: string
  name: string
}): Promise<string> {
  const form = new FormData()
  const fileBytes = Uint8Array.from(params.bytes)
  form.append('file', new Blob([fileBytes], { type: params.contentType }), params.filename)
  form.append(
    'pinataMetadata',
    JSON.stringify({
      name: params.name,
      keyvalues: { source: 'friendkey-oerc1155-metadata', app: '4626' },
    }),
  )
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

  const res = await fetch(PINATA_PIN_FILE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.jwt}` },
    body: form,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`pinFileToIPFS failed: ${res.status} ${text.slice(0, 200)}`)
  const parsed = JSON.parse(text) as { IpfsHash?: string; ipfsHash?: string }
  const cid = String(parsed.IpfsHash ?? parsed.ipfsHash ?? '').trim()
  if (!cid) throw new Error('pinFileToIPFS missing IpfsHash')
  return cid
}

async function pinJson(params: {
  jwt: string
  body: Record<string, unknown>
  name: string
}): Promise<string> {
  const res = await fetch(PINATA_PIN_JSON_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataContent: params.body,
      pinataMetadata: {
        name: params.name,
        keyvalues: { source: 'friendkey-oerc1155-metadata', app: '4626' },
      },
      pinataOptions: { cidVersion: 1 },
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`pinJSONToIPFS failed: ${res.status} ${text.slice(0, 200)}`)
  const parsed = JSON.parse(text) as { IpfsHash?: string; ipfsHash?: string }
  const cid = String(parsed.IpfsHash ?? parsed.ipfsHash ?? '').trim()
  if (!cid) throw new Error('pinJSONToIPFS missing IpfsHash')
  return cid
}

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}

async function main(): Promise<void> {
  const jwt = pinataJwt()
  const tokenPath = resolve(META_DIR, '1659.json')
  const collectionPath = resolve(META_DIR, 'collection.json')
  if (!existsSync(tokenPath) || !existsSync(collectionPath)) {
    throw new Error('metadata/1659.json and metadata/collection.json required')
  }

  const tokenMeta = JSON.parse(readFileSync(tokenPath, 'utf8')) as Record<string, unknown>
  const collectionMeta = JSON.parse(readFileSync(collectionPath, 'utf8')) as Record<string, unknown>

  let tokenImageCid = ''
  let collectionImageCid = ''

  const tokenImagePath = getArg('--token-image')
  const collectionImagePath = getArg('--collection-image')

  if (tokenImagePath) {
    const abs = resolve(process.cwd(), tokenImagePath)
    tokenImageCid = await pinFileBytes({
      jwt,
      bytes: readFileSync(abs),
      filename: abs.split('/').pop() || 'token.png',
      contentType: contentTypeFor(abs),
      name: 'friendkey-1659-image',
    })
    tokenMeta.image = `ipfs://${tokenImageCid}`
  } else if (typeof tokenMeta.image === 'string' && tokenMeta.image.startsWith('ipfs://')) {
    tokenImageCid = tokenMeta.image.slice('ipfs://'.length)
  }

  if (collectionImagePath) {
    const abs = resolve(process.cwd(), collectionImagePath)
    collectionImageCid = await pinFileBytes({
      jwt,
      bytes: readFileSync(abs),
      filename: abs.split('/').pop() || 'collection.png',
      contentType: contentTypeFor(abs),
      name: 'friendkey-collection-image',
    })
    collectionMeta.image = `ipfs://${collectionImageCid}`
  } else if (typeof collectionMeta.image === 'string' && collectionMeta.image.startsWith('ipfs://')) {
    collectionImageCid = collectionMeta.image.slice('ipfs://'.length)
  }

  // Persist local JSON if images were updated
  writeFileSync(tokenPath, JSON.stringify(tokenMeta, null, 2) + '\n')
  writeFileSync(collectionPath, JSON.stringify(collectionMeta, null, 2) + '\n')

  const tokenMetadataCid = await pinJson({
    jwt,
    body: tokenMeta,
    name: 'friendkey-1659-metadata',
  })
  const collectionMetadataCid = await pinJson({
    jwt,
    body: collectionMeta,
    name: 'friendkey-collection-metadata',
  })

  // Optional directory layout for future multi-id {id}.json substitution
  const dirCid = getArg('--uri-dir-cid') // optional reuse; Pinata folder pin not required for live exact URI

  const out = {
    status: 'pinned',
    tokenImageCid: tokenImageCid || undefined,
    collectionImageCid: collectionImageCid || undefined,
    tokenMetadataCid,
    collectionMetadataCid,
    uriDirCid: dirCid || undefined,
    uriTemplate: dirCid ? `ipfs://${dirCid}/{id}.json` : undefined,
    uri1659Exact: `ipfs://${tokenMetadataCid}`,
    contractURI: `ipfs://${collectionMetadataCid}`,
    uriLive: `ipfs://${tokenMetadataCid}`,
    uriNote:
      'OZ ERC1155 build may not substitute {id}; live setURI is typically the exact #1659 JSON CID.',
    note: 'Public CIDs only. setURI(uriLive or uriTemplate); setContractURI(contractURI). Seed allowlist 1659.',
  }

  // Drop undefined keys
  const cleaned = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined))
  const outPath = resolve(META_DIR, 'ipfs.json')
  writeFileSync(outPath, JSON.stringify(cleaned, null, 2) + '\n')
  console.log(JSON.stringify(cleaned, null, 2))
  console.log(`\nWrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
