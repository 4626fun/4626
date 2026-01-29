import { memo, useEffect, useRef, useState } from 'react'

type Props = {
  className?: string
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

function canUseWebgl(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      (canvas.getContext('webgl', { alpha: true, antialias: false }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    return !!gl
  } catch {
    return false
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL shader alloc failed')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(log)
  }
  return shader
}

function linkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('WebGL program alloc failed')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Unknown program link error'
    gl.deleteProgram(program)
    throw new Error(log)
  }
  return program
}

/**
 * Lightweight, Shadertoy-style background shader for the waitlist “done” moment.
 * - Progressive enhancement only (fails open to “no effect”)
 * - Respects prefers-reduced-motion
 * - Pauses when tab is hidden
 */
export const WaitlistDoneCelebrationBackground = memo(function WaitlistDoneCelebrationBackground({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const [enabled] = useState(() => !prefersReducedMotion() && canUseWebgl())

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false }) as
      | WebGLRenderingContext
      | null
    if (!gl) return

    // Fullscreen triangle (no VBO needed in WebGL1 if we use gl_VertexID, but WebGL1 lacks it).
    const quad = gl.createBuffer()
    if (!quad) return
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    // 2 triangles covering clip space
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
      ]),
      gl.STATIC_DRAW,
    )

    // Minimal vertex shader + “iTime / iResolution” fragment shader.
    // (We can swap the fragment shader to the exact Shadertoy source later.)
    const vsSource = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `
    const fsSource = `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      varying vec2 vUv;

      // Simple hash + smooth noise
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 uv = vUv;
        vec2 p = (uv * 2.0 - 1.0);
        p.x *= iResolution.x / max(iResolution.y, 1.0);

        float t = iTime * 0.35;
        // Flowy warp
        float n1 = noise(p * 1.8 + vec2(t, -t));
        float n2 = noise(p * 3.2 + vec2(-t * 1.3, t * 0.9));
        vec2 warp = vec2(n1 - 0.5, n2 - 0.5);
        p += warp * 0.28;

        // Soft “orbital” banding
        float r = length(p);
        float a = atan(p.y, p.x);
        float bands = 0.5 + 0.5 * sin(10.0 * r - 2.0 * t + 2.5 * sin(a * 2.0));
        float haze = smoothstep(1.2, 0.2, r);

        vec3 base = vec3(0.0, 0.32, 1.0); // Base blue
        vec3 accent = vec3(0.85, 0.95, 1.0);
        vec3 col = mix(base, accent, bands * 0.55);
        col *= haze;

        // Subtle grain
        float g = hash(uv * iResolution.xy + fract(iTime) * 10.0);
        col += (g - 0.5) * 0.035;

        // Keep it subtle: final alpha is low so content stays readable
        float alpha = 0.28 * haze;
        gl_FragColor = vec4(col, alpha);
      }
    `

    let program: WebGLProgram | null = null
    let vs: WebGLShader | null = null
    let fs: WebGLShader | null = null
    try {
      vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
      fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
      program = linkProgram(gl, vs, fs)
    } catch {
      // Fail open (no effect).
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
      if (program) gl.deleteProgram(program)
      return
    }

    gl.useProgram(program)
    const aPos = gl.getAttribLocation(program, 'aPos')
    const uTime = gl.getUniformLocation(program, 'iTime')
    const uRes = gl.getUniformLocation(program, 'iResolution')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const start = performance.now()
    let lastFrameMs = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height)
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' && rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      } else if (document.visibilityState === 'visible' && !rafRef.current) {
        lastFrameMs = 0
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const tick = () => {
      rafRef.current = null
      // Cap to ~30fps to keep it light.
      const now = performance.now()
      if (lastFrameMs && now - lastFrameMs < 33) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastFrameMs = now

      resize()
      const t = (now - start) / 1000
      if (uTime) gl.uniform1f(uTime, t)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      rafRef.current = requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)

    resize()
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      ro.disconnect()
      gl.bindBuffer(gl.ARRAY_BUFFER, null)
      gl.deleteBuffer(quad)
      if (program) gl.deleteProgram(program)
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? ''}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
})

