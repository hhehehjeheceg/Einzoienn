"""Mixage « Pourquoi c'est horrible d'être gaucher ».

Voix off : nivellement (les fins de phrase trop basses sont remontées, on entend chaque mot),
compression vers le bas, expandeur qui coupe les traînes entre les mots (pas d'écho).
Bruitages : ElevenLabs (audio/sfx/*.mp3) + synthèse, toujours au moins 6 dB sous la voix.
Musique de la chaîne à 17 % dès le début. Pas d'effet « titre ».
Sortie : out/mix_raw.wav puis out/mix.wav (loudnorm deux passes, -14 LUFS, TP -1).
"""
import json
import re
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

HERE = Path(__file__).parent
OUT = HERE / "out"
SR = 48000
# durée et minutage : lus dans cues.js (mêmes repères que les scènes)
_src = (HERE / "cues.js").read_text()
CUES = json.loads(_src[_src.index("["):_src.rindex("]") + 1])
DUR = float(np.ceil((CUES[-1]["e"] + 2.6) * 10) / 10)
N = int(SR * DUR)
rng = np.random.default_rng(23)
mix = np.zeros((2, N))


def load(name):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(HERE / "audio/sfx" / f"{name}.mp3"), "-f", "f32le",
                          "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)


SFX = {p.stem: load(p.stem) for p in sorted((HERE / "audio/sfx").glob("*.mp3"))}


def peak(x):
    return int(np.argmax(np.abs(x).sum(0)))


def fade(x, fi=0.005, fo=0.05):
    x = x.copy()
    i, o = min(int(fi * SR), x.shape[1] // 2), min(int(fo * SR), x.shape[1] // 2)
    if i:
        x[:, :i] *= np.linspace(0, 1, i)
    if o:
        x[:, -o:] *= np.linspace(1, 0, o)
    return x


def seg(name, a, b):
    return fade(SFX[name][:, int(a * SR):int(b * SR)], 0.005, 0.08)


def place(x, t, gain=1.0, at_peak=True, pan=0.0):
    off = peak(x) if at_peak else 0
    s = int(t * SR) - off
    a, b = max(0, s), min(N, s + x.shape[1])
    if b <= a:
        return
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    piece = x[:, a - s:b - s] * gain
    mix[0, a:b] += piece[0] * l * 1.414
    mix[1, a:b] += piece[1] * r * 1.414


def pitch(x, ratio):
    n = int(x.shape[1] / ratio)
    idx = np.linspace(0, x.shape[1] - 1, n)
    return np.vstack([np.interp(idx, np.arange(x.shape[1]), c) for c in x])


def lp(x, f):
    return sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)


def hp(x, f):
    return sosfilt(butter(2, f, "high", fs=SR, output="sos"), x)


def tt(n):
    return np.arange(n) / SR


def st(y):
    return np.vstack([y, y])


# ---------------------------------------------------------------- synthèse
def sub(dur=1.0, f0=100, f1=35, gain=0.8):
    n = int(dur * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * 6)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    y[:200] *= np.linspace(0, 1, 200)
    return st(y) * gain


def pop(gain=0.3, f0=500, f1=1400):
    n = int(0.09 * SR); t = tt(n)
    f = f0 + (f1 - f0) * (t / t[-1])
    return st(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)) * gain


def swish(dur=0.45, gain=0.3, f=3000):
    n = int(dur * SR)
    y = lp(rng.standard_normal(n), f) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return st(y) * gain


def tick(gain=0.1, f=2600):
    n = int(0.03 * SR); t = tt(n)
    return st(np.sin(2 * np.pi * f * t) * np.exp(-t * 180) + rng.standard_normal(n) * np.exp(-t * 300) * 0.3) * gain


def scratch(gain=0.5):
    """Disque qui s'arrête net (record scratch)."""
    n = int(0.42 * SR); t = tt(n)
    f = 1800 * np.abs(np.sin(2 * np.pi * 3.4 * t)) * np.exp(-t * 2) + 120
    y = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 + lp(rng.standard_normal(n), 4000) * 0.6
    y = hp(y, 300) * np.exp(-t * 3)
    return st(y) * gain


def hum(dur, gain=0.05):
    """Ronronnement de la lumière annulaire."""
    n = int(dur * SR); t = tt(n)
    y = (np.sin(2 * np.pi * 100 * t) + 0.4 * np.sin(2 * np.pi * 200 * t)) * (1 - np.exp(-t * 8))
    y[-2400:] *= np.linspace(1, 0, 2400)
    return st(y) * gain


