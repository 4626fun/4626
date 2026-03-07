import React from 'react'
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
  })
})
