/**
 * Shared tip aggregation for Shovel task_updates.
 *
 * shovel.task_updates is append-only history. A bare MIN(src_num) returns the
 * oldest retained row, not the slowest live cursor. Correct tip:
 *   MIN(MAX(src_num) per integration) across required integrations.
 */

/**
 * @param {string[]} igNames
 * @returns {string}
 */
export function buildSlowestCursorTipSql(igNames) {
  if (!Array.isArray(igNames) || igNames.length === 0) {
    throw new Error('igNames must be a non-empty array')
  }
  for (const name of igNames) {
    if (typeof name !== 'string' || !/^[a-z0-9_]+$/i.test(name)) {
      throw new Error(`invalid integration name: ${String(name)}`)
    }
  }
  const namesLiteral = igNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')
  return `
    select
      coalesce(min(tip), 0)::text as tip,
      count(*)::text as present,
      (
        select string_agg(x, ',')
        from unnest(array[${namesLiteral}]::text[]) as x
        where not exists (
          select 1
          from shovel.task_updates t
          where t.ig_name = x
            and t.src_num::bigint > 0
        )
      ) as missing
    from (
      select ig_name, max(src_num::bigint) as tip
      from shovel.task_updates
      where ig_name in (${namesLiteral})
      group by ig_name
    ) per_ig
  `.trim()
}

/**
 * @param {{ tipRaw?: string | null, presentRaw?: string | null, missingRaw?: string | null }} row
 * @param {number} requiredCount
 * @returns {{ ok: boolean, tip: number | null, present: number, missing: string[], detail: string }}
 */
export function interpretSlowestCursorTip(row, requiredCount) {
  const tipRaw = row?.tipRaw ?? '0'
  const present = Number(row?.presentRaw ?? '0')
  const missing = (row?.missingRaw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const tip = Number(tipRaw || '0')

  if (!Number.isFinite(present) || present < requiredCount || missing.length > 0) {
    return {
      ok: false,
      tip: Number.isFinite(tip) && tip > 0 ? tip : null,
      present: Number.isFinite(present) ? present : 0,
      missing: missing.length ? missing : [],
      detail: `enabled integrations missing task_updates tips (present=${Number.isFinite(present) ? present : 0}/${requiredCount}; missing=${missing.join(',') || 'unknown'})`,
    }
  }

  if (!Number.isFinite(tip) || tip <= 0) {
    return {
      ok: false,
      tip: null,
      present,
      missing: [],
      detail: 'no shovel.task_updates tip for enabled integrations',
    }
  }

  return {
    ok: true,
    tip,
    present,
    missing: [],
    detail: `index tip=${tip} (min of per-ig max; ${present}/${requiredCount})`,
  }
}
