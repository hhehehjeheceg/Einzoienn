#!/usr/bin/env python3
"""Turn a top-down reference map picture into the island data read by sim.js.

The picture is classified by colour (sea, lagoon, snow, desert, forest, lava),
cleaned, and resampled on a 176 x 176 grid of 10 m cells covering the world
square [-880, 880]. Output: azur-horizons/map-s8-data.js, which sets
window.AZMapS8 = { n, cell, half, sdf, snow, desert, forest, lava } where sdf
is the signed distance to the shore in metres / 4 (int8, positive on land) and
the other layers are soft masks 0..255 (uint8), all base64-encoded rows of +z.
Only derived masks are written; the picture itself is not copied.

usage: python3 tools/azur/map-s8.py <reference.jpg> [out.js]
"""
import base64
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..", "azur-horizons", "map-s8-data.js")
# picture pixel -> world metres: the island bounding box is fitted to 1600 m (measured below)
ISLAND_W = 1600.0
N, CELL, HALF = 176, 10.0, 880.0
UP = 4  # supersampling of the picture for smooth shores

im = Image.open(SRC).convert("RGB")
W, H = im.size
a = np.asarray(im.filter(ImageFilter.GaussianBlur(0.6))).astype(float) / 255
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx, mn = a.max(2), a.min(2)
v = mx
s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
d = mx - mn + 1e-9
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6

sea = (h >= .5) & (h <= .64) & (s > (.38 if W < 300 else .8)) & (v < .78)
lagoon = (h >= .43) & (h < .52) & (s > .3) & (v > .45)
snow = (s < .2) & (v > .74)
snow = nd.binary_opening(snow, iterations=1 if W < 300 else 2)
desert = ((h < .13) | (h > .95)) & (s > .28) & (v > .45)
forest = (h > .18) & (h < .48) & (v < .42) & (s >= .2)
frame = np.zeros_like(sea)
if W < 300:  # first reference picture: grid letters along the top and left edges
    frame[:6, :] = True
    frame[:, :6] = True
else:  # labelled picture: logo in the sea at the top right, white labels everywhere
    frame[:int(H * .15), int(W * .74):] = True
text = (s < .12) & (v > .9)
# eau = océan et ce qui y est relié (lagunes) ; la glace bleue de la neige et les routes bleutées restent de la terre
wet = sea | lagoon | frame
lab, n = nd.label(wet)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
wsz = nd.sum(wet, lab, range(1, n + 1))
water = np.isin(lab, [i for i in edge] + [i + 1 for i, sz in enumerate(wsz) if sz > W * H * .01])
# étiquettes posées sur la mer : redeviennent de l'eau
near_water = nd.uniform_filter(water.astype(float), 7) > .45
water = water | (text & near_water)
land = ~water
land = nd.binary_opening(land, iterations=2) | (land & ~text)
# keep the main island and its two small islets, drop specks
lab, n = nd.label(land)
sizes = nd.sum(land, lab, range(1, n + 1))
big = max(sizes)
land = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= max(20, big * .0005)])
ys, xs = np.where(land)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
CX, CY, MPP = (x0 + x1) / 2, (y0 + y1) / 2, ISLAND_W / (x1 - x0)
print("island box", x0, x1, y0, y1, "centre", CX, CY, "m/px", round(MPP, 3))
land = nd.binary_closing(land, iterations=1) | (land & nd.binary_opening(land, iterations=1))
# volcano: lava = orange pixels near the crater, kept out of the desert mask
K = W / 225.0 if W < 300 else 1.0
if W < 300:
    vx, vy, lx0, lx1, ly0, ly1, vr = 166.5, 65.5, 138, 174, 64, 97, 30
else:
    vx, vy, lx0, lx1, ly0, ly1, vr = 408, 156, 345, 420, 165, 232, 62
