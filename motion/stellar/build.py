"""Build stellar.html: inline the fonts and concatenate src/js/*.js into src/template.html."""
import base64
from pathlib import Path

HERE = Path(__file__).parent
FACES = [
    ("Anton", "anton.woff2", "normal", "400"),
    ("InterV", "inter-var.woff2", "normal", "100 900"),
    ("Unbounded", "unbounded.woff2", "normal", "200 900"),
    ("JBM", "jetbrains-mono-500.woff2", "normal", "500"),
    ("Bricolage", "bricolage.woff2", "normal", "200 800"),
]
css = []
for family, file, style, weight in FACES:
    data = base64.b64encode((HERE / "fonts" / file).read_bytes()).decode()
    css.append(f"@font-face{{font-family:'{family}';src:url(data:font/woff2;base64,{data}) format('woff2');"
               f"font-style:{style};font-weight:{weight};font-display:block}}")
files = sorted((HERE / "src" / "js").glob("*.js"))
script = "\n".join(f"// ===== {p.name} =====\n{p.read_text(encoding='utf-8')}" for p in files)
html = (HERE / "src" / "template.html").read_text(encoding="utf-8")
html = html.replace("/*FONTS*/", "\n".join(css)).replace("/*SCRIPT*/", script)
(HERE / "stellar.html").write_text(html, encoding="utf-8")
print(f"stellar.html written ({len(html) / 1024:.0f} KB, {len(files)} scripts)")
