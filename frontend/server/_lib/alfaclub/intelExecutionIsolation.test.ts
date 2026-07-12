import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const INTEL_ROOTS = [
  path.resolve(__dirname, 'marketState'),
  path.resolve(__dirname, 'regimes'),
  path.resolve(__dirname, 'decisions'),
  path.resolve(__dirname, 'audits'),
  path.resolve(__dirname, 'portfolio'),
  path.resolve(__dirname, '../../agents/eliza/plugins/virtuals/intelJobs.ts'),
]

const FORBIDDEN = [
  'counterTradeRunner',
  'counterTradeEntryFlow',
  'counterTradeExitFlow',
  'counterTradeAdjustFlow',
  'counterTradeEngine',
]

function listFiles(target: string): string[] {
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  const out: string[] = []
  for (const entry of fs.readdirSync(target)) {
    if (entry.endsWith('.test.ts')) continue
    const full = path.join(target, entry)
    const entryStat = fs.statSync(full)
    if (entryStat.isDirectory()) out.push(...listFiles(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

describe('intel execution isolation', () => {
  it('does not import live counter-trade execution modules', () => {
    const files = INTEL_ROOTS.flatMap((root) => listFiles(root))
    const violations: string[] = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const forbidden of FORBIDDEN) {
        if (text.includes(forbidden)) {
          violations.push(`${path.relative(process.cwd(), file)} mentions ${forbidden}`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
