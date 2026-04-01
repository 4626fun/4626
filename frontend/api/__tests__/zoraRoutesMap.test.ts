import { describe, expect, it } from 'vitest'

import { zoraRouteLoaders } from '../_handlers/_routes.zora.ts'
import { zoraCliRouteSubpaths } from '../_handlers/zora/cli/_routes.ts'

describe('zora route loader map', () => {
  it('keeps existing core routes and adds CLI compatibility routes', () => {
    expect(typeof zoraRouteLoaders.coin).toBe('function')
    expect(typeof zoraRouteLoaders.explore).toBe('function')
    expect(typeof zoraRouteLoaders.profile).toBe('function')

    expect(typeof zoraRouteLoaders[zoraCliRouteSubpaths.authStatus]).toBe('function')
    expect(typeof zoraRouteLoaders[zoraCliRouteSubpaths.explore]).toBe('function')
    expect(typeof zoraRouteLoaders[zoraCliRouteSubpaths.get]).toBe('function')
    expect(typeof zoraRouteLoaders[zoraCliRouteSubpaths.priceHistory]).toBe('function')
    expect(typeof zoraRouteLoaders[zoraCliRouteSubpaths.profile]).toBe('function')
  })
})
