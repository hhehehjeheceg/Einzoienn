"""Mixage : voix off + bruitages (aucune musique), sur la timeline du film.

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
DUR = 58.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

mix = np.zeros((2, N))
duck_exempt = np.zeros(N)  # zones où les impacts ne sont pas baissés sous la voix


def load(name):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(HERE / "audio/sfx" / f"{name}.mp3"), "-f", "f32le",
                          "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)


SFX = {n: load(n) for n in ["title", "pops", "whispers", "chaos", "heartbeat", "boom", "glitch", "phone", "crickets",
                            "sparkle", "morning", "whoosh", "subscribe", "like", "freeze", "street", "love", "alarm", "reveal"]}


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


cues = json.loads((HERE / "cues.js").read_text()[len("window.CUES = "):-2])

# ---------------------------------------------------------------- 1. lit
place(fade(SFX["title"], 0, 0.6), 0.12 + 0.35, 0.55, exempt=True)          # accroche : titre
for i in range(6):                                                        # bulles en orbite
    place(pop(0.16, 420 + i * 60, 1300 + i * 80), 0.5 + i * 0.32 + 0.05, 1.0, pan=np.sin(i) * 0.6)
place(riser(1.2, 300, 6000, 0.18), 3.47 - 1.2 + 0.05, at_peak=False)       # montée vers « TOUT »
place(sub(1.4, 110, 35, 0.8), 3.47, exempt=True)
place(SFX["sparkle"], 3.5, 0.9)
for i in range(12):
    place(pop(0.1, 600 + i * 40, 1800), 3.47 + i * 0.015 + 0.04, 1.0, pan=np.cos(i) * 0.8)
bed("morning", 0.0, 1.0, 4.55, 8.1, 0.35, xf=0.3, rate_jitter=0.06)
place(fade(SFX["sparkle"], 0, 0.3), 5.39, 0.5)                             # les yeux s'ouvrent
w = SFX["whispers"]
place(fade(w, 0.05, 0.4), 6.2, 0.55, at_peak=False, pan=-0.5)              # « Et là… »
place(fade(pitch(w, 0.92), 0.05, 0.4), 6.95, 0.5, at_peak=False, pan=0.5)  # « ça commence »

# ---------------------------------------------------------------- 2. rue
wh = seg("whoosh", 0.0, 0.7)
place(fade(wh, 0.01, 0.2), 8.1 + 0.18, 0.7)                                # whip
street = seg("street", 0, SFX["street"].shape[1] / SR)
for t0 in np.arange(8.1, 17.9, 0.42):                                     # pas pendant la marche
    if t0 < 11.0:
        place(tick(0.05, 900), t0, 1.0, pan=0.2)
# rumeur de rue : bruit rose filtré
n = int((17.9 - 8.1) * SR)
city = lp(hp(rng.standard_normal(n), 120), 1600)
city = city / np.abs(city).max() * 0.05
env = np.minimum(1, np.minimum(np.arange(n) / (0.4 * SR), (n - np.arange(n)) / (0.3 * SR)))
place(np.vstack([city * env, city * env]), 8.1, 1.0, at_peak=False)
for i in range(5):
    place(pop(0.12, 500, 1500), 9.15 + i * 0.18, 1.0, pan=(-0.8, 0.9, 0.4, -0.9, 1.0)[i])
P = [seg("pops", 0.0, 0.3), seg("pops", 0.3, 0.6), seg("pops", 0.6, 0.95)]
place(fade(P[0]), 11.3, 0.8, pan=-0.6)
place(fade(SFX["alarm"], 0, 0.3)[:, :int(0.62 * SR)], 11.75, 0.18, at_peak=False, pan=-0.6)
place(fade(P[1]), 12.91, 0.8, pan=0.6)
place(fade(P[2]), 14.19, 0.8, pan=0.3)
place(SFX["love"], 14.3, 0.5, pan=0.3)
place(SFX["sparkle"], 16.75, 1.0, exempt=True)
place(pop(0.25, 300, 1600), 16.75, 1.0)
place(sub(0.6, 140, 60, 0.35), 16.75)

# ---------------------------------------------------------------- 3. chat
place(fade(seg("whoosh", 2.05, 2.7), 0.01, 0.2), 17.9 + 0.18, 0.7)
place(fade(P[1]), 19.29, 0.7)
place(fade(SFX["crickets"], 0.05, 0.4), 20.55, 0.9, at_peak=False)
place(fade(pitch(SFX["crickets"], 1.05), 0.2, 0.4), 21.3, 0.5, at_peak=False)

# ---------------------------------------------------------------- 4. chaos (couches qui s'empilent)
place(fade(seg("whoosh", 4.0, 4.6), 0.01, 0.2), 21.9 + 0.2, 0.6)
c0, c1 = 21.98, 27.25
ch = SFX["chaos"]
for k in range(46):
    tk = c0 + 0.2 + (k / 46) ** 0.7 * (c1 - c0 - 0.6)
    src = ch if k % 2 == 0 else SFX["whispers"]
    p = fade(pitch(src, 0.85 + rng.random() * 0.35), 0.08, 0.25)
    p = lp(p, 1100)
    g = 0.08 + 0.2 * ((tk - c0) / (c1 - c0)) ** 1.5
    place(p, tk, g, at_peak=False, pan=(rng.random() - 0.5) * 1.6)
place(riser(c1 - c0 - 0.4, 150, 9000, 0.22), c0 + 0.3, at_peak=False)
for h in [24.11, 25.43, 26.11, 26.63]:
    place(fade(seg("glitch", 0.0, 0.22)), h, 0.6, exempt=True)
    place(sub(0.5, 120, 50, 0.45), h)
place(fade(seg("glitch", 0.55, 0.95)), 27.08, 0.7, exempt=True)
cut = int(c1 * SR)
mix[:, cut:cut + int(0.9 * SR)] = 0                                       # silence net après le chaos

# ---------------------------------------------------------------- 5. Max
place(SFX["boom"], 28.3, 0.9, exempt=True)
place(sub(2.2, 70, 28, 0.9), 28.3, exempt=True)
place(SFX["boom"], 29.69, 0.8, exempt=True)
place(fade(SFX["title"], 0, 0.5)[:, int(0.6 * SR):], 29.69, 0.45, exempt=True)
place(sub(1.4, 95, 30, 0.8), 29.69, exempt=True)

# ---------------------------------------------------------------- 6. moquerie
place(SFX["sparkle"], 30.2, 0.4)
place(fade(P[0]), 31.37, 0.5)
place(swish(0.35, 0.25), 31.3)
place(SFX["phone"], 32.53, 0.9)
for i in range(5):
    place(pop(0.14, 700 + i * 90, 1700), 33.29 + i * 0.12, 1.0, pan=0.3 + i * 0.12)

# ---------------------------------------------------------------- 7. le temps se fige
place(fade(SFX["freeze"], 0, 0.6), 34.6, 0.75, at_peak=False, exempt=True)
for b in [37.15, 37.75, 38.3]:
    place(SFX["heartbeat"], b, 1.0, exempt=True)
    place(sub(0.35, 60, 40, 0.5), b)

# ---------------------------------------------------------------- 8. pensée de Max
place(fade(SFX["reveal"], 0.02, 0.5), 38.65, 1.4, at_peak=False)
place(riser(0.6, 2000, 9000, 0.06), 38.1, at_peak=False)

# ---------------------------------------------------------------- 9. morale
place(fade(seg("whoosh", 5.8, 6.4), 0.01, 0.25), 41.75 + 0.3, 0.5)
place(SFX["sparkle"], 43.08, 0.5)
place(swish(0.3, 0.2), 43.68)
place(SFX["sparkle"], 44.96, 0.6)

# ---------------------------------------------------------------- 10. « Et toi ? »
place(fade(seg("whoosh", 0.0, 0.7), 0.01, 0.2), 46.0 + 0.18, 0.6)
place(sub(0.7, 130, 50, 0.6), 46.14, exempt=True)
place(pop(0.25, 400, 1500), 46.2)
place(pop(0.3, 500, 1700), 49.07)
typed = "Moi je voudrais savoir"
for i in range(len(typed)):
    place(tick(0.06, 2200 + (i % 3) * 300), 49.47 + i * (1.2 / 22), 1.0)

# ---------------------------------------------------------------- 11. abonne-toi / like / fin
place(fade(seg("whoosh", 2.05, 2.7), 0.01, 0.2), 50.1 + 0.2, 0.5)
place(SFX["subscribe"], 50.52 + (0.624 - 0.379), 0.9)
place(SFX["like"], 50.96, 1.2)
place(SFX["sparkle"], 51.0, 0.7)
place(fade(SFX["title"], 0, 0.6), 52.1 + 0.3, 0.5, exempt=True)
place(SFX["sparkle"], 53.2, 0.4)
bed("morning", 0.0, 1.0, 52.6, 57.6, 0.22, xf=0.3, rate_jitter=0.06)       # le carton de fin ne s'éteint pas
place(SFX["sparkle"], 54.8, 0.3, pan=-0.4)
place(SFX["sparkle"], 56.6, 0.25, pan=0.4)
fo = int(1.2 * SR)
mix[:, N - fo:] *= np.linspace(1, 0, fo)

# ---------------------------------------------------------------- voix + ducking
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT / "vo_timeline.wav"), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                     capture_output=True, check=True).stdout
vo = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)[:, :N]
vo = hp(vo, 80)
# voix : compression douce (gain lissé sur 30 ms) pour qu'elle reste lisible partout
venv = np.sqrt(np.convolve((vo ** 2).mean(0), np.ones(int(0.03 * SR)) / int(0.03 * SR), "same")) + 1e-6
ref = np.percentile(venv[venv > venv.max() * 0.05], 70)
vgain = np.clip((ref / venv) ** 0.55, 0.6, 3.0)
vgain = np.convolve(vgain, np.ones(int(0.02 * SR)) / int(0.02 * SR), "same")
vo = vo * vgain
# présence de la voix : attaque rapide, relâchement doux
env = np.convolve(np.abs(vo).mean(0), np.ones(int(0.03 * SR)) / int(0.03 * SR), "same")
act = np.clip(env / (env.max() * 0.06), 0, 1)
act = np.maximum.reduce([np.roll(act, -k) for k in range(0, int(0.06 * SR), 240)])   # anticipe de 60 ms
rel = np.exp(-1 / (0.25 * SR))
for i in range(1, N):                                                                    # relâchement 250 ms
    if act[i] < act[i - 1] * rel:
        act[i] = act[i - 1] * rel
# bruitages : -5 dB de base, -14 dB sous la voix, limiteur doux
sfx = mix * 0.32 * (1 - 0.85 * act)
sfx = np.tanh(sfx * 2.5) / 2.5
VO_G = 1.5
# garantie : partout où la voix parle, bruitages au moins 12 dB sous elle
hop = int(0.02 * SR)
def rms_frames(x):
    e = (x ** 2).mean(0)
    k = np.ones(int(0.1 * SR)) / int(0.1 * SR)
    return np.sqrt(np.convolve(e, k, "same"))[::hop]
vr, sr_ = rms_frames(vo * VO_G), rms_frames(sfx)
speaking = vr > vr.max() * 0.04
g = np.ones_like(vr)
g[speaking] = np.minimum(1, vr[speaking] * 10 ** (-15 / 20) / np.maximum(sr_[speaking], 1e-9))
g = np.minimum.reduce([np.roll(g, k) for k in range(-8, 9)])          # tient le gain 160 ms autour
g = np.convolve(g, np.ones(5) / 5, "same")
gs = np.interp(np.arange(N), np.arange(len(g)) * hop, g)
sfx = sfx * gs
out = sfx + vo * VO_G
# contrôle : écart voix/bruitages sur les instants où la voix parle (trames de 20 ms)
vr2, sr2 = rms_frames(vo * VO_G), rms_frames(sfx)
m = 20 * np.log10(vr2[speaking] / np.maximum(sr2[speaking], 1e-9))
print(f"voix au-dessus des bruitages : min {m.min():.1f} dB, médiane {np.median(m):.1f} dB, {100 * (m < 12).mean():.1f} % des trames sous 12 dB")
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
