#!/usr/bin/env python3
"""Build the web-ready character pack for AZUR Horizons (ch1 characters).

Input : a folder holding the Quaternius CC0 packs, laid out as
        <src>/q/{base,hair,outfits,parts,textures}/...  (Universal Base Characters,
        Modular Character Outfits - Fantasy) plus <src>/UAL1.glb and <src>/UAL2.glb
        (Universal Animation Library 1 & 2, Unreal-Godot exports). All CC0 1.0.
Output: azur-horizons/assets/ch1/chars/
        *.glb        one skinned model per source model, external jpg textures,
                     normal / roughness maps dropped (the game shades them itself)
        tex/*.jpg    base colour textures, downscaled
        anims.glb    the clips the game uses, constant channels dropped,
                     rotations stored as normalized int16

Usage: python3 -I tools/azur/build-chars.py <src> <out>
Requires Pillow.
"""
import json, os, struct, sys
from array import array
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
Q = os.path.join(SRC, "q")
os.makedirs(os.path.join(OUT, "tex"), exist_ok=True)

MODELS = {
    "body_m": "base/Superhero_Male_FullBody.gltf",
    "body_f": "base/Superhero_Female_FullBody.gltf",
    "hair_parted": "hair/Hair_SimpleParted.gltf",
    "hair_buzz": "hair/Hair_Buzzed.gltf",
    "hair_buzz_f": "hair/Hair_BuzzedFemale.gltf",
    "hair_long": "hair/Hair_Long.gltf",
    "hair_buns": "hair/Hair_Buns.gltf",
    "hair_beard": "hair/Hair_Beard.gltf",
    "ranger_m": "outfits/Male_Ranger.gltf",
    "ranger_f": "outfits/Female_Ranger.gltf",
    "peasant_m": "outfits/Male_Peasant.gltf",
    "peasant_f": "outfits/Female_Peasant.gltf",
}
TEX_SIZE = {"MI_Eyes": 256, "MI_Hair_1": 512, "MI_Hair_2": 512}
DEFAULT_TEX = 1024

CLIPS = {
    "UAL1.glb": [
        "Idle_Loop", "Idle_LookAround_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Jog_Bwd_Loop", "Jog_Left_Loop",
        "Jog_Right_Loop", "Jog_Fwd_L_Loop", "Jog_Fwd_R_Loop", "Jog_Bwd_L_Loop", "Jog_Bwd_R_Loop", "Sprint_Loop",
        "Jump_Start", "Jump_Loop", "Jump_Land", "Crouch_Idle_Loop", "Crouch_Fwd_Loop", "Crouch_Bwd_Loop",
        "Crouch_Left_Loop", "Crouch_Right_Loop", "Crawl_Fwd_Loop", "Crawl_Idle_Loop", "Swim_Fwd_Loop",
        "Swim_Idle_Loop", "Roll", "Death01", "Dance_Loop", "Celebration", "BackFlip", "Interact",
        "PickUp_Kneeling", "Pistol_Idle_Loop", "Pistol_Aim_Neutral", "Pistol_Shoot", "Pistol_Reload",
        "Driving_Loop", "Hit_Chest", "Sword_Attack", "Punch_Jab", "Drink", "Fixing_Kneeling",
    ],
    "UAL2.glb": [
        "Mining_Loop", "TreeChopping_Loop", "Bandage_Loop", "Consume", "Chest_Open", "LiftAir_Fall_Air_Loop",
        "Yes", "Surprise", "Idle_FoldArms_Loop", "NinjaJump_Idle_Loop", "Slide_Loop", "Melee_Hook",
        "OverhandThrow", "Walk_Fwd_Loop", "Walk_Bwd_Loop", "Walk_L_Loop", "Walk_R_Loop", "KipUp",
    ],
}

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    b = open(path, "rb").read()
    off, js, binc = 12, None, b""
    while off < len(b):
        cl, ct = struct.unpack("<II", b[off:off + 8])
        chunk = b[off + 8:off + 8 + cl]
        if ct == 0x4E4F534A:
            js = json.loads(chunk)
        else:
            binc = chunk
        off += 8 + cl
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * (-len(jb) % 4)
    binc += b"\0" * (-len(binc) % 4)
    total = 12 + 8 + len(jb) + (8 + len(binc) if binc else 0)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A) + jb)
        if binc:
            f.write(struct.pack("<II", len(binc), 0x004E4942) + binc)


def accessor_values(g, binc, i):
    a = g["accessors"][i]
    bv = g["bufferViews"][a["bufferView"]]
    fmt, size = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", size * n)
    out = []
    for k in range(a["count"]):
        o = start + k * stride
        out.append(struct.unpack_from("<" + fmt * n, binc, o))
    return out


tex_done = {}


def texture_for(src_png, mat):
    key = (src_png, mat)
    if key in tex_done:
        return tex_done[key]
    size = TEX_SIZE.get(mat, DEFAULT_TEX)
    name = mat.lower().replace("mi_", "") + ".jpg"
    im = Image.open(src_png).convert("RGB")
    if im.width > size:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(os.path.join(OUT, "tex", name), quality=86, optimize=True, progressive=False)
    tex_done[key] = name
    return name


