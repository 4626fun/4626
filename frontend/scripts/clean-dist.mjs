#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const distPath = path.resolve(process.cwd(), 'dist')
const buildPath = path.resolve(process.cwd(), 'build')

await fs.rm(distPath, { recursive: true, force: true })
await fs.rm(buildPath, { recursive: true, force: true })

console.log('cleaned generated output directories: dist, build')
