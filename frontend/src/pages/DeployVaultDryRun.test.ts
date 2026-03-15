import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('DeployVault dry run wiring', () => {
  it('registers the dry-run route and gates the dry-run action to local fork RPC mode', () => {
    const routeSource = fs.readFileSync(path.resolve(__dirname, '../../api/_handlers/_routes.ts'), 'utf8')
    const viteConfigSource = fs.readFileSync(path.resolve(__dirname, '../../vite.config.ts'), 'utf8')
    const pageSource = fs.readFileSync(path.resolve(__dirname, './DeployVault.tsx'), 'utf8')

    expect(routeSource).toContain("'deploy/session/dry-run': () => import('./deploy/session/_dryRun.js')")
    expect(viteConfigSource).toContain("'/api/deploy/config': () => import('./api/_handlers/deploy/_config')")
    expect(pageSource).toContain('/api/deploy/config')
    expect(pageSource).toContain('/api/deploy/session/dry-run')
    expect(pageSource).toContain('isLocalForkRpcUrl')
    expect(pageSource).toContain('VITE_BASE_RPC')
    expect(pageSource).toContain('Run dry-run')
    expect(pageSource).toContain('Dry-run is local-fork-only.')
  })

  it('keeps canonical 3-strategy + idle-reserve defaults in deploy-session payload construction', () => {
    const pageSource = fs.readFileSync(path.resolve(__dirname, './DeployVault.tsx'), 'utf8')

    expect(pageSource).toContain('const DEFAULT_CHARM_WEIGHT_BPS = 3_000n')
    expect(pageSource).toContain('const DEFAULT_AJNA_WEIGHT_BPS = 3_000n')
    expect(pageSource).toContain('const DEFAULT_SOLANA_WEIGHT_BPS = 3_000n')
    expect(pageSource).toContain('const DEFAULT_IDLE_PERCENT_BPS = 1_000n')
    expect(pageSource).toContain("functionName: 'setMinimumTotalIdle'")
    expect(pageSource).toContain("functionName: 'deployToStrategies'")
  })
})