def buzz(dur, gain=0.06):
    """Mouche qui tourne au-dessus des céréales."""
    n = int(dur * SR); t = tt(n)
    f = 210 + 30 * np.sin(2 * np.pi * 1.3 * t)
    y = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.9 * t))
    y = lp(y, 2500); y[:2400] *= np.linspace(0, 1, 2400); y[-2400:] *= np.linspace(1, 0, 2400)
    return np.vstack([y * (0.6 + 0.4 * np.sin(t * 5)), y * (0.6 - 0.4 * np.sin(t * 5))]) * gain


def rewind(dur, gain=0.25):
    n = int(dur * SR); t = tt(n)
    f = 400 + 2200 * t / dur
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 + hp(rng.standard_normal(n), 2000) * 0.5
    y *= (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 14 * t)))
    y[:1200] *= np.linspace(0, 1, 1200); y[-1200:] *= np.linspace(1, 0, 1200)
    return st(y) * gain


def splashy(gain=0.6):
    return SFX["splash"] * gain


def whoosh(t, i, gain=0.6):
    a, b = [(0.0, 0.7), (2.05, 2.7), (4.0, 4.6), (5.8, 6.4)][i % 4]
    place(seg("whoosh", a, b), t, gain)


def shutter(t, gain=0.55, pan=0.0):
    place(SFX["shutter"], t, gain, pan=pan)


def notif(t, gain=0.5):
    place(SFX["notif"], t, gain)


def sparkle(t, gain=0.4, pan=0.0):
    place(SFX["sparkle"], t, gain, pan=pan)



def norm(w):
    return re.sub(r'[«»?!.,…:;"]', '', w.lower().replace('’', "'")).strip()


def W(word, n=1):
    """Temps de début du n-ième mot (même règle que pch2_scenes.js)."""
    target, k = norm(word), 0
    for c in CUES:
        w = norm(c["w"])
        if w == target or (len(target) > 3 and w.startswith(target)):
            k += 1
            if k == n:
                return c["s"]
    raise KeyError(word)


def snip(gain=0.35):
    """Coup de ciseaux : clic métallique + souffle court."""
    n = int(0.07 * SR); t = tt(n)
    y = (np.sin(2 * np.pi * 3200 * t) * 0.5 + np.sin(2 * np.pi * 5100 * t) * 0.3) * np.exp(-t * 90) + hp(rng.standard_normal(n), 3000) * np.exp(-t * 60) * 0.6
    return st(y) * gain


def bonk(gain=0.6, f0=520, f1=160):
    """« Bonk » de dessin animé : note qui tombe + choc sourd."""
    n = int(0.28 * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) + lp(rng.standard_normal(n), 900) * np.exp(-t * 40) * 0.8
    return st(y) * gain


def boing(gain=0.35, f=220):
    n = int(0.5 * SR); t = tt(n)
    ff = f * (1 + 0.35 * np.sin(2 * np.pi * 14 * t) * np.exp(-t * 4)) * (1 + 0.6 * np.exp(-t * 12))
    return st(np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 5)) * gain


def squeak(dur=0.12, gain=0.12, f=2400):
    """Feutre qui grince sur le tableau."""
    n = int(dur * SR); t = tt(n)
    ff = f * (1 + 0.08 * np.sin(2 * np.pi * 37 * t))
    y = np.sign(np.sin(2 * np.pi * np.cumsum(ff) / SR)) * np.sin(np.pi * t / t[-1])
    return st(lp(y, 6000)) * gain


def hiss(dur, gain=0.08):
    """Le radiateur qui chauffe : souffle qui monte."""
    n = int(dur * SR); t = tt(n)
    y = sosfilt(butter(2, [800, 4000], "band", fs=SR, output="sos"), rng.standard_normal(n)) * np.linspace(0.2, 1, n) ** 1.5
    y[-2400:] *= np.linspace(1, 0, 2400)
    return np.vstack([y, np.roll(y, 300)]) * gain


