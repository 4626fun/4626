4626.fun — SEO asset bundle
Complete generation system for 4626.fun's favicon / PWA / OG / Twitter assets.
All assets are generated programmatically from one Python source of truth — no
binary art files. Rerunning the scripts regenerates every output deterministically.

What's in this bundle
text
seo_bundle/
├── README.md                      — this file
├── scripts/
│   ├── logomark_clean_overlap.py  — the C5 logomark render (source of truth)
│   ├── logomark_seo_export.py     — generates all 15 SEO assets from C5
│   └── logomark_seo_contact.py    — contact-sheet QA renderer
├── fonts/                         — exact font files used at render time
│   ├── space-grotesk-medium.otf   — '4626' in wordmark
│   ├── space-grotesk-regular.otf
│   ├── newsreader-italic.ttf      — '.fun' italic in wordmark
│   ├── inter-regular.otf
│   ├── inter-medium.otf
│   ├── cormorant.ttf              — unused currently
│   ├── cormorant-italic.ttf
│   ├── playfair.ttf               — unused
│   └── playfair-italic.ttf
├── out/                           — generated outputs (current canonical state)
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── favicon-48x48.png
│   ├── apple-touch-icon.png
│   ├── pwa-512.png
│   ├── pwa-512-maskable.png
│   ├── mstile-150x150.png
│   ├── mstile-310x310.png
│   ├── og-image.png               — 1200 × 630
│   ├── app-hero.png               — alias for og-image
│   ├── twitter-card.png           — 1200 × 675
│   ├── site.webmanifest
│   └── browserconfig.xml
└── contact_sheet.jpg              — QA preview of all generated assets
Running
bash
pip install pillow
cd scripts/
python logomark_seo_export.py
python logomark_seo_contact.py   # optional QA sheet
Outputs write to ./seo_out/ relative to the scripts dir. The contact sheet
writes alongside the script.

Design system
Logomark — C5 "clean overlap"
Three stacked isometric cubes (champagne top → silver middle → blue base),
rendered at supersampled 3× and downscaled with LANCZOS.

Palette:

text
BG              = (2, 6, 23)       # #020617   page bg
BG_GLOW         = (24, 32, 58)     # subtle radial glow

CHAMPAGNE_STROKE = (230, 205, 150) # top cube outline (gold)
CHAMPAGNE_FILL   = (217, 194, 138) # #D9C28A
CHAMPAGNE_EDGE   = (255, 240, 200) # top-face edge highlight

SILVER_STROKE    = (225, 232, 245) # middle cube outline
SILVER_FILL      = (196, 206, 224)
SILVER_EDGE      = (255, 255, 255)

BLUE_STROKE      = (150, 180, 220) # bottom cube outline (slate)
BLUE_FILL        = (90, 130, 200)
BLUE_EDGE        = (180, 210, 255)
C5 specifically: slate stroke mode, edge-lit, stroke multiplier 1.35×, and
"clean overlap" occlusion (edges hidden where cubes stack). See
logomark_clean_overlap.py — the c5() function is the exact render.

Wordmark — "4626.fun" lockup
'4626' — Space Grotesk Medium, letter-spacing −0.04em, color #F8FAFF

'.fun' — Newsreader Italic, vertical gradient #F4EBD2 → #8F8163
(champagne family, matches the top cube of the logomark)

Both glyph runs drawn at the same pixel size with shared baseline
(via font.getmetrics() ascent offset). Critical detail: Pillow's text
origin is glyph-cell-top, not baseline, so each run is offset by
(common_baseline − font_ascent) to align.

Output is cropped to true-ink-bbox before compositing.

Tagline
"Creator Vaults on Base" — Space Grotesk Medium, color #AAB6D2 (muted slate).

OG / Twitter card layout
Canvas: #020617 with soft radial glow (center at (0.32W, 0.55H), blurred)

Logomark rendered at min(w,h) × 0.42 × 1.6 then cropped to true ink
(strips the render canvas's bg-ellipse padding). This is what makes the
mark→text spacing feel right.

Logomark origin at x = width × 0.10, vertically centered.

Gap between mark's ink edge and wordmark: width × 0.025 (~30px at 1200w).

Wordmark + tagline block vertically centered against the mark's center.

Gap between wordmark and tagline: height × 0.045.

Assets summary
File	Size	Purpose
favicon.ico	16+32+48	multi-res ICO for browser tabs
favicon-16x16.png	16	explicit HTML link
favicon-32x32.png	32	explicit HTML link
favicon-48x48.png	48	explicit HTML link
favicon.svg	wrapper	modern browsers (embeds 512px PNG base64)
apple-touch-icon.png	180	iOS home screen (filled bg, iOS rounds)
pwa-512.png	512	PWA standard icon
pwa-512-maskable.png	512	Android adaptive icon, 11% safe-zone pad
mstile-150x150.png	150	Windows tile
mstile-310x310.png	310	Windows large tile
og-image.png	1200 × 630	Open Graph / Facebook / general link cards
app-hero.png	1200 × 630	alias for og-image (some existing HTML)
twitter-card.png	1200 × 675	X/Twitter summary_large_image
site.webmanifest	JSON	PWA manifest
browserconfig.xml	XML	Windows tile config
Deployment target
Repo: github.com/wenakita/4626 (private, main branch)
Destination: frontend/public/ (all files land at site root)

Existing HTML/manifest references use these exact filenames. Drop the out/
contents into frontend/public/ to replace.

Known refinement targets
If you want to iterate, these are the obvious levers in
logomark_seo_export.py:

Wordmark color of .fun. Currently champagne
(CHAMPAGNE_TOP / CHAMPAGNE_BOT). The site CSS actually has two silver
variants too: #F5F8FF → #7C8699 (.cres-line-4 .cres-brand) and
#C9D0E0 → #7C8699 (.cres-line-4 em). Pick whichever you prefer.

Wordmark size. render_wordmark(int(height * 0.18), ...) — tweak the
0.18 to scale up/down.

Mark↔text gap. tx = mx + mark_w + int(width * 0.025) — smaller value
= tighter lockup.

Mark size. logomark_ratio=0.42 — grows/shrinks the logomark.

Tagline copy. tagline="Creator Vaults on Base" default in
render_og().

Tagline style. Currently roman slate. Could do uppercase with tracking
for a more "legal-looking" feel: set uppercase + letter-spacing 0.2em.

Maskable safe-zone. render_c5_padded(512, inner_ratio=0.78) —
Android spec minimum is 0.80; current gives 11% padding, comfortably safe.

Font licensing
All fonts are open-licensed:

Space Grotesk — SIL Open Font License 1.1

Newsreader — SIL Open Font License 1.1

Inter — SIL Open Font License 1.1

Cormorant, Playfair — SIL Open Font License 1.1 (unused in final output)

Safe to ship.