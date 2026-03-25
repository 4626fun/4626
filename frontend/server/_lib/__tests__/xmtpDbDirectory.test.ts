import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  findMountedAncestorPath,
  hasDedicatedMount,
  listXmtpDb3FilesUnderRoot,
  parseMountInfoMountPoints,
} from '../xmtpDbDirectory.js'

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

describe('mount detection helpers', () => {
  const mountInfo = [
    '36 25 0:32 / / rw,relatime - overlay overlay rw',
    '74 36 0:60 / /data/.xmtp-data rw,relatime - ext4 /dev/vdb rw',
    '81 36 0:61 / /tmp rw,nosuid,nodev - tmpfs tmpfs rw',
  ].join('\n')
  const parentMountInfo = [
    '36 25 0:32 / / rw,relatime - overlay overlay rw',
    '74 36 0:60 / /data rw,relatime - ext4 /dev/vdb rw',
  ].join('\n')

  it('parses mount points from /proc/self/mountinfo', () => {
    expect(parseMountInfoMountPoints(mountInfo)).toEqual(['/', '/data/.xmtp-data', '/tmp'])
  })

  it('finds the closest mounted ancestor for a target path', () => {
    expect(findMountedAncestorPath('/data/.xmtp-data/v3/xmtp.db3', mountInfo)).toBe('/data/.xmtp-data')
    expect(findMountedAncestorPath('/tmp/foo/bar', mountInfo)).toBe('/tmp')
    expect(findMountedAncestorPath('/app/.xmtp-data', mountInfo)).toBe('/')
  })

  it('treats rootfs-only paths as not dedicated mounts', () => {
    expect(hasDedicatedMount('/app/.xmtp-data', mountInfo)).toBe(false)
    expect(hasDedicatedMount('/data/.xmtp-data/v3/xmtp.db3', mountInfo)).toBe(true)
  })

  it('accepts a parent mount that contains the XMTP DB directory', () => {
    expect(findMountedAncestorPath('/data/.xmtp-data/v3/xmtp.db3', parentMountInfo)).toBe('/data')
    expect(hasDedicatedMount('/data/.xmtp-data/v3/xmtp.db3', parentMountInfo)).toBe(true)
  })

  it('returns no dedicated mount when mount info is unavailable', () => {
    expect(findMountedAncestorPath('/data/.xmtp-data/v3/xmtp.db3', '')).toBeNull()
    expect(hasDedicatedMount('/data/.xmtp-data/v3/xmtp.db3', '')).toBe(false)
  })

  it('resolves symlinked target paths before comparing against mount points', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xmtp-mount-symlink-'))
    const mounted = path.join(root, 'mounted-volume')
    const link = path.join(root, 'db-link')
    try {
      fs.mkdirSync(mounted, { recursive: true })
      fs.symlinkSync(mounted, link)
      const symlinkMountInfo = [
        '36 25 0:32 / / rw,relatime - overlay overlay rw',
        `74 36 0:60 / ${mounted} rw,relatime - ext4 /dev/vdb rw`,
      ].join('\n')

      expect(findMountedAncestorPath(path.join(link, 'v3', 'xmtp.db3'), symlinkMountInfo)).toBe(mounted)
      expect(hasDedicatedMount(path.join(link, 'v3', 'xmtp.db3'), symlinkMountInfo)).toBe(true)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
