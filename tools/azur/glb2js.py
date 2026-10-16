#!/usr/bin/env python3
"""Wrap each .glb as a classic script for hosts that refuse .glb files and data: fetches.
Each output <name>.glb.js registers the base64 GLB in window.AZCh1Pack[<name>]; ch1-models-v93
loads it with a <script> tag when window.AZ_CH1_EXT === ".glb.js".
Usage: python3 -I tools/azur/glb2js.py <in_dir> <out_dir>"""
import base64, os, sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.endswith(".glb"):
        continue
    key = name[:-4]
    b64 = base64.b64encode(open(os.path.join(src, name), "rb").read()).decode()
    dst = os.path.join(out, name + ".js")
    with open(dst, "w") as f:
        f.write('(window.AZCh1Pack||(window.AZCh1Pack={}))["%s"]="%s";\n' % (key, b64))
    print(name, "->", os.path.getsize(dst))
