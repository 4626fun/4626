// PR 6c P1 hotfix v2 (Codex follow-up): the phase-A intent marker is
// written ATOMICALLY inside `consumeAmoeCreditsForEntry`'s debit CTE,
// not by a separate post-debit INSERT in the handler.
//
// Codex flagged the original layout as P1: a transient DB failure on
// the handler-side INSERT after the debit had already committed would
// leave an unmarked burn that the refund cron would then permanently
// skip (its EXISTS guard joins on `amoe_burn_credits_intents`). Users
// would silently lose credits unless they happened to retry with the
// same `spendRefId`.
//
// The fix folds the intent insert into the same single-statement CTE
// as the debit — Postgres single-statement transactional atomicity
// guarantees both rows commit or neither does.
//
// This test pins the contract structurally so a future refactor that
// reverts to a separate post-debit INSERT fails the build.
//
// See: docs/security/amoe-burn-then-submit-design.md §5.1.1
//      docs/security/amoe-pr5b-publisher-runbook.md (Phase-A scope guard)

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readLocalSource(pathname: string): string {
  return readFileSync(new URL(pathname, import.meta.url), 'utf8')
}

const lotteryAmoeSource = readLocalSource('../lottery/lotteryAmoe.ts')
const burnCreditsHandlerSource = readFileSync(
  new URL(
    '../../../api/_handlers/v1/lottery/_amoeBurnCredits.ts',
    import.meta.url,
  ),
  'utf8',
)

