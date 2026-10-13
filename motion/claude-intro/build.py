"""Build claude-intro.html: inline the fonts and concatenate src/js/*.js into src/template.html."""
import base64
from pathlib import Path

HERE = Path(__file__).parent
FACES = [
    # family, file, style, weight range
    ("InterV", "inter-var.woff2", "normal", "100 900"),
    ("InstrSerif", "instrument-serif-italic.woff2", "italic", "400"),
    ("InstrSerif", "instrument-serif.woff2", "normal", "400"),
    ("JBM", "jetbrains-mono-500.woff2", "normal", "500"),
    ("Bricolage", "bricolage.woff2", "normal", "200 800"),
    ("Unbounded", "unbounded.woff2", "normal", "200 900"),
    ("Anton", "anton.woff2", "normal", "400"),
    ("Fraunces", "fraunces-italic.woff2", "italic", "100 900"),
    ("Caveat", "caveat-700.woff2", "normal", "700"),
    ("Syne", "syne.woff2", "normal", "400 800"),
]

css = []
for family, file, style, weight in FACES:
    data = base64.b64encode((HERE / "fonts" / file).read_bytes()).decode()
    css.append(
        f"@font-face{{font-family:'{family}';src:url(data:font/woff2;base64,{data}) format('woff2');"
        f"font-style:{style};font-weight:{weight};font-display:block}}"
    )

script = "\n".join(
    f"// ===== {p.name} =====\n{p.read_text(encoding='utf-8')}" for p in sorted((HERE / "src" / "js").glob("*.js"))
)
html = (HERE / "src" / "template.html").read_text(encoding="utf-8")
html = html.replace("/*FONTS*/", "\n".join(css)).replace("/*SCRIPT*/", script)
(HERE / "claude-intro.html").write_text(html, encoding="utf-8")
print(f"claude-intro.html written ({len(html) / 1024:.0f} KB, {len(list((HERE / 'src' / 'js').glob('*.js')))} scripts)")
