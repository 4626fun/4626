# Design Refinement — 4626.fun

*An overlay-only refinement of the existing cinematic scroll experience.  
The arc, the components, and the motion direction are unchanged. What changed
is the feel — tighter typography, quieter atmosphere, one material language,
one voice.*

The pass is delivered as two additive files loaded after the originals:

- `refinement.css` — the overlay stylesheet (15 sections, ~820 lines)
- `refinement.js` — a minimal runtime shader proxy that dims the starfield
  per-chapter without overwriting the chapter system's own `uBrightness` writes

No edits were made to `style.css`, `app.js`, the scene structure, or the
continuity spec. Every refinement is surgical — a quieter override in
service of the existing narrative.

---

## 1 · Audit · scene by scene

### I — Hero *("Deposit. Earn together.")*

**Before:** The headline was heavy (weight 700, very filled), set against
an ambient field where three slow-drifting orbs competed with the starfield.
The partner row dropped in saturated brand colours (Zora purple, Uniswap pink),
the CTA was a filled `#0052FF` block, and the chapter numeral *I* rendered in
italic serif, reading as a slash. The floating tokens (akita, creator portraits)
sat too high in the opacity mix and felt decorative.

**After:** Headline dropped to weight 300 with tighter tracking and an enlarged
breathe-room. The italic accent word "Earn" shifts from blue-white to a warm
champagne-to-brass gradient (`#EDE5CB → #8F8163`). The CTA is now transparent,
a hairline border, with a letter-spacing expansion on hover instead of a fill.
Partner logos unified to monochrome ghosts (grayscale 100 %, opacity 0.38) so
the row reads as rhythm, not a parade of brands. Floating tokens dropped to
2–6 % opacity with grayscale and soft blur — present as atmosphere, not content.
Chapter numeral switched to roman-style (non-italic) serif with extra tracking,
so *I* now reads as a clean vertical column with serifs.

### II — Tokenize *(transfer spine, share ⇄ asset)*

**Before:** The central transfer spine was `#0052FF` — a saturated chrome-blue
rail that read as brand accent, not cinematic geometry. The glow bloom widened
it further. Labels (VAULT SHARE, DEPOSITED ASSET) carried the same blue-on-blue.

**After:** The spine was re-tinted to cool graphite (`rgba(195, 212, 240, 0.48)`
at the midpoint, fading to transparent at top and bottom), preserving the
up-down transfer semantics without the brand rail. Glow bloom cut to 6 %
opacity at its brightest, 20 px blur. The deposit info panel is now treated
as a watch-face plate: 10 px radius, 1 px hairline border, backdrop-blur 20 px
saturate 1.15, subtle inset highlight.

### III — Accrue *(the ratio)*

**Before:** The ratio readout *1.000 → 1.069* was set at weight 500. A bluish
textshadow halo surrounded it. Gridlines and callout plates were tile-like.

**After:** Ratio dropped to weight 200 with `-0.055em` tracking — a display
numeric that reads as a financial frontispiece, not a widget. Halo reduced to
a 60 px / 140 px radial whisper at ~9 % opacity. Callout plates (DAY 30, DAY 90,
DAY 150) unified to the same watch-face material, 10 px radius, backdrop-blur
22 px. The "AKITA PER SHARE | from 1.000" eyebrow dropped to `--ink-lo` mono,
sized 10 px, with generous tracking.

### IV — Share token *(Continuous Clearing Auction)*

**Before:** Node cards carried the old 2–6 px radius vocabulary; edge strokes
were 0.8–1 px with strong blue opacity; dashed flow arrows at 0.46 looked busy.

**After:** Cards unified to the 10 px object radius; backgrounds dropped to
`rgba(9, 13, 24, 0.55)`; borders to `rgba(210, 220, 240, 0.08)`. Edges thinned
to 0.6 stroke, 0.32 opacity, graphite tone instead of electric. Dashed flows
kept at 0.8 stroke, 0.46 opacity for legibility. The allocation cards (40%
CCA / 40% Vesting / 20% Liquidity) read as floating objects, not UI.

### V — The Full Picture *("Two tokens. One vault.")*

**Before:** Already strong — an architectural chapter opener. The body copy
below the headline was a touch heavy and the divider line faintly blue-tinted.

**After:** Headline weight dropped to 300 with warmer italic for *Two* and
*One*. Divider rule re-gradientised to silver hairline fading at top and
bottom. Body copy reads as reduced editorial caption, tracking 0.01em,
`--ink-mid`. The chapter kicker "V — THE FULL PICTURE" now sits with more
air above, rule at 56 px, gradient fade.

### VI — Creator Vaults *(the product objects)*

