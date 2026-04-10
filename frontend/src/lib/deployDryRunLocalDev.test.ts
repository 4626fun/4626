import fs from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

describe('deploy dry-run local dev workflow', () => {
  it('documents and wires the one-command fork-plus-app workflow', () => {
    const packageJsonPath = path.resolve(__dirname, '../../package.json')
    const scriptPath = path.resolve(__dirname, '../../scripts/dev-deploy-dry-run.sh')
    const localBatcherScriptPath = path.resolve(__dirname, '../../scripts/deploy-local-batcher.ts')
    const smokeScriptPath = path.resolve(__dirname, '../../scripts/smoke-deploy-dry-run.sh')
    const presetPath = path.resolve(__dirname, '../../.env.deploy-dry-run.example')
    const envExamplePath = path.resolve(__dirname, '../../.env.example')
    const readmePath = path.resolve(__dirname, '../../README.md')

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>
    }
    const envExample = fs.readFileSync(envExamplePath, 'utf8')
    const readme = fs.readFileSync(readmePath, 'utf8')

    expect(packageJson.scripts?.['dev:deploy-dry-run']).toBe('bash scripts/dev-deploy-dry-run.sh')
    expect(fs.existsSync(scriptPath)).toBe(true)
    expect(fs.existsSync(localBatcherScriptPath)).toBe(true)
    expect(fs.existsSync(smokeScriptPath)).toBe(true)
    expect(fs.existsSync(presetPath)).toBe(true)

    const scriptSource = fs.readFileSync(scriptPath, 'utf8')
    const localBatcherSource = fs.readFileSync(localBatcherScriptPath, 'utf8')
    const smokeScriptSource = fs.readFileSync(smokeScriptPath, 'utf8')
    const presetSource = fs.readFileSync(presetPath, 'utf8')

    expect(scriptSource).toContain('anvil')
    expect(scriptSource).toContain('--code-size-limit')
    expect(scriptSource).toContain('BASE_FORK_UPSTREAM_RPC_URL')
    expect(scriptSource).toContain('BASE_RPC_URL')
    expect(scriptSource).toContain('VITE_BASE_RPC')
    expect(scriptSource).toContain('deploy-local-batcher.ts')
    expect(scriptSource).toContain('DEPLOY_DRY_RUN_USE_LOCAL_BATCHER')
    expect(scriptSource).toContain('VITE_DEPLOYMENT_VERSION')
    expect(scriptSource).toContain('VITE_CREATOR_VAULT_BATCHER')
    expect(scriptSource).toContain('CREATOR_VAULT_BATCHER')
    expect(scriptSource).toContain('trap')
    expect(scriptSource).toContain('pnpm exec vite')

    expect(localBatcherSource).toContain('forge')
    expect(localBatcherSource).toContain('--broadcast')
    expect(localBatcherSource).toContain('Deployed to:')

    expect(smokeScriptSource).toContain('ORIGIN="http://localhost:${PORT}"')
    expect(smokeScriptSource).toContain('HOST_HEADER="localhost:${PORT}"')

    expect(presetSource).toContain('BASE_FORK_UPSTREAM_RPC_URL=')
    expect(presetSource).toContain('BASE_RPC_URL=http://127.0.0.1:8545')
    expect(presetSource).toContain('VITE_BASE_RPC=http://127.0.0.1:8545')
    expect(presetSource).toContain('VITE_DEPLOYMENT_VERSION=v1.8.3-dryrun')
    expect(presetSource).toContain('DEPLOY_DRY_RUN_USE_LOCAL_BATCHER=1')
    expect(presetSource).toContain('VITE_ALLOW_CONTRACT_OVERRIDES=0')
    expect(presetSource).toContain('ALLOW_API_CONTRACT_OVERRIDES=0')

    expect(envExample).toContain('.env.deploy-dry-run.example')
    expect(readme).toContain('pnpm -C frontend dev:deploy-dry-run')
    expect(readme).toContain('BASE_FORK_UPSTREAM_RPC_URL')
    expect(readme).toContain('local `DeploymentBatcher`')
  })
})
