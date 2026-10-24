"""Mixage ép. 3 : voix off + bruitages en couches + musique de la chaîne à 17 %.

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


SFX = {n: load(n) for n in ["pops", "heartbeat", "boom", "glitch", "phone", "sparkle", "whoosh", "subscribe", "like", "freeze",
                            "love", "reveal", "rewind", "tapestop", "click", "fall", "correct", "trombone", "static", "laugh",
                            "steps", "cloth", "kick", "goal", "skate", "bail"]}


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



def rewind_fx(t0, t1, gain=0.8, heavy=False):
    """Clic de télécommande + bande qui rembobine (bouclée sur la durée) + neige + arrêt de bande."""
    place(SFX["click"][:, :int(0.25 * SR)], t0 - 0.03, 0.9)
    rw = SFX["rewind"]
    t = t0
    while t < t1 - 0.15:
        p = fade(pitch(rw, 1.15 if heavy else 1.0)[:, :int(min(1.0, t1 - t) * SR)], 0.02, 0.08)
        place(p, t, gain, at_peak=False)
        t += p.shape[1] / SR - 0.06
    place(fade(SFX["static"][:, :int(min(0.8, t1 - t0) * SR)], 0.01, 0.15), t0 + 0.02, 0.35 if not heavy else 0.55, at_peak=False)
    if heavy:
        place(fade(seg("glitch", 0.0, 0.9)), t0 + 0.4, 0.5, at_peak=False)
    place(fade(SFX["tapestop"][:, :int(0.7 * SR)], 0.01, 0.2), t1 - 0.25, 0.6, at_peak=False)


# ---------------------------------------------------------------- 1. accroche (sans effet « titre »)
for i in range(14):                                   # tic-tac à l'envers
    place(tick(0.09, 1400 if i % 2 else 1000), 0.25 + i * 0.29, 1.0)
place(fade(SFX["rewind"][:, :int(0.6 * SR)], 0.02, 0.2), 1.82, 0.45, at_peak=False)
for i in range(10):                                   # compte à rebours 10 -> 0
    place(tick(0.12, 2200), 2.66 + i * 0.15, 1.0)
place(sub(0.6, 120, 50, 0.5), 3.66)

# ---------------------------------------------------------------- 2. escalier
place(fade(seg("whoosh", 0.0, 0.7), 0.01, 0.2), 4.4 + 0.18, 0.8)
place(SFX["steps"], 4.7, 0.7, at_peak=False)
place(SFX["cloth"], 5.9, 0.7)
place(SFX["fall"], 6.25, 1.1)
place(sub(0.5, 110, 45, 0.6), 6.35)
place(SFX["sparkle"], 6.5, 0.5)
rewind_fx(6.83, 7.35)
place(swish(0.35, 0.35), 7.95)                        # le saut
place(sub(0.4, 130, 60, 0.5), 8.45)                   # réception
place(SFX["cloth"], 8.45, 0.6)
place(SFX["sparkle"], 8.5, 0.9)
place(sub(0.6, 110, 45, 0.6), 8.55)                   # tampon

# ---------------------------------------------------------------- 3. contrôle
place(fade(seg("whoosh", 2.05, 2.7), 0.01, 0.2), 9.4 + 0.18, 0.8)
for i in range(4):                                    # la correction s'écrit au tableau
    place(tick(0.1, 900 + i * 120), 10.75 + i * 0.12, 1.0)
place(sub(0.5, 140, 60, 0.4), 10.92)
rewind_fx(12.04, 12.5)
for i in range(22):                                   # crayon qui gratte à toute vitesse
    place(tick(0.05, 3000 + (i % 4) * 400), 13.0 + i * 0.075, 1.0)
place(SFX["correct"], 14.6, 1.0)
place(sub(0.6, 110, 45, 0.7), 14.76)
place(SFX["sparkle"], 14.8, 0.9)

# ---------------------------------------------------------------- 4. skatepark
place(fade(seg("whoosh", 4.0, 4.6), 0.01, 0.2), 15.6 + 0.18, 0.8)
sk = SFX["skate"]
place(fade(sk[:, :int(1.2 * SR)], 0.05, 0.3), 15.9, 0.6, at_peak=False)
place(fade(sk, 0.02, 0.3), 17.0, 0.7, at_peak=False)
place(SFX["bail"], 18.1, 1.0)
rewind_fx(18.82, 19.15)
place(fade(sk[:, int(0.8 * SR):], 0.02, 0.2), 19.3, 0.6, at_peak=False)
place(SFX["bail"], 19.85, 0.9)
rewind_fx(20.5, 20.85)
place(fade(sk[:, int(0.8 * SR):], 0.02, 0.2), 20.9, 0.5, at_peak=False)
rewind_fx(21.38, 23.0, 0.9, heavy=True)
place(fade(sk, 0.02, 0.3), 23.2, 0.7, at_peak=False)
place(swish(0.5, 0.35), 23.7)
place(sub(0.4, 130, 60, 0.5), 24.35)
place(SFX["goal"], 24.45, 0.6)                        # petite foule qui applaudit
place(sub(0.6, 110, 45, 0.6), 24.54)
place(SFX["sparkle"], 24.57, 0.9)

# ---------------------------------------------------------------- 5. Max
place(fade(seg("whoosh", 5.8, 6.4), 0.01, 0.25), 25.7 + 0.25, 0.7)
place(SFX["phone"], 26.3, 0.9)
rewind_fx(27.88, 28.7)
place(SFX["click"][:, :int(0.25 * SR)], 29.85, 1.0)
place(SFX["boom"], 29.98, 0.9)
place(sub(1.0, 90, 30, 0.7), 29.98)
place(fade(seg("glitch", 0.0, 0.3)), 30.0, 0.5)
place(sub(0.7, 120, 45, 0.7), 32.1)
place(fade(SFX["static"][:, :int(0.5 * SR)], 0.01, 0.15), 32.12, 0.4, at_peak=False)
place(SFX["fall"], 33.4, 0.7)
place(swish(0.5, 0.3), 34.4)

# ---------------------------------------------------------------- 6. la boucle
for n in range(4):
    tp = 35.5 + n * 1.6 + 0.9
    if tp < 40.6:
        place(SFX["click"][:, :int(0.25 * SR)], tp, 0.8)
        place(fade(SFX["rewind"][:, :int(0.35 * SR)], 0.01, 0.1), tp + 0.05, 0.45, at_peak=False)
for tj in [36.36, 38.2, 39.72]:
    place(sub(0.6, 120, 45, 0.7), tj)
    place(fade(seg("glitch", 0.0, 0.2)), tj, 0.4)

# ---------------------------------------------------------------- 7. il lâche le bouton
place(fade(seg("whoosh", 0.0, 0.7), 0.01, 0.2), 40.6 + 0.25, 0.7)
place(SFX["cloth"], 41.96, 0.7)
place(fade(seg("glitch", 0.55, 0.95)), 42.89, 0.5)
place(sub(0.4, 150, 70, 0.4), 42.89)
place(SFX["sparkle"], 42.9, 0.6)
place(SFX["fall"], 43.25, 0.9)
place(pop(0.3, 500, 1500), 43.95)
place(fade(sk[:, :int(1.0 * SR)], 0.02, 0.3), 44.64, 0.5, at_peak=False)
place(SFX["laugh"], 45.9, 1.1, at_peak=False)
place(SFX["sparkle"], 45.85, 0.7)
place(fade(SFX["reveal"], 0.02, 0.5), 46.46, 1.3, at_peak=False)

# ---------------------------------------------------------------- 8. « Et toi ? »
place(fade(seg("whoosh", 2.05, 2.7), 0.01, 0.2), 48.6 + 0.18, 0.7)
place(sub(0.7, 130, 50, 0.6), 49.28)
place(pop(0.3, 500, 1700), 50.8)
for i in range(24):
    place(tick(0.06, 2200 + (i % 3) * 300), 51.1 + i * (1.0 / 24), 1.0)

# ---------------------------------------------------------------- 9. abonne-toi / like / fin (sans effet « titre »)
place(fade(seg("whoosh", 4.0, 4.6), 0.01, 0.2), 51.7 + 0.2, 0.7)
place(SFX["subscribe"], 52.14 + (0.624 - 0.379), 1.0)
place(SFX["like"], 52.48, 1.5)
place(SFX["sparkle"], 52.52, 0.8)
place(SFX["sparkle"], 53.6, 0.6)
place(SFX["sparkle"], 56.0, 0.35, pan=0.4)
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
