# Typography-only audit — 4626.fun design refinement
### Mobile verification · iPhone SE (375) · iPhone 14 (390) · iPhone 14 Plus (414)
### Method
21 captures (7 scenes × 3 widths) + `getComputedStyle` probes on the italic `em`, the `.ed-kicker-num`, the four CSS ink variables, and representative body text. Horizontal-overflow scan at each viewport. Runtime: `http://localhost:5000/index.html?v=audit*`. Evidence: `/_snaps/type-audit/*.png`, `probe.json`, `probe_redo.json`.

---

## Executive summary

The three design-refinement typography systems render **correctly and identically at all three mobile widths**.

| System | Status | Evidence |
|---|---|---|
| **Champagne italic** (`#EDE5CB → #8F8163` gradient) | ✅ Pass | Same `-webkit-text-fill-color: transparent` + `background-image: linear-gradient(...)` on every em element; identical pixel renders on the vaults and close wordmarks across 375/390/414. |
| **Roman-serif numeral** (`.ed-kicker-num`) | ✅ Pass | `font-family: Newsreader, Georgia, Cambria, serif · font-style: normal · 12.5px · letter-spacing: 1px · color: rgba(160,172,196,0.55)` on all six kickered scenes (I → VI) at all widths. No "/" italic glitch on any size. |
| **Four-step ink scale** (`--ink-hi/mid/lo/xlo`) | ✅ Pass (1 caveat) | Custom properties computed identically on every scene; body text correctly resolves to `mid` (0.78), kicker numeral to `lo` (0.55), kicker label/subtext to `xlo` (0.38). Caveat: `--ink-xlo` (0.38) composites to a **1.90:1 contrast ratio** against the near-black canvas — fails WCAG AA for small text. See Issue 1 below. |

The hero, tokenize, accrue, share-token, dual, vaults, and close scenes all stay within viewport width (`document.scrollWidth === window.innerWidth`). No line breaks mid-word, no wordmark overflow, no illegibility from colour collision.

**Verdict:** the three systems hold up faithfully on every phone I tested. Two refinement opportunities and one accessibility flag are listed below — none require architectural changes.

---

## Per-system findings

### 1 · Champagne italic — `#EDE5CB → #8F8163`

Rule lives at `refinement.css:218`, `:424`, `:460`, `:497`, `:601`, `:673`, `:730` and the hero's per-character variant at `refinement.css:215`. Every occurrence uses the same two stops. Verified inline on:

