import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readLocalSource(pathname: string): string {
  return readFileSync(new URL(pathname, import.meta.url), 'utf8')
}

/**
 * AMOE compliance lock-ins.
 *
 * AMOE ("Alternative Method of Entry") must be free of any nexus to a
 * paid action. The lottery treats unified `points` as the substrate
 * for both leaderboard/tier (paid OK) AND for funding free entries
 * (paid NOT OK). The bifurcation is enforced by the SQL view
 * `points_amoe_eligible_balance`, which uses a strict allowlist
 * (fail-closed `ELSE 0`).
 *
 * These tests are a static regression net: if someone refactors the
 * AMOE spend path and accidentally re-introduces a path that lets
 * paid-action points (e.g. `has_creator_coin`, `referral_*`) fund
 * free entries, the suite breaks loudly.
 *
 * See: docs/security/amoe-points-source-audit.md
 */
describe('AMOE points eligibility bifurcation', () => {
  const lotteryAmoeSource = readLocalSource('../lottery/lotteryAmoe.ts')
  const migrationSource = readFileSync(
    new URL(
      '../../../../supabase/migrations/20260427180000_amoe_eligible_points_view.sql',
      import.meta.url,
    ),
    'utf8',
  )

  describe('allowlist view definition', () => {
    it('defines the points_amoe_eligible_balance view in lotteryAmoe.ts', () => {
      expect(
        lotteryAmoeSource.includes('CREATE OR REPLACE VIEW points_amoe_eligible_balance'),
      ).toBe(true)
    })

    it('defines the points_amoe_eligible_balance view in supabase migrations', () => {
      const lowered = migrationSource.toLowerCase()
      // Tolerate the optional `public.` schema qualifier.
      const hasView =
        lowered.includes('create or replace view points_amoe_eligible_balance') ||
        lowered.includes('create or replace view public.points_amoe_eligible_balance')
      expect(hasView).toBe(true)
    })

    it('uses fail-closed ELSE 0 in the view (runtime bootstrap)', () => {
      // The CASE in the view must NOT have a permissive default. Any new
      // source must be explicitly allowlisted. Look for the view block
      // ending with `ELSE 0` rather than scanning the whole file (the
      // file has other CASEs unrelated to AMOE eligibility).
      const viewStart = lotteryAmoeSource.indexOf(
        'CREATE OR REPLACE VIEW points_amoe_eligible_balance',
      )
      expect(viewStart).toBeGreaterThan(-1)
      const viewEnd = lotteryAmoeSource.indexOf('GROUP BY signup_id', viewStart)
      expect(viewEnd).toBeGreaterThan(viewStart)
      const viewBody = lotteryAmoeSource.slice(viewStart, viewEnd)
      expect(viewBody.includes('ELSE 0')).toBe(true)
      // And the legacy permissive default must be gone from the view body.
      expect(viewBody.includes('ELSE amount * 0.30')).toBe(false)
    })

    it('uses fail-closed ELSE 0 in the migration', () => {
      const lowered = migrationSource.toLowerCase()
      expect(lowered.includes('else 0')).toBe(true)
      expect(lowered.includes('else amount * 0.30')).toBe(false)
    })
  })

  describe('paid-action sources are excluded from AMOE eligibility', () => {
    const paidActionSources = [
      'has_creator_coin',
      'referral_passthrough',
      'referral_signup',
      'referral_csw_link',
      'referral_qualified',
    ]

    for (const src of paidActionSources) {
      it(`view does not allowlist '${src}'`, () => {
        // The runtime view block must not mention this source as a
        // CASE WHEN branch. Scoping the search to the view block keeps
        // it surgical — `has_creator_coin` is a legitimate award source
        // elsewhere; what we forbid is funding AMOE entries with it.
        const viewStart = lotteryAmoeSource.indexOf(
          'CREATE OR REPLACE VIEW points_amoe_eligible_balance',
        )
        const viewEnd = lotteryAmoeSource.indexOf('GROUP BY signup_id', viewStart)
        const viewBody = lotteryAmoeSource.slice(viewStart, viewEnd)
        expect(viewBody.includes(`'${src}'`)).toBe(false)
      })

      it(`migration does not allowlist '${src}'`, () => {
        expect(migrationSource.includes(`'${src}'`)).toBe(false)
      })
    }
  })

  describe('AMOE-eligible reader is wired in correctly', () => {
    it('exports/defines readAmoeEligibleCreditsForSignup', () => {
      expect(lotteryAmoeSource.includes('readAmoeEligibleCreditsForSignup')).toBe(true)
    })

    it('AMOE spend (consumeAmoeCreditsForEntry) gates on the same waitlist-weighted balance as public points', () => {
      const fnStart = lotteryAmoeSource.indexOf(
        'export async function consumeAmoeCreditsForEntry',
      )
      expect(fnStart).toBeGreaterThan(-1)
      const fnEnd = lotteryAmoeSource.indexOf(
        '\nexport async function ',
        fnStart + 'export async function consumeAmoeCreditsForEntry'.length,
      )
      const fnBody = lotteryAmoeSource.slice(fnStart, fnEnd > -1 ? fnEnd : undefined)

      expect(fnBody.includes('FROM points_amoe_eligible_balance')).toBe(false)
      expect(fnBody.includes("'referral_passthrough'")).toBe(true)
      expect(fnBody.includes("'amoe_entry_spend'")).toBe(true)
    })

    it('readAmoeEligibleCreditsForSignup uses waitlist breakdown (one public points total)', () => {
      const fnStart = lotteryAmoeSource.indexOf(
        'async function readAmoeEligibleCreditsForSignup',
      )
      expect(fnStart).toBeGreaterThan(-1)
      const fnEnd = lotteryAmoeSource.indexOf('\n}', fnStart)
      const fnBody = lotteryAmoeSource.slice(fnStart, fnEnd)
      expect(fnBody.includes('readWaitlistPointsBreakdown')).toBe(true)
      expect(fnBody.includes('FROM points_amoe_eligible_balance')).toBe(false)
    })

    it('getAmoeCreditSnapshot uses the AMOE-eligible reader', () => {
      const fnStart = lotteryAmoeSource.indexOf(
        'export async function getAmoeCreditSnapshot',
      )
      expect(fnStart).toBeGreaterThan(-1)
      const fnEnd = lotteryAmoeSource.indexOf(
        '\nexport async function ',
        fnStart + 'export async function getAmoeCreditSnapshot'.length,
      )
      const fnBody = lotteryAmoeSource.slice(fnStart, fnEnd > -1 ? fnEnd : undefined)
      expect(fnBody.includes('readAmoeEligibleCreditsForSignup')).toBe(true)
      expect(fnBody.includes('readUnifiedPointsForSignup')).toBe(false)
    })

    it('claimDailyTwitterCheckin uses the AMOE-eligible reader for the returned snapshot', () => {
      const fnStart = lotteryAmoeSource.indexOf(
        'export async function claimDailyTwitterCheckin',
      )
      expect(fnStart).toBeGreaterThan(-1)
      const fnEnd = lotteryAmoeSource.indexOf(
        '\nexport async function ',
        fnStart + 'export async function claimDailyTwitterCheckin'.length,
      )
      const fnBody = lotteryAmoeSource.slice(fnStart, fnEnd > -1 ? fnEnd : undefined)
      expect(fnBody.includes('readAmoeEligibleCreditsForSignup')).toBe(true)
      expect(fnBody.includes('readUnifiedPointsForSignup')).toBe(false)
    })

    it('keeps readUnifiedPointsForSignup for non-AMOE leaderboard/tier reads', () => {
      // Bifurcation, not deletion: tier/leaderboard still use the
      // unified balance. We just want both readers to exist.
      expect(lotteryAmoeSource.includes('function readUnifiedPointsForSignup')).toBe(true)
    })
  })

  describe('eligible subset invariant', () => {
    // For every source the eligibility view weights, the unified ledger
    // (readUnifiedPointsForSignup) MUST weight it at least as much,
    // otherwise AMOE-eligible credits could exceed unified points and
    // the "eligible subset" property documented in this PR no longer
    // holds. This guards against the class of bug found by Codex on
    // PR #394: amoe_checkin was 1.00x in the view but fell into the
    // 0.30x ELSE in the unified reader.
    function findExplicitSourceWeight(
      body: string,
      source: string,
    ): number | null {
      // Match `source = '<name>'  THEN amount [* <weight>]`.
      // We allow either a pure `THEN amount` (weight 1.00) or an
      // explicit multiplier.
      const re = new RegExp(
        `source\\s*=\\s*'${source}'[^\\n]*?THEN\\s+amount(?:\\s*\\*\\s*([0-9]+(?:\\.[0-9]+)?))?`,
      )
      const match = body.match(re)
      if (!match) return null
      if (match[1] === undefined) return 1.0
      return Number.parseFloat(match[1])
    }

    function unifiedReaderBody(): string {
      const start = lotteryAmoeSource.indexOf(
        'async function readUnifiedPointsForSignup',
      )
      const end = lotteryAmoeSource.indexOf('\n}', start)
      return lotteryAmoeSource.slice(start, end)
    }

    function viewBody(): string {
      const start = lotteryAmoeSource.indexOf(
        'CREATE OR REPLACE VIEW points_amoe_eligible_balance',
      )
      const end = lotteryAmoeSource.indexOf('GROUP BY signup_id', start)
      return lotteryAmoeSource.slice(start, end)
    }

    // Sources that the view explicitly weights at 1.00x (full credit).
    // For each, the unified reader must also weight them at >= 1.00x.
    const fullCreditSources = [
      'amoe_twitter_daily',
      'amoe_checkin',
      'waitlist_signup',
      'csw_link',
    ]

    for (const src of fullCreditSources) {
      it(`unified reader weights '${src}' at >= the view's 1.00x weight`, () => {
        const view = findExplicitSourceWeight(viewBody(), src)
        const unified = findExplicitSourceWeight(unifiedReaderBody(), src)
        expect(view).not.toBeNull()
        expect(unified).not.toBeNull()
        expect(view).toBe(1.0)
        // unified must be >= view weight to preserve the subset invariant.
        expect(unified!).toBeGreaterThanOrEqual(view!)
      })
    }

    it('unified reader has an explicit branch for amoe_checkin (regression: PR #394 review)', () => {
      // If this branch ever drops back into the ELSE * 0.30 fallback,
      // amoe_checkin under-counts in unified points while still being
      // 1.00x in the eligibility view — the exact bug Codex flagged.
      expect(unifiedReaderBody().includes("source = 'amoe_checkin'")).toBe(true)
    })
  })
})