**Before:** Vault cards were sharp (2 px radius), backgrounds flat, borders
too crisp. The featured quote was a plain sentence without editorial framing.
Stats rows (APY / TVL / DEPOSITORS) competed with the headline for attention.

**After:** Cards promoted to *plate* material: 14 px radius, layered inset
highlight, 60 px soft drop shadow, backdrop-blur 20 px saturate 1.1 — enough
to read as objects, not tiles. Featured quote became a pull-quote with a
champagne left rule at 16 % opacity. Stats row descends below a hairline
separator; values set at weight 300 with subtle letter-spacing for numeric
elegance. APY accent value in soft ice-blue (`#C3D4F0`), not saturated.

### VII — Close *(the crescendo and seal)*

**Before:** Crescendo text occasionally fought the starfield during the most
important emotional moment — mid-white gradients lost contrast against bright
stars in the upper tunnel region. The final *4626.fun* wordmark carried the
same white weight as the crescendo lines before it, so the last beat felt
homogeneous rather than arrived-at.

**After:** A soft stage vignette (`radial-gradient(55% 45% at 50% 52%,
rgba(0,0,0,0.55) 0%, transparent 75%)`) at opacity 0.85 now sits behind the
crescendo pin, giving every line of text a dark apron to sit on without
going *darker to feel premium*. Crescendo lines 1, 2, and 4 received
weight-300 white-to-slate gradients, with italic emphasis words (em tags)
switched to the warm champagne gradient used throughout. The final wordmark
"4626.*fun*" sits with the serif italic "fun" in the same champagne family
— a signoff that arrives softer than what came before it.

---

## 2 · The code

Two files wired into `index.html`:

```html
<link rel="stylesheet" href="./style.css">
<link rel="stylesheet" href="./refinement.css">        <!-- overlay (new) -->
...
<script type="module" src="./app.js"></script>
<script src="./refinement.js" defer></script>          <!-- shader proxy -->
```

### `refinement.css` · 15 sections

0. **Font polish** — antialiased, geometric precision, optical feature-settings,
   soft body vignette
1. **Ambient canvas** — `opacity: 0.52; saturate 0.72; brightness 0.84`; ambient-orbs
   explicitly `display: none`
2. **Nav** — transparent with backdrop-blur 16 px; brand text at weight 500;
   nav-btn becomes hairline border, no fill, letter-spacing grow on hover
3. **Scroll progress** — 1 px silver thread, 0.65 opacity
4. **CTA buttons** — transparent + 1 px hairline border; hover = tracking expands
   from 0.28em to 0.30em; no fill, no transform
5. **Editorial kicker** — roman-style serif numeral, 56 px gradient rule,
   tracked mono label in `--ink-xlo`
6. **Hero** — headline weight 300 with warm italic accent; partner logos monochromed;
   floats at 2–6 % opacity; scroll cue 3.6 s cue-pulse instead of upward streak
7. **Token** — spine re-tinted graphite; deposit panel as watch-face plate
8. **Accrue** — ratio weight 200, quiet halo; callout cards unified material
9. **CCA** — thinner edges, unified card radius, quieter flow
10. **Dual** — weight 300 headline, silver divider, champagne italic emphasis
11. **Vaults** — 14 px plate radius, layered shadow, pull-quote left rule
12. **Close** — stage vignette, crescendo weight discipline, champagne signoff
13. **Footer** — hairline top border
13.5. **Chrome UI** — scan-line re-tinted silver; audio toggle becomes editorial
    ghost (no blue halo)
14. **Motion discipline** — beauty easing, softened float parallax, ambient-orb
    keyframes neutralised
15. **Mobile breathing** — tighter kicker/headline spacing at ≤720 px

### `refinement.js` · runtime shader proxy

Rather than compete with the chapter system's writes to
`material.uniforms.uBrightness`, `refinement.js` proxies that uniform. Each
chapter's natural brightness value gets multiplied by a beauty coefficient:

```js
{ hero: 0.58, token: 0.52, accrue: 0.42, cca: 0.50,
  'dual-overview': 0.46, vaults: 0.38, close: 0.28 }
```

This keeps the chapter system authoring brightness the same way it always did,
while ensuring the starfield never overpowers the editorial layer.

---

## 3 · Reductions · simplified · softened · removed

### Removed
- Three ambient drifting blue orbs behind the hero (`.ambient-orb` × 3)
- The blue headline halo (`.hero-headline-glow` opacity → 0)
- CTA button `::after` pseudo-element (was a filled sweep)
- `enter-vaults-btn::before` decoration
- `.vault-card-glow` accent wash
- Generic upward partner-row sweep animation — replaced with *fade in place + depth recede* (already in spec, now respected at the visual layer)

