import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')
const protocolsDir = path.join(frontendRoot, 'public', 'protocols')
const manifestPath = path.join(protocolsDir, 'manifest.json')

const ignoredFiles = new Set(['manifest.json', 'README.md', '.DS_Store'])
const allowedExtensions = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'])

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function failWith(errors) {
  console.error('Protocol asset verification failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

async function getTrackedAssetFilenames() {
  const directoryEntries = await readdir(protocolsDir)
  const tracked = []

  for (const name of directoryEntries) {
    if (ignoredFiles.has(name)) continue
    const fullPath = path.join(protocolsDir, name)
    const entryStat = await stat(fullPath)
    if (!entryStat.isFile()) continue
    if (!allowedExtensions.has(path.extname(name).toLowerCase())) continue
    tracked.push(name)
  }

  return tracked.sort((a, b) => a.localeCompare(b))
}

async function verify() {
  const errors = []

  let manifest
  try {
    const raw = await readFile(manifestPath, 'utf8')
    manifest = JSON.parse(raw)
  } catch (error) {
    failWith([`Unable to read or parse manifest at ${manifestPath}: ${String(error)}`])
  }

  if (!manifest || typeof manifest !== 'object') {
    errors.push('Manifest root must be an object.')
  }

  if (!Array.isArray(manifest.assets)) {
    errors.push('Manifest must include an "assets" array.')
  }

  const entries = Array.isArray(manifest?.assets) ? manifest.assets : []
  const seenFiles = new Set()

  for (const [index, entry] of entries.entries()) {
    const prefix = `assets[${index}]`
    if (!entry || typeof entry !== 'object') {
      errors.push(`${prefix} must be an object.`)
      continue
    }

    const requiredFields = ['protocol', 'variant', 'file', 'sha256', 'officialSourceUrl', 'brandGuideUrl']
    for (const field of requiredFields) {
      const value = entry[field]
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${prefix}.${field} must be a non-empty string.`)
      }
    }

    if (typeof entry.file !== 'string' || entry.file.includes('/') || entry.file.includes('\\')) {
      errors.push(`${prefix}.file must be a filename inside public/protocols (no path separators).`)
      continue
    }

    if (seenFiles.has(entry.file)) {
      errors.push(`Duplicate manifest file entry detected: "${entry.file}".`)
      continue
    }
    seenFiles.add(entry.file)

    if (typeof entry.officialSourceUrl === 'string' && !isHttpsUrl(entry.officialSourceUrl)) {
      errors.push(`${prefix}.officialSourceUrl must be a valid https URL.`)
    }
    if (typeof entry.brandGuideUrl === 'string' && !isHttpsUrl(entry.brandGuideUrl)) {
      errors.push(`${prefix}.brandGuideUrl must be a valid https URL.`)
    }

    const targetPath = path.join(protocolsDir, entry.file)
    try {
      const fileBytes = await readFile(targetPath)
      const actualHash = sha256Hex(fileBytes)
      if (actualHash !== entry.sha256) {
        errors.push(
          `${entry.file} hash mismatch. expected=${entry.sha256} actual=${actualHash}. ` +
            'If intentional, update manifest.json with the new checksum and provenance.',
        )
      }
    } catch (error) {
      errors.push(`Missing manifest file "${entry.file}" (${String(error)}).`)
    }
  }

  const trackedFiles = await getTrackedAssetFilenames()
  const unlistedFiles = trackedFiles.filter((name) => !seenFiles.has(name))
  if (unlistedFiles.length > 0) {
    errors.push(`Manifest is missing protocol assets: ${unlistedFiles.join(', ')}`)
  }

  const staleManifestEntries = [...seenFiles].filter((name) => !trackedFiles.includes(name))
  if (staleManifestEntries.length > 0) {
    errors.push(`Manifest references files that no longer exist: ${staleManifestEntries.join(', ')}`)
  }

  if (errors.length > 0) {
    failWith(errors)
  }

  console.log(`Protocol assets verified successfully (${trackedFiles.length} files).`)
}

verify().catch((error) => {
  failWith([`Unexpected verification error: ${String(error)}`])
})
