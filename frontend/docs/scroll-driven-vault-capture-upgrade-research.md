Scroll‑Driven Vault Capture Upgrade Research
Executive summary
Enabled connectors used: GitHub, Figma (confirmed authenticated). The GitHub repo audited is wenakita/4626. Figma access is available but I did not find a Figma file URL/key in the repo, so I could not pull specific nodes/frames without you sharing a Figma URL (fileKey + nodeId).

What’s currently happening (repo reality): the desktop cinematic is still powered by the monolithic frontend/src/components/home/VaultFlowScroll.tsx 
. The vault visuals inside it are implemented as a VaultScene component driven by several scroll-threshold MotionValues (posts/top edges pathLength, “lid” opacity, landing flash, glow, etc.). The orb is rendered already inside the cube and the cube “draws around it,” which makes the story aesthetic, but not always semantically legible as “coin entered the vault.”

What to change (high impact, low risk): replace VaultScene with a single, phase‑based capture system driven by one normalized MotionValue:

Add captureProgress as useTransform(scroll, [0.08, 0.34], [0, 1]) and derive four sub‑phases (approach → contact → contain → settle) from it.
Render explicit threshold + ripple right at “contact” to sell entry, and a containment seal (interior fill + edge clamp) to sell protection.
Keep your existing cube wireframe geometry (already good) but upgrade sequencing and “protective” cues: edge hierarchy, interior atmosphere, lock pulse.
This approach keeps your constraints (CSS + SVG + Framer Motion; no WebGL) while making the narrative transition obvious and premium by using recognizable “physical metaphors”: threshold, pressure, seal, energy transfer.

Repo audit findings
Files inspected (exact paths)
Core cinematic renderer and vault visuals:

frontend/src/components/home/VaultFlowScroll.tsx 
frontend/src/components/home/VaultFlowScroll.test.tsx 
Public entry + orchestration routing (desktop wraps the monolith):

frontend/src/components/home/vault-flow/VaultFlowRoot.tsx 
frontend/src/components/home/vault-flow/orchestrators/VaultFlowDesktop.tsx 
frontend/src/pages/Home.tsx 
Semantic model layer (beats, state derivation, selectors, copy):

frontend/src/components/home/vault-flow/model/storySemantics.ts 
frontend/src/components/home/vault-flow/model/storyClock.ts 
frontend/src/components/home/vault-flow/model/storySelectors.ts 
frontend/src/components/home/vault-flow/model/storyContent.ts 
What exists today in VaultFlowScroll.tsx that affects vault clarity
Vault motion values today (high level):

The world and vault camera/transform are driven by scroll (useSpring(scrollYProgress)), using useTransform and useMotionTemplate. This is the right architecture for scroll-linked animation: useScroll returns a scrollYProgress MotionValue from 0..1 between offsets, and composing it via useTransform/useSpring is the intended pattern. 
The vault visuals are built from:
SVG wireframe drawing via pathLength
multiple glow layers via boxShadow
an interior fill polygon inside the wireframe
a “cube interior POV” overlay for the stage 4 feeling
Where legibility currently drops:

Entry is implied, not shown. There’s no explicit “threshold crossing” artifact (plane, ripple, lock ring, energy handoff) marking the moment the coin enters. In scrollytelling, a key principle is one gesture, big visual impact—Immersive Garden calls out using a simple scroll with each action causing a big impact (even when linear). 
The cube reads as a schematic, not a container. It’s a wireframe drawing with some fill, but it lacks “protective” affordances (seal, thickness, atmosphere, occlusion). Awwwards’ experimental exemplars often rely on wireframe/technical visualization to communicate a system—Omega Clearspace explicitly highlights a “model wireframe” and scroll-driven transitions as key elements. 
High‑frequency “effects” can feel decorative. Some glows/flashes (especially non‑semantic colors) risk reading as “cool” rather than meaningful. Since you want “everything means something,” we should consolidate effects so that each moment has one visual thesis.
Best insertion point for captureProgress
Insert captureProgress near the existing vault MotionValues in VaultFlowScroll.tsx—right after coinEntryGlow is defined (or right before vault wireframe values). Conceptually:

vault transform (vaultTransform, vaultOpacity) continues to place the system in 3D space
captureProgress becomes the unified driver for orb descent, wireframe draw, threshold contact, containment seal
coinEntryGlow remains as your “mint is live / shares minted” sustained inner glow
Recommended visual upgrade pattern
The four phase model
You already have a strong narrative arc; the upgrade is to make it legible with a small set of “physical” signals:

Approach: orb descends, cube begins to “instantiate” (back edges first, then front edges).
Contact: orb hits the “deposit threshold,” flashes a tight white-blue ring and emits a ripple.
Contain: cube seals (interior fill thickens, edges clamp brighter, a soft pulse travels the frame).
Settle: orb becomes the “vault core” (outer glow reduces, inner glow remains), and the system looks stable.
This mirrors best-practice scrollytelling pacing: keep the user locked in a linear progression with distinct “beats” per screen; sites like The ADHD experience are explicitly structured around scroll-triggered sections that represent symptoms as visual events (a model for “each beat is a moment”). 

