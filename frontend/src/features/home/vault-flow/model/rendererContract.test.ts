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
    'src/features/home/vault-flow',
  )
  const orchestratorsDir = path.resolve(
    process.cwd(),
    'src/features/home/vault-flow/orchestrators',
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

  it('no hideLegacy* feature-flag props remain in VaultFlowScroll or orchestrators', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/features/home/vault-flow/VaultFlowScroll.tsx',
    )
    const orchestratorFiles = collectFiles(orchestratorsDir).filter((f) => f.endsWith('.tsx'))
    const filesToCheck = [vaultFlowScrollPath, ...orchestratorFiles]

    const offenders = filesToCheck.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /hideLegacy[A-Z]/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('VaultFlowScroll uses smooth useTransform scroll-linking, not raw if/else thresholds', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/features/home/vault-flow/VaultFlowScroll.tsx',
    )
    const source = readFileSync(vaultFlowScrollPath, 'utf8')

    // Raw imperative scroll branching is banned.
    // useTransform([0.10, 0.15, ...]) is the approved pattern.
    expect(source).not.toMatch(/v\s*>=\s*0\.\d+\b/)
    expect(source).not.toMatch(/v\s*<\s*0\.\d+\b/)
    expect(source).not.toMatch(/hardStopFired/)
    // useSpring introduces physics lag that fights the beat timing — banned.
    expect(source).not.toMatch(/useSpring/)
    // useTransform must be present (the approved scroll-link mechanism).
    expect(source).toMatch(/useTransform/)
  })

  it('VaultFlowScroll beat layout — all beats always in tree, no conditional mounts', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/features/home/vault-flow/VaultFlowScroll.tsx',
    )
    const source = readFileSync(vaultFlowScrollPath, 'utf8')

    // All beats always rendered; opacity is driven by useTransform, not mount/unmount.
    expect(source).not.toMatch(/isBeat\s*\(/)
    expect(source).not.toMatch(/isMintConfirmed\s*\(/)
    // Old scrolljacking height constant must not reappear.
    expect(source).not.toMatch(/3200vh/)
    // First and last beat testIds must be present in source.
    expect(source).toMatch(/beat-1-threshold/)
    expect(source).toMatch(/beat-4-mint/)
    expect(source).toMatch(/beat-6-strategies/)
  })
})
