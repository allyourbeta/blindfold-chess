#!/usr/bin/env python3
"""
Render public/icons/*.png from the user-provided artwork assets/icon-user.png.

The artwork is a full-bleed square photo (blindfolded boxwood knight on a
walnut/maple board), with no frame or baked-in corners. This script derives
the four required formats:
  icon-192 / icon-512   — art with breathing room, rounded transparent corners
  apple-touch-icon      — art with breathing room, square (iOS rounds it)
  icon-maskable-512     — art scaled into the central safe zone, so a circular
                          launcher mask can't clip the ears or the base

Breathing room is made by shrinking the art and extending its own edge
pixels into the margin, blurred. The photo's background is already out of
focus, so the seam does not show.

The PNGs are committed; run this only if the source artwork changes.
Requires Pillow and numpy:  pip install Pillow numpy
"""
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "icon-user.png"
OUT = ROOT / "public" / "icons"

im = Image.open(SRC).convert("RGBA")
S = 1024
im = im.resize((S, S), Image.LANCZOS)

def padded(scale, shift_y=0.0):
    """Art shrunk to `scale` and centred (plus a downward shift as a fraction
    of S). The margin is filled by stretching the art's own edge pixels
    outward and blurring them, then the sharp art is laid on top with a
    feathered seam. Edge-stretching (not a blurred copy) keeps any ghost of
    the knight out of the margin."""
    n = int(S * scale)
    fg = im.resize((n, n), Image.LANCZOS)
    x = (S - n) // 2
    y = (S - n) // 2 + int(S * shift_y)
    a = np.asarray(fg)
    bg = np.pad(a, ((y, S - n - y), (x, S - n - x), (0, 0)), mode="edge")
    bg = Image.fromarray(bg).filter(ImageFilter.GaussianBlur(14))
    feather = int(n * 0.04)
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rectangle((feather, feather, n - feather, n - feather), fill=255)
    fg.putalpha(mask.filter(ImageFilter.GaussianBlur(feather / 2)))
    bg.alpha_composite(fg, (x, y))
    return bg

def rounded(img, radius_frac=0.225):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1),
                                        radius=int(img.size[0] * radius_frac), fill=255)
    out = img.copy(); out.putalpha(m); return out

OUT.mkdir(parents=True, exist_ok=True)
standard = padded(0.90, 0.015)   # ears clear of the top edge
rounded(standard).resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
rounded(standard).resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
standard.convert("RGB").resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
padded(0.78, 0.01).convert("RGB").resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png")
print("Wrote 4 icons to", OUT)
