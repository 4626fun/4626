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

  it('no hideLegacy* feature-flag props remain in VaultFlowScroll or orchestrators', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/components/home/VaultFlowScroll.tsx',
    )
    const orchestratorFiles = collectFiles(orchestratorsDir).filter((f) => f.endsWith('.tsx'))
    const filesToCheck = [vaultFlowScrollPath, ...orchestratorFiles]

    const offenders = filesToCheck.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /hideLegacy[A-Z]/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('VaultFlowScroll does not use raw scroll-progress thresholds for stage gating', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/components/home/VaultFlowScroll.tsx',
    )
    const source = readFileSync(vaultFlowScrollPath, 'utf8')

    // Raw scroll-progress branching patterns are banned — they were replaced by
    // the section-based whileInView architecture which has no scroll gating at all.
    expect(source).not.toMatch(/v\s*>=\s*0\.\d+\b/)
    expect(source).not.toMatch(/v\s*<\s*0\.\d+\b/)
    expect(source).not.toMatch(/hardStopFired/)
    expect(source).not.toMatch(/useSpring/)
  })

  it('VaultFlowScroll is a static section layout — no beat-gated conditional mounts', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/components/home/VaultFlowScroll.tsx',
    )
    const source = readFileSync(vaultFlowScrollPath, 'utf8')

    // Section-based design: all content is always in the tree.
    // Beat-gated mounts (isBeat guards) belong in the orchestrators, not here.
    expect(source).not.toMatch(/isBeat\s*\(/)
    expect(source).not.toMatch(/isMintConfirmed\s*\(/)
    // No scrolljacking — height:3200vh sticky container is gone
    expect(source).not.toMatch(/3200vh/)
    expect(source).not.toMatch(/sticky/)
  })
})

