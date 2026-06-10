import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../server/_lib/controlPlane/__fixtures__')

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as Record<string, unknown>
}

describe('controlPlane contract fixtures', () => {
  it('operation envelope fixture includes required identity fields', () => {
    const expected = loadFixture('operation.envelope.v1.json')
    const sample = {
      operationId: 'op_provision_abc',
      operationKind: 'vault.provision',
      status: 'running',
      scopeType: 'vault',
      scopeId: '0x1111111111111111111111111111111111111111',
      lockScope: 'vault.provision',
      lockKey: 'creator:8453:cca',
      idempotencyKey: 'idem-1',
      idempotencyFingerprint: 'vault.provision:vault:0x1111...:hash',
      policyVersion: 'cpol_abc123',
      schemaVersion: 'v1',
      requestedBy: '0xadmin',
      errorCode: null,
      errorMessage: null,
      input: { chainId: 8453 },
      result: null,
      createdAt: '2026-05-18T16:00:00.000Z',
      updatedAt: '2026-05-18T16:01:00.000Z',
      finishedAt: null,
    }
    for (const key of Object.keys(expected)) {
      expect(sample).toHaveProperty(key)
    }
  })

  it('event timeline fixture keys are present on sample events', () => {
    const expected = loadFixture('event.timeline.v1.json')
    const sample = {
      eventType: 'operation.status_transition',
      stageId: 'stage_1',
      message: 'queued_for_keeper_execution',
      data: {
        previousStatus: 'requested',
        nextStatus: 'queued',
        reason: 'queued_for_keeper_execution',
        actor: 'system',
        policyVersion: 'cpol_abc123',
      },
      createdAt: '2026-05-18T16:00:01.000Z',
    }
    for (const key of Object.keys(expected)) {
      expect(sample).toHaveProperty(key)
    }
  })
})
