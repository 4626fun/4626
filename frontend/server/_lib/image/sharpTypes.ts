/**
 * Sharp ships `export =` + a same-named namespace. Under `moduleResolution: "bundler"`,
 * `import sharp from 'sharp'` brings the callable into value space but not the namespace,
 * so `sharp.OverlayOptions` / `sharp.Sharp` fail with TS2503. Resolve types via
 * `import('sharp').…` instead.
 */
export type SharpOverlayOptions = import('sharp').OverlayOptions
export type SharpInstance = import('sharp').Sharp

/** Node 22+ Buffer is generic; sharp returns `Buffer<ArrayBufferLike>`. */
export type ImageBuffer = Buffer<ArrayBufferLike>
