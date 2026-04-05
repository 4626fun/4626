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

  it('VaultFlowScroll stage-transitions use storySelectors, not raw v< thresholds', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/components/home/VaultFlowScroll.tsx',
    )
    const source = readFileSync(vaultFlowScrollPath, 'utf8')

    // Old raw stage-gating patterns that Track B replaced with storySelectors
    expect(source).not.toMatch(/v\s*>=\s*0\.46\b/)    // old depositComplete trigger
    expect(source).not.toMatch(/v\s*<\s*0\.52\b/)     // old cardPhase 1→2 gate
    expect(source).not.toMatch(/v\s*>=\s*0\.76\b/)    // old cardPhase 2→3 gate

    // Positive: storySelectors must be imported and used for the key transitions
    expect(source).toMatch(/isMintConfirmed\(/)
    expect(source).toMatch(/isDeployStrategiesVisible\(/)
    expect(source).toMatch(/isDistributionVisible\(/)
  })

  it('Phase 4 visibility guards are in place: HeroBlock and DepositCardBlock use isBeat call-site guards', () => {
    const vaultFlowScrollPath = path.resolve(
      process.cwd(),
      'src/components/home/VaultFlowScroll.tsx',
    )
    const source = readFileSync(vaultFlowScrollPath, 'utf8')

    // HeroBlock guard: isBeat check for the three early beats that precede distribution
    expect(source).toMatch(/isBeat\(desktopStoryState,\s*'creatorEstablishes'\)/)
    expect(source).toMatch(/isBeat\(desktopStoryState,\s*'valueFlowsIn'\)/)
    expect(source).toMatch(/isBeat\(desktopStoryState,\s*'participantDeposits'\)/)

    // DepositCardBlock guard: negated isBeat checks for the two transparent-card beats
    expect(source).toMatch(/!isBeat\(desktopStoryState,\s*'creatorEstablishes'\)/)
    expect(source).toMatch(/!isBeat\(desktopStoryState,\s*'valueFlowsIn'\)/)
  })
})