Mermaid timeline for capture phases
Approach (0.08 →~0.19)
Orb enters frame,cube back-edgesappear, front edgesbegin to draw
Contact (≈0.19 →~0.21)
Threshold flare +ripple + micro squash(entry moment)
Contain (≈0.21 →~0.32)
Interior fill thickens,edge clamp pulse,energy transfers toframe
Settle (≈0.32 →0.34+)
Effects decay, vaultholds a calm innerglow (system is"ready")
Vault capture phases (global scroll progress)


Show code
Premium-feel micro details that map to your constraints
These are all doable with CSS, SVG, and Framer Motion:

Edge hierarchy (depth cue): front edges brighter + thicker; back edges dimmer + slightly blurred (SVG filter). This makes a wireframe feel like a real volume (used heavily in high-end “model wireframes” like Omega Clearspace). 
Threshold plane & ripple: a single ellipse “gate” that lights up at contact, then expands a ripple. This is your strongest “coin entered vault” signal.
Containment seal pulse: a short-lived edge highlight that travels (or simply blooms) on the front top edge + posts, then fades.
Interior atmosphere: subtle gradient fill inside cube that increases during containment.
Orb submerge via masking: use CSS mask-image: linear-gradient(...) to feather the orb into space (MDN confirms gradients are valid mask images and provide nuanced transparency). 
Reduce-motion compliance: flashing can be harmful for vestibular sensitivity; prefers-reduced-motion should reduce or remove flash/ripple bursts. 
Performance discipline: scroll-linked animation can jank if driven from raw scroll events; keep to transform + opacity (compositor-friendly) and avoid layout-triggering properties. Chrome’s scroll-driven animation guidance highlights main-thread scroll event pitfalls. 
Pasteable replacement component: VaultCaptureSystem
This is designed to drop into your existing VaultFlowScroll.tsx by replacing VaultScene and removing the old vault-specific MotionValues (vaultLidOp, vaultWallOp, vaultPostProgress, vaultTopProgress, landingFlash, vaultGlow, and optionally zoraGreenFlash). It reuses your existing cube geometry (front/back edge coordinates) and orb styling, but adds the missing “entry” semantics (threshold + ripple + containment pulse).

Paste this in place of the current VaultSceneProps + VaultScene definition block.

tsx
Copy
// ── VaultCaptureSystem ───────────────────────────────────────────────────────
// Replaces VaultScene. Canonical "coin enters vault" sequence driven by ONE
// normalized MotionValue: captureProgress.
//
// Design goals:
// 1) Make entry legible (threshold plane + ripple)
// 2) Make cube feel like a protective container (interior atmosphere + seal pulse)
// 3) Premium micro-details (edge hierarchy, restrained glow, specular drift)
//
// NOTE: Uses existing cube SVG geometry from the previous VaultScene.

type VaultCaptureSystemProps = {
  uid: string
  vaultTransform: MotionValue<string>
  vaultOpacity: MotionValue<number>
  captureProgress: MotionValue<number>
  coinEntryGlow: MotionValue<number>
  prefersReducedMotion: boolean
}

const VaultCaptureSystem = memo(function VaultCaptureSystem({
  uid,
  vaultTransform,
  vaultOpacity,
  captureProgress,
  coinEntryGlow,
  prefersReducedMotion,
}: VaultCaptureSystemProps) {
  // Phase timing aligned to existing VaultFlowScroll checkpoints:
  // - hardStop #1 is at v >= 0.32; our "contain" is effectively complete by then.
  const _approach = useTransform(captureProgress, [0.0, 0.42], [0, 1], { clamp: true })
  const _contact  = useTransform(captureProgress, [0.42, 0.54], [0, 1], { clamp: true })
  const _contain  = useTransform(captureProgress, [0.54, 0.92], [0, 1], { clamp: true })
  const _settle   = useTransform(captureProgress, [0.92, 1.0], [0, 1], { clamp: true })

  // Smooth them (consistent with existing smoothstep helper in this file)
  const approachP = useTransform(_approach, smoothstep)
  const contactP  = useTransform(_contact, smoothstep)
  const containP  = useTransform(_contain, smoothstep)
  const settleP   = useTransform(_settle, smoothstep)

  return (
    <motion.div
      className="absolute left-1/2 top-[44vh] z-20"
      style={{ transform: vaultTransform, opacity: vaultOpacity }}
      aria-hidden="true"
    >
      <div className="relative">
        {/* Substance first: interior atmosphere */}
        <VaultInteriorFill uid={uid} containP={containP} />

        {/* Container: full wireframe with front/back edge hierarchy */}
        <VaultWireframe
          uid={uid}
          approachP={approachP}
          contactP={contactP}
          containP={containP}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Entry semantics: threshold + ripple */}
        <ThresholdPlane
          uid={uid}
          contactP={contactP}
          prefersReducedMotion={prefersReducedMotion}
        />
        <EntryRipple
          uid={uid}
          contactP={contactP}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Energy handoff: orb glow collapses into the vault; mint glow sustains */}
        <EnergyTransferGlow
          uid={uid}
          approachP={approachP}
          contactP={contactP}
          containP={containP}
          settleP={settleP}
          coinEntryGlow={coinEntryGlow}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* The coin/orb: now it actually "arrives" and compresses at contact */}
        <Orb
          approachP={approachP}
          contactP={contactP}
          containP={containP}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Subtle depth hint after seal (kept restrained—real dive happens later) */}
        <DivePortal uid={uid} settleP={settleP} />

        {/* Maintain relative container height (matches previous VaultScene layout) */}
        <div className="h-24 w-24" aria-hidden="true" />
      </div>
    </motion.div>
  )
})

