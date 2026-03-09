import React from 'react'
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AdminImageGeneration } from './AdminImageGeneration'

describe('AdminImageGeneration', () => {
  it('renders the minimal reference-guided image workflow UI', () => {
    const html = renderToStaticMarkup(React.createElement(AdminImageGeneration))

    expect(html).toContain('Reference-guided image composition')
    expect(html).toContain('Vault / frame reference')
    expect(html).toContain('Token mascot / subject reference')
    expect(html).toContain('Generate')
    expect(html).toContain('Refine output')
    expect(html).toContain('Preview expects a public Supabase image bucket')
  })

  it('documents the local Vite imagegen API routes needed for localhost /admin/imagegen testing', () => {
    const viteConfigSource = fs.readFileSync(path.resolve(__dirname, '../../vite.config.ts'), 'utf8')

    expect(viteConfigSource).toContain("'/api/image/projects/create': () => import('./api/_handlers/image/_projects-create')")
    expect(viteConfigSource).toContain("'/api/image/projects/assets/upload': () => import('./api/_handlers/image/_assets-upload')")
    expect(viteConfigSource).toContain("'/api/image/projects/generate': () => import('./api/_handlers/image/_generate')")
    expect(viteConfigSource).toContain("'/api/image/projects/refine': () => import('./api/_handlers/image/_refine')")
    expect(viteConfigSource).toContain("'/api/image/jobs/status': () => import('./api/_handlers/image/_jobs-status')")
    expect(viteConfigSource).toContain("'/api/image/projects/get': () => import('./api/_handlers/image/_projects-get')")
  })
})