describe('AMOE burn-credits — atomic phase-A intent marker', () => {
  describe('lib layer — consumeAmoeCreditsForEntry', () => {
    // Find the bounds of the function so we don't accidentally match
    // strings elsewhere in the (large) file.
    const fnStart = lotteryAmoeSource.indexOf(
      'export async function consumeAmoeCreditsForEntry',
    )
    // The next top-level export marks the end of the function for our
    // purposes. `AmoeMessageFields` is the immediately-following symbol.
    const fnEnd = lotteryAmoeSource.indexOf('export type AmoeMessageFields', fnStart)
    const fnBody = lotteryAmoeSource.slice(fnStart, fnEnd)

    it('locates the function body', () => {
      expect(fnStart).toBeGreaterThan(-1)
      expect(fnEnd).toBeGreaterThan(fnStart)
    })

    it('writes the intent row inside the same CTE as the debit', () => {
      // The single statement must contain BOTH the points debit AND
      // the intent insert, joined by sharing the `ins` CTE so the
      // intent only inserts when the debit row was inserted.
      expect(fnBody).toMatch(
        /WITH\s+current\s+AS[\s\S]+?ins\s+AS\s*\([\s\S]+?INSERT\s+INTO\s+points\b/i,
      )
      expect(fnBody).toMatch(
        /intent_ins\s+AS\s*\([\s\S]+?INSERT\s+INTO\s+amoe_burn_credits_intents\b/i,
      )
      // Critical: `intent_ins` must SELECT FROM `ins` (not from
      // `current` or a constant), so it only fires when the debit row
      // was actually inserted. If somebody refactors this to
      // `SELECT ${signupId}, ${spendRefId}` without `FROM ins`, the
      // intent would be written even when the debit was a no-op (e.g.
      // insufficient credits short-circuit), which breaks the
      // atomicity invariant in the OTHER direction.
      expect(fnBody).toMatch(
        /intent_ins\s+AS\s*\(\s*INSERT\s+INTO\s+amoe_burn_credits_intents[\s\S]+?FROM\s+ins\b/i,
      )
    })

    it('uses ON CONFLICT DO NOTHING on the intent insert (idempotent retries)', () => {
      // Locate the intent_ins block specifically and assert the
      // conflict clause is inside it. The CTE body ends at the
      // closing `)` followed by either `,` (next CTE) or whitespace
      // before the outer `SELECT` — we approximate by taking a
      // generous window forward and asserting the conflict clause
      // appears before the next CTE keyword (`intent_ins` is the
      // last CTE before the outer SELECT today).
      const intentStart = fnBody.indexOf('intent_ins AS')
      expect(intentStart).toBeGreaterThan(-1)
      // Window from `intent_ins AS` to the outer top-level SELECT
      // (which begins with `SELECT\n      (SELECT credits FROM current)`).
      const outerSelectStart = fnBody.indexOf(
        'SELECT\n      (SELECT credits',
        intentStart,
      )
      expect(outerSelectStart).toBeGreaterThan(intentStart)
      const intentBody = fnBody.slice(intentStart, outerSelectStart)
      expect(intentBody).toMatch(/ON\s+CONFLICT\s+DO\s+NOTHING/i)
    })

    it('does NOT write the intent in a separate post-debit statement', () => {
      // Codex P1: the original layout had a *second* `db.sql` template
      // call after the debit returned, which is the racy pattern. The
      // helper should now perform exactly two SQL statements at most:
      //   1. The debit-with-intent CTE (always)
      //   2. The retry-path SELECT WITH intent_backfill CTE (only if
      //      the debit was a no-op)
      // and NO standalone `INSERT INTO amoe_burn_credits_intents` at
      // the helper-function tail.
      //
      // We approximate this by counting INSERT-INTO-intents
      // occurrences and asserting they live inside CTE blocks
      // (`intent_ins` or `intent_backfill`), never as a standalone
      // statement.
      const inserts = fnBody.match(/INSERT\s+INTO\s+amoe_burn_credits_intents\b/gi) ?? []
      expect(inserts.length).toBeGreaterThanOrEqual(1)
      // For each occurrence, the preceding ~80 characters must contain
      // either `intent_ins AS (` or `intent_backfill AS (` — i.e.
      // the INSERT lives inside a CTE, not at top-level.
      const insertRegex = /INSERT\s+INTO\s+amoe_burn_credits_intents\b/gi
      let match: RegExpExecArray | null
      while ((match = insertRegex.exec(fnBody)) !== null) {
        const lookback = fnBody.slice(Math.max(0, match.index - 200), match.index)
        const isInCte = /(intent_ins|intent_backfill)\s+AS\s*\(/i.test(lookback)
        expect(
          isInCte,
          `INSERT INTO amoe_burn_credits_intents at offset ${match.index} ` +
            `is not inside an intent_ins / intent_backfill CTE — atomic ` +
            `intent invariant broken.`,
        ).toBe(true)
      }
    })

    it('backfills the intent on the idempotent-retry path', () => {
      // When the debit row already exists (idempotent retry against
      // the same spendRefId), the helper must still ATTEMPT to write
      // the intent — for two reasons:
      //   (a) Legacy debits committed during the brief window before
      //       this hotfix landed have no intent row.
      //   (b) Any pathological case where the debit's CTE committed
      //       but the application-layer follow-up (e.g. the read of
      //       `creditsRemaining`) failed and the caller retried.
      // The backfill is wrapped in `intent_backfill AS (...)` and is
      // ON CONFLICT DO NOTHING so it's safe to fire repeatedly.
      expect(fnBody).toMatch(
        /intent_backfill\s+AS\s*\(\s*INSERT\s+INTO\s+amoe_burn_credits_intents/i,
      )
      const backfillStart = fnBody.indexOf('intent_backfill AS')
      expect(backfillStart).toBeGreaterThan(-1)
      const backfillBody = fnBody.slice(backfillStart, backfillStart + 600)
      expect(backfillBody).toMatch(/ON\s+CONFLICT\s+DO\s+NOTHING/i)
      // The backfill must FROM the existing-row CTE so it only fires
      // when we actually observed an existing debit row.
      expect(backfillBody).toMatch(/FROM\s+existing\b/i)
    })
  })

  describe('handler layer — _amoeBurnCredits.ts', () => {
    it('does NOT import getDb', () => {
      // The handler must not perform any direct DB writes for the
      // intent marker. All intent writes happen inside the lib helper.
      expect(burnCreditsHandlerSource).not.toMatch(
        /import\s*\{\s*getDb\s*\}\s*from\s*['"][^'"]*db\/postgres/,
      )
    })

    it('does NOT issue a follow-up INSERT into amoe_burn_credits_intents', () => {
      // Codex P1 was specifically about a handler-side INSERT after
      // the debit. Lock that pattern out structurally.
      expect(burnCreditsHandlerSource).not.toMatch(
        /INSERT\s+INTO\s+amoe_burn_credits_intents/i,
      )
    })

    it('documents that the intent is written atomically by the lib', () => {
      // A code-comment canary so future readers understand WHY the
      // handler doesn't touch the intent table directly. Without this
      // a well-meaning refactor could re-introduce the race.
      expect(burnCreditsHandlerSource).toMatch(/atomic/i)
      expect(burnCreditsHandlerSource).toMatch(/consumeAmoeCreditsForEntry/)
    })
  })
})