const VaultInteriorFill = memo(function VaultInteriorFill({
  uid,
  containP,
}: {
  uid: string
  containP: MotionValue<number>
}) {
  // Atmosphere increases only once containment begins
  const fillOpacity = useTransform(containP, [0, 1], [0, 0.22])

  return (
    <motion.div
      className="pointer-events-none absolute z-0"
      style={{ left: -66, right: -66, bottom: -20, height: 310, opacity: fillOpacity }}
    >
      <svg viewBox="0 0 244 310" width="100%" height="310" fill="none">
        <defs>
          <radialGradient id={`${uid}-vault-atmo`} cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="rgba(120,175,255,0.055)" />
            <stop offset="55%" stopColor="rgba(40,80,220,0.030)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Back face haze */}
        <rect x="28" y="52" width="188" height="186" fill={`url(#${uid}-vault-atmo)`} />
        {/* Front face haze */}
        <rect x="0" y="28" width="244" height="274" fill="rgba(80,130,255,0.018)" />
      </svg>
    </motion.div>
  )
})

const VaultWireframe = memo(function VaultWireframe({
  uid,
  approachP,
  contactP,
  containP,
  prefersReducedMotion,
}: {
  uid: string
  approachP: MotionValue<number>
  contactP: MotionValue<number>
  containP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  // Sequence: posts → top edges → (contain) floor plate
  const postProgress = useTransform(approachP, [0.08, 0.72], [0, 1], { clamp: true })
  const topProgress  = useTransform(approachP, [0.46, 1.0], [0, 1], { clamp: true })

  const wallsOpacity = useTransform(approachP, [0.0, 0.18], [0, 1], { clamp: true })
  const floorOpacity = useTransform(containP, [0.0, 0.30], [0, 1], { clamp: true })

  // Contact pulse: brighten front edges briefly, then settle
  const frontBoost = prefersReducedMotion
    ? useTransform(contactP, [0, 1], [0.78, 0.78])
    : useTransform(contactP, [0, 0.5, 1], [0.62, 1.0, 0.82])

  return (
    <div className="relative z-10">
      {/* Floor plate (appears during containment) */}
      <motion.div
        className="pointer-events-none absolute"
        style={{ bottom: -20, left: -66, right: -66, height: 80, opacity: floorOpacity }}
      >
        <svg viewBox="0 0 244 80" width="100%" height="80" fill="none">
          <defs>
            <linearGradient id={`${uid}-floor-fill`} x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="rgba(60,110,255,0.05)" />
              <stop offset="100%" stopColor="rgba(20,50,180,0.20)" />
            </linearGradient>
          </defs>

          <polygon points="28,8 216,8 244,72 0,72" fill={`url(#${uid}-floor-fill)`} />

          <line x1="0" y1="72" x2="244" y2="72" stroke="rgba(160,205,255,0.62)" strokeWidth="1.5" />
          <line x1="28" y1="8" x2="216" y2="8" stroke="rgba(100,148,255,0.28)" strokeWidth="0.8" />

          <line x1="0" y1="72" x2="28" y2="8" stroke="rgba(120,168,255,0.32)" strokeWidth="0.8" />
          <line x1="244" y1="72" x2="216" y2="8" stroke="rgba(120,168,255,0.32)" strokeWidth="0.8" />

          {/* Corner brackets */}
          <polyline points="0,60 0,72 16,72" stroke="rgba(185,218,255,0.55)" strokeWidth="1.3" fill="none" />
          <polyline points="228,72 244,72 244,60" stroke="rgba(185,218,255,0.55)" strokeWidth="1.3" fill="none" />
          <polyline points="28,0 28,8 42,8" stroke="rgba(185,218,255,0.45)" strokeWidth="1.1" fill="none" />
          <polyline points="202,8 216,8 216,0" stroke="rgba(185,218,255,0.45)" strokeWidth="1.1" fill="none" />

          <ellipse cx="122" cy="74" rx="96" ry="5" fill="rgba(60,110,255,0.14)" />
        </svg>
      </motion.div>

      {/* Walls & top edges */}
      <motion.div
        className="pointer-events-none absolute"
        style={{ left: -66, right: -66, bottom: -20, height: 310, opacity: wallsOpacity }}
      >
        <svg viewBox="0 0 244 310" width="100%" height="310" fill="none">
          <defs>
            <filter id={`${uid}-back-post-blur`} x="-80%" y="-20%" width="260%" height="140%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
            <filter id={`${uid}-front-glow`} x="-120%" y="-20%" width="340%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Back edges (dimmer, blurred) */}
          <motion.path
            d="M 28 238 L 28 52"
            stroke="rgba(86,124,210,0.18)"
            strokeWidth="0.8"
            strokeLinecap="round"
            filter={`url(#${uid}-back-post-blur)`}
            style={{ pathLength: postProgress }}
          />
          <motion.path
            d="M 216 238 L 216 52"
            stroke="rgba(86,124,210,0.18)"
            strokeWidth="0.8"
            strokeLinecap="round"
            filter={`url(#${uid}-back-post-blur)`}
            style={{ pathLength: postProgress }}
          />

          <motion.path
            d="M 28 52 L 216 52"
            stroke="rgba(86,124,210,0.18)"
            strokeWidth="0.7"
            strokeLinecap="round"
            style={{ pathLength: topProgress }}
          />

          {/* Depth diagonals (top face) */}
          <motion.path
            d="M 0 28 L 28 52"
            stroke="rgba(124,164,245,0.35)"
            strokeWidth="0.85"
            strokeLinecap="round"
            style={{ pathLength: topProgress }}
          />
          <motion.path
            d="M 244 28 L 216 52"
            stroke="rgba(124,164,245,0.35)"
            strokeWidth="0.85"
            strokeLinecap="round"
            style={{ pathLength: topProgress }}
          />

          {/* Front edges (brighter, "protective") — glow copy first */}
          <motion.path
            d="M 0 302 L 0 28"
            stroke="rgba(140,200,255,0.16)"
            strokeWidth="5"
            strokeLinecap="round"
            filter={`url(#${uid}-front-glow)`}
            style={{ pathLength: postProgress, opacity: frontBoost }}
          />
          <motion.path
            d="M 244 302 L 244 28"
            stroke="rgba(140,200,255,0.16)"
            strokeWidth="5"
            strokeLinecap="round"
            filter={`url(#${uid}-front-glow)`}
            style={{ pathLength: postProgress, opacity: frontBoost }}
          />

          <motion.path
            d="M 0 28 L 244 28"
            stroke="rgba(160,215,255,0.14)"
            strokeWidth="5"
            strokeLinecap="round"
            filter={`url(#${uid}-front-glow)`}
            style={{ pathLength: topProgress, opacity: frontBoost }}
          />

          {/* Front edges sharp */}
          <motion.path
            d="M 0 302 L 0 28"
            stroke="rgba(172,218,255,0.76)"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ pathLength: postProgress, opacity: frontBoost }}
          />
          <motion.path
            d="M 244 302 L 244 28"
            stroke="rgba(172,218,255,0.76)"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ pathLength: postProgress, opacity: frontBoost }}
          />
          <motion.path
            d="M 0 28 L 244 28"
            stroke="rgba(208,234,255,0.80)"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ pathLength: topProgress, opacity: frontBoost }}
          />

          {/* Top corner brackets */}
          <motion.polyline points="0,28 18,28" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topProgress }} />
          <motion.polyline points="0,28 0,48" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topProgress }} />
          <motion.polyline points="226,28 244,28" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topProgress }} />
          <motion.polyline points="244,28 244,48" stroke="rgba(220,244,255,0.88)" strokeWidth="2.0" fill="none" style={{ opacity: topProgress }} />
        </svg>
      </motion.div>
    </div>
  )
})

