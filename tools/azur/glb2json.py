#!/usr/bin/env python3
"""Convert .glb files to self-contained glTF JSON (buffers as base64 data URIs).
Used for hosts that do not serve .glb (the artifact host); images keep their relative URIs.
Usage: python3 -I tools/azur/glb2json.py <in_dir> <out_dir>"""
import base64, json, os, struct, sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.endswith(".glb"):
        continue
    b = open(os.path.join(src, name), "rb").read()
    off, js, binc = 12, None, b""
    while off < len(b):
        cl, ct = struct.unpack("<II", b[off:off + 8])
        chunk = b[off + 8:off + 8 + cl]
        if ct == 0x4E4F534A:
            js = json.loads(chunk)
        else:
            binc = chunk
        off += 8 + cl
    if js.get("buffers"):
        js["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(binc).decode()
    dst = os.path.join(out, name[:-4] + ".json")
    with open(dst, "w") as f:
        json.dump(js, f, separators=(",", ":"))
    print(name, "->", os.path.getsize(dst))
