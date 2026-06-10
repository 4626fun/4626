#!/usr/bin/env node

const FORMAT_TEXT = 'text'
const FORMAT_JSON = 'json'
const FORMAT_MARKDOWN = 'markdown'

function normalizeFormat(argv = process.argv.slice(2)) {
  const wantsJson = argv.includes('--json')
  const wantsMarkdown = argv.includes('--markdown')
  if (wantsJson && wantsMarkdown) {
    throw new Error('choose only one output format: --json or --markdown')
  }
  if (wantsJson) return FORMAT_JSON
  if (wantsMarkdown) return FORMAT_MARKDOWN
  return FORMAT_TEXT
}

function compareViolations(a, b) {
  const aKey = `${a.rule ?? ''}|${a.file ?? ''}|${a.specifier ?? ''}`
  const bKey = `${b.rule ?? ''}|${b.file ?? ''}|${b.specifier ?? ''}`
  return aKey.localeCompare(bKey)
}

function buildPayload({
  guard,
  violations,
  checks = [],
  remediation = [],
  fatalError = null,
}) {
  const normalizedViolations = [...violations].sort(compareViolations)
  const status = fatalError
    ? 'error'
    : normalizedViolations.length > 0
      ? 'fail'
      : 'pass'

  return {
    guard,
    status,
    counts: {
      violations: normalizedViolations.length,
    },
    checks,
    violations: normalizedViolations,
    remediation,
    fatalError,
  }
}

function renderText(payload) {
  if (payload.status === 'pass') {
    console.log(`ok: ${payload.guard}`)
    for (const check of payload.checks) console.log(` - ${check}`)
    return
  }

  if (payload.status === 'error') {
    console.error(`error: ${payload.guard} could not complete (fail-closed)`)
    console.error(` - ${payload.fatalError ?? 'unknown fatal error'}`)
    return
  }

  console.error(`error: ${payload.guard} violations found:`)
  for (const violation of payload.violations) {
    const rule = violation.rule ? `[${violation.rule}] ` : ''
    const specifier = violation.specifier ? `: ${violation.specifier}` : ''
    console.error(`- ${rule}${violation.file ?? '<unknown>'}${specifier}`)
    if (violation.detail) console.error(`    ${violation.detail}`)
  }
  if (payload.remediation.length > 0) {
    console.error('\nTo resolve:')
    for (const item of payload.remediation) console.error(`- ${item}`)
  }
}

function renderMarkdown(payload) {
  const lines = []
  lines.push(`## ${payload.guard}`)
  lines.push('')
  lines.push(`- Status: \`${payload.status}\``)
  lines.push(`- Violations: \`${payload.counts.violations}\``)
  lines.push('')

  if (payload.status === 'pass' && payload.checks.length > 0) {
    lines.push('### Checks')
    lines.push('')
    for (const check of payload.checks) lines.push(`- ${check}`)
    lines.push('')
  }

  if (payload.status === 'error') {
    lines.push('### Fatal error')
    lines.push('')
    lines.push(`- ${payload.fatalError ?? 'unknown fatal error'}`)
    lines.push('')
  }

  if (payload.violations.length > 0) {
    lines.push('### Violations')
    lines.push('')
    for (const violation of payload.violations) {
      const rule = violation.rule ? `[${violation.rule}] ` : ''
      const specifier = violation.specifier ? ` — \`${violation.specifier}\`` : ''
      lines.push(`- ${rule}\`${violation.file ?? '<unknown>'}\`${specifier}`)
      if (violation.detail) lines.push(`  - ${violation.detail}`)
    }
    lines.push('')
  }

  if (payload.remediation.length > 0) {
    lines.push('### Remediation')
    lines.push('')
    for (const item of payload.remediation) lines.push(`- ${item}`)
    lines.push('')
  }

  process.stdout.write(lines.join('\n'))
}

function render(payload, format) {
  if (format === FORMAT_JSON) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    return
  }
  if (format === FORMAT_MARKDOWN) {
    renderMarkdown(payload)
    return
  }
  renderText(payload)
}

export function reportGuard({
  guard,
  violations = [],
  checks = [],
  remediation = [],
  fatalError = null,
  argv = process.argv.slice(2),
}) {
  const format = normalizeFormat(argv)
  const payload = buildPayload({
    guard,
    violations,
    checks,
    remediation,
    fatalError,
  })
  render(payload, format)

  if (payload.status === 'error') return 2
  if (payload.status === 'fail') return 1
  return 0
}
