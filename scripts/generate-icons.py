#!/usr/bin/env python3
"""
Render public/icons/*.png from the user-provided artwork assets/icon-user.png.

The artwork is a rounded rectangle with pure black baked in outside the
corners. This script derives the four required formats:
  icon-192 / icon-512   — corners made transparent
  apple-touch-icon      — corners filled burgundy (iOS re-rounds the corners,
                          which would otherwise reveal black triangles)
  icon-maskable-512     — art scaled into the inner ~80% on full-bleed
                          burgundy, so a circular launcher mask can't clip
                          the gold frame

The PNGs are committed; run this only if the source artwork changes.
Requires Pillow:  pip install Pillow
"""
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "icon-user.png"
OUT = ROOT / "public" / "icons"
BURGUNDY = (55, 1, 11, 255)  # sampled from the artwork's own background

im = Image.open(SRC).convert("RGBA")
w, h = im.size

def corners_transparent(img):
    img = img.copy()
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(img, corner, (0, 0, 0, 0), thresh=40)
    return img

def corners_filled(img, color):
    base = Image.new("RGBA", img.size, color)
    base.alpha_composite(corners_transparent(img))
    return base

OUT.mkdir(parents=True, exist_ok=True)
transparent = corners_transparent(im)
transparent.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
transparent.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
corners_filled(im, BURGUNDY).resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")

mask = Image.new("RGBA", (w, h), BURGUNDY)
inner = transparent.resize((int(w * 0.78), int(h * 0.78)), Image.LANCZOS)
off = (w - inner.size[0]) // 2
mask.alpha_composite(inner, (off, off))
mask.resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png")
print("Wrote 4 icons to", OUT)
