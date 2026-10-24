"""Mixage ép. 2 : voix off (isolée, sans écho) + bruitages bien audibles, aucune musique.

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
DUR = 59.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

mix = np.zeros((2, N))
duck_exempt = np.zeros(N)  # zones où les impacts ne sont pas baissés sous la voix


def load(name):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(HERE / "audio/sfx" / f"{name}.mp3"), "-f", "f32le",
                          "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)


SFX = {n: load(n) for n in ["title", "pops", "heartbeat", "boom", "glitch", "phone", "sparkle", "whoosh", "subscribe", "like",
                            "freeze", "love", "reveal", "buzzer", "scratch", "crumble", "gasp", "slowclap", "applause", "bell",
                            "classroom", "cork"]}


def peak(x):
    return int(np.argmax(np.abs(x).sum(0)))


def seg(name, a, b):
    x = SFX[name]
    return x[:, int(a * SR):int(b * SR)]


def fade(x, fi=0.005, fo=0.05):
    x = x.copy()
    i, o = int(fi * SR), int(fo * SR)
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


# ---------------------------------------------------------------- 1. accroche
place(fade(SFX["title"], 0, 0.6), 0.45, 0.7)
for i in range(10):                                   # bips du polygraphe
    place(tick(0.08, 1800), 0.3 + i * 0.22, 1.0)
place(SFX["buzzer"], 2.42, 1.0)
place(fade(seg("glitch", 0.0, 0.22)), 2.45, 0.6)
place(sub(0.8, 120, 45, 0.7), 2.42)
place(pop(0.3, 400, 1500), 3.2)
place(tick(0.25, 700), 3.45)                          # cadenas qui se ferme
place(tick(0.2, 500), 3.52)

# ---------------------------------------------------------------- 2. petit-déjeuner
place(fade(seg("whoosh", 0.0, 0.7), 0.01, 0.2), 4.2 + 0.18, 0.8)
place(pop(0.25, 500, 1400), 6.25)
cr = SFX["crumble"]
for k, tc in enumerate(np.arange(6.4, 8.0, 0.3)):     # mastication
    place(fade(cr[:, int(0.05 * SR):int(0.2 * SR)] * (0.6 + 0.3 * (k % 2))), tc, 0.5, at_peak=False)
place(SFX["cork"], 8.95, 1.0)
place(SFX["crumble"], 9.58, 1.3)
place(sub(0.5, 140, 60, 0.4), 9.58)
place(sub(0.7, 110, 45, 0.8), 10.45)                  # tampon VÉRITÉ
place(SFX["sparkle"], 10.5, 0.8)
place(SFX["scratch"], 11.42, 1.0)
place(fade(SFX["freeze"], 0, 0.3)[:, :int(0.6 * SR)], 11.45, 0.4, at_peak=False)

# ---------------------------------------------------------------- 3-9. la classe
place(fade(seg("whoosh", 2.05, 2.7), 0.01, 0.2), 12.9 + 0.18, 0.8)
place(fade(SFX["bell"], 0, 0.4), 12.95, 0.7, at_peak=False)
bed("classroom", 0.0, 8.0, 13.0, 45.2, 0.35, xf=0.5)
place(pop(0.25, 450, 1300), 13.85)
place(SFX["cork"], 16.3, 0.9)
place(pop(0.3, 600, 1800), 17.06)
for i in range(3):
    place(tick(0.12, 1200 + i * 400), 17.15 + i * 0.09, 1.0)
place(fade(SFX["gasp"], 0.01, 0.4), 17.9, 1.1, at_peak=False)
place(SFX["love"], 19.5, 0.8)
place(SFX["cork"], 21.5, 0.9)
for i in range(8):
    place(pop(0.22, 500 + i * 60, 1600), 21.68 + i * 0.25, 1.0, pan=np.sin(i * 1.7) * 0.6)
place(SFX["sparkle"], 23.18, 1.0)
place(SFX["love"], 23.25, 0.7)
place(fade(seg("whoosh", 4.0, 4.6), 0.01, 0.2), 25.15 + 0.18, 0.8)
place(SFX["sparkle"], 26.3, 0.6)
place(SFX["boom"], 26.43, 1.0)
place(sub(1.2, 90, 30, 0.8), 26.43)
place(swish(0.4, 0.3), 27.6)
place(SFX["phone"], 29.23, 1.1)
place(fade(SFX["gasp"], 0.01, 0.4)[:, :int(2.0 * SR)], 30.3, 0.6, at_peak=False)
for s_ in np.arange(33.0, 35.6, 1.0):                 # horloge pendant le silence
    place(tick(0.22, 900), s_, 1.0)
for b in [33.2, 33.9, 34.6]:
    place(SFX["heartbeat"], b, 1.2)
    place(sub(0.35, 60, 40, 0.5), b)
place(swish(0.45, 0.3), 35.6)
place(fade(seg("whoosh", 5.8, 6.4), 0.01, 0.25), 38.85, 0.6)
place(fade(SFX["reveal"], 0.02, 0.5), 40.0, 1.6, at_peak=False)
place(SFX["slowclap"], 42.82, 1.4)
ap = SFX["applause"]
for k in range(10):
    place(fade(pitch(ap, 0.9 + 0.2 * rng.random()), 0.05, 0.3), 43.9 + k * 0.17, 0.55 + 0.05 * k, at_peak=False, pan=(rng.random() - 0.5) * 1.2)
place(SFX["sparkle"], 43.95, 0.9)
place(sub(0.6, 120, 50, 0.5), 43.95)

# ---------------------------------------------------------------- 10. morale
place(fade(seg("whoosh", 0.0, 0.7), 0.01, 0.2), 45.2 + 0.25, 0.7)
place(tick(0.25, 600), 47.6)
place(SFX["sparkle"], 47.62, 1.0)
place(fade(SFX["reveal"], 0.02, 0.5), 47.7, 1.4, at_peak=False)

# ---------------------------------------------------------------- 11. « Et toi ? »
place(fade(seg("whoosh", 2.05, 2.7), 0.01, 0.2), 48.5 + 0.18, 0.7)
place(sub(0.7, 130, 50, 0.7), 48.62)
for s_ in np.arange(49.66, 51.0, 0.5):
    place(tick(0.14, 2400), s_, 1.0)
place(pop(0.3, 500, 1700), 51.05)
for i in range(13):
    place(tick(0.07, 2200 + (i % 3) * 300), 51.35 + i * (0.8 / 13), 1.0)

# ---------------------------------------------------------------- 12. abonne-toi / like / fin
place(fade(seg("whoosh", 4.0, 4.6), 0.01, 0.2), 52.1 + 0.2, 0.7)
place(SFX["subscribe"], 52.5 + (0.624 - 0.379), 1.0)
place(SFX["like"], 52.94, 1.5)
place(SFX["sparkle"], 53.0, 0.8)
place(fade(SFX["title"], 0, 0.6), 53.93 + 0.3, 0.6)
place(SFX["sparkle"], 55.2, 0.5)
place(SFX["sparkle"], 57.0, 0.35, pan=0.4)
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
out = sfx + vo * VO_G
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