const ThresholdPlane = memo(function ThresholdPlane({
  uid,
  contactP,
  prefersReducedMotion,
}: {
  uid: string
  contactP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  // A brief plane flare during contact (ends at contactP=1)
  const op = prefersReducedMotion
    ? useTransform(contactP, [0, 1], [0, 0])
    : useTransform(contactP, [0.1, 0.25, 0.65, 1.0], [0, 0.22, 0.75, 0])

  const scale = useTransform(contactP, [0.0, 0.35, 1.0], [0.96, 1.02, 1.04])

  return (
    <motion.div
      className="pointer-events-none absolute z-20"
      style={{
        left: -66,
        right: -66,
        top: -124,
        height: 130,
        opacity: op,
        scale,
        transformOrigin: '50% 50%',
      }}
    >
      <svg viewBox="0 0 244 120" width="100%" height="120" fill="none">
        <defs>
          <radialGradient id={`${uid}-threshold`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="45%" stopColor="rgba(140,190,255,0.22)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <ellipse cx="122" cy="62" rx="84" ry="20" fill={`url(#${uid}-threshold)`} />
        <ellipse cx="122" cy="62" rx="84" ry="20" stroke="rgba(200,235,255,0.32)" strokeWidth="0.8" />
      </svg>
    </motion.div>
  )
})

const EntryRipple = memo(function EntryRipple({
  uid,
  contactP,
  prefersReducedMotion,
}: {
  uid: string
  contactP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  const op = prefersReducedMotion
    ? useTransform(contactP, [0, 1], [0, 0])
    : useTransform(contactP, [0.0, 0.22, 1.0], [0, 0.58, 0])

  const rippleScale = useTransform(contactP, [0.0, 1.0], [0.35, 1.85])

  return (
    <motion.div
      className="pointer-events-none absolute z-20"
      style={{
        left: -66,
        right: -66,
        top: -132,
        height: 150,
        opacity: op,
        scale: rippleScale,
        transformOrigin: '50% 55%',
      }}
    >
      <svg viewBox="0 0 244 160" width="100%" height="160" fill="none">
        <defs>
          <filter id={`${uid}-ripple-blur`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        <ellipse
          cx="122"
          cy="78"
          rx="84"
          ry="20"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.2"
          filter={`url(#${uid}-ripple-blur)`}
        />
        <ellipse
          cx="122"
          cy="78"
          rx="84"
          ry="20"
          stroke="rgba(120,175,255,0.22)"
          strokeWidth="0.8"
        />
      </svg>
    </motion.div>
  )
})

const EnergyTransferGlow = memo(function EnergyTransferGlow({
  uid,
  approachP,
  contactP,
  containP,
  settleP,
  coinEntryGlow,
  prefersReducedMotion,
}: {
  uid: string
  approachP: MotionValue<number>
  contactP: MotionValue<number>
  containP: MotionValue<number>
  settleP: MotionValue<number>
  coinEntryGlow: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  // Outer orb glow: strong during approach, collapses during contain
  const orbGlow = prefersReducedMotion
    ? useTransform(approachP, [0, 1], [0.10, 0.10])
    : useTransform(approachP, [0.0, 0.65, 1.0], [0.55, 0.90, 0.30])

  // Temporary edge flash at contact (must end at 0 when contactP=1)
  const edgeFlash = prefersReducedMotion
    ? useTransform(contactP, [0, 1], [0, 0])
    : useTransform(contactP, [0.0, 0.22, 0.55, 1.0], [0, 1.0, 0.28, 0])

  // Inner vault glow: combine "contain" (seal energy) + "coinEntryGlow" (mint energy)
  const vaultInner = useTransform([containP, settleP, coinEntryGlow], ([c, s, mint]) => {
    const contain = Number(c ?? 0)
    const settle  = Number(s ?? 0)
    const mintGlow = Number(mint ?? 0)

    // base containment glow (subtle) + mint sustain (stronger later)
    return Math.min(1, contain * 0.35 + settle * 0.08 + mintGlow * 0.75)
  })

  return (
    <>
      {/* Orb halo (centered on previous orb center: left=-32, top=-141, 160×160) */}
      <motion.div
        className="pointer-events-none absolute z-30"
        style={{
          left: -32,
          top: -141,
          width: 160,
          height: 160,
          borderRadius: '50%',
          opacity: orbGlow,
          boxShadow: prefersReducedMotion
            ? '0 0 0 0 transparent'
            : [
                '0 0 26px 9px rgba(0,82,255,0.52)',
                '0 0 58px 22px rgba(0,82,255,0.24)',
                '0 0 110px 44px rgba(0,82,255,0.09)',
              ].join(', '),
        }}
      />

      {/* Inner vault glow (sustained through mint/distribution via coinEntryGlow) */}
      <motion.div
        className="pointer-events-none absolute z-10"
        style={{
          left: -32,
          top: -141,
          width: 160,
          height: 160,
          borderRadius: '50%',
          opacity: vaultInner,
          boxShadow: prefersReducedMotion
            ? '0 0 0 0 transparent'
            : [
                '0 0 24px 10px rgba(100,160,255,0.34)',
                '0 0 66px 26px rgba(0,82,255,0.22)',
                '0 0 140px 58px rgba(0,82,255,0.08)',
              ].join(', '),
        }}
      />

      {/* Contact edge flash overlay (front edge + posts) */}
      <motion.div
        className="pointer-events-none absolute z-40"
        style={{ left: -66, right: -66, bottom: -20, height: 310, opacity: edgeFlash }}
      >
        <svg viewBox="0 0 244 310" width="100%" height="310" fill="none">
          <defs>
            <filter id={`${uid}-edgeflash`} x="-120%" y="-20%" width="340%" height="140%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d="M 0 28 L 244 28"
            stroke="rgba(255,255,255,0.40)"
            strokeWidth="2.4"
            strokeLinecap="round"
            filter={`url(#${uid}-edgeflash)`}
          />
          <path
            d="M 0 302 L 0 28"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="2.2"
            strokeLinecap="round"
            filter={`url(#${uid}-edgeflash)`}
          />
          <path
            d="M 244 302 L 244 28"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="2.2"
            strokeLinecap="round"
            filter={`url(#${uid}-edgeflash)`}
          />
        </svg>
      </motion.div>
    </>
  )
})

const Orb = memo(function Orb({
  approachP,
  contactP,
  containP,
  prefersReducedMotion,
}: {
  approachP: MotionValue<number>
  contactP: MotionValue<number>
  containP: MotionValue<number>
  prefersReducedMotion: boolean
}) {
  // Orb translation: comes from above, settles into the original orb pocket.
  const orbY = useTransform([approachP, containP], ([a, c]) => {
    const approach = Number(a ?? 0)
    const contain  = Number(c ?? 0)
    // Start well above. By the time contain begins, we're nearly in place.
    const yApproach = -240 + 190 * approach // -240 → -50
    const yContain  = -50 + 50 * contain    // -50 → 0
    return yApproach + (yContain - (-50)) * contain
  })

  // Contact "squash" — very subtle (premium, not cartoony)
  const scaleX = prefersReducedMotion
    ? useTransform(contactP, [0, 1], [1, 1])
    : useTransform(contactP, [0, 0.5, 1], [1, 1.03, 1])
  const scaleY = prefersReducedMotion
    ? useTransform(contactP, [0, 1], [1, 1])
    : useTransform(contactP, [0, 0.5, 1], [1, 0.97, 1])

  // Specular drift — tiny motion to make the glass feel "alive"
  const highlightX = useTransform(approachP, [0, 1], [-4, 5])
  const highlightY = useTransform(approachP, [0, 1], [-3, 4])

  return (
    <motion.div
      className="pointer-events-none absolute z-30"
      style={{
        left: -57,
        top: -168,
        width: 210,
        height: 232,
        y: orbY,
        scaleX,
        scaleY,
        transformOrigin: '50% 55%',
        // Feather into floor (existing technique; uses mask-image)
        maskImage: 'linear-gradient(to bottom, black 72%, transparent 97%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 72%, transparent 97%)',
      }}
    >
      {/* Sphere base */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 2,
          width: 210,
          height: 210,
          borderRadius: '50%',
          background: [
            'radial-gradient(circle at 50% 50%, rgba(6,14,46,0.94) 0%, rgba(3,7,28,0.98) 100%)',
            'radial-gradient(circle at 33% 25%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 20%, transparent 38%)',
            'radial-gradient(circle at 42% 38%, rgba(160,210,255,0.11) 0%, transparent 52%)',
            'radial-gradient(circle at 50% 74%, rgba(0,0,20,0.55) 0%, transparent 56%)',
            'radial-gradient(circle at 50% 50%, transparent 56%, rgba(0,8,38,0.22) 80%, rgba(0,4,22,0.34) 100%)',
          ].join(', '),
          boxShadow: [
            'inset 0 0 0 0.5px rgba(140,190,255,0.18)',
            'inset 0 0 48px 8px rgba(18,55,200,0.07)',
            'inset 0 -28px 44px -20px rgba(0,0,48,0.18)',
          ].join(', '),
        }}
      />

      {/* Rim ring */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 2,
          width: 210,
          height: 210,
          borderRadius: '50%',
          border: '1px solid rgba(160,205,255,0.14)',
        }}
      />

      {/* Moving specular highlight (micro-detail) */}
      {!prefersReducedMotion ? (
        <motion.div
          className="absolute"
          style={{
            left: 34,
            top: 26,
            width: 110,
            height: 110,
            borderRadius: '50%',
            x: highlightX,
            y: highlightY,
            background:
              'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 28%, transparent 60%)',
          }}
        />
      ) : null}

      {/* Breathing inner luminance */}
      {!prefersReducedMotion ? (
        <motion.div
          className="absolute"
          style={{
            left: 18,
            top: 20,
            width: 174,
            height: 174,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 48%, rgba(60,120,255,0.09) 0%, transparent 68%)',
          }}
          animate={{ opacity: [0.35, 0.80, 0.35] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
    </motion.div>
  )
})

const DivePortal = memo(function DivePortal({
  uid,
  settleP,
}: {
  uid: string
  settleP: MotionValue<number>
}) {
  // Keep very subtle. The real "dive" flash already exists later in the file.
  const op = useTransform(settleP, [0, 1], [0, 0.18])

  return (
    <motion.div
      className="pointer-events-none absolute z-5"
      style={{
        left: -54,
        top: -164,
        width: 204,
        height: 204,
        borderRadius: '50%',
        opacity: op,
        background:
          'radial-gradient(circle at 50% 55%, rgba(255,255,255,0.04) 0%, rgba(120,175,255,0.05) 30%, rgba(0,82,255,0.03) 52%, transparent 76%)',
      }}
    />
  )
})
Patch instructions for VaultFlowScroll.tsx
You asked for an “exact diff/patch or list of lines.” Because VaultScene is a very large block, the safest/fastest way to apply this without merge pain is a surgical replace-by-anchors (copy/paste blocks). Here’s the clean sequence:

Replace component block
In frontend/src/components/home/VaultFlowScroll.tsx 
:

Find the block that begins with:
ts
Copy
type VaultSceneProps = {
…and ends with:

ts
Copy
const VaultScene = memo(function VaultScene(...) { ... })
Replace that entire block with the VaultCaptureSystem code above.
Add captureProgress MotionValue
Inside VaultFlowScroll (function body), in the vault MotionValue section:

Keep coinEntryGlow as-is.
Add:
ts
Copy
// Capture system driver — unified “coin enters vault” timeline
const captureProgress = useTransform(scroll, [0.08, 0.34], [0, 1])
Recommended placement: right after coinEntryGlow (so it’s close to the rest of the vault system definitions).

Delete vault MotionValues that are now obsolete
After you replace VaultScene, remove these MotionValues because they’re only used by the old component:

landingFlash
vaultGlow
vaultLidOp
vaultWallOp
vaultPostProgress
vaultTopProgress
(optional but recommended) zoraGreenFlash (it’s a flash effect that doesn’t clearly map to the “entry” story; you already communicate mint with the card + coinEntryGlow sustain)
Also update the hard stop comment that references vaultTopProgress so it doesn’t mention a deleted variable. Keep the hard stop itself (if (!f.s1 && v >= 0.32)) the same.

Replace render call
Replace:

tsx
Copy
<VaultScene
  uid={uid}
  vaultTransform={vaultTransform}
  vaultOpacity={vaultOpacity}
  vaultLidOp={vaultLidOp}
  vaultWallOp={vaultWallOp}
  vaultPostProgress={vaultPostProgress}
  vaultTopProgress={vaultTopProgress}
  vaultGlow={vaultGlow}
  landingFlash={landingFlash}
  zoraGreenFlash={zoraGreenFlash}
  coinEntryGlow={coinEntryGlow}
/>
With:

tsx
Copy
<VaultCaptureSystem
  uid={uid}
  vaultTransform={vaultTransform}
  vaultOpacity={vaultOpacity}
  captureProgress={captureProgress}
  coinEntryGlow={coinEntryGlow}
  prefersReducedMotion={prefersReducedMotion}
/>
No other call sites should change.

Moodboard: scrollytelling techniques you can steal (CSS+SVG+Framer Motion friendly)
Below are 12 concrete patterns that show up repeatedly in Awwwards-style scrolling experiences, mapped directly to your vault capture constraints.

Reference sites table (high priority first)
Reference	Why it’s relevant to your vault capture	Patterns to borrow that map to CSS/SVG/Framer Motion
Omega Clearspace (Immersive Garden / Reflet) 
Explicitly highlights model wireframe, scroll, and transitions as key elements—closest match to your “wireframe cube as product object.”	Wireframe depth hierarchy; transition punctuations; “model as narrative actor.”
The ADHD experience (Awwwards SOTD) 
Strong example of scroll as sequential cinematic beats, where visuals represent abstract concepts clearly.	One-screen “beat” pacing; distinct “moment markers” on scroll; high-contrast minimalism.
Immersive Garden case study (New Mobile Workforce) 
States they used simple navigation (scroll/arrows) but big visual impact—this is exactly what your capture moment needs.	“One action = one impact”; linear progression; timed reveal of key objects.
Immersive Garden case study (Rainforest Foods) 
Describes scroll as “watching a movie” with composited depth.	Cinematic pacing; depth via layered planes; subtle discovery points.
Portal-1 Studio (HM) 
Clean, mono-color, story-led, scroll-based; explicitly categorized with storytelling and vector.	Restrained palette; vector-based story moments; scroll-linked section transitions.
Market Makers – Trading Platform (Nominee) 
Directly highlights CSS/SVG infographic animation on scroll—very relevant for pathLength sequencing and data-as-visuals.	SVG path draw on scroll; “data becomes motion” narrative; minimal dark UI.
Active Theory (Awwwards profile) 
Industry benchmark for premium digital experiences; even if WebGL-heavy, the pacing principles apply.	Dark premium staging; controlled accent color; “state changes feel inevitable.”
Resn (Communication Arts) 
Describes a single interactive object as the “nexus” for the experience.	“Hero object as system”; object-driven narrative; micro discoveries (but keep yours meaningful).
Awwwards “Experimental websites” category description 
Defines experimental as pushing UX patterns & interaction; helpful framing for your hero’s ambition.	“Unconventional but purposeful” interaction; focus on innovation over decoration.
Motion useScroll docs 
Confirms correct scroll-linked architecture; includes the offset model and best practice composition.	Offset calibration; compose with useSpring + useTransform; event-less progress.
Chrome scroll-driven animation guidance 
Highlights why scroll-linked animation must stay performant (avoid main thread jank).	Keep to opacity/transform; minimize per-frame React state updates.
MDN reduced motion guidance 
Motion/flashing is a known accessibility issue; your flash/ripple should degrade gracefully.	Reduced motion variants; suppress flashes; maintain meaning without motion.

Concrete animation techniques to apply immediately
Threshold crossing marker (the “receipt” of entry)
Implement a thin ellipse plane + ripple at the point the orb “enters.” This is the single best way to make entry legible. It maps perfectly to SVG + motion scaling (no WebGL). This pattern shows up constantly in high-end scroll sections because it gives the viewer a timestamped moment (see how Awwwards scroll showcases highlight “scroll” as discrete elements, especially for cinematic experiences). 

Edge hierarchy (depth as meaning)
Front edges: brighter, thicker, slight glow. Back edges: dimmer, thinner, slight blur. This turns a cube from “math” into “container.” Omega Clearspace explicitly emphasizes wireframe treatment; this is the exact trick. 

Containment seal pulse (protection cue)
A 250–400ms bloom on front top edge + posts right after contact sells “locked.” This is the “vault did something” proof.

Interior atmosphere ramp (volume, not abstraction)
Fade in an interior gradient during contain (0 → ~0.22 opacity). It reads as space with air, not a wireframe diagram.

Orb squash micro‑physics (subtle premium)
At contact, scaleX 1.02–1.04 and scaleY 0.96–0.98 at peak, then return. Keep it micro (premium), not bouncy (toy).

Specular drift (glass realism)
Add a tiny moving highlight layer (a radial gradient circle) drifting 5–10px across approach. Reads as glass and makes the orb feel “real.” Use useTransform(approachP, ...) and pure transform (compositor friendly).

Energy transfer collapse (meaningful glow)
During contain, reduce orb halo while increasing vault inner glow. Sustaining inner glow through mint (coinEntryGlow) makes the vault feel “powered” by the deposit.

Mask-based submerge (soft occlusion)
As the orb settles, feather it into the floor using mask-image. MDN confirms gradients are valid mask images and enable partial transparency. 

One moment, one effect (anti‑noise discipline)
Instead of multiple unrelated glows, make each beat have one visual thesis. Immersive Garden’s own case-study language emphasizes large visual impact per action. 

Reduced motion variant (keep meaning, remove flash)
Use prefers-reduced-motion to disable contact flash and ripple (or greatly reduce amplitude). This aligns with accessibility guidance that flashing/motion can be problematic. 

Offset calibration (avoid “drift” between beats)
Motion’s useScroll uses offsets to map progress; keep all mappings normalized from the same source values so your phases don’t drift on different viewports. 

Transform/opacity only (performance)
Chrome’s scroll-driven animation guidance notes JS scroll event pitfalls and jank risk; your implementation should stay in transform/opacity rather than layout properties. 

Implementation checklist and tuning guidance
Implementation steps
Replace VaultScene with VaultCaptureSystem (code above).
Add captureProgress MotionValue and pass it down.
Remove obsolete MotionValues (vaultLidOp, vaultWallOp, vaultPostProgress, vaultTopProgress, landingFlash, vaultGlow, and ideally zoraGreenFlash).
Verify the stage 1 hard stop at v >= 0.32 still makes visual sense (it should now correspond to “contain complete”).
Do a reduced-motion pass: ensure threshold/ripple/edge flashes suppress cleanly.
Run the focused tests already in repo; the existing VaultFlowScroll.test.tsx largely asserts text/scene visibility and should remain stable. 
Numeric tuning ranges
These are “dial knobs” that tend to produce premium results:

Parameter	Recommended range	Why
captureProgress window	[0.08, 0.34]	Matches your vault “arrival → sealed” region before the deposit card becomes dominant.
Contact flash duration (in progress)	~8–12% of capture window	Fast enough to read as a “moment,” short enough not to feel like an effect.
Ripple scale	1.5×–2.1×	Large enough to read, not so large it becomes decorative.
Orb squash	scaleX +2–4%, scaleY −2–4%	Premium micro-physics (avoid cartoon).
Interior fill max opacity	0.16–0.26	Enough to suggest volume without filling the cube.
Front edge brightness delta	+0.20–0.35 alpha vs back	Depth cue without neon.

Easing values that work well here
Even though scroll-linked transforms are “scrubbed,” you’ll still use easing in looping accents and some AnimatePresence transitions:

UI reveal ease (already used in your file): cubic-bezier(0.22, 1, 0.36, 1)
Premium “soft” ease: cubic-bezier(0.32, 0, 0.67, 0) (great for gentle fades)
Looping pulse: easeInOut with 2.2s–4.8s duration (you already use this style; keep it restrained)
Accessibility and safety notes
Suppress flashes/ripples under reduced motion because flashing/motion can be problematic for certain users (vestibular disorders, migraines, etc.). prefers-reduced-motion is the right channel for this. 
Keep the vault “meaning” without motion: in reduced mode, show the sealed cube + stable inner glow, no pulses.
Tests likely to touch
frontend/src/components/home/VaultFlowScroll.test.tsx focuses on stage text visibility and semantic overlays; it should not break unless you change copy or aria-labels. 
If you add new aria-labels (optional), be consistent so they don’t collide with existing ones like “distribution checkpoint progress.”
If you want, I can also produce a separate VaultCaptureSystem.tsx file + import to keep VaultFlowScroll.tsx smaller, but the pasteable replacement above is already tailored to the repo’s current geometry and positioning.