def rain(dur, gain=0.07):
    n = int(dur * SR)
    y = hp(lp(rng.standard_normal(n), 6000), 900)
    for _ in range(int(dur * 22)):
        i = rng.integers(0, n - 800); y[i:i + 800] += rng.standard_normal(800) * np.exp(-np.arange(800) / 110) * 2.2
    f = int(0.25 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return np.vstack([y, np.roll(y, 400)]) * gain


def splat(gain=0.45):
    n = int(0.25 * SR); t = tt(n)
    y = lp(rng.standard_normal(n), 1800) * np.exp(-t * 16) + np.sin(2 * np.pi * (180 - 120 * t / t[-1]) * t) * np.exp(-t * 14) * 0.6
    return st(y) * gain


def type_ticks(t0, n, step=0.07, gain=0.05):
    for i in range(n):
        place(tick(gain, 3600 + (i % 3) * 400), t0 + i * step, pan=(i % 2 - 0.5) * 0.4)


def scribbling(t0, t1, gain=0.45, rate=1.0):
    t = t0
    while t < t1 - 0.05:
        p = fade(pitch(SFX["pencil"], rate * (0.95 + rng.random() * 0.1))[:, :int(min(1.6, t1 - t) * SR)], 0.02, 0.06)
        place(p, t, gain, at_peak=False, pan=(rng.random() - 0.5) * 0.3)
        t += p.shape[1] / SR - 0.04


def rubbing(t0, t1, gain=0.5):
    t = t0
    while t < t1 - 0.05:
        p = fade(pitch(SFX["rub"], 0.95 + rng.random() * 0.1)[:, :int(min(0.8, t1 - t) * SR)], 0.01, 0.05)
        place(p, t, gain, at_peak=False)
        t += p.shape[1] / SR - 0.03


def steps(t0, t1, rate, gain=0.12, pan=0.0):
    k = 0
    while t0 + k / rate < t1:
        place(bonk(gain * 0.4, 260, 120), t0 + k / rate, pan=pan); k += 1


T = {k: W(*v) if isinstance(v, tuple) else W(v) for k, v in {
    "gaucher": "gaucher", "les": "les", "ciseaux": "ciseaux", "coupent": "coupent", "rien": "rien", "machent": "mâchent", "papier": "papier",
    "tu1": "tu", "encre": "l'encre", "fin": "fin", "bleu": "bleu", "cahier": "cahier", "poignet": "poignet",
    "cantine": "cantine", "cognes": "cognes", "coude": "coude", "voisin": "voisin", "chaque": "chaque", "bouchee": "bouchée",
    "tableau": "tableau", "manche": "manche", "mamie": "grand-mère", "essaie": "essaie", "corriger": "corriger",
    "alors": "alors", "enfin": "enfin", "special": "spécial", "effacable": "effaçable", "bavure": "bavure",
    "premier": "premier", "controle": "contrôle", "ecris3": ("écris", 3), "fier": "fier",
    "prof": "prof", "pose": "pose", "radiateur": "radiateur", "tienne": "tienne", "devient": "devient", "blanche": "blanche",
    "zero2": ("zéro", 2), "copie": ("copie", 2), "toi": "toi", "disle": "dis-le", "abonne": "abonne-toi", "like": "like",
    "prochain": "prochain", "horrible": ("horrible", 2)}.items()}

# ---------------------------------------------------------------- 1. titre (pas d'effet « titre ») : objets qui tournent, la main s'illumine, BONK
for i in range(5):
    place(swish(0.5, 0.12, 2500 + i * 300), 0.25 + i * 0.5, pan=(i % 2 - 0.5) * 0.8)
sparkle(T["gaucher"] + 0.05, 0.45, pan=0.3)
place(SFX["correct"], T["gaucher"] + 0.1, 0.3)
place(bonk(0.7), T["les"] - 0.75)
for i in range(4):
    place(tick(0.05, 3000 + i * 300), T["les"] - 0.6 + i * 0.09)

# ---------------------------------------------------------------- 2. ciseaux qui mâchent
for i in range(int((T["machent"] - T["ciseaux"]) / 0.2)):
    place(snip(0.3), T["ciseaux"] + i * 0.2, pan=0.2)
place(fade(SFX["crumble"][:, :int(1.2 * SR)], 0.01, 0.2), T["machent"], 0.55, at_peak=False)
for i in range(3):
    place(SFX["chomp"], T["machent"] + 0.15 + i * 0.28, 0.35)
place(fade(SFX["trombone"][:, :int(1.4 * SR)], 0.01, 0.3), T["papier"] + 0.6, 0.22, at_peak=False)

# ---------------------------------------------------------------- 3. l'encre
whoosh(T["tu1"] - 0.3, 1, 0.4)
scribbling(T["tu1"], T["fin"] - 0.2, 0.4)
place(splat(0.5), T["encre"])
place(swish(0.3, 0.25), T["fin"] - 0.15)
sparkle(T["bleu"], 0.45, pan=0.4)
place(boing(0.25, 300), T["bleu"] + 0.15)

# ---------------------------------------------------------------- 4. la spirale
place(fade(SFX["rub"][:, :int(0.6 * SR)], 0.05, 0.1), T["cahier"] + 0.2, 0.3, at_peak=False)
place(SFX["boom"], T["poignet"], 0.45)
place(boing(0.4, 180), T["poignet"] + 0.05)
place(sub(0.5, 140, 50, 0.4), T["poignet"])

# ---------------------------------------------------------------- 5. cantine : les coudes
bites = [T["cognes"] - 0.05, T["coude"] + 0.05, T["voisin"] + 0.1, T["chaque"] + 0.1, T["bouchee"] + 0.25]
whoosh(T["cantine"] - 0.5, 2, 0.4)
for i, b in enumerate(bites):
    place(bonk(0.55 + 0.05 * i, 480 - i * 30, 150), b, pan=0.0)
    place(SFX["kick"], b, 0.25)
    for j in range(5):
        place(tick(0.04, 1800 + j * 250), b + 0.15 + j * 0.06, pan=(j % 2 - 0.5))
place(SFX["chomp"], bites[0] - 0.3, 0.2)

# ---------------------------------------------------------------- 6. tableau : la manche efface
place(fade(SFX["rip"][:, :int(0.6 * SR)], 0.01, 0.1), T["tableau"] - 0.4, 0.4, at_peak=False)
for i in range(int((T["manche"] + 0.3 - T["tableau"]) / 0.16)):
    place(squeak(0.1, 0.07, 2200 + (i % 4) * 180), T["tableau"] + i * 0.16, pan=0.3)
rubbing(T["tableau"] + 0.3, T["manche"] + 0.3, 0.35)
place(fade(SFX["laugh"], 0.01, 0.3), T["manche"] + 0.05, 0.45, at_peak=False, pan=-0.2)

# ---------------------------------------------------------------- 7. mamie
whoosh(T["mamie"] - 0.6, 3, 0.35)
steps(T["mamie"] - 0.2, T["mamie"] + 0.6, 3.0, 0.3, pan=0.5)
place(SFX["cloth"], T["corriger"] - 0.05, 0.4)
place(pop(0.3, 900, 400), T["corriger"] + 0.1)
scribbling(T["corriger"] + 0.2, T["corriger"] + 1.0, 0.45, 1.3)
place(boing(0.3, 260), T["corriger"] + 0.5)

# ---------------------------------------------------------------- 8. le stylo spécial gaucher
place(SFX["reveal"], T["alors"], 0.45)
place(swish(0.6, 0.25, 4000), T["enfin"] + 0.2)
for i in range(6):
    place(swish(0.12, 0.08, 5000), T["enfin"] + i * 0.12, pan=(i % 2 - 0.5))
sparkle(T["special"], 0.55)
place(SFX["starup"], T["special"], 0.35)
place(SFX["correct"], T["effacable"], 0.45)
place(SFX["correct"], T["bavure"], 0.5)
place(SFX["pops"], T["bavure"] + 0.05, 0.4)
sparkle(T["bavure"] + 0.1, 0.4, pan=-0.3)

# ---------------------------------------------------------------- 9. contrôle
place(swish(0.35, 0.25), T["premier"] - 0.3)
scribbling(T["controle"], T["fier"] - 0.15, 0.5, 1.5)
place(SFX["correct"], T["ecris3"], 0.4)
sparkle(T["fier"], 0.5)
place(SFX["bell"], T["fier"] + 0.05, 0.2)

# ---------------------------------------------------------------- 10. radiateur
whoosh(T["prof"] - 0.4, 0, 0.35)
steps(T["pose"] - 0.1, T["pose"] + 0.6, 3.5, 0.35, pan=0.3)
place(SFX["cloth"], T["radiateur"] + 0.1, 0.45)
place(hiss(T["blanche"] + 0.8 - T["radiateur"], 0.09), T["radiateur"] + 0.2, at_peak=False)
for i in range(int((T["blanche"] + 0.5 - T["tienne"]) / 0.55)):
    place(SFX["heartbeat"], T["tienne"] + i * 0.55, 0.35)
place(SFX["stardown"], T["blanche"], 0.35)

# ---------------------------------------------------------------- 11. zéro, copie blanche
for i in range(4):
    place(squeak(0.1, 0.09, 1900 + i * 150), T["zero2"] + i * 0.1)
place(SFX["boom"], T["copie"] + 0.16, 0.6)
place(sub(0.8, 110, 35, 0.6), T["copie"] + 0.16)
place(rain(1.6, 0.06), T["copie"] + 0.55, at_peak=False)
place(fade(SFX["laugh"], 0.01, 0.3), T["copie"] + 0.8, 0.3, at_peak=False, pan=-0.4)

# ---------------------------------------------------------------- 12. gaucher ou droitier
place(fade(SFX["rip"][:, :int(0.6 * SR)], 0.01, 0.1), T["toi"] - 0.45, 0.4, at_peak=False)
place(pop(0.3, 500, 1700), T["toi"])
for i in range(10):
    place(tick(0.04, 2400 + (i % 2) * 500), T["toi"] + 0.4 + i * 0.18)
type_ticks(T["disle"] + 0.2, 15)

# ---------------------------------------------------------------- 13. abonne-toi / like / fin (pas d'effet « titre »)
whoosh(T["abonne"] - 0.3, 2, 0.4)
place(SFX["subscribe"], T["abonne"] + 0.3, 0.75)
place(SFX["like"], T["like"], 0.9)
sparkle(T["like"] + 0.05, 0.45)
place(swish(0.4, 0.2), T["prochain"])
steps(T["horrible"] + 0.5, T["horrible"] + 1.1, 3.0, 0.3, pan=0.5)
place(pop(0.3, 600, 1500), T["horrible"] + 1.0)
fo = int(1.2 * SR)
mix[:, N - fo:] *= np.linspace(1, 0, fo)

# ---------------------------------------------------------------- voix : nivellement + anti-écho
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT / "vo_timeline.wav"), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)
vo = np.concatenate([vo, np.zeros((2, max(0, N - vo.shape[1])))], axis=1)[:, :N]
vo = hp(vo, 80)


