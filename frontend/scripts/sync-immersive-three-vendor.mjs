#!/usr/bin/env node
/**
 * GLTFLoader.js imports ../utils/BufferGeometryUtils.js and SkeletonUtils.js.
 * Keep them vendored beside public/immersive/vendor/three/addons/loaders/.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const threeJsm = path.join(root, 'node_modules/three/examples/jsm')
const destUtils = path.join(root, 'public/immersive/vendor/three/addons/utils')

const files = ['BufferGeometryUtils.js', 'SkeletonUtils.js']

for (const name of files) {
  const src = path.join(threeJsm, 'utils', name)
  const dest = path.join(destUtils, name)
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src} — run pnpm -C frontend install`)
    process.exit(1)
  }
  fs.mkdirSync(destUtils, { recursive: true })
  fs.copyFileSync(src, dest)
}

console.log(`Synced ${files.length} Three.js utils → ${destUtils}`)
