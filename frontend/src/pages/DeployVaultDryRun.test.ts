import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('DeployVault dry run wiring', () => {
  it('registers the dry-run route and exposes a dry-run action in the deploy page', () => {
    const routeSource = fs.readFileSync(path.resolve(__dirname, '../../api/_handlers/_routes.ts'), 'utf8')
    const viteConfigSource = fs.readFileSync(path.resolve(__dirname, '../../vite.config.ts'), 'utf8')
    const pageSource = fs.readFileSync(path.resolve(__dirname, './DeployVault.tsx'), 'utf8')

    expect(routeSource).toContain("'deploy/session/dry-run': () => import('./deploy/session/_dryRun.js')")
    expect(viteConfigSource).toContain("'/api/deploy/config': () => import('./api/_handlers/deploy/_config')")
    expect(pageSource).toContain('/api/deploy/config')
    expect(pageSource).toContain('/api/deploy/session/dry-run')
    expect(pageSource).toContain('Run dry-run')
  })
})