def build_model(key, rel):
    path = os.path.join(Q, rel)
    g = json.load(open(path))
    base = os.path.dirname(path)
    binc = open(os.path.join(base, g["buffers"][0]["uri"]), "rb").read()
    images, textures = [], []
    for m in g.get("materials", []):
        pbr = m.setdefault("pbrMetallicRoughness", {})
        m.pop("normalTexture", None)
        m.pop("occlusionTexture", None)
        m.pop("emissiveTexture", None)
        pbr.pop("metallicRoughnessTexture", None)
        pbr["metallicFactor"] = 0.0
        pbr["roughnessFactor"] = 0.85
        t = pbr.get("baseColorTexture")
        if t:
            src_img = g["images"][g["textures"][t["index"]]["source"]]["uri"]
            jpg = texture_for(os.path.normpath(os.path.join(base, src_img)), m["name"])
            images.append({"uri": "tex/" + jpg})
            textures.append({"source": len(images) - 1, "sampler": 0})
            pbr["baseColorTexture"] = {"index": len(textures) - 1}
    g["images"], g["textures"] = images, textures
    g["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
    g["buffers"] = [{"byteLength": len(binc)}]
    g.pop("extensionsUsed", None)
    write_glb(os.path.join(OUT, key + ".glb"), g, binc)
    return os.path.getsize(os.path.join(OUT, key + ".glb"))


def build_anims():
    out_js = {"asset": {"version": "2.0", "generator": "azur build-chars"}, "nodes": [], "scenes": [{"nodes": []}],
              "scene": 0, "animations": [], "accessors": [], "bufferViews": [], "buffers": []}
    data = bytearray()
    skeleton_done = False
    node_map = {}

    def add_accessor(values, ctype, typ, normalized=False, minmax=False):
        nonlocal data
        fmt = COMP[ctype][0]
        flat = [x for v in values for x in v]
        while len(data) % 4:
            data.append(0)
        off = len(data)
        data += struct.pack("<%d%s" % (len(flat), fmt), *flat)
        out_js["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(data) - off})
        acc = {"bufferView": len(out_js["bufferViews"]) - 1, "componentType": ctype, "count": len(values), "type": typ}
        if normalized:
            acc["normalized"] = True
        if minmax:
            acc["min"] = [min(v[i] for v in values) for i in range(len(values[0]))]
            acc["max"] = [max(v[i] for v in values) for i in range(len(values[0]))]
        out_js["accessors"].append(acc)
        return len(out_js["accessors"]) - 1

    for fname, wanted in CLIPS.items():
        g, binc = read_glb(os.path.join(SRC, fname))
        if not skeleton_done:
            # copy the bone hierarchy (names + rest transforms) so the clips bind by bone name
            skin = g["skins"][0]
            joints = set(skin["joints"])
            keep = [i for i, n in enumerate(g["nodes"]) if i in joints]
            for i in keep:
                n = g["nodes"][i]
                node_map[i] = len(out_js["nodes"])
                out_js["nodes"].append({k: n[k] for k in ("name", "translation", "rotation", "scale") if k in n})
            for i in keep:
                kids = [node_map[c] for c in g["nodes"][i].get("children", []) if c in node_map]
                if kids:
                    out_js["nodes"][node_map[i]]["children"] = kids
            roots = set(node_map.values()) - {c for n in out_js["nodes"] for c in n.get("children", [])}
            out_js["scenes"][0]["nodes"] = sorted(roots)
            skeleton_done = True
        names = {g["nodes"][i]["name"]: i for i in range(len(g["nodes"]))}
        by_name = {a["name"]: a for a in g["animations"]}
        for clip in wanted:
            a = by_name[clip]
            channels, samplers = [], []
            time_cache = {}
            for ch in a["channels"]:
                node = g["nodes"][ch["target"]["node"]]
                path = ch["target"]["path"]
                bone = node["name"]
                if path == "scale":
                    continue
                if path == "translation" and bone not in ("pelvis", "root"):
                    continue
                if names.get(bone) not in node_map:
                    continue
                s = a["samplers"][ch["sampler"]]
                times = accessor_values(g, binc, s["input"])
                vals = accessor_values(g, binc, s["output"])
                if path == "translation" and bone == "root":
                    continue  # no root motion: the game moves the character itself
                const = all(max(abs(v[i] - vals[0][i]) for v in vals) < 1e-4 for i in range(len(vals[0])))
                if const:
                    times, vals = [times[0]], [vals[0]]
                tkey = (s["input"], len(times))
                if tkey not in time_cache:
                    time_cache[tkey] = add_accessor(times, 5126, "SCALAR", minmax=True)
                if path == "rotation":
                    q = []
                    for v in vals:
                        q.append(tuple(max(-32767, min(32767, int(round(x * 32767)))) for x in v))
                    out_acc = add_accessor(q, 5122, "VEC4", normalized=True)
                else:
                    out_acc = add_accessor(vals, 5126, "VEC3")
                samplers.append({"input": time_cache[tkey], "output": out_acc, "interpolation": s.get("interpolation", "LINEAR")})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": node_map[names[bone]], "path": path}})
            out_js["animations"].append({"name": clip, "channels": channels, "samplers": samplers})
    out_js["buffers"] = [{"byteLength": len(data) + (-len(data) % 4)}]
    write_glb(os.path.join(OUT, "anims.glb"), out_js, bytes(data))
    return os.path.getsize(os.path.join(OUT, "anims.glb"))


if __name__ == "__main__":
    for k, rel in MODELS.items():
        print("%-12s %7d bytes" % (k, build_model(k, rel)))
    print("anims        %7d bytes" % build_anims())
    tot = sum(os.path.getsize(os.path.join(OUT, "tex", f)) for f in os.listdir(os.path.join(OUT, "tex")))
    print("textures     %7d bytes (%d files)" % (tot, len(os.listdir(os.path.join(OUT, "tex")))))
