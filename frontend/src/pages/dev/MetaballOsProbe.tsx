import { useEffect, useMemo, useRef, useState } from 'react'

import { PageMeta } from '@/components/seo/PageMeta'

type PointerState = { x: number; y: number }

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'shader compile error'
    gl.deleteShader(shader)
    throw new Error(info)
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string) {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc)
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  if (!vert || !frag) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'program link error'
    gl.deleteProgram(program)
    throw new Error(info)
  }
  return program
}

function useMetaballShader(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  pointerRef: React.RefObject<PointerState>,
  startedAtRef: React.RefObject<number | null>,
) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
    })
    if (!gl) return
    const activeCanvas = canvas
    const activeGl = gl

    const vertSrc = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `

    const fragSrc = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_res;
      uniform vec2 u_pointer;
      uniform float u_time;
      uniform float u_reveal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 m = mat2(1.6, -1.2, 1.2, 1.6);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = m * p;
          a *= 0.5;
        }
        return v;
      }

      float metaballField(vec2 p, float t) {
        vec2 cp = vec2(0.5, 0.53);
        cp += (u_pointer - 0.5) * vec2(0.15, 0.06);
        float field = 0.0;
        for (int i = 0; i < 8; i++) {
          float fi = float(i);
          float phase = t * (0.25 + 0.04 * fi) + fi * 2.13;
          vec2 c = cp + vec2(cos(phase * (1.2 + fi * 0.07)), sin(phase * (1.0 + fi * 0.05))) * (0.06 + 0.01 * fi);
          float r = 0.09 + 0.015 * sin(phase * 1.7 + fi * 0.4);
          vec2 d = p - c;
          field += (r * r) / dot(d, d);
        }
        return field;
      }

      void main() {
        vec2 uv = v_uv;
        vec2 p = uv;
        float t = u_time;
        float reveal = smoothstep(0.0, 1.0, u_reveal);

        vec3 darkBg = vec3(0.01, 0.013, 0.016);
        vec3 lightBg = vec3(0.82, 0.84, 0.83);
        vec3 bg = mix(darkBg, lightBg, reveal);

        float vignette = smoothstep(1.15, 0.2, distance(uv, vec2(0.5, 0.55)));
        vec3 col = bg * (0.68 + 0.32 * vignette);

        float fog = fbm(uv * vec2(3.2, 1.9) + vec2(0.0, t * 0.09));
        fog += 0.5 * fbm(uv * vec2(5.1, 2.9) - vec2(t * 0.06, 0.0));
        fog *= reveal;
        col += vec3(0.12, 0.14, 0.13) * fog * 0.48;

        float floorLine = smoothstep(0.94, 0.89, uv.y) * smoothstep(0.03, 0.22, uv.x) * smoothstep(0.03, 0.22, 1.0 - uv.x);
        col += vec3(0.78, 0.84, 0.75) * floorLine * (0.14 + 0.44 * reveal);

        float field = metaballField(uv, t);
        float body = smoothstep(0.95, 1.45, field);
        float shell = smoothstep(0.92, 1.15, field) - smoothstep(1.25, 1.9, field);
        float rim = pow(max(0.0, 1.0 - abs((uv.y - 0.52) * 8.0)), 2.0) * shell;

        vec3 blobCore = mix(vec3(0.015, 0.02, 0.03), vec3(0.07, 0.085, 0.09), reveal * 0.18);
        vec3 blobRim = vec3(0.62, 0.8, 0.75) * (0.36 + 0.24 * reveal);
        vec3 blob = blobCore + blobRim * rim;
        col = mix(col, blob, body);

        float grain = (noise(uv * u_res * 0.3 + t * 30.0) - 0.5) * 0.018;
        col += grain;
        gl_FragColor = vec4(col, 1.0);
      }
    `

    let raf = 0
    const program = createProgram(activeGl, vertSrc, fragSrc)
    if (!program) return

    const positionBuffer = activeGl.createBuffer()
    if (!positionBuffer) return
    activeGl.bindBuffer(activeGl.ARRAY_BUFFER, positionBuffer)
    activeGl.bufferData(
      activeGl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      activeGl.STATIC_DRAW,
    )

    const aPos = activeGl.getAttribLocation(program, 'a_pos')
    const uRes = activeGl.getUniformLocation(program, 'u_res')
    const uTime = activeGl.getUniformLocation(program, 'u_time')
    const uReveal = activeGl.getUniformLocation(program, 'u_reveal')
    const uPointer = activeGl.getUniformLocation(program, 'u_pointer')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      const width = window.innerWidth
      const height = window.innerHeight
      activeCanvas.width = Math.floor(width * dpr)
      activeCanvas.height = Math.floor(height * dpr)
      activeCanvas.style.width = `${width}px`
      activeCanvas.style.height = `${height}px`
      activeGl.viewport(0, 0, activeCanvas.width, activeCanvas.height)
    }

    function render(now: number) {
      const t = now * 0.001
      const startAt = startedAtRef.current
      const reveal = startAt ? Math.min(1, (now - startAt) / 1700) : 0
      activeGl.useProgram(program)
      activeGl.bindBuffer(activeGl.ARRAY_BUFFER, positionBuffer)
      activeGl.enableVertexAttribArray(aPos)
      activeGl.vertexAttribPointer(aPos, 2, activeGl.FLOAT, false, 0, 0)
      activeGl.uniform2f(uRes, activeCanvas.width, activeCanvas.height)
      activeGl.uniform1f(uTime, t)
      activeGl.uniform1f(uReveal, reveal)
      activeGl.uniform2f(uPointer, pointerRef.current.x, pointerRef.current.y)
      activeGl.drawArrays(activeGl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(render)
    }

    resize()
    raf = requestAnimationFrame(render)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      activeGl.deleteBuffer(positionBuffer)
      activeGl.deleteProgram(program)
    }
  }, [canvasRef, pointerRef, startedAtRef])
}

