import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const serverAlfaclubRoot = resolve(here, '../../server/_lib/alfaclub')
const roots = [
  resolve(serverAlfaclubRoot, 'inverseAkitaTradeJournal.ts'),
  resolve(serverAlfaclubRoot, 'inverseAkitaTradeJournalSender.ts'),
  resolve(serverAlfaclubRoot, 'inverseAkitaTradeJournalEvidence.ts'),
  resolve(serverAlfaclubRoot, 'inverseAkitaTradeJournalAnalysis.ts'),
]

const forbidden = [
  'arenaClient',
  'inverseAkitaChatReaction',
  'counterTradeEngine',
  'counterTradeHarvest',
  'counterTradeLlmAdvisor',
  'skillRouter',
  '/api/hermit/draft',
  '_handlers/hermit/_draft',
  'runArenaTrade',
  'sendCounterTrade',
  'executeCounterTrade',
]

function localImports(source: string, parent: string): string[] {
  return [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
    .map((match) => match[1]!)
    .filter((specifier) => !specifier.endsWith('.json'))
    .map((specifier) => resolve(dirname(parent), specifier.replace(/\.js$/, '.ts')))
}

function reachableSources(): Array<{ path: string; source: string }> {
  const visited = new Set<string>()
  const pending = [...roots]
  const result: Array<{ path: string; source: string }> = []
  while (pending.length > 0) {
    const path = pending.pop()!
    if (visited.has(path)) continue
    visited.add(path)
    const source = readFileSync(path, 'utf8')
    result.push({ path, source })
    for (const imported of localImports(source, path)) {
      if (imported.includes('/alfaclub/') || imported.endsWith('/schemaBootstrap.ts')) {
        pending.push(imported)
      }
    }
  }
  return result
}

describe('InverseAKITA trade-journal analysis architecture boundary', () => {
  it('has no direct or transitive execution/creative-draft dependency', () => {
    for (const { path, source } of reachableSources()) {
      for (const token of forbidden) {
        expect(source, `${path} must not reference ${token}`).not.toContain(token)
      }
    }
  })

  it('keeps the analysis boundary explicitly analysis-only', () => {
    const analysis = readFileSync(
      resolve(serverAlfaclubRoot, 'inverseAkitaTradeJournalAnalysis.ts'),
      'utf8',
    )
    expect(analysis).toContain('analysisOnly: true')
    expect(analysis).not.toMatch(/\b(?:execute|submit|place|close)Position\s*\(/)
  })
})
