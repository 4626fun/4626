"""
Minimal thumbnail for the $PROBE Zora content coin.

Matches the probe HTML's palette (zinc-950 bg, #8b8b8b labels, white
primary). Outputs probe-thumbnail.png at 2048x2048 so it looks sharp
on retina. Regenerate by running `python3 make-thumbnail.py` from the
`zora-probe/` dir.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

SIZE = 2048
BG = (10, 10, 10)          # matches body background of the HTML
FG = (255, 255, 255)
MUTED = (139, 139, 139)    # matches h1 label color
ACCENT = (200, 154, 43)    # matches .tag.pending amber
RULE = (38, 38, 38)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

img = Image.new("RGB", (SIZE, SIZE), BG)
d = ImageDraw.Draw(img)

# Kicker line (uppercase, letter-spaced) ──────────────────────────────
kicker_font = ImageFont.truetype(FONT, 52)
kicker_text = "Z O R A   S A N D B O X   ·   V 1"
kw = d.textlength(kicker_text, font=kicker_font)
d.text(((SIZE - kw) / 2, 520), kicker_text, fill=MUTED, font=kicker_font)

# Big hero title ──────────────────────────────────────────────────────
title_font = ImageFont.truetype(FONT_BOLD, 420)
title_text = "probe"
tw = d.textlength(title_text, font=title_font)
d.text(((SIZE - tw) / 2, 640), title_text, fill=FG, font=title_font)

# Rule ────────────────────────────────────────────────────────────────
rule_y = 1220
d.rectangle([(SIZE * 0.22, rule_y), (SIZE * 0.78, rule_y + 2)], fill=RULE)

# Diagnostic lines that hint at what's inside ─────────────────────────
diag_font = ImageFont.truetype(FONT, 38)
lines = [
    ("iframe origin",      "?"),
    ("window.ethereum",    "?"),
    ("fetch to base rpc",  "?"),
    ("parent access",      "?"),
]
y = 1290
for label, value in lines:
    label_line = f"{label:<22}"
    label_w = d.textlength(label_line, font=diag_font)
    row_y = y
    d.text((SIZE * 0.22, row_y), label_line, fill=MUTED, font=diag_font)
    d.text((SIZE * 0.22 + label_w + 24, row_y), value, fill=ACCENT, font=diag_font)
    y += 64

# Small tag bottom-right ──────────────────────────────────────────────
footer_font = ImageFont.truetype(FONT, 30)
footer = "view to run · copy results"
fw = d.textlength(footer, font=footer_font)
d.text(((SIZE - fw) / 2, 1720), footer, fill=MUTED, font=footer_font)

# Micro attribution top-right ─────────────────────────────────────────
micro_font = ImageFont.truetype(FONT, 28)
micro = "4626.fun"
mw = d.textlength(micro, font=micro_font)
d.text((SIZE - mw - 48, 48), micro, fill=MUTED, font=micro_font)

out = Path(__file__).parent / "probe-thumbnail.png"
img.save(out, "PNG", optimize=True)
print(f"wrote {out} ({out.stat().st_size} bytes)")