### Softened
- Starfield canvas overall opacity 1.0 → 0.52; saturation 1.0 → 0.72
- Token transfer spine `#0052FF` → cool graphite `rgba(195, 212, 240, 0.48)`
- Scan-line swept blue → silver hairline, opacity cut by ~45 %
- Audio toggle blue border/glow → editorial ghost button at 42 % opacity
- Hero float tokens 0.18 → 0.02–0.06 + grayscale
- All CTAs changed from filled `--color-accent` → transparent + hairline border
- Crescendo text now sits on a radial stage vignette for contrast without darkness

### Simplified
- Radius vocabulary: 2 / 3 / 4 / 6 / 8 px → **2 / 10 / 14** (hair, object, plate)
- Partner logos: varied brand colour palette → **one** monochrome treatment
- Nav: filled blue pill button → transparent hairline (matches all CTAs)
- Chapter kicker numeral: italic serif (ambiguous at 13 px) → roman serif with tracking

### Reduced
- Headline weight 700 → 300
- Partner row opacity 0.72 → 0.38
- Ambient-orb presence (removed entirely, replaced with starfield alone)
- Inter-chapter brightness swings (now a single proxy coefficient set)
- Blue tone throughout — retained only where it's *semantic* (APY accent, token rings)

---

## 4 · Per-scene elegance notes

**Hero · I.** The opener used to introduce the product. It now *greets* the
reader. Typography carries the mood — the champagne italic *Earn* is the
only accent a single scroll-unit needs. Everything else steps back.

**Tokenize · II.** The transfer spine is no longer a brand rail; it's a
cinematic axis. The eye follows geometry, not colour. Material unity
between the deposit panel and everything downstream makes the system feel
authored by one hand.

**Accrue · III.** The ratio was always the hero of this scene. Dropping its
weight lets it *arrive* quieter — a Patek dial, not a dashboard. Rule-top,
rule-bottom compose the numeric like a classical frontispiece.

**Share token · IV.** Allocation percentages now float in matching glass plates
connected by thin graphite curves. The mechanism still reads — it just stopped
*announcing*.

**Dual · V.** This chapter was already strong. The refinement tightened the
headline weight and gave the supporting sentence more air, so the moment of
*two tokens, one vault* lands as a thesis rather than a factoid.

**Vaults · VI.** The product cards graduated from tiles to *plates* — 14 px
radius, layered light, soft drop. Each vault reads as an editorial object
you'd want to open. The pull-quote with a champagne rule frames the voice of
the vault (the creator), not the metrics below.

**Close · VII.** A film has a denouement, and this one finally does. The
vignette behind the crescendo gives every line of text a dark apron to rest
on — without the whole sequence going darker. The *4626.fun* signoff arrives
in the same warm italic used in the first champagne accent — closing the loop
the hero opened.

---

## 5 · Why the result feels more premium

The site already *had* the components, the motion, and the story. What it
didn't have was restraint — a single voice telling you which element to
care about in any given 200 ms.

The design refinement delivered that voice through four decisions:

1. **One material language.** Two radii (2 px for hairlines, 10 px for
   objects, 14 px for plates). One glass recipe — `rgba(9, 13, 24, 0.55)` +
   `blur(20px) saturate(1.1)` + inset highlight + soft drop. Every card,
   panel, and plate now belongs to the same family. That's the difference
   between a UI kit and a product film.

2. **One colour temperature.** Blue was kept only where it carries meaning
   (APY accents, token ring glow at the moment of mint). Everything else
   reverts to an ink scale (`--ink-hi / mid / lo / xlo`) or to the warm
   champagne family for italic serif emphasis. The page no longer *lives*
   in a single brand colour; it uses colour as voice.

3. **One hierarchy of motion.** Starfield is atmosphere (dimmed 0.52,
   chapter-aware proxy). Floats are memory (0.02–0.06). Headlines are
   arrivals (weight 300, tight tracking, measured reveal). CTAs are
   invitations (hairline borders, letter-spacing expansion on hover).
   Nothing competes with anything else at its same register.

4. **Typography as cinema.** Weight 300 display copy with tight letter-
   spacing. Italic serif accents in a warm palette. Mono eyebrows at 9–10
   px with 0.28–0.32em tracking. Roman-serif chapter numerals at
   12.5 px with their own optical nudge. Every size, weight, and tracking
   value is declarative, and the editorial system works *with* the starfield
   rather than despite it.

Everything else that the brief asked for — elegance, immersion,
restraint, inevitability, composition — followed from those four.

---

*Beauty is what is left when nothing else needs to happen.*