export function MetaballOsProbe() {
  const [started, setStarted] = useState(false)
  const [email, setEmail] = useState('')
  const [pointer, setPointer] = useState<PointerState>({ x: 0.5, y: 0.5 })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointerRef = useRef(pointer)
  const startedAtRef = useRef<number | null>(null)
  const [domReveal, setDomReveal] = useState(false)

  useEffect(() => {
    pointerRef.current = pointer
  }, [pointer])

  useMetaballShader(canvasRef, pointerRef, startedAtRef)

  function handleStart() {
    if (started) return
    const now = performance.now()
    startedAtRef.current = now
    setStarted(true)
    window.setTimeout(() => {
      setDomReveal(true)
    }, 520)
  }

  const introOpacity = useMemo(() => (started ? 0 : 1), [started])

  return (
    <div
      className="relative min-h-0 w-full overflow-hidden bg-transparent text-white"
      onPointerMove={(event) => {
        const x = clamp01(event.clientX / Math.max(window.innerWidth, 1))
        const y = clamp01(event.clientY / Math.max(window.innerHeight, 1))
        setPointer({ x, y })
      }}
    >
      <PageMeta
        title="Metaball OS probe"
        description="Dev-only metaball and fog launch-surface experiment"
        canonicalPath="/dev/metaball-os"
      />

      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="relative z-20 flex min-h-[calc(100dvh-2rem)] items-center justify-center px-4 py-12">
        <div
          className="relative w-[min(92vw,980px)] overflow-hidden border border-white/20 bg-black/45 shadow-[0_0_100px_rgba(164,214,197,0.18)] transition-all duration-700"
          style={{
            height: started ? 'min(82vh, 760px)' : 'min(42vh, 380px)',
            borderRadius: started ? '36px 120px 44px 112px / 70px 58px 82px 64px' : '999px',
            transform: started ? 'scale(1)' : 'scale(0.86)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/25" />
          <div
            className="pointer-events-none absolute inset-0 border border-emerald-100/20"
            style={{ borderRadius: 'inherit' }}
          />

          {!started ? (
            <div className="relative z-10 flex h-full items-center justify-center">
              <button
                type="button"
                onClick={handleStart}
                className="text-6xl font-semibold tracking-[-0.03em] text-white transition hover:scale-[1.015]"
                style={{ opacity: introOpacity }}
              >
                start
              </button>
            </div>
          ) : null}

          <div
            className="relative z-10 h-full overflow-y-auto px-7 py-6 text-zinc-900 transition duration-700"
            style={{
              opacity: domReveal ? 1 : 0,
              transform: `translateY(${domReveal ? '0px' : '18px'})`,
            }}
          >
            <div className="sticky top-0 z-20 -mx-7 mb-7 border-b border-zinc-500/25 bg-zinc-100/80 px-7 py-3 backdrop-blur-md">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-zinc-700/90">
                <span>Metaball OS</span>
                <span>Scrollable live webpage</span>
              </div>
            </div>

            <div className="space-y-10 pb-10">
              <section>
                <p className="text-xs font-medium text-zinc-700">A fake startup for impossible product surfaces.</p>
                <h1 className="mt-3 text-[64px] font-semibold leading-[0.9] tracking-[-0.04em]">
                  Ship websites that emerge from living matter.
                </h1>
                <p className="mt-4 max-w-[620px] text-[24px] leading-[1.15] text-zinc-700">
                  This is now a real scroll container inside the blob viewport. Scroll to move
                  through sections while the shader scene stays alive behind it.
                </p>
                <form className="mt-6 flex w-full max-w-[540px] gap-2" onSubmit={(event) => event.preventDefault()}>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    className="w-full border border-zinc-500/30 bg-zinc-50/65 px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-700/50"
                  />
                  <button
                    type="submit"
                    className="border border-amber-300/65 bg-amber-200/90 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-amber-100"
                  >
                    Get started
                  </button>
                </form>
              </section>

              <section className="grid grid-cols-3 border border-zinc-600/20 bg-zinc-50/38 text-zinc-900">
                <div className="border-r border-zinc-600/20 p-4">
                  <div className="text-[44px] font-semibold leading-none">145</div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-zinc-600">Ray steps</div>
                </div>
                <div className="border-r border-zinc-600/20 p-4">
                  <div className="text-[44px] font-semibold leading-none">20</div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-zinc-600">Volume samples</div>
                </div>
                <div className="p-4">
                  <div className="text-[44px] font-semibold leading-none">live</div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-zinc-600">HTML texture</div>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-600/20 bg-zinc-50/42 p-6">
                <h2 className="text-3xl font-semibold tracking-tight">Section 02 — Scroll choreography</h2>
                <p className="mt-3 max-w-[700px] text-zinc-700">
                  In the reference, the page content feels like a tangible surface inside the fluid form.
                  This section exists to prove the in-blob page can contain normal long-form content.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-600/20 bg-white/60 p-4">
                    <p className="text-sm font-medium text-zinc-800">Interactive panel</p>
                    <p className="mt-2 text-sm text-zinc-700">Buttons, links, and inputs stay clickable inside the viewport.</p>
                  </div>
                  <div className="rounded-xl border border-zinc-600/20 bg-white/60 p-4">
                    <p className="text-sm font-medium text-zinc-800">Performance-friendly</p>
                    <p className="mt-2 text-sm text-zinc-700">GPU shader animates behind a regular overflow container.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-600/20 bg-zinc-50/42 p-6">
                <h2 className="text-3xl font-semibold tracking-tight">Section 03 — Depth and material</h2>
                <p className="mt-3 text-zinc-700">
                  Keep scrolling. The container is intentionally taller than the viewport so it behaves like
                  a real webpage embedded in the blob.
                </p>
                <div className="mt-5 space-y-3">
                  {['Volumetric fog layers', 'Metaball field blending', 'Pointer-reactive drift', 'Soft floor glow'].map((item) => (
                    <div key={item} className="rounded-xl border border-zinc-600/20 bg-white/60 px-4 py-3 text-sm text-zinc-800">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
