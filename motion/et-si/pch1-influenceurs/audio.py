"""Mixage « Pourquoi c'est horrible d'avoir des parents influenceurs ».

Voix off : nivellement (les fins de phrase trop basses sont remontées, on entend chaque mot),
compression vers le bas, expandeur qui coupe les traînes entre les mots (pas d'écho).
Bruitages : ElevenLabs (audio/sfx/*.mp3) + synthèse, toujours au moins 6 dB sous la voix.
Musique de la chaîne à 17 % dès le début. Pas d'effet « titre ».
Sortie : out/mix_raw.wav puis out/mix.wav (loudnorm deux passes, -14 LUFS, TP -1).
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

HERE = Path(__file__).parent
OUT = HERE / "out"
SR = 48000
DUR = 55.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
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


# ---------------------------------------------------------------- 1. accroche : flashs des téléphones (pas d'effet « titre »)
for i, f in enumerate([0.5, 0.86, 1.25, 1.62, 2.04, 2.4, 2.78]):
    shutter(f, 0.5, pan=-0.5 if i % 2 == 0 else 0.5)
place(SFX["pops"], 0.52, 0.25)
place(hum(3.2, 0.03), 0.05, at_peak=False)
for i in range(18):
    place(pop(0.06, 700 + (i % 4) * 150, 1600), 0.3 + i * 0.16, pan=0.6)

# ---------------------------------------------------------------- 2. ta vie = du contenu
for c in [3.3, 3.98, 4.52, 4.98]:
    place(swish(0.3, 0.22, 4000), c + 0.1)
    place(tick(0.06, 3000), c + 0.25)
shutter(3.72, 0.5)
place(SFX["boom"], 5.40, 0.7)
place(sub(0.8, 110, 40, 0.7), 5.40)

# ---------------------------------------------------------------- 3. premier bain
whoosh(6.15 + 0.16, 0)
for s_ in [6.3, 6.85, 7.4]:
    place(splashy(0.4), s_ + 0.05, pan=(rng.random() - 0.5) * 0.4)
notif(6.47)
for i in range(14):
    place(tick(0.05, 2200 + (i % 3) * 300), 7.26 + i * 0.05)
place(SFX["correct"], 7.97, 0.45)
sparkle(7.98, 0.4)
place(pop(0.25, 400, 900), 7.86)

# ---------------------------------------------------------------- 4. premiers pas + couches
for i in range(7):
    place(pop(0.12, 300, 500), 8.35 + i * 0.19, pan=-0.3 + i * 0.08)
place(SFX["reveal"], 9.25, 0.35)
place(swish(0.3, 0.3), 9.95)
place(SFX["boom"], 10.06, 0.6)
place(sub(0.6, 120, 45, 0.6), 10.06)
sparkle(10.1, 0.45)
place(SFX["cloth"], 10.75, 0.4)

# ---------------------------------------------------------------- 5. céréales, lumière
whoosh(11.25 + 0.16, 1)
place(SFX["chomp"], 11.5, 0.25)
place(SFX["cloth"], 12.2, 0.3)
place(swish(0.3, 0.3), 13.75)
place(pop(0.3, 600, 300), 13.95)
place(SFX["click"][:, :int(0.4 * SR)], 14.46, 0.6)
place(hum(1.0, 0.05), 14.48, at_peak=False)
place(swish(0.6, 0.25, 2000), 15.25)
place(buzz(0.9, 0.05), 15.3, at_peak=False)

# ---------------------------------------------------------------- 6. anniversaire : 7 prises
whoosh(16.2 + 0.18, 2)
place(SFX["cloth"], 16.6, 0.35)
place(SFX["pops"], 16.85, 0.4)
sparkle(16.9, 0.35, pan=-0.3)
place(rewind(0.38, 0.22), 18.12, at_peak=False)
for i, a in enumerate([18.52, 18.92, 19.06, 19.2, 19.32, 19.42]):
    place(SFX["clap"][:, :int(0.4 * SR)], a + 0.02, 0.45 if i == 0 else 0.35)
place(SFX["boom"], 19.42, 0.55)
place(SFX["trombone"][:, :int(1.2 * SR)], 19.6, 0.25, at_peak=False)

# ---------------------------------------------------------------- 7. chute de vélo
place(SFX["bike"][:, :int(0.5 * SR)], 20.1, 0.35, at_peak=False)
place(SFX["fall"], 20.42, 0.6)
place(sub(0.6, 120, 45, 0.6), 20.85)
place(SFX["boom"], 20.85, 0.45)
for i in range(6):
    place(tick(0.05, 3200 + i * 120), 20.95 + i * 0.12, pan=(i % 2 - 0.5))
place(SFX["steps"][:, :int(0.6 * SR)], 21.0, 0.35, at_peak=False, pan=0.5)
for a in [21.75, 22.0, 22.25]:
    place(tick(0.08, 1800), a)
shutter(22.56, 0.6)
place(SFX["correct"], 22.62, 0.35)

# ---------------------------------------------------------------- 8. tu pleures -> miniature
place(swish(0.25, 0.3), 23.2)
place(sub(0.5, 140, 60, 0.45), 24.68)
shutter(24.68, 0.65)
place(SFX["reveal"], 25.86, 0.3)
place(pop(0.3, 500, 1400), 26.0)
place(pop(0.3, 600, 1600), 26.1)

# ---------------------------------------------------------------- 9. collège
place(SFX["steps"], 27.0, 0.3, at_peak=False)
place(pop(0.25, 600, 1500), 28.7)
place(pop(0.25, 700, 1700), 29.38)
place(SFX["laugh"], 30.9, 0.3, at_peak=False, pan=-0.4)
place(SFX["laugh"], 31.95, 0.45, at_peak=False, pan=0.4)
place(SFX["boom"], 31.95, 0.4)
sparkle(32.0, 0.35)

# ---------------------------------------------------------------- 10. stop + carton
whoosh(33.0 + 0.16, 3)
place(SFX["boom"], 34.26, 0.8)
place(sub(1.0, 100, 32, 0.8), 34.26)
place(SFX["cloth"], 35.06, 0.4)
for a in [35.2, 35.4, 35.55, 35.7]:
    place(swish(0.3, 0.25, 4000), a + 0.1)
    place(pop(0.25, 300, 200), a + 0.4)
place(SFX["stardown"], 35.85, 0.35)

# ---------------------------------------------------------------- 11. dîner
place(SFX["cloth"], 37.3, 0.25)
for i in range(4):
    place(tick(0.05, 4000), 38.2 + i * 0.35, pan=(i % 2 - 0.5) * 0.6)
place(pop(0.3, 900, 500), 38.62)
place(SFX["laugh"], 39.3, 0.3, at_peak=False)
sparkle(39.56, 0.35)

# ---------------------------------------------------------------- 12. sauf que… la sœur filmait, 10 millions
place(scratch(0.55), 41.05, at_peak=False)
place(sub(0.7, 120, 40, 0.5), 41.1)
place(SFX["phone"][:, :int(0.5 * SR)], 41.7, 0.3, at_peak=False)
place(swish(0.35, 0.3), 42.55)
for i, a in enumerate([43.2, 43.55, 43.85]):
    notif(a, 0.45)
for i in range(16):
    place(tick(0.05, 2400 + (i % 3) * 300), 44.14 + i * 0.038)
place(SFX["goal"], 44.76, 0.35)
place(SFX["boom"], 44.76, 0.5)
place(SFX["heartbeat"], 45.0, 0.45)

# ---------------------------------------------------------------- 13. Et toi ?
place(swish(0.5, 0.3), 45.55)
place(pop(0.3, 500, 1700), 45.7)
for i in range(12):
    place(tick(0.05, 2000 + (i % 2) * 400), 46.6 + i * 0.12)
place(pop(0.3, 600, 1500), 47.3)
for i in range(10):
    place(tick(0.04, 3500), 47.8 + i * 0.07)

# ---------------------------------------------------------------- 14. abonne-toi / like / prochain (sans effet « titre »)
whoosh(48.45 + 0.15, 2, 0.5)
place(SFX["subscribe"], 48.92, 0.8)
place(SFX["like"], 49.2, 1.0)
sparkle(49.24, 0.5)
place(swish(0.4, 0.25), 49.65)
place(SFX["laugh"], 52.55, 0.25, at_peak=False, pan=0.4)
fo = int(1.2 * SR)
mix[:, N - fo:] *= np.linspace(1, 0, fo)

# ---------------------------------------------------------------- voix : nivellement + anti-écho
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT / "vo_timeline_fix.wav"), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
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
mus *= 1 - 0.85 * np.clip(np.minimum((tm - 41.05) / 0.08, (41.7 - tm) / 0.4), 0, 1)  # le disque s'arrête net
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
