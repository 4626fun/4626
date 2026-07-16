#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensurePhase2CoreCreatesPrecreated } from '../../api/_handlers/deploy/v2/session/phase2CorePrecreate.ts'

async function main() {
  const planPath = resolve(process.argv[2] || '../tmp/v1191-creator-canary-plan.json')
  const plan = JSON.parse(readFileSync(planPath, 'utf8'))
  const result = await ensurePhase2CoreCreatesPrecreated(plan.phase2CoreCalls || [])
  console.log(JSON.stringify(result, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
