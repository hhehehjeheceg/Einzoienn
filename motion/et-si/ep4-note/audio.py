"""Mixage ép. 4 : voix off + bruitages en couches + musique de la chaîne à 17 %.

Bruitages : ElevenLabs (audio/sfx/*.mp3), placés par leur pic mesuré, plus quelques
sons de synthèse (riser, sub, tics, souffles) pour les ambiances longues que le
générateur ne sait pas faire (il plafonne à 1-3 s).
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
DUR = 61.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

mix = np.zeros((2, N))
duck_exempt = np.zeros(N)  # zones où les impacts ne sont pas baissés sous la voix


def load(name):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(HERE / "audio/sfx" / f"{name}.mp3"), "-f", "f32le",
                          "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)


SFX = {n: load(n) for n in ["pops", "heartbeat", "boom", "glitch", "phone", "sparkle", "whoosh", "subscribe", "like",
                            "fall", "correct", "static", "laugh", "steps", "cloth", "goal", "starup", "stardown", "notif",
                            "shutter", "splash", "busby", "dog", "rip"]}


def peak(x):
    return int(np.argmax(np.abs(x).sum(0)))


def seg(name, a, b):
    x = SFX[name]
    return x[:, int(a * SR):int(b * SR)]


def fade(x, fi=0.005, fo=0.05):
    x = x.copy()
    i, o = min(int(fi * SR), x.shape[1] // 2), min(int(fo * SR), x.shape[1] // 2)
    if i:
        x[:, :i] *= np.linspace(0, 1, i)
    if o:
        x[:, -o:] *= np.linspace(1, 0, o)
    return x


def place(x, t, gain=1.0, at_peak=True, pan=0.0, exempt=False):
    """Place x pour que son pic (ou son début) tombe à t secondes."""
    off = peak(x) if at_peak else 0
    s = int(t * SR) - off
    a, b = max(0, s), min(N, s + x.shape[1])
    if b <= a:
        return
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    piece = x[:, a - s:b - s] * gain
    mix[0, a:b] += piece[0] * l * 1.414
    mix[1, a:b] += piece[1] * r * 1.414
    if exempt:
        duck_exempt[a:b] = 1


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


# ---------------------------------------------------------------- synthèse
def riser(dur, f0=200, f1=4000, gain=0.25):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 40
    for k in range(steps):
        a, b = k * n // steps, (k + 1) * n // steps
        f = f0 * (f1 / f0) ** (k / steps)
        out[a:b] = sosfilt(butter(2, [f * 0.7, min(f * 1.4, 20000)], "band", fs=SR, output="sos"), noise[a:b])
    env = np.linspace(0, 1, n) ** 2
    return np.vstack([out * env, out * env]) * gain


def sub(dur=1.2, f0=90, f1=32, gain=0.9):
    n = int(dur * SR)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * 6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 3.2)
    y[:200] *= np.linspace(0, 1, 200)
    return np.vstack([y, y]) * gain


def tick(gain=0.12, f=2600):
    n = int(0.03 * SR)
    t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 180) + rng.standard_normal(n) * np.exp(-t * 300) * 0.3
    return np.vstack([y, y]) * gain


def pop(gain=0.3, f0=500, f1=1400):
    n = int(0.09 * SR)
    t = tt(n)
    f = f0 + (f1 - f0) * (t / t[-1])
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)
    return np.vstack([y, y]) * gain


def swish(dur=0.5, gain=0.3):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    y = lp(noise, 3000) * env
    return np.vstack([y, y]) * gain


def bed(name, a, b, t0, t1, gain, xf=0.25, rate_jitter=0.0):
    """Boucle un extrait avec fondus croisés pour remplir [t0, t1]."""
    piece = seg(name, a, b)
    L = piece.shape[1]
    X = int(xf * SR)
    t = t0
    k = 0
    while t < t1:
        p = piece if not rate_jitter else pitch(piece, 1 + rate_jitter * (rng.random() - 0.5))
        p = fade(p, xf, xf)
        place(p, t, gain, at_peak=False, pan=(rng.random() - 0.5) * 0.4)
        t += (p.shape[1] - X) / SR
        k += 1


def T_(x):
    return x



def first_peak(name):
    x = SFX[name]; e = np.abs(x).sum(0); return int(np.argmax(e > e.max() * 0.5))



def loudest(name, dur):
    """Fenêtre de dur secondes autour du pic (pour les fichiers longs)."""
    x = SFX[name]; p = peak(x); a = max(0, p - int(dur * 0.35 * SR))
    return fade(x[:, a:a + int(dur * SR)], 0.01, 0.1)


def brush(dur, gain=0.12):
    n = int(dur * SR); t = tt(n)
    y = sosfilt(butter(2, [2500, 7000], "band", fs=SR, output="sos"), rng.standard_normal(n)) * (0.55 + 0.45 * np.sin(2 * np.pi * 9 * t)) ** 2
    y[:2400] *= np.linspace(0, 1, 2400); y[-2400:] *= np.linspace(1, 0, 2400)
    return np.vstack([y, y]) * gain


def gulp(gain=0.5):
    n = int(0.22 * SR); t = tt(n)
    f = 420 * np.exp(-t * 9) + 110
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1]) ** 0.7
    return np.vstack([y, y]) * gain


def alarm(dur, gain=0.12):
    n = int(dur * SR); t = tt(n)
    y = np.sign(np.sin(2 * np.pi * 880 * t)) * (np.sin(2 * np.pi * 4 * t) > 0)
    y = lp(y, 3000)
    return np.vstack([y, y]) * gain


def rain(dur, gain=0.1):
    n = int(dur * SR)
    y = hp(lp(rng.standard_normal(n), 6000), 700)
    for _ in range(int(dur * 25)):
        i = rng.integers(0, n - 800); y[i:i + 800] += rng.standard_normal(800) * np.exp(-np.arange(800) / 120) * 2.5
    y[:int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR)); y[-int(0.3 * SR):] *= np.linspace(1, 0, int(0.3 * SR))
    return np.vstack([y, np.roll(y, 400)]) * gain


WH = [(0.0, 0.7), (2.05, 2.7), (4.0, 4.6), (5.8, 6.4)]
def whoosh(t, i, gain=0.75):
    a, b = WH[i % 4]
    place(fade(seg("whoosh", a, b), 0.01, 0.2), t, gain)


def up(t, gain=0.9):
    place(SFX["starup"], t, gain); place(SFX["sparkle"], t + 0.05, 0.5, pan=0.3)


def down(t, gain=0.9):
    place(SFX["stardown"], t, gain); place(sub(0.6, 120, 45, 0.5), t)


# ---------------------------------------------------------------- 1. accroche (sans effet « titre »)
for i in range(6):
    place(SFX["sparkle"][:, :int(0.5 * SR)], 0.3 + i * 0.45, 0.25, pan=(-0.6 if i % 2 else 0.6))
for i in range(16):                                   # la note défile comme une machine à sous
    place(tick(0.1, 1800 + (i % 5) * 220), 2.2 + i * 0.065, 1.0)
up(3.24, 1.0)
place(sub(0.6, 120, 50, 0.5), 3.24)

# ---------------------------------------------------------------- 2. le miroir
whoosh(3.3 + 0.18, 0)
place(brush(1.9, 0.1), 3.6, at_peak=False)
place(swish(0.4, 0.3), 5.45)
up(5.66, 1.0)
place(sub(0.5, 140, 60, 0.45), 5.68)

# ---------------------------------------------------------------- 3. la rue
whoosh(6.6 + 0.18, 1)
place(fade(SFX["steps"], 0.05, 0.3), 6.9, 0.35, at_peak=False, pan=-0.4)
up(9.47, 1.0)
place(fade(SFX["steps"][:, :int(1.0 * SR)], 0.02, 0.2), 10.4, 0.5, at_peak=False, pan=0.4)
down(11.79, 1.0)
place(sub(0.6, 110, 45, 0.6), 11.8)

# ---------------------------------------------------------------- 4. la porte
whoosh(12.1 + 0.15, 2)
place(SFX["cloth"], 12.45, 0.4)
up(13.3, 1.0)
place(pop(0.3, 600, 1600), 13.4)
place(pop(0.25, 700, 1800), 13.6, pan=0.3)

# ---------------------------------------------------------------- 5. le bus
whoosh(14.3 + 0.15, 3)
place(fade(SFX["busby"][:, :int(1.2 * SR)], 0.1, 0.5), 14.2, 0.45, at_peak=False, pan=-0.5)
place(SFX["laugh"], 15.05, 0.8, at_peak=False, pan=-0.3)
up(15.9, 1.1)
place(SFX["boom"], 15.92, 0.5)
place(sub(0.8, 110, 40, 0.7), 15.92)

# ---------------------------------------------------------------- 6. la belle vie
place(SFX["sparkle"], 16.45, 0.8)
place(swish(0.45, 0.3), 16.95)
place(pop(0.35, 500, 1500), 17.26)
for i, ts in enumerate([18.14, 18.49, 18.84, 19.19, 19.54]):
    place(SFX["shutter"][:, :int(0.4 * SR)], ts, 0.6, pan=(-0.5 if i % 2 else 0.5))
for i, ts in enumerate([18.4, 18.8, 19.2, 19.6]):
    place(SFX["notif"][:, :int(0.35 * SR)], ts, 0.45, pan=(0.4 if i % 2 else -0.4))
place(SFX["pops"], 19.4, 0.5)

# ---------------------------------------------------------------- 7. Max
whoosh(20.2 + 0.18, 0)
place(sub(0.8, 100, 40, 0.6), 20.46)
place(SFX["stardown"], 22.14, 0.5)
place(swish(0.35, 0.4), 23.95)
place(SFX["splash"], 24.42, 1.0)
place(SFX["fall"], 24.45, 0.7)
place(sub(0.6, 110, 45, 0.7), 24.45)
place(SFX["phone"], 24.6, 0.6)
place(SFX["laugh"], 24.9, 0.7, at_peak=False, pan=0.4)
for i in range(12):
    place(tick(0.07, 1500 + i * 60), 25.86 + i * 0.075, 1.0)
place(SFX["correct"], 26.8, 0.6)

# ---------------------------------------------------------------- 8. des milliers d'inconnus
whoosh(27.0 + 0.2, 1)
for i in range(9):
    place(pitch(SFX["notif"], 0.9 + 0.05 * (i % 4))[:, :int(0.5 * SR)], 27.3 + i * 0.37, 0.35, at_peak=False, pan=(i % 3 - 1) * 0.6)
for ts in [28.94, 29.78, 30.54]:
    down(ts, 1.0)
    place(fade(seg("glitch", 0.0, 0.25)), ts, 0.45)
place(alarm(0.75, 0.1), 30.6, at_peak=False)

# ---------------------------------------------------------------- 9. sous la pluie
place(rain(3.4, 0.09), 31.3, at_peak=False)
place(SFX["busby"], 31.85, 0.9)
place(loudest("dog", 0.9), 33.65, 0.8)

# ---------------------------------------------------------------- 10. Max, cinq étoiles
whoosh(34.6 + 0.18, 2)
up(36.06, 0.8)
up(36.78, 1.1)
place(SFX["boom"], 36.8, 0.6)
place(SFX["goal"], 36.85, 0.45, at_peak=False)

# ---------------------------------------------------------------- 11. tu l'arraches… silence
whoosh(37.6 + 0.2, 3)
place(SFX["heartbeat"], 38.05, 0.6)
place(riser(1.2, 300, 5000, 0.18), 38.18, at_peak=False)
place(SFX["rip"], 39.38, 1.2)
place(SFX["boom"], 39.4, 0.8)
place(sub(1.0, 90, 30, 0.8), 39.4)
place(SFX["heartbeat"], 40.6, 0.3)

# ---------------------------------------------------------------- 12. toute la rue
place(SFX["sparkle"], 41.92, 0.6)
place(SFX["rip"], 43.02, 1.0, pan=-0.5)
place(SFX["rip"], 44.3, 1.0, pan=0.5)
for i in range(7):
    place(pitch(SFX["rip"], 0.85 + 0.06 * i), 45.32 + i * 0.04, 0.45, pan=(i - 3) / 3.5)
place(SFX["goal"], 45.42, 0.9, at_peak=False)
place(SFX["laugh"], 45.6, 0.6, at_peak=False)
place(SFX["boom"], 45.42, 0.5)

# ---------------------------------------------------------------- 13. la dernière note
whoosh(46.0 + 0.18, 0)
place(SFX["sparkle"], 47.42, 0.7)
place(sub(0.7, 120, 45, 0.6), 48.58)
place(swish(0.5, 0.35), 49.3)
place(gulp(0.55), 49.75)
for i, ts in enumerate([50.62, 50.83, 51.0, 51.15]):
    place(SFX["shutter"][:, :int(0.35 * SR)], ts, 0.6, pan=(-0.5 if i % 2 else 0.5))

# ---------------------------------------------------------------- 14. « Et toi ? »
place(swish(0.55, 0.35), 51.4)
place(sub(0.7, 130, 50, 0.6), 51.79)
place(pop(0.3, 500, 1700), 53.61)
for i in range(17):
    place(tick(0.06, 2200 + (i % 3) * 300), 53.95 + i * (0.9 / 17), 1.0)

# ---------------------------------------------------------------- 15. abonne-toi / like / fin (sans effet « titre »)
whoosh(54.62 + 0.2, 2, 0.7)
place(SFX["subscribe"], 55.06 + (0.624 - 0.379), 1.0)
place(SFX["like"], 55.5, 1.5)
place(SFX["sparkle"], 55.54, 0.8)
place(SFX["sparkle"], 56.52, 0.6)
place(SFX["sparkle"], 58.92, 0.35, pan=0.4)
fo = int(1.0 * SR)
mix[:, N - fo:] *= np.linspace(1, 0, fo)

# ---------------------------------------------------------------- voix (sans écho) + équilibre
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT / "vo_timeline.wav"), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)[:, :N]
vo = hp(vo, 80)
venv = np.sqrt(np.convolve((vo ** 2).mean(0), np.ones(int(0.03 * SR)) / int(0.03 * SR), "same")) + 1e-7
ref = np.percentile(venv[venv > venv.max() * 0.05], 70)
g = np.minimum(1.0, (ref / venv) ** 0.3)                       # compression vers le bas seulement (jamais de remontée)
g *= np.clip((venv / (ref * 0.12)) ** 1.5, 0.25, 1.0)          # expandeur : coupe les traînes entre les mots
g = np.convolve(g, np.ones(int(0.015 * SR)) / int(0.015 * SR), "same")
vo = vo * g
VO_G = 1.4
env = np.convolve(np.abs(vo).mean(0), np.ones(int(0.03 * SR)) / int(0.03 * SR), "same")
act = np.clip(env / (env.max() * 0.06), 0, 1)
act = np.maximum.reduce([np.roll(act, -k) for k in range(0, int(0.05 * SR), 240)])
rel = np.exp(-1 / (0.2 * SR))
for i in range(1, N):
    if act[i] < act[i - 1] * rel:
        act[i] = act[i - 1] * rel
sfx = mix * 0.6 * (1 - 0.5 * act)                              # -6 dB seulement sous la voix
sfx = np.tanh(sfx * 1.5) / 1.5
hop = int(0.02 * SR)
def rms_frames(x):
    e = (x ** 2).mean(0)
    return np.sqrt(np.convolve(e, np.ones(int(0.1 * SR)) / int(0.1 * SR), "same"))[::hop]
vr, sr_ = rms_frames(vo * VO_G), rms_frames(sfx)
speaking = vr > vr.max() * 0.04
gg = np.ones_like(vr)
gg[speaking] = np.minimum(1, vr[speaking] * 10 ** (-6 / 20) / np.maximum(sr_[speaking], 1e-9))
gg = np.minimum.reduce([np.roll(gg, k) for k in range(-6, 7)])
gg = np.convolve(gg, np.ones(5) / 5, "same")
sfx = sfx * np.interp(np.arange(N), np.arange(len(gg)) * hop, gg)
# plafond : aucun bruitage au-dessus du pic de la voix - 3 dB
sr3 = rms_frames(sfx)
cap = np.minimum(1, vr.max() * 10 ** (-3 / 20) / np.maximum(sr3, 1e-9))
cap = np.minimum.reduce([np.roll(cap, k) for k in range(-6, 7)])
cap = np.convolve(cap, np.ones(5) / 5, "same")
sfx = sfx * np.interp(np.arange(N), np.arange(len(cap)) * hop, cap)
vr2, sr2 = rms_frames(vo * VO_G), rms_frames(sfx)
m = 20 * np.log10(vr2[speaking] / np.maximum(sr2[speaking], 1e-9))
print(f"voix au-dessus des bruitages : min {m.min():.1f} dB, médiane {np.median(m):.1f} dB")
s_only = rms_frames(sfx)[~speaking]
print(f"bruitages hors voix : pic RMS {20 * np.log10(s_only.max() / vr.max()):.1f} dB par rapport au pic de la voix")
# musique de la chaîne, depuis son début, volume 17 %, légère baisse sous la voix
raw_m = subprocess.run(["ffmpeg", "-v", "error", "-i", str(HERE / "../musique/musique-chaine.wav"), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                       capture_output=True, check=True).stdout
mus = np.frombuffer(raw_m, np.float32).reshape(-1, 2).T.astype(np.float64)
if mus.shape[1] < N:
    mus = np.concatenate([mus, np.zeros((2, N - mus.shape[1]))], axis=1)
mus = mus[:, :N] * 0.17
mus[:, N - int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))
mus *= 1 - 0.3 * act
# « Silence. » : la musique se retire presque entièrement
tm = np.arange(N) / SR
mus *= 1 - 0.8 * np.clip(np.minimum((tm - 39.4) / 0.4, (41.9 - tm) / 0.8), 0, 1)
out = sfx + vo * VO_G + mus
out /= max(1e-9, np.abs(out).max()) / 0.9
pcm = (np.clip(out, -1, 1) * 32767).astype("<i2").T.tobytes()
with wave.open(str(OUT / "mix_raw.wav"), "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)

# loudnorm deux passes
p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(OUT / "mix_raw.wav"), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
                     "-f", "null", "-"], capture_output=True, text=True).stderr
js = json.loads(p1[p1.rindex("{"):p1.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
      f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "mix_raw.wav"), "-af", af, "-ar", str(SR), str(OUT / "mix.wav")], check=True)
print("mix ok", js["input_i"], "->", "-14 LUFS")
