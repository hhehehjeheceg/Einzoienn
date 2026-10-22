"""Build claude-30s.html: inline the fonts, three.js, the 3D glyph outlines and src/js/*.js into src/template.html."""
import base64
import json
from pathlib import Path

HERE = Path(__file__).parent
FACES = [
    # family, file, style, weight range
    ("Fraunces", "fraunces-600.woff2", "normal", "600"),
    ("Fraunces", "fraunces-400.woff2", "normal", "400"),
    ("InstrSerif", "instrument-serif-italic.woff2", "italic", "400"),
    ("InterV", "inter-var.woff2", "normal", "100 900"),
    ("JBM", "jetbrains-mono-500.woff2", "normal", "500"),
    ("NotoJP", "noto-jp.woff2", "normal", "500"),
    ("NotoKR", "noto-kr.woff2", "normal", "500"),
    ("NotoSC", "noto-sc.woff2", "normal", "500"),
    ("NotoAR", "noto-arabic.woff2", "normal", "500"),
    ("NotoDV", "noto-devanagari.woff2", "normal", "500"),
    ("NotoHE", "noto-hebrew.woff2", "normal", "500"),
]

css = []
for family, file, style, weight in FACES:
    data = base64.b64encode((HERE / "fonts" / file).read_bytes()).decode()
    css.append(
        f"@font-face{{font-family:'{family}';src:url(data:font/woff2;base64,{data}) format('woff2');"
        f"font-style:{style};font-weight:{weight};font-display:block}}"
    )

three = (HERE / "vendor" / "three-r170.cjs").read_text(encoding="utf-8")
lib = (
    "const THREE = (() => { const exports = {};\n" + three + "\nreturn exports; })();\n"
    + "const GLYPHS = " + json.dumps(json.loads((HERE / "src" / "glyphs.json").read_text())) + ";\n"
)
scripts = sorted((HERE / "src" / "js").glob("*.js"))
script = "\n".join(f"// ===== {p.name} =====\n{p.read_text(encoding='utf-8')}" for p in scripts)
html = (HERE / "src" / "template.html").read_text(encoding="utf-8")
html = html.replace("/*FONTS*/", "\n".join(css)).replace("/*LIB*/", lib).replace("/*SCRIPT*/", script)
(HERE / "claude-30s.html").write_text(html, encoding="utf-8")
print(f"claude-30s.html written ({len(html) / 1024:.0f} KB, {len(scripts)} scripts)")
