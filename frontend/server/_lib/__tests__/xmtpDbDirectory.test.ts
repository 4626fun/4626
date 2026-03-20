import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { listXmtpDb3FilesUnderRoot } from '../xmtpDbDirectory.js'

describe('listXmtpDb3FilesUnderRoot', () => {
  let tmp: string | null = null

  afterEach(() => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true })
      tmp = null
    }
  })

  it('finds .db3 files nested under subfolders (e.g. v3/)', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xmtp-db-test-'))
    const v3 = path.join(tmp, 'v3')
    fs.mkdirSync(v3, { recursive: true })
    fs.writeFileSync(path.join(v3, 'xmtp-production-abc.db3'), 'SQLite format 3\0')
    fs.writeFileSync(path.join(tmp, 'ignored.txt'), 'x')

    const found = listXmtpDb3FilesUnderRoot(tmp)
    expect(found.length).toBe(1)
    expect(found[0]).toBe(path.join(v3, 'xmtp-production-abc.db3'))
  })

  it('returns empty when no db3 files exist', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xmtp-db-test-'))
    fs.mkdirSync(path.join(tmp, 'empty'), { recursive: true })
    expect(listXmtpDb3FilesUnderRoot(tmp)).toEqual([])
  })
})
