function shouldSuppressEarlyDevNoise(args: unknown[]): boolean {
  if (!args.length) return false
  const joined = args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.message
      return String((arg as any)?.message ?? arg ?? '')
    })
    .join(' ')
    .toLowerCase()
  if (!joined) return false
  return (
    joined.includes('motion() is deprecated. use motion.create() instead') ||
    joined.includes('lit is in dev mode. not recommended for production') ||
    joined.includes('unable to refresh tokens - token is missing or no longer valid') ||
    joined.includes('cannot redefine property: ethereum') ||
    joined.includes('cannot set property ethereum of #<window> which has only a getter') ||
    joined.includes('injected is not defined') ||
    (joined.includes('websocket error 1006') && joined.includes('requestrelay.js')) ||
    joined.includes('accessing element.ref was removed in react 19') ||
    (joined.includes('failed to fetch dynamically imported module:') &&
      (joined.includes('chrome-extension://') || joined.includes('moz-extension://'))) ||
    (joined.includes('each child in a list should have a unique "key" prop') &&
      joined.includes('check the render method of `fragment`') &&
      joined.includes('child from me'))
  )
}

if (typeof window !== 'undefined' && !(window as any).__cvEarlyConsolePatched) {
  const originalWarn = console.warn.bind(console)
  const originalError = console.error.bind(console)
  console.warn = (...args: unknown[]) => {
    if (shouldSuppressEarlyDevNoise(args)) return
    originalWarn(...args)
  }
  console.error = (...args: unknown[]) => {
    if (shouldSuppressEarlyDevNoise(args)) return
    originalError(...args)
  }
  ;(window as any).__cvEarlyConsolePatched = true
}

export {}
