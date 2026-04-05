import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

function collectFiles(rootDir: string): string[] {
  const entries = readdirSync(rootDir)
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(rootDir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectFiles(full))
      continue
    }
    files.push(full)
  }
  return files
}

describe('vault-flow renderer contract', () => {
  const vaultFlowDir = path.resolve(
    process.cwd(),
    'src/components/home/vault-flow',
  )
  const orchestratorsDir = path.resolve(
    process.cwd(),
    'src/components/home/vault-flow/orchestrators',
  )
  const sourceFiles = collectFiles(vaultFlowDir).filter(
    (file) =>
      (file.endsWith('.ts') || file.endsWith('.tsx')) &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.test.tsx'),
  )

  it('does not import launchConfig from any vault-flow source file', () => {
    const offenders = sourceFiles.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /from\s+['"](?:\.\.\/)*launchConfig['"]/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('orchestrators do not branch on raw state.beat/state.phase comparisons', () => {
    const orchestratorFiles = collectFiles(orchestratorsDir).filter((file) =>
      file.endsWith('.tsx'),
    )

    const offenders = orchestratorFiles.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /state\.(beat|phase)\s*===/.test(source)
    })

    expect(offenders).toEqual([])
  })
})

