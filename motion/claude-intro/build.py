"""Inline the fonts into src.html -> claude-intro.html (one self-contained file)."""
import base64
from pathlib import Path

HERE = Path(__file__).parent
FACES = [
    ("InterV", "inter-var.woff2", "normal", "100 900"),
    ("InstrSerif", "instrument-serif-italic.woff2", "italic", "400"),
    ("InstrSerif", "instrument-serif.woff2", "normal", "400"),
    ("JBM", "jetbrains-mono-500.woff2", "normal", "500"),
]

css = []
for family, file, style, weight in FACES:
    data = base64.b64encode((HERE / "fonts" / file).read_bytes()).decode()
    css.append(
        f"@font-face{{font-family:'{family}';src:url(data:font/woff2;base64,{data}) format('woff2');"
        f"font-style:{style};font-weight:{weight};font-display:block}}"
    )

src = (HERE / "src.html").read_text(encoding="utf-8")
(HERE / "claude-intro.html").write_text(src.replace("/*FONTS*/", "\n".join(css)), encoding="utf-8")
print("claude-intro.html written")
