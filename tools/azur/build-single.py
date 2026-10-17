#!/usr/bin/env python3
"""Build a single self-contained HTML file of AZUR Horizons.

Phones open an HTML file from a zip without loading any file next to it, so the
regular build stops on the loading screen. This script inlines every stylesheet
and script of azur-horizons/index.html, embeds fonts, images, the event music
and the Chapter-1 character models (base64), and adds small shims so the code
that still asks for "./assets/..." paths gets the embedded copy instead.

usage: python3 tools/azur/build-single.py [out.html]
"""
import base64
import json
import mimetypes
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "azur-horizons")
ROOT = os.path.normpath(ROOT)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "..", "azur-horizons-single.html")
MIME = {".woff2": "font/woff2", ".webp": "image/webp", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
        ".png": "image/png", ".mp3": "audio/mpeg"}


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def data_uri(rel):
    ext = os.path.splitext(rel)[1].lower()
    mime = MIME.get(ext) or mimetypes.guess_type(rel)[0] or "application/octet-stream"
    with open(os.path.join(ROOT, rel), "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def clean(path):
    return path.split("?")[0].lstrip("./") if path.startswith("./") else path.split("?")[0]


def css_inline(rel):
    css = read(rel)
    base = os.path.dirname(rel)

    def sub(m):
        url = m.group(2)
        if url.startswith("data:") or url.startswith("http") or url.startswith("#"):
            return m.group(0)
        p = os.path.normpath(os.path.join(base, clean(url)))
        if os.path.exists(os.path.join(ROOT, p)):
            return 'url("%s")' % data_uri(p)
        return m.group(0)
    return re.sub(r'url\((["\']?)([^)"\']+)\1\)', sub, css)


# assets addressed at run time by path: images, the event music, the model textures
INLINE = {}
for d, _, files in os.walk(os.path.join(ROOT, "assets")):
    for fn in files:
        if os.path.splitext(fn)[1].lower() in (".webp", ".svg", ".jpg", ".png"):
            rel = os.path.relpath(os.path.join(d, fn), ROOT).replace(os.sep, "/")
            INLINE[rel] = data_uri(rel)
INLINE["event-end-audio.mp3"] = data_uri("event-end-audio.mp3")

chars = os.path.join(ROOT, "assets", "ch1", "chars")
PACKS = {}
for fn in sorted(os.listdir(chars)):
    if fn.endswith(".glb"):
        with open(os.path.join(chars, fn), "rb") as f:
            PACKS[fn[:-4]] = base64.b64encode(f.read()).decode("ascii")


def js_inline(rel):
    js = read(rel)
    # static "./assets/x.ext" strings -> embedded copy
    def sub(m):
        p = m.group(2)
        return m.group(1) + INLINE[p] + m.group(1) if p in INLINE else m.group(0)
    js = re.sub(r'(["\'])\./((?:assets/)[^"\'?]+\.(?:webp|svg|jpg|png))\1', sub, js)
    # icons.js builds the path from the item id
    js = js.replace('src="./assets/${x.model || x.id}.webp"',
                    'src="${(window.AZ_INLINE||{})["assets/"+(x.model||x.id)+".webp"]||("./assets/"+(x.model||x.id)+".webp")}"')
    return js.replace("</script", "<\\/script")


SHIM = r"""
(function () {
  var M = window.AZ_INLINE || {};
  function map(u) {
    if (typeof u !== "string" || u.indexOf("data:") === 0) return u;
    var p = u.split("?")[0].replace(/^\.\//, "").replace(/^.*?(assets\/|event-end-audio)/, "$1");
    return M[p] || u;
  }
  window.AZ_INLINE_MAP = map;
  function hook(proto) {
    var d = Object.getOwnPropertyDescriptor(proto, "src");
    if (!d || !d.set) return;
    Object.defineProperty(proto, "src", { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { d.set.call(this, map(v)); } });
  }
  try { hook(HTMLImageElement.prototype); hook(HTMLMediaElement.prototype); } catch (e) {}
  var sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { return sa.call(this, n, (n === "src" || n === "href") ? map(v) : v); };
  if (window.fetch) { var f = window.fetch; window.fetch = function (u, o) { return f.call(this, typeof u === "string" ? map(u) : u, o); }; }
})();
"""

THREE_HOOK = r"""
(function () { try { var T = window.THREE; if (T && T.DefaultLoadingManager) T.DefaultLoadingManager.setURLModifier(function (u) { return window.AZ_INLINE_MAP ? window.AZ_INLINE_MAP(u) : u; }); } catch (e) {} })();
"""

html = read("index.html")
head = "<script>window.AZ_CH1_EXT=\".glb.js\";window.AZ_INLINE=%s;%s</script>\n<script>(window.AZCh1Pack||(window.AZCh1Pack={}));%s</script>\n" % (
    json.dumps(INLINE, separators=(",", ":")), SHIM,
    "".join('window.AZCh1Pack[%s]="%s";' % (json.dumps(k), v) for k, v in PACKS.items()))


def link_sub(m):
    href = clean(m.group(1))
    if os.path.exists(os.path.join(ROOT, href)) and href.endswith(".css"):
        return "<style>/* %s */\n%s\n</style>" % (href, css_inline(href))
    return m.group(0)


html = re.sub(r'<link rel="stylesheet" href="([^"]+)"\s*/?>', link_sub, html)
html = re.sub(r'<link rel="icon"[^>]*>', '<link rel="icon" href="%s">' % data_uri("assets/favicon.svg"), html)


def script_sub(m):
    src = clean(m.group(1))
    if not os.path.exists(os.path.join(ROOT, src)):
        return m.group(0)
    out = "<script>/* %s */\n%s\n</script>" % (src, js_inline(src))
    if src == "vendor/three.min.js":
        out += "\n<script>%s</script>" % THREE_HOOK
    return out


html = re.sub(r'<script src="([^"]+)"></script>', script_sub, html)
# styles and the loading screen first; the heavy embedded data goes right before the first script
first = html.find("<script>/* ")
html = html[:first] + head + html[first:] if first >= 0 else head + html
left = re.findall(r'(?:src|href)="\./[^"]+"', html)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", OUT, "%.1f MB" % (os.path.getsize(OUT) / 1e6), "packs", len(PACKS), "inline", len(INLINE), "unresolved", left[:10])
