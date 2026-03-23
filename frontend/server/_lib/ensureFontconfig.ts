import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

declare const process: { env: Record<string, string | undefined> }

let initialized = false

const FONTCONFIG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <dir prefix="xdg">fonts</dir>
  <cachedir>/tmp/4626-fontconfig-cache</cachedir>
  <config />
</fontconfig>
`

export function ensureFontconfig(): void {
  if (initialized) return
  initialized = true

  if ((process.env.FONTCONFIG_PATH ?? '').trim() && (process.env.FONTCONFIG_FILE ?? '').trim()) {
    return
  }

  const baseDir = join(tmpdir(), '4626-fontconfig')
  const configPath = join(baseDir, 'fonts.conf')

  mkdirSync(baseDir, { recursive: true })
  if (!existsSync(configPath)) {
    writeFileSync(configPath, FONTCONFIG_XML, 'utf8')
  }

  if (!(process.env.FONTCONFIG_PATH ?? '').trim()) {
    process.env.FONTCONFIG_PATH = baseDir
  }
  if (!(process.env.FONTCONFIG_FILE ?? '').trim()) {
    process.env.FONTCONFIG_FILE = configPath
  }
  if (!(process.env.XDG_CACHE_HOME ?? '').trim()) {
    process.env.XDG_CACHE_HOME = baseDir
  }
}