yy, xx = np.mgrid[0:H, 0:W]
near_v = np.hypot(xx - vx, yy - vy) < vr
orange = ((h < .17) | (h > .95)) & (s > .25) & (v > .45)
lava = orange & (xx >= lx0) & (xx <= lx1) & (yy >= ly0) & (yy <= ly1)
desert = desert & ~near_v
# clean the big masks: fill the town patches and streaks inside snow and desert
snow = nd.binary_fill_holes(nd.binary_closing(snow, iterations=4)) & land
snow = nd.binary_opening(snow, iterations=2)
lab, n = nd.label(snow)
sizes = nd.sum(snow, lab, range(1, n + 1))
snow = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= 200 * (W / 225.0) ** 2])
desert = nd.binary_fill_holes(nd.binary_closing(desert, iterations=4)) & land
lab, n = nd.label(desert)
sizes = nd.sum(desert, lab, range(1, n + 1))
desert = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= 200 * (W / 225.0) ** 2])


def up(m):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((W * UP, H * UP), Image.BILINEAR)).astype(float) / 255


land_u = up(nd.gaussian_filter(land.astype(float), .7 * (W / 225.0))) > .5
inside = nd.distance_transform_edt(land_u)
outside = nd.distance_transform_edt(~land_u)
sdf_u = (inside - outside) * MPP / UP  # metres, positive on land


def sample(img, scale_up, wx, wz):
    """bilinear sample of a picture-space array at world positions"""
    px = (wx / MPP + CX) * scale_up
    py = (wz / MPP + CY) * scale_up
    return nd.map_coordinates(img, [py, px], order=1, mode="nearest")


cz, cx = np.mgrid[0:N, 0:N]
wx = (cx + .5) * CELL - HALF
wz = (cz + .5) * CELL - HALF
sdf = sample(sdf_u, UP, wx, wz)
sdf[np.hypot(wx, wz) > HALF * 1.05] = -300


def soft(m, sigma):
    return nd.gaussian_filter(m.astype(float), sigma)


layers = {
    "snow": sample(soft(snow, 1.6 * (W / 225.0)), 1, wx, wz),
    "desert": sample(soft(desert, 1.6 * (W / 225.0)), 1, wx, wz),
    "forest": sample(soft(forest & land, 1.4 * (W / 225.0)), 1, wx, wz),
    "lava": sample(soft(lava, .9 * (W / 225.0)), 1, wx, wz),
}


def b64(arr, dtype):
    return base64.b64encode(arr.astype(dtype).tobytes()).decode("ascii")


data = {"n": N, "cell": CELL, "half": HALF, "sdf": b64(np.clip(np.round(sdf / 4), -127, 127), np.int8)}
for k, m in layers.items():
    data[k] = b64(np.clip(np.round(m * 255), 0, 255), np.uint8)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* AZUR v94 — île « saison 8 » : masques dérivés de la carte de référence (tools/azur/map-s8.py). */\n")
    f.write("(function (root) { root.AZMapS8 = %s; })(typeof globalThis !== 'undefined' ? globalThis : this);\n" % json.dumps(data))
print("wrote", OUT, os.path.getsize(OUT), "bytes; land cells", int((sdf > 0).sum()), "snow", float(layers["snow"].mean()), "desert", float(layers["desert"].mean()))
# preview
prev = np.zeros((N, N, 3), np.uint8)
prev[sdf > 0] = (90, 170, 60)
prev[(sdf > 0) & (layers["forest"] > .45)] = (35, 95, 45)
prev[(sdf > 0) & (layers["desert"] > .5)] = (230, 150, 60)
prev[(sdf > 0) & (layers["snow"] > .5)] = (240, 245, 250)
prev[(sdf > 0) & (layers["lava"] > .3)] = (255, 90, 20)
prev[sdf <= 0] = (20, 60, 160)
Image.fromarray(prev).resize((704, 704), Image.NEAREST).save(os.path.splitext(OUT)[0] + ".preview.png" if len(sys.argv) > 3 else "/tmp/map-s8-preview.png")