def env_of(x, win):
    e = (x ** 2).mean(0)
    k = int(win * SR)
    return np.sqrt(np.convolve(e, np.ones(k) / k, "same")) + 1e-7


def smooth(g, att=0.01, rel=0.08):
    """Lissage asymétrique (baisse rapide, remontée lente)."""
    out = np.empty_like(g); a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR)); v = g[0]
    for i in range(len(g)):
        c = a if g[i] < v else r
        v = c * v + (1 - c) * g[i]
        out[i] = v
    return out


hop = 48
# même traitement de voix que les épisodes précédents (ép. 5) : le volume et le timbre habituels
venv = np.sqrt(np.convolve((vo ** 2).mean(0), np.ones(int(0.03 * SR)) / int(0.03 * SR), "same")) + 1e-7
ref = np.percentile(venv[venv > venv.max() * 0.05], 70)
g = np.minimum(1.0, (ref / venv) ** 0.3)                       # compression vers le bas seulement
g *= np.clip((venv / (ref * 0.12)) ** 1.5, 0.25, 1.0)          # expandeur : coupe les traînes entre les mots (pas d'écho)
g = np.convolve(g, np.ones(int(0.015 * SR)) / int(0.015 * SR), "same")
vo = vo * g
VO_G = 1.4

# contrôle : niveau de chaque mot après traitement
src = (HERE / "cues.js").read_text()
cues = json.loads(src[src.index("["):src.rindex("]") + 1])
lv = []
for c in cues:
    a, b = int(c["s"] * SR), int(max(c["e"], c["s"] + 0.12) * SR)
    lv.append(20 * np.log10(np.sqrt((vo[:, a:b] ** 2).mean()) + 1e-9))
