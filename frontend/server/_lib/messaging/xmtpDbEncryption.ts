import fs from 'node:fs'
import path from 'node:path'

import { listXmtpDb3FilesUnderRoot } from './xmtpDbDirectory.js'

const SQLITE_HEADER = Buffer.from('SQLite format 3\u0000', 'utf8')

export function fileLooksLikePlainSqlite(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false
    // XMTP's SQLCipher-backed DBs keep a sidecar salt file. Treat those as
    // encrypted even when the main DB file uses a SQLite-compatible header.
    if (fs.existsSync(`${filePath}.sqlcipher_salt`)) return false
    const fd = fs.openSync(filePath, 'r')
    try {
      const header = Buffer.alloc(SQLITE_HEADER.length)
      const bytesRead = fs.readSync(fd, header, 0, header.length, 0)
      if (bytesRead !== SQLITE_HEADER.length) return false
      return header.equals(SQLITE_HEADER)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return false
  }
}

export function hasLegacyPlaintextDbInDir(rootDir: string): boolean {
  try {
    for (const filePath of listXmtpDb3FilesUnderRoot(rootDir)) {
      if (fileLooksLikePlainSqlite(filePath)) return true
    }
    return false
  } catch {
    return false
  }
}

export function hasLegacyMigrationBackupForFile(filePath: string): boolean {
  try {
    const dir = path.dirname(filePath)
    const base = path.basename(filePath)
    const prefix = `${base}.legacy-unencrypted.`
    return fs.readdirSync(dir).some((name) => name.startsWith(prefix))
  } catch {
    return false
  }
}
