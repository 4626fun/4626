#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function parseArg(flag, fallback) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('-')) return fallback
  return next
}

async function listSubdirs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
}

async function existsDir(dir) {
  try {
    const stat = await fs.stat(dir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function main() {
  const cwd = process.cwd()
  const fromRaw = parseArg('--from', process.env.CURSOR_SKILLS_DIR || '../.cursor/skills')
  const toRaw = parseArg('--to', process.env.AGENT_SKILLS_DIR || './skills')
  const prune = hasFlag('--prune')
  const dryRun = hasFlag('--dry-run')

  const fromDir = path.resolve(cwd, fromRaw)
  const toDir = path.resolve(cwd, toRaw)

  if (!(await existsDir(fromDir))) {
    throw new Error(`Source skills directory not found: ${fromDir}`)
  }

  await fs.mkdir(toDir, { recursive: true })

  const sourceSkills = await listSubdirs(fromDir)
  const targetSkillsBefore = await listSubdirs(toDir)

  let copied = 0
  let removed = 0

  for (const skillName of sourceSkills) {
    const src = path.join(fromDir, skillName)
    const dst = path.join(toDir, skillName)
    if (dryRun) {
      console.log(`[dry-run] copy ${src} -> ${dst}`)
      copied += 1
      continue
    }

    await fs.rm(dst, { recursive: true, force: true })
    await fs.cp(src, dst, { recursive: true, force: true })
    copied += 1
  }

  if (prune) {
    const sourceSet = new Set(sourceSkills)
    for (const skillName of targetSkillsBefore) {
      if (sourceSet.has(skillName)) continue
      const dst = path.join(toDir, skillName)
      if (dryRun) {
        console.log(`[dry-run] remove ${dst}`)
        removed += 1
        continue
      }
      await fs.rm(dst, { recursive: true, force: true })
      removed += 1
    }
  }

  console.log('skills sync complete')
  console.log(`from=${fromDir}`)
  console.log(`to=${toDir}`)
  console.log(`copied=${copied}`)
  console.log(`prune=${prune ? 'on' : 'off'}`)
  console.log(`removed=${removed}`)
  console.log(`dryRun=${dryRun ? 'on' : 'off'}`)
}

main().catch((error) => {
  const message = String(error?.message || error)
  console.error(`skills sync failed: ${message}`)
  process.exit(1)
})