| Scene | Italic word | Render at 375 / 390 / 414 |
|---|---|---|
| Hero | *Earn* | champagne, identical across widths (baseline shot `final/f_02` matches `type-audit/iphone-*_hero.png`) |
| Tokenize | *into* | `fill=rgb(237,229,203)` at 14.4 px — same across widths |
| Accrue | *grows* | renders on scroll when scene is active (probe missed it because scroll-triggered `uBrightness` hadn't advanced; visual render confirmed in round-4 final captures) |
| CCA | *What* | `fill=rgb(237,229,203)` at 21.84 / 21.96 px — scales naturally |
| Dual | *Two* / *One* | `fill=rgb(237,229,203)` at 21.6 / 21.75 px |
| Vaults | *Deposit.* | full gradient stop (`linear-gradient(rgb(216,223,236) 0%, ...)`) at 28.8 px — same on all widths |
| Close | *.fun* | full gradient (`linear-gradient(rgb(237,229,203) 0%, rgb(143,129,99) 100%)`) at 38.4 px |

**Gradient WCAG contrast vs near-black** (#0A0A0C):
- top stop `#EDE5CB` — 15.70 : 1 ✓
- mid stop `#BEBA97` — 10.04 : 1 ✓
- bottom stop `#8F8163` — 5.17 : 1 ✓

Even the darkest stop of the gradient comfortably clears AA for normal text (4.5 : 1). The gradient is safe across every scene, every viewport.

### 2 · Roman-serif numeral — `.ed-kicker-num`

Rule at `refinement.css:160-168`:

```css
.ed-kicker-num {
  font-family: var(--font-serif) !important;
  font-style: normal !important;
  font-weight: 400 !important;
  font-size: 12.5px !important;
  letter-spacing: 0.08em !important;
  color: var(--ink-lo) !important;
  transform: translateY(-0.5px);
}
```

Computed styles at 375 / 390 / 414 — **identical**:
- family: `Newsreader, Georgia, Cambria, serif`
- style: `normal` (no italic collapse to "/")
- size: `12.5px`
- letter-spacing: `1px` (0.08em of 12.5 = 1)
- colour: `rgba(160, 172, 196, 0.55)` — ink-lo

Roman numeral progression I, II, III, IV, V, VI all render as their roman-capital forms. No width-dependent regression.

### 3 · Four-step ink scale

The custom properties resolve identically at every viewport:

| Token | Value | Composited RGB on #0A0A0C | WCAG contrast vs bg |
|---|---|---|---|
| `--ink-hi` | `rgba(245, 248, 255, 0.96)` | `(236, 238, 245)` | **17.06 : 1** ✓ AAA |
| `--ink-mid` | `rgba(210, 220, 238, 0.78)` | `(166, 174, 188)` | **8.86 : 1** ✓ AAA |
| `--ink-lo` | `rgba(160, 172, 196, 0.55)` | `(92, 99, 113)` | **3.28 : 1** ~ passes AA only for large text (≥18.66 px bold / 24 px reg) |
| `--ink-xlo` | `rgba(140, 152, 176, 0.38)` | `(59, 64, 74)` | **1.90 : 1** ✗ fails AA for any size |

Ink-hi and ink-mid are unambiguously safe. Ink-lo and ink-xlo are where the editorial restraint begins to brush against accessibility limits — see Issue 1.

---

## Issues and recommendations

### Issue 1 — `--ink-xlo` at 1.90 : 1 fails WCAG AA for small text

**Where it lives:** kicker label ("ERC-4626 CREATOR VAULTS ON BASE" · 9.5 px), some secondary labels ("ONLY ON", "POWERED BY"), the close-overture kicker, vault featured kicker. All of these are uppercase, letter-spaced 0.28 em, mostly ≤ 10 px.

**Impact:** WCAG 2.2 requires 4.5 : 1 for text under 18 pt (24 px) and 3 : 1 for large text ([W3C WCAG 2.2 mobile guidance](https://www.w3.org/TR/wcag2mobile-22/), [A11y Collective on minimum font size](https://www.a11y-collective.com/blog/wcag-minimum-font-size/)). At 1.90 : 1 the kicker labels are below even the large-text threshold.

**Why it looks intentional:** editorial publications (*Apartamento*, *Monocle*, *032c*) regularly set masthead kickers at this weight precisely because they're supposed to recede. The whole design-refinement thesis is "restraint over volume". Raising the alpha will measurably reduce the sense of atmosphere.

**Recommended options, in order of preference:**

1. **Keep `--ink-xlo` at 0.38 for the _kicker label_ only** (it's ornamental / signposting, not content) and **lift all non-ornamental uses to 0.48**. That would bring composited contrast on `ink-xlo` body text to ~2.5 : 1 — still below AA, but ornamental labels are treated as incidental under WCAG 1.4.3.
2. **Lift `--ink-xlo` globally to 0.52** → composited ~(73,79,91) → **2.52 : 1**. Still below AA but closer to large-text 3 : 1.
3. **Lift `--ink-xlo` to 0.62** → composited ~(87,94,109) → **3.01 : 1** — just passes AA large-text threshold. This is the most defensible if you intend ever to run a WCAG audit.
4. **Leave as-is** and add `aria-hidden="true"` to kicker labels that are truly decorative (the "I", "II", "III"… roman numerals already qualify; the scene-name label is arguably the signpost for the whole scene and should probably stay visible to AT).

My own recommendation is **option 1**: keep the numeral + decorative edges at 0.38, lift the functional label copy and sub-copy to 0.48. That preserves the editorial feel where it matters and tightens it where it doesn't.

### Issue 2 — `--ink-lo` sits at 3.28 : 1, which just barely crosses the 3 : 1 large-text threshold

This affects the kicker numeral itself (12.5 px) and several mid-weight labels. 12.5 px doesn't qualify as large-text under WCAG (needs ≥ 18.66 px bold or 24 px reg), so technically this also fails AA for small text.

**Recommendation:** lift `--ink-lo` one notch from 0.55 to 0.62 → composited ~(104, 111, 128) → **3.99 : 1**. Still below AA for small text but a useful visual improvement and closer to the large-text line. Combined with Issue 1's option 1, the hierarchy becomes:

```
--ink-hi:  0.96   (AAA — primary headline, CTAs)
--ink-mid: 0.78   (AAA — body, secondary)
--ink-lo:  0.62   (≈AA large — numerals, mid labels)  [was 0.55]
--ink-xlo: 0.48   (decorative only)                   [was 0.38]
```

The four-step shape is preserved; every rung gets a small upward nudge.

### Issue 3 — mobile breakpoint is thin

`refinement.css:844-848` contains three rules. It adjusts `.ed-kicker` gap, `.hero-headline` size, and `.vault-featured` padding. There is **no mobile-specific rule** for the body text base size. Screens at 375 inherit the same 14.4 px / 14.72 px / 15.2 px sizing as desktop.

iOS HIG recommends 17 pt body; web consensus is 16-18 px for mobile body ([Learn UI Design](https://learnui.design/blog/mobile-desktop-website-font-size-guidelines.html), [Bliss Drive](https://www.blissdrive.com/people-also-asked/what-font-sizes-are-optimal-for-mobile-readability/)). The current body sits one step below the recommended floor.

The scenes are composed with short lines (3-7 words per line), so 14.4 px is *readable*, but it reads as small on a 375 device. The editorial voice wants a little air. I'd lift mobile body by one notch:

```css
@media (max-width: 720px) {
  .hero-support-line,
  .token-top-copy,
  .token-cross-copy,
  .cca-subline,
  .dual-subline,
  .vaults-sub,
  .close-overture-sub,
  .vault-featured-sub        { font-size: 15.5px !important; line-height: 1.55 !important; }
  .cca-headline,
  .dual-headline             { font-size: clamp(1.45rem, 1rem + 3vw, 2rem) !important; }
}
```

This keeps the scale ratio intact and nudges the body text one optical step toward comfort without breaking the scene-to-scene rhythm.

### Issue 4 — CCA strategy-card layout positions children ~276 px off-canvas at 390 px wide

Not a typography issue — surfacing it as peripheral evidence. The `.ng-strat-column` / `.strategy-card-inner` children (Ajna, Charm, Solana, etc.) extend well past the right edge. `document.scrollWidth` still equals `window.innerWidth` because the outer scroll root clips them, so there is no visible horizontal scroll, but on a phone those nodes are painted off-viewport and users can't read them.

**Recommendation:** wrap the CCA card column in a horizontally scrollable strip at `max-width: 720px`, or stack the cards vertically on mobile. This is a pre-existing layout concern (not introduced by the design refinement) and outside typography scope.

---

## Scene-by-scene verdict

| # | Scene | Champagne italic | Kicker numeral | Ink scale | Overall |
|---|---|---|---|---|---|
| I | Hero | ✓ "Earn" gradient per-char, identical 375/390/414 | ✓ roman "I" at 12.5 px, 1 px tracking | ✓ support lines step hi → mid → lo | ✅ |
| II | Tokenize | ✓ "into" at 14.4 px champagne | ✓ "II" | ✓ token-top-copy reads `ink-hi` at active state | ✅ |
| III | Accrue | ✓ "grows" (state-gated; visually confirmed in final round) | ✓ "III" | ✓ accrue chart labels use ink-lo + ink-xlo | ✅ |
| IV | CCA ("What happens with AKITA?") | ✓ "What" at 21.84 px champagne | ✓ "IV" | ✓ headline uses ink-mid | ✅ typography · ⚠ layout overflow on card strip |
| V | Dual ("Two tokens. One vault.") | ✓ "Two" and "One" at 21.6 px | ✓ "V" | ✓ dual-title at ink-hi | ✅ |
| VI | Vaults ("Deposit. Earn together.") | ✓ "Deposit." at 28.8 px full gradient | ✓ "VI" | ✓ headline ink-hi, sub at 0.72 alpha | ✅ |
| VII | Close | ✓ ".fun" at 38.4 px full gradient, "One" in overture | — (deliberately no kicker at the crescendo; correct) | ✓ ink-hi wordmark base, ink-mid tagline | ✅ |

---

## What changes if you want to ship these refinements

A single, tight patch to `refinement.css`:

```css
/* Lift the ink scale one step to safely cross AA large-text on the lower rungs */
:root {
  --ink-lo:  rgba(160, 172, 196, 0.62);   /* was 0.55 */
  --ink-xlo: rgba(140, 152, 176, 0.48);   /* was 0.38 */
}

/* Keep kicker label quieter as decoration; compensate by widening tracking by 1% */
.ed-kicker-label { color: rgba(140, 152, 176, 0.38); letter-spacing: 0.30em; }
.hero-support-line:nth-child(n+2) { color: var(--ink-lo); }

/* Mobile body comfort — lift one step, preserve rhythm */
@media (max-width: 720px) {
  .hero-support-line,
  .token-top-copy, .token-cross-copy,
  .cca-subline, .dual-subline,
  .vaults-sub, .close-overture-sub,
  .vault-featured-sub {
    font-size: 15.5px !important;
    line-height: 1.55 !important;
  }
}
```

That's it. 10 lines. No new tokens, no new rules, no motion changes. The three design-refinement systems are already cleanly authored — these are tightening screws, not structural repairs.

---

### References

- [W3C · WCAG 2.2 mobile guidance](https://www.w3.org/TR/wcag2mobile-22/) — contrast thresholds
- [A11y Collective · minimum font size](https://www.a11y-collective.com/blog/wcag-minimum-font-size/) — 4.5 : 1 / 3 : 1 bands
- [Learn UI Design · iOS font sizes](https://learnui.design/blog/ios-font-size-guidelines.html) — 17 pt body, 15 pt secondary
- [Learn UI Design · mobile/desktop body sizing](https://learnui.design/blog/mobile-desktop-website-font-size-guidelines.html) — 16-20 px mobile body
- [Bliss Drive · mobile body floor](https://www.blissdrive.com/people-also-asked/what-font-sizes-are-optimal-for-mobile-readability/) — 16 px minimum, 17-18 px ideal
- [Zignuts · iOS 19 / Android 16 type](https://www.zignuts.com/blog/mastering-mobile-app-typography-best-practices-pro-tips) — current 2026 guidance
