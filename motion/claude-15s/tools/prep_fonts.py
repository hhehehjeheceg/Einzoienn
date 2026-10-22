"""Prepare the fonts of claude-15s.

    python3 tools/prep_fonts.py <fontsource dir>

<fontsource dir> holds the extracted npm packages (npm pack + tar):
  @fontsource-variable/fraunces, @fontsource/noto-sans-{jp,kr,sc,arabic,devanagari,hebrew}

Writes
  fonts/fraunces-600.woff2, fonts/fraunces-400.woff2   static instances (opsz 144, SOFT 100, WONK 0)
  fonts/noto-<script>.woff2                            subsets holding only the greetings of the language ring
  src/glyphs.json                                      outlines of the 3D letters (Fraunces 700), y up, units/em
"""
import io
import json
import sys
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
FRAUNCES = SRC / "fontsource-variable-fraunces-5.3.0/package/files/fraunces-latin-full-normal.woff2"
GLYPHS_3D = "Claude{}"
# the language ring: every greeting is drawn with the film's fonts or one of these subsets
GREET = {
    "jp": ("fontsource-noto-sans-jp-5.3.1", "こんにちは"),
    "kr": ("fontsource-noto-sans-kr-5.3.1", "안녕하세요"),
    "sc": ("fontsource-noto-sans-sc-5.3.1", "你好"),
    "arabic": ("fontsource-noto-sans-arabic-5.3.0", "مرحبا"),
    "devanagari": ("fontsource-noto-sans-devanagari-5.3.0", "नमस्ते"),
    "hebrew": ("fontsource-noto-sans-hebrew-5.3.0", "שלום"),
}


def instance(wght):
    f = TTFont(FRAUNCES)
    return instantiateVariableFont(f, {"opsz": 144, "wght": wght, "SOFT": 100, "WONK": 0}, updateFontNames=False)


def save_woff2(font, path, text=None):
    if text is not None:
        opts = Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        sub = Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
    font.flavor = "woff2"
    font.save(path)
    print(f"{path.name:28s} {path.stat().st_size / 1024:7.1f} KB")


class CmdPen(BasePen):
    def __init__(self, gs):
        super().__init__(gs)
        self.cmds = []

    def _moveTo(self, p):
        self.cmds.append(["M", *p])

    def _lineTo(self, p):
        self.cmds.append(["L", *p])

    def _qCurveToOne(self, p1, p2):
        self.cmds.append(["Q", *p1, *p2])

    def _curveToOne(self, p1, p2, p3):
        self.cmds.append(["C", *p1, *p2, *p3])

    def _closePath(self):
        self.cmds.append(["Z"])


def outlines(font, chars):
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    out = {"upm": font["head"].unitsPerEm, "asc": font["hhea"].ascent, "desc": font["hhea"].descent, "glyphs": {}}
    for ch in chars:
        name = cmap[ord(ch)]
        pen = CmdPen(gs)
        gs[name].draw(pen)
        out["glyphs"][ch] = {"adv": hmtx[name][0], "cmds": [[c[0]] + [round(v, 2) for v in c[1:]] for c in pen.cmds]}
    return out


if __name__ == "__main__":
    save_woff2(instance(600), HERE / "fonts/fraunces-600.woff2")
    save_woff2(instance(400), HERE / "fonts/fraunces-400.woff2")
    (HERE / "src/glyphs.json").write_text(json.dumps(outlines(instance(700), GLYPHS_3D)))
    print("src/glyphs.json written")
    for key, (pkg, text) in GREET.items():
        files = sorted((SRC / pkg / "package/files").glob("*-500-normal.woff2"))
        need = set(text)
        pick = None
        for f in files:
            cm = TTFont(f).getBestCmap()
            if all(ord(c) in cm for c in need):
                pick = f
                break
        if pick is None:   # CJK packages split the script over many files: merge is not needed, take the one with most coverage
            raise SystemExit(f"no single subset of {pkg} covers {text}")
        save_woff2(TTFont(pick), HERE / f"fonts/noto-{key}.woff2", text)
