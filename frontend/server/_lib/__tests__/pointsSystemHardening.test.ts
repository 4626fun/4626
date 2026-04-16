import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readLocalSource(pathname: string): string {
  return readFileSync(new URL(pathname, import.meta.url), 'utf8')
}

describe('unified points ledger hardening', () => {
  it('does not create or write legacy account point tables', () => {
    const source = readLocalSource('../identity/accountsIdentity.ts').toLowerCase()
    expect(source.includes('create table if not exists account_points')).toBe(false)
    expect(source.includes('create table if not exists account_point_events')).toBe(false)
    expect(source.includes('insert into account_points')).toBe(false)
    expect(source.includes('insert into account_point_events')).toBe(false)
    expect(source.includes('from account_point_events')).toBe(false)
  })

  it('does not create or write legacy AMOE credit tables', () => {
    const source = readLocalSource('../lottery/lotteryAmoe.ts').toLowerCase()
    expect(source.includes('create table if not exists lottery_amoe_credits')).toBe(false)
    expect(source.includes('create table if not exists lottery_amoe_credit_ledger')).toBe(false)
    expect(source.includes('insert into lottery_amoe_credits')).toBe(false)
    expect(source.includes('insert into lottery_amoe_credit_ledger')).toBe(false)
  })

  it('does not reference legacy waitlist points ledger tables in admin handlers', () => {
    const source = readLocalSource('../../../api/_handlers/admin/waitlist/_delete.ts').toLowerCase()
    expect(source.includes('waitlist_points_ledger')).toBe(false)
  })
})