lv = np.array(lv)
low = [(cues[i]["w"], round(lv[i] - np.median(lv), 1)) for i in np.argsort(lv)[:6]]
print(f"mots : médiane {np.median(lv):.1f} dB, plus bas : {low}")

# activité de la voix (pour baisser bruitages et musique dessous)
env = np.convolve(np.abs(vo).mean(0), np.ones(int(0.03 * SR)) / int(0.03 * SR), "same")
act = np.clip(env / (env.max() * 0.06), 0, 1)
act = np.maximum.reduce([np.roll(act, -k) for k in range(0, int(0.05 * SR), 240)])
act = smooth(act[::hop], 0.001, 0.2)
act = np.interp(np.arange(N), np.arange(0, N, hop), act)
sfx = mix * 0.6 * (1 - 0.5 * act)
sfx = np.tanh(sfx * 1.5) / 1.5
fh = int(0.02 * SR)


def rms_frames(x):
    e = (x ** 2).mean(0)
    return np.sqrt(np.convolve(e, np.ones(int(0.1 * SR)) / int(0.1 * SR), "same"))[::fh]


vr, sr_ = rms_frames(vo * VO_G), rms_frames(sfx)
speaking = vr > vr.max() * 0.04
gg = np.ones_like(vr)
gg[speaking] = np.minimum(1, vr[speaking] * 10 ** (-6 / 20) / np.maximum(sr_[speaking], 1e-9))
gg = np.minimum.reduce([np.roll(gg, k) for k in range(-6, 7)])
gg = np.convolve(gg, np.ones(5) / 5, "same")
sfx = sfx * np.interp(np.arange(N), np.arange(len(gg)) * fh, gg)
sr3 = rms_frames(sfx)
cap = np.minimum(1, vr.max() * 10 ** (-3 / 20) / np.maximum(sr3, 1e-9))
cap = np.minimum.reduce([np.roll(cap, k) for k in range(-6, 7)])
cap = np.convolve(cap, np.ones(5) / 5, "same")
sfx = sfx * np.interp(np.arange(N), np.arange(len(cap)) * fh, cap)
vr2, sr2 = rms_frames(vo * VO_G), rms_frames(sfx)
m = 20 * np.log10(vr2[speaking] / np.maximum(sr2[speaking], 1e-9))
print(f"voix au-dessus des bruitages : min {m.min():.1f} dB, médiane {np.median(m):.1f} dB")

