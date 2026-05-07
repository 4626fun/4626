import { describe, expect, it, vi } from 'vitest'

import {
  readWaitlistAirtableSyncConfig,
  syncWaitlistToAirtable,
} from './waitlistAirtableSync.js'

describe('waitlist Airtable sync', () => {
  it('requires the server-only Airtable token and defaults to the configured waitlist base/tables', () => {
    const { config, missing } = readWaitlistAirtableSyncConfig({
      AIRTABLE_PERSONAL_ACCESS_TOKEN: undefined,
    })

    expect(config).toBeNull()
    expect(missing).toEqual(['AIRTABLE_PERSONAL_ACCESS_TOKEN'])
  })

  it('maps the four Airtable waitlist tables from the shared base', () => {
    const { config, missing } = readWaitlistAirtableSyncConfig({
      AIRTABLE_PERSONAL_ACCESS_TOKEN: 'pat_test',
    })

    expect(missing).toEqual([])
    expect(config?.baseId).toBe('apppGxObBZlGy0AAo')
    expect(config?.tables.applicants.table).toBe('tblCWAvEXya2mSMU6')
    expect(config?.tables.referrals.table).toBe('tblb1hAx5w3S7hnGM')
    expect(config?.tables.tasks.table).toBe('tblJZKc3ZxWgifQ0f')
    expect(config?.tables.onboarding.table).toBe('tbl48bNOWQ8yN3xRr')
  })

  it('dry-runs without sending records to Airtable', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const db = {
      sql: async () => ({
        rows: [
          {
            signup_id: 7,
            email: 'builder@example.com',
            persona: 'creator',
            primary_wallet: '0x1111111111111111111111111111111111111111',
            csw_address: '0x2222222222222222222222222222222222222222',
            primary_embedded_eoa: '0x3333333333333333333333333333333333333333',
            embedded_wallet: null,
            referral_code: 'AKITA',
            contact_preference: 'email',
            app_access_status: 'approved',
            app_access_decided_at: '2026-05-01T00:00:00.000Z',
            created_at: '2026-04-01T00:00:00.000Z',
            updated_at: '2026-05-02T00:00:00.000Z',
            points_total: 120,
            rank: 1,
          },
        ],
      }),
    }
    const { config } = readWaitlistAirtableSyncConfig({ AIRTABLE_PERSONAL_ACCESS_TOKEN: 'pat_test' })
    expect(config).not.toBeNull()

    const result = await syncWaitlistToAirtable({
      db,
      config: config!,
      dryRun: true,
      fetchImpl,
    })

    expect(result).toMatchObject({
      dryRun: true,
      tables: [
        { key: 'applicants', attempted: 1, upserted: 0, errors: [] },
        { key: 'referrals', attempted: 1, upserted: 0, errors: [] },
        { key: 'tasks', attempted: 1, upserted: 0, errors: [] },
        { key: 'onboarding', attempted: 1, upserted: 0, errors: [] },
      ],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('upserts rows using Airtable-supported merge keys', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ records: [{ id: 'rec1' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as unknown as typeof fetch & { mock: { calls: Array<[RequestInfo | URL, RequestInit]> } }
    const db = {
      sql: async () => ({
        rows: [
          {
            signup_id: 9,
            email: 'waitlist@example.com',
            points_total: 88,
            rank: 4,
            referral_conversion_id: 2,
            point_id: 3,
          },
        ],
      }),
    }
    const { config } = readWaitlistAirtableSyncConfig({ AIRTABLE_PERSONAL_ACCESS_TOKEN: 'pat_test' })
    expect(config).not.toBeNull()

    const result = await syncWaitlistToAirtable({
      db,
      config: config!,
      fetchImpl,
    })

    const calls = fetchImpl.mock.calls.map(([url, init]) => ({
      url: String(url),
      body: JSON.parse(String(init.body)),
    }))
    const applicantsBody = calls.find(call => call.url.includes(config!.tables.applicants.table))?.body
    const referralsBody = calls.find(call => call.url.includes(config!.tables.referrals.table))?.body

    expect(result.tables.map(table => [table.key, table.upserted])).toEqual([
      ['applicants', 1],
      ['referrals', 1],
      ['tasks', 1],
      ['onboarding', 1],
    ])
    expect(applicantsBody.performUpsert.fieldsToMergeOn).toEqual(['email'])
    expect(applicantsBody.records[0].fields).toMatchObject({
      email: 'waitlist@example.com',
      status: 'new',
    })
    expect(applicantsBody.records[0].fields).not.toHaveProperty('id')
    expect(referralsBody.performUpsert.fieldsToMergeOn).toEqual(['id'])
    expect(referralsBody.records[0].fields).toMatchObject({
      id: '2',
      status: 'pending',
    })
  })
})