# musique de la chaîne dès le début, 17 %, légère baisse sous la voix
raw_m = subprocess.run(["ffmpeg", "-v", "error", "-i", str(HERE / "../musique/musique-chaine.wav"), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                       capture_output=True, check=True).stdout
mus = np.frombuffer(raw_m, np.float32).reshape(-1, 2).T.astype(np.float64)
while mus.shape[1] < N:
    mus = np.concatenate([mus, mus], axis=1)
mus = mus[:, :N] * 0.17  # niveau de départ, recalé plus bas par rapport à la voix
mus[:, N - int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))
mus *= 1 - 0.45 * act
tm = np.arange(N) / SR
# la musique est réglée par rapport à la voix : toujours 21 dB sous la voix quand on parle,
# et creusée dans les fréquences de la voix (1-4 kHz) pour qu'elle ne la masque jamais
_ve = np.sqrt(np.convolve((vo ** 2).mean(0), np.ones(4800) / 4800, 'same')); _sp = _ve > _ve.max() * 0.1
_db = lambda x, m: 20 * np.log10(np.sqrt((x[:, m] ** 2).mean()) + 1e-12)
mus = mus - 0.45 * sosfilt(butter(2, [1000, 4000], "band", fs=SR, output="sos"), mus)
mus *= 10 ** ((_db(vo * VO_G, _sp) - 21 - _db(mus, _sp)) / 20)
out = sfx + vo * VO_G + mus
print(f"hors voix : musique {_db(mus, ~_sp) - _db(vo * VO_G, _sp):.1f} dB sous la voix ; sfx pendant voix {_db(sfx, _sp) - _db(vo * VO_G, _sp):.1f} dB")
print(f"pendant la voix : voix {_db(vo * VO_G, _sp):.1f} dB, musique {_db(mus, _sp):.1f} dB -> écart {_db(vo * VO_G, _sp) - _db(mus, _sp):.1f} dB")
out /= max(1e-9, np.abs(out).max()) / 0.9
pcm = (np.clip(out, -1, 1) * 32767).astype("<i2").T.tobytes()
with wave.open(str(OUT / "mix_raw.wav"), "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)

p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(OUT / "mix_raw.wav"), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
                     "-f", "null", "-"], capture_output=True, text=True).stderr
js = json.loads(p1[p1.rindex("{"):p1.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
      f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "mix_raw.wav"), "-af", af, "-ar", str(SR), str(OUT / "mix.wav")], check=True)
print("mix ok", js["input_i"], "-> -14 LUFS")
