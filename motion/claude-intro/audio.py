"""Score + sound design for claude-intro v2, 100 % synthesized (numpy + scipy).

D major, 120 BPM (beat 0.5 s, bar 2 s), 40 s = 20 bars. Picture and sound share one
timeline: sound effects sit on the cues exported by the film (out/cues.json).

  bars 0-1   intro: e-piano, warm pad, air                    "Bonjour."
  bars 2-3   pulse: soft kick, sub, pluck 8ths                "Je suis Claude."
  bars 4-6   build: four on the floor, 16th arp, filter opens  verbs
  bar  7     pre-drop: snare roll on the word cuts, riser, reverse crash, breath
  bars 8-13  DROP 1: kick, clap, hats, gated supersaw, hook lead + ping-pong delay,
             offbeat bass, sidechain pump                      3D world
  bars 14-16 breakdown: piano, choir, sub                      "Je vérifie / je ne sais pas"
  bar  17    rebuild: kick, snare roll, riser                  orbit
  bars 18-19 DROP 2: boom, full chord, bell hook, ring out     logo

Output: out/mix_raw.wav (16-bit, peak normalised). Loudness is set afterwards with ffmpeg.
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

HERE = Path(__file__).parent
OUT = HERE / "out"
SR = 48000
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(11)

BUS = {k: np.zeros((2, N)) for k in ("kick", "drums", "bass", "keys", "pads", "lead", "fx")}
SEND_REV = np.zeros((2, N))
SEND_DLY = np.zeros((2, N))
KICKS = []  # kick times, they drive the sidechain


# ------------------------------------------------------------------ basics
def tt(n):
    return np.arange(n) / SR


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def stereo(sig, pan=0.0):
    if sig.ndim == 2:
        return sig
    a = (pan + 1) * np.pi / 4
    return np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)


def place(bus, sig, start, gain=1.0, pan=0.0, rev=0.0, dly=0.0):
    sig = stereo(sig, pan)
    i0 = int(round(start * SR))
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(sig.shape[1] - j0, N - i0)
    if n <= 0:
        return
    s = sig[:, j0:j0 + n] * gain
    BUS[bus][:, i0:i0 + n] += s
    if rev:
        SEND_REV[:, i0:i0 + n] += s * rev
    if dly:
        SEND_DLY[:, i0:i0 + n] += s * dly


def noise(n):
    return rng.standard_normal(n)


def filt(x, kind, f, order=2):
    bt = {"low": "lowpass", "high": "highpass", "bp": "bandpass"}[kind]
    return sosfilt(butter(order, f, btype=bt, fs=SR, output="sos"), x, axis=-1)


def biquad(f, q, kind):
    w = 2 * np.pi * f / SR
    c, al = np.cos(w), np.sin(w) / (2 * q)
    if kind == "lp":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
    elif kind == "hp":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    else:
        b = [al, 0.0, -al]
    a = [1 + al, -2 * c, 1 - al]
    return np.array(b) / a[0], np.array(a) / a[0]


def peq(x, f, db, q=0.9):
    """RBJ peaking equaliser."""
    A_ = 10 ** (db / 40)
    w = 2 * np.pi * f / SR
    c, al = np.cos(w), np.sin(w) / (2 * q)
    b = np.array([1 + al * A_, -2 * c, 1 - al * A_])
    a = np.array([1 + al / A_, -2 * c, 1 - al / A_])
    return lfilter(b / a[0], a / a[0], x, axis=-1)


def tvf(x, fc, q=0.8, kind="lp", block=96):
    """Time-varying biquad (block-wise coefficient updates, state carried over)."""
    if x.ndim == 2:
        return np.vstack([tvf(ch, fc, q, kind, block) for ch in x])
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    y = np.empty_like(x)
    zi = np.zeros(2)
    for s in range(0, len(x), block):
        f = min(max(float(fc[min(s + block // 2, len(x) - 1)]), 20.0), SR * 0.45)
        b, a = biquad(f, q, kind)
        y[s:s + block], zi = lfilter(b, a, x[s:s + block], zi=zi)
    return y


def adsr(dur, a=0.005, d=0.12, s=0.7, r=0.15):
    n_on = int(dur * SR)
    n = n_on + int(r * SR)
    t = tt(n)
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if n_on < n:
        lvl = e[n_on]
        e[n_on:] = lvl * np.exp(-(t[n_on:] - dur) / (r / 4))
    return e


# ------------------------------------------------------------------ oscillators
def blep(ph, dt):
    r = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m]
    r[m] = x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    r[m] = x * x + x + x + 1
    return r


def saw(f, n, ph0=None):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    ph = ((rng.random() if ph0 is None else ph0) + np.cumsum(f) / SR) % 1.0
    return 2 * ph - 1 - blep(ph, f / SR)


def square(f, n):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    ph = (rng.random() + np.cumsum(f) / SR) % 1.0
    dt = f / SR
    p2 = (ph + 0.5) % 1.0
    return (2 * ph - 1 - blep(ph, dt)) - (2 * p2 - 1 - blep(p2, dt))


DET7 = np.array([-1, -0.62, -0.28, 0, 0.28, 0.62, 1])


def supersaw(f, n, det=0.16, voices=7, width=0.85):
    offs = DET7 if voices == 7 else np.linspace(-1, 1, voices)
    out = np.zeros((2, n))
    for o in offs:
        out += stereo(saw(f * 2 ** (o * det / 12), n), o * width) * (1.0 if o == 0 else 0.78)
    return out / len(offs)


def vib(n, rate=5.5, depth=0.004, delay=0.15):
    t = tt(n)
    return 1 + depth * np.sin(2 * np.pi * rate * t) * np.clip((t - delay) / 0.3, 0, 1)


# ------------------------------------------------------------------ instruments
def epiano(m, dur, vel=0.7):
    f = mtof(m)
    n = int((dur + 1.2) * SR)
    t = tt(n)
    idx = 1.9 * vel * np.exp(-t / 0.35) + 0.25
    car = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    tine = np.sin(2 * np.pi * f * 14 * t) * 0.10 * vel * np.exp(-t / 0.025)
    env = np.exp(-t / (2.2 if f < 300 else 1.4)) * np.minimum(1, t / 0.003)
    env *= np.clip((dur + 1.2 - t) / 1.2, 0, 1) ** 2
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.8 * t)
    return (car * env * trem + tine) * vel


def piano(m, dur, vel=0.7):
    f = mtof(m)
    n = int((dur + 2.5) * SR)
    t = tt(n)
    y = np.zeros(n)
    K = int(min(18, 9000 / f))
    for k in range(1, K + 1):
        fk = k * f * np.sqrt(1 + 0.00035 * k * k)
        if fk > 15000:
            break
        amp = (1 / k ** 1.15) * (0.45 + 0.55 * vel) ** (k * 0.35)
        tau = 3.0 / (1 + 0.38 * (k - 1)) * (262 / f) ** 0.45
        y += amp * (np.sin(2 * np.pi * fk * t) + np.sin(2 * np.pi * fk * 1.0007 * t + 0.4)) * 0.5 * np.exp(-t / tau)
    ham = filt(noise(int(0.006 * SR)), "bp", (800, 4000)) * 0.15 * vel
    y[: len(ham)] += ham
    y *= np.minimum(1, t / 0.0015) * np.clip((dur + 2.5 - t) / 0.8, 0, 1)
    return y * vel


def bell(m, vel=0.6, dur=2.5):
    f = mtof(m)
    n = int(dur * SR)
    t = tt(n)
    idx = 2.2 * np.exp(-t / 0.5)
    v = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t))
    v += 0.25 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.4)
    return v * np.exp(-t / 1.1) * np.minimum(1, t / 0.002) * vel


def pluck(m, vel=0.6, bright=1.0):
    f = mtof(m)
    n = int(0.55 * SR)
    t = tt(n)
    idx = 2.6 * bright * np.exp(-t / 0.07)
    v = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 2 * f * t))
    return v * np.exp(-t / 0.2) * np.minimum(1, t / 0.002) * vel


def pad_chord(notes, dur, bright, det=0.09, att=0.45, rel=0.9, sweep=None):
    n = int((dur + rel) * SR)
    out = np.zeros((2, n))
    for m in notes:
        out += supersaw(mtof(m), n, det=det, voices=5, width=0.9)
    out /= len(notes) ** 0.7
    if sweep is None:
        out = filt(out, "low", bright)
    else:
        out = tvf(out, np.geomspace(sweep[0], sweep[1], n), q=0.9)
    t = tt(n)
    e = np.minimum(1, t / att) ** 1.5 * np.where(t > dur, np.exp(-(t - dur) / (rel / 4)), 1)
    return out * e


def choir(notes, dur, att=0.6, rel=1.0):
    n = int((dur + rel) * SR)
    t = tt(n)
    out = np.zeros((2, n))
    for j, m in enumerate(notes):
        for d in (-7, 0, 7):
            src = saw(mtof(m) * 2 ** (d / 1200) * vib(n, 5.2, 0.006, 0.2), n)
            v = filt(src, "bp", (650, 950)) + 0.55 * filt(src, "bp", (1050, 1300)) + 0.25 * filt(src, "bp", (2600, 3200))
            out += stereo(v, (d / 7) * 0.6 * (1 if j % 2 else -1))
    out /= len(notes) * 1.5
    e = np.minimum(1, t / att) ** 2 * np.where(t > dur, np.exp(-(t - dur) / (rel / 4)), 1)
    return out * e


def lead(m, dur, vel=0.8):
    rel = 0.18
    n = int((dur + rel) * SR)
    f = mtof(m) * vib(n)
    v = supersaw(f, n, det=0.11, voices=5, width=0.5) + 0.35 * stereo(square(f / 2, n))
    return v * adsr(dur, 0.004, 0.14, 0.72, rel)[:n] * vel


# ------------------------------------------------------------------ drums
def kick(dec=0.32, click=1.0):
    n = int(0.7 * SR)
    t = tt(n)
    f = 47 + 140 * np.exp(-t / 0.03) + 40 * np.exp(-t / 0.005)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dec)
    cl = filt(noise(n), "high", 2500) * np.exp(-t / 0.0025) * 0.45 * click
    x = body + cl
    return np.tanh(1.7 * x) / np.tanh(1.7)


def snare(dec=0.15):
    n = int(0.45 * SR)
    t = tt(n)
    tone = (np.sin(2 * np.pi * 186 * t) + 0.6 * np.sin(2 * np.pi * 332 * t)) * np.exp(-t / 0.05)
    nz = filt(noise(n), "bp", (1400, 9000)) * np.exp(-t / dec)
    return 0.55 * tone + 0.9 * nz


def clap():
    n = int(0.45 * SR)
    t = tt(n)
    nz = filt(noise(n), "bp", (900, 3400))
    e = np.zeros(n)
    for k, o in enumerate((0, 0.009, 0.019, 0.03)):
        m = t >= o
        e[m] += np.exp(-(t[m] - o) / (0.006 if k < 3 else 0.16))
    return nz * e


HATF = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]


def metal(n, mult=1.0):
    t = tt(n)
    return sum(np.sign(np.sin(2 * np.pi * f * mult * t + rng.random() * 6)) for f in HATF)


def hat(dec):
    n = int(max(0.3, dec * 6) * SR)
    x = filt(filt(metal(n), "bp", (6500, 12000)), "high", 7000)
    return x * np.exp(-tt(n) / dec) / 3


def shaker():
    n = int(0.12 * SR)
    t = tt(n)
    return filt(noise(n), "bp", (4500, 9500)) * np.minimum(1, t / 0.012) * np.exp(-t / 0.035)


def crash(dur=2.6):
    n = int(dur * SR)
    t = tt(n)
    m = metal(n, 1.0) + metal(n, 1.37) + metal(n, 1.93)
    x = filt(m, "bp", (3500, 12000)) / 6 + filt(noise(n), "high", 5000) * 0.5
    return x * np.exp(-t / 0.95) * np.minimum(1, t / 0.002)


def tom(f0=150):
    n = int(0.4 * SR)
    t = tt(n)
    f = f0 * (0.62 + 0.38 * np.exp(-t / 0.08))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)


K1, SN, CL, HC, HO = kick(), snare(), clap(), hat(0.035), hat(0.22)
CR = crash()


def hit_kick(t0, g):
    place("kick", K1, t0, g)
    KICKS.append(t0)


# ------------------------------------------------------------------ fx sounds
def swept(dur, f0, f1, q=1.4, curve=None):
    n = int(dur * SR)
    p = np.linspace(0, 1, n) if curve is None else curve
    fc = f0 * (f1 / f0) ** p
    return tvf(noise(n), fc, q=q, kind="bp")


def riser(dur, f0=400, f1=7000):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    nz = swept(dur, f0, f1, 1.6, p ** 1.4) * p ** 2.2
    tone = saw(110 * 2 ** (2 * p ** 1.3), n)
    tone = filt(tone, "low", 3000) * p ** 2.5 * 0.25
    return nz * 0.8 + tone


def rev_crash(dur=1.2):
    c = crash(dur + 0.1)[: int(dur * SR)][::-1].copy()
    return c * np.linspace(0, 1, len(c)) ** 2


def impact(big=1.0):
    n = int(3.0 * SR)
    t = tt(n)
    f = 30 + 70 * np.exp(-t / 0.09)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.9 * big))
    body = filt(noise(n), "low", 1200) * np.exp(-t / 0.12)
    snap = filt(noise(n), "high", 3000) * np.exp(-t / 0.01) * 0.4
    return np.tanh(1.3 * (sub + body * 0.4 + snap))


def whoosh(dur, f0=500, f1=3800, peak=0.55):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    e = np.where(p < peak, (p / peak) ** 2, ((1 - p) / (1 - peak)) ** 1.6)
    return swept(dur, f0, f1, 1.2) * e


def s_key(i):
    n = int(0.05 * SR)
    t = tt(n)
    v = filt(noise(n), "bp", (2500, 9000)) * np.exp(-t / 0.006)
    return v + np.sin(2 * np.pi * (1900 + 160 * (i % 4)) * t) * np.exp(-t / 0.012) * 0.4


def s_pop(i):
    n = int(0.16 * SR)
    t = tt(n)
    f0 = mtof([74, 76, 78, 81, 83, 86][i % 6])
    f = f0 * (1 + 0.9 * (1 - np.exp(-t / 0.02)))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * np.minimum(1, t / 0.002)


def s_tick(i):
    n = int(0.06 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * (2300 + 90 * (i % 5)) * t) * np.exp(-t / 0.01) + filt(noise(n), "high", 4000) * np.exp(-t / 0.003) * 0.3


def s_tok(i):
    n = int(0.5 * SR)
    t = tt(n)
    f = mtof([74, 78, 81, 86][i % 4])
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.05)) * np.exp(-t / 0.16) * np.minimum(1, t / 0.002)


def s_scribble(dur):
    n = int((dur + 0.05) * SR)
    t = tt(n)
    v = filt(noise(n), "bp", (2000, 7000))
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 34 * t + rng.random() * 6) ** 2
    return v * am * np.minimum(1, t / 0.02) * np.clip((n / SR - t) / 0.05, 0, 1)


def s_scan(dur):
    n = int(dur * SR)
    t = tt(n)
    p = np.linspace(0, 1, n)
    v = swept(dur, 1500, 6000, 3.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t) ** 2)
    beep = np.sin(2 * np.pi * 2637 * t) * (p > 0.85) * np.exp(-np.maximum(0, t - 0.85 * dur) / 0.05)
    return v * np.sin(np.pi * p) ** 0.7 * 0.8 + beep * 0.25


def s_suck(dur):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    return swept(dur, 300, 7000, 1.5, p ** 1.5) * p ** 3


def s_hit(i):
    n = int(0.3 * SR)
    t = tt(n)
    f = 55 + 110 * np.exp(-t / 0.02)
    k = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08)
    thwip = swept(0.3, 5000, 900, 2.0) * np.exp(-t / 0.035)
    tone = np.sin(2 * np.pi * mtof([86, 81, 88, 83, 90, 86, 93, 88, 90, 98][i % 10]) * t) * np.exp(-t / 0.06) * 0.22
    return np.tanh(1.4 * (k * 0.9 + thwip * 0.6 + tone))


def s_marker(dur):
    n = int(dur * SR)
    t = tt(n)
    p = np.linspace(0, 1, n)
    v = filt(noise(n), "bp", (2800, 6500)) * (0.55 + 0.45 * np.sin(2 * np.pi * 55 * t) ** 2)
    sq = np.sin(2 * np.pi * (1800 + 400 * p) * t) * 0.08
    return (v + sq) * np.sin(np.pi * p) ** 0.5


def s_orbit(dur):
    n = int(dur * SR)
    t = tt(n)
    p = np.linspace(0, 1, n)
    rate = 1.0 + 9 * p ** 2.2
    ph = 2 * np.pi * np.cumsum(rate) / SR
    fc = 900 * 2 ** (2.5 * p) * (1 + 0.35 * np.sin(ph))
    v = tvf(noise(n), fc, q=3.0, kind="bp")
    whine = np.sin(2 * np.pi * np.cumsum(500 * 2 ** (2 * p ** 1.5)) / SR) * 0.06 * p ** 2
    amp = (0.3 + 0.7 * p ** 1.8)
    pan = np.sin(ph) * 0.8
    return np.vstack([(v + whine) * amp * np.cos((pan + 1) * np.pi / 4), (v + whine) * amp * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)


def s_shimmer():
    n = int(2.6 * SR)
    out = np.zeros(n)
    for k, m in enumerate((86, 90, 93, 98)):
        o = int(k * 0.06 * SR)
        tb = tt(n - o)
        out[o:] += np.sin(2 * np.pi * mtof(m) * tb) * np.exp(-tb / 0.9) * np.minimum(1, tb / 0.004) * 0.8 ** k
    return out


def s_dive(dur):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    speed = np.where(p < 0.5, 16 * p ** 4, 16 * (1 - p) ** 4)
    return swept(dur, 300, 4200, 1.2, speed ** 0.7) * speed ** 1.2


def build_sfx(cues):
    for c in cues:
        k, t, i, soft = c["k"], c["t"], c.get("i", 0), c.get("soft", 0)
        g = 0.55 if soft else 1.0
        if k == "blip":
            n = int(0.25 * SR)
            tb = tt(n)
            place("fx", np.sin(2 * np.pi * 1318.5 * tb) * np.exp(-tb / 0.06) * np.minimum(1, tb / 0.003), t, 0.06, rev=0.4)
        elif k == "key":
            place("fx", s_key(i), t, 0.15 * (0.85 + 0.3 * ((i * 37) % 7) / 7), pan=0.1 * ((i % 3) - 1))
        elif k == "type":
            for j in range(5):
                place("fx", s_key(i + j), t + j * c["d"] / 5, 0.09, pan=0.3)
        elif k == "pop":
            place("fx", s_pop(i), t, 0.11 * g, pan=0.25 * np.sin(i * 1.7), rev=0.25)
        elif k == "tick":
            place("fx", s_tick(i), t, 0.06 * g, pan=0.2 * np.sin(i * 2.3), rev=0.2)
        elif k in ("swoosh", "rise"):
            d = 0.42 if k == "swoosh" else 0.32
            place("fx", whoosh(d, 700, 4200 if k == "swoosh" else 2600), t - d * 0.45, 0.10 if k == "swoosh" else 0.07, rev=0.3)
        elif k == "swish":
            place("fx", whoosh(0.3, 1500, 6000, 0.35), t, 0.07, rev=0.2)
        elif k == "bell":
            place("fx", bell(86, 0.7) + 0.5 * bell(93, 0.4), t, 0.07, rev=0.5, dly=0.25)
        elif k == "shimmer":
            place("fx", s_shimmer(), t, 0.04 * g, pan=0.15, rev=0.6)
        elif k == "tok":
            place("fx", s_tok(i), t, 0.11, pan=-0.2 + 0.13 * i, rev=0.35)
        elif k == "scan":
            place("fx", s_scan(c["d"]), t, 0.05, pan=0.3)
        elif k == "scribble":
            place("fx", s_scribble(c["d"]), t, 0.03, pan=0.35)
        elif k == "suck":
            place("fx", s_suck(c["d"]), t, 0.16, rev=0.2)
        elif k == "hit":
            place("fx", s_hit(i), t, 0.30, pan=0.18 * (1 if i % 2 else -1), rev=0.15)
        elif k == "impact":
            place("fx", impact(1.0 if i == 0 else 0.7), t, 0.55 if i == 0 else 0.4, rev=0.45)
        elif k == "boom":
            place("fx", impact(1.4), t, 0.6, rev=0.6)
        elif k == "dive":
            place("fx", s_dive(c["d"]), t, 0.16, rev=0.3)
        elif k == "whoosh":
            v = whoosh(c["d"] + 0.2, 400, 3800, 0.5)
            pan = np.linspace(-0.7, 0.7, len(v)) * c.get("pan", 1)
            st = np.vstack([v * np.cos((pan + 1) * np.pi / 4), v * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)
            place("fx", st, t - 0.05, 0.14, rev=0.25)
        elif k == "chime":
            place("fx", bell([81, 86, 90][i % 3], 0.6, 1.8), t, 0.06, rev=0.5)
        elif k == "riser":
            place("fx", riser(c["d"], 500, 8000), t, 0.16, rev=0.3)
        elif k == "marker":
            place("fx", s_marker(c["d"]), t, 0.05, pan=-0.2)
        elif k == "orbit":
            place("fx", s_orbit(c["d"]), t, 0.12, rev=0.3)


# ------------------------------------------------------------------ harmony
V = {
    "D": [50, 57, 62, 66, 69], "Bm": [47, 54, 59, 62, 66], "G": [43, 50, 55, 59, 62],
    "A": [45, 52, 57, 61, 64], "Asus": [45, 52, 57, 62, 64], "A/C#": [49, 52, 57, 61, 64],
}
ROOT = {"D": 38, "Bm": 35, "G": 31, "A": 33, "Asus": 33, "A/C#": 37}
BARS = ["D", "Bm", "G", "A", "D", "Bm", "G", "Asus", "D", "A/C#", "Bm", "G", "D", "A", "Bm", "G", "D", "A", "D", "D"]
HOOK = [  # (bar offset, 8th step, midi, length in 8ths)
    (0, 0, 78, 1), (0, 1, 81, 1), (0, 2, 86, 2), (0, 4, 85, 2), (0, 6, 81, 2),
    (1, 0, 76, 2), (1, 2, 85, 2), (1, 4, 83, 1), (1, 5, 81, 3),
    (2, 0, 86, 2), (2, 2, 85, 1), (2, 3, 83, 2), (2, 5, 78, 1), (2, 6, 81, 2),
    (3, 0, 83, 2), (3, 2, 81, 2), (3, 4, 79, 1), (3, 5, 78, 1), (3, 6, 76, 2),
    (4, 0, 78, 1), (4, 1, 81, 1), (4, 2, 86, 2), (4, 4, 85, 2), (4, 6, 81, 2),
    (5, 0, 76, 2), (5, 2, 85, 2), (5, 4, 88, 4),
]


def bar_t(b):
    return b * 2.0


def arp_tones(name):
    v = V[name]
    return [m + 12 for m in v[1:]] + [v[1] + 24]


# ------------------------------------------------------------------ arrangement
def build_music():
    # air bed for the intro
    n = int(5 * SR)
    air = filt(noise(n), "bp", (300, 5000)) * np.minimum(1, tt(n) / 1.0) * np.clip((5 - tt(n)) / 1.5, 0, 1)
    place("pads", stereo(air, 0.0), 0.0, 0.012)

    # pads
    for b, name in enumerate(BARS):
        s = bar_t(b)
        if b <= 6:
            bright = [650, 800, 1000, 1200, 1500, 1900, 2400][b]
            place("pads", pad_chord(V[name], 2.15, bright), s - 0.1, 0.42 if b < 4 else 0.36, rev=0.45)
        elif b == 7:
            place("pads", pad_chord(V[name], 1.85, 0, sweep=(1600, 9000), rel=0.15), s - 0.1, 0.36, rev=0.4)
        elif 8 <= b <= 13:
            place("pads", pad_chord(V[name], 2.1, 2600), s, 0.14, rev=0.3)
        elif 14 <= b <= 16:
            place("pads", pad_chord(V[name][1:], 2.2, 900, att=0.6, rel=1.2), s, 0.3, rev=0.5)
            place("pads", choir([m + 12 for m in V[name][1:4]], 2.1), s, 0.36, rev=0.6)
        elif b == 17:
            place("pads", pad_chord(V[name][1:], 1.9, 0, sweep=(900, 7000), rel=0.1), s, 0.3, rev=0.4)
            place("pads", choir([m + 12 for m in V[name][1:4]], 1.85, rel=0.15), s, 0.8, rev=0.5)

    # gated supersaw chords in the drop
    gate = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]
    for b in range(8, 14):
        name = BARS[b]
        n = int(2.0 * SR)
        ch = sum(supersaw(mtof(m + 12), n, det=0.2) for m in V[name][1:]) / 3.0
        g = np.zeros(n)
        st = int(0.125 * SR)
        tb = tt(st)
        for k, on in enumerate(gate):
            if on:
                g[k * st:(k + 1) * st] = np.minimum(1, tb / 0.003) * (0.55 + 0.45 * np.exp(-tb / 0.05)) * np.clip((0.125 - tb) / 0.015, 0, 1)
        ch = filt(ch * g, "low", 6500 if b >= 12 else 4800)
        place("pads", ch, bar_t(b), 1.35, rev=0.25, dly=0.12)

    # final chord (drop 2): big, then the filter closes as it rings out
    n = int(4.0 * SR)
    big = sum(supersaw(mtof(m), n, det=0.22) for m in V["D"] + [74, 78, 81]) / 4.0
    big = tvf(big, np.geomspace(9000, 900, n), q=0.8) * np.exp(-tt(n) / 1.6) * np.minimum(1, tt(n) / 0.004)
    big *= np.clip((4.0 - tt(n)) / 0.6, 0, 1)
    place("pads", big, 36.0, 1.0, rev=0.5)
    place("pads", pad_chord(V["D"], 3.0, 1800, att=0.05, rel=1.0), 36.0, 0.3, rev=0.6)

    # e-piano: intro motif, then soft chords under the build
    ev = [(0.0, V["D"][1:], 0.42, 1.9), (1.0, [74], 0.5, 0.5), (1.5, [76], 0.45, 0.5),
          (2.0, V["Bm"][1:], 0.42, 1.9), (2.0, [78], 0.55, 1.0), (3.0, [74], 0.45, 0.5), (3.5, [73], 0.45, 0.5),
          (4.0, V["G"][1:], 0.45, 1.9), (5.0, [71], 0.35, 0.5), (5.5, [74], 0.35, 0.5),
          (6.0, V["A"][1:], 0.45, 1.9), (7.0, [73], 0.35, 0.5), (7.5, [76], 0.35, 0.5)]
    for b in range(4, 7):
        ev.append((bar_t(b), V[BARS[b]][1:], 0.3, 1.9))
    for t0, notes, vel, d in ev:
        for j, m in enumerate(notes):
            place("keys", epiano(m, d, vel), t0 + 0.012 * j, 0.15, pan=-0.35 + 0.18 * j, rev=0.35, dly=0.1)

    # pluck arp
    for b in range(2, 18):
        if 14 <= b <= 16:
            continue
        tones = arp_tones(BARS[b])
        pat = [0, 1, 2, 3, 4, 3, 2, 1]
        step = 0.25 if b < 4 else 0.125
        for k in range(int(2.0 / step)):
            s = bar_t(b) + k * step
            if b == 7 and s >= 15.75:
                continue
            m = tones[pat[k % 8]]
            if b < 4:
                g = 0.05
            elif b < 7:
                g = 0.045 + 0.02 * (b - 4)
            elif b == 7:
                g = 0.07
            elif b < 14:
                g = 0.06
            else:
                g = 0.03 + 0.04 * (s - 34.0) / 2
            place("keys", pluck(m, 0.7, 1.3 if b >= 8 else 1.0), s, g, pan=0.45 if k % 2 else -0.45, rev=0.3, dly=0.15)

    # hook lead (drop 1)
    for bo, st_, m, ln in HOOK:
        s = 16.0 + bo * 2.0 + st_ * 0.25
        place("lead", lead(m, ln * 0.25 - 0.02), s, 0.55, rev=0.25, dly=0.32)
        place("lead", lead(m - 12, ln * 0.25 - 0.02, 0.5), s, 0.22, rev=0.2)

    # breakdown piano: chords, 8th arpeggios, slow melody
    for b in (14, 15, 16, 17):
        name = BARS[b]
        v = V[name]
        for j, m in enumerate(v[1:4]):
            place("keys", piano(m, 1.9, 0.55), bar_t(b) + 0.01 * j, 0.15, pan=-0.2, rev=0.45)
        if b < 17:
            arp = [v[1] + 12, v[2] + 12, v[3] + 12, v[4] + 12, v[3] + 12, v[2] + 12, v[1] + 12, v[2] + 12]
            for k, m in enumerate(arp):
                place("keys", piano(m, 0.3, 0.4), bar_t(b) + k * 0.25, 0.1, pan=0.3, rev=0.45)
    for t0, m, d in [(28.0, 86, 1.0), (29.0, 85, 0.5), (29.5, 83, 0.5), (30.0, 83, 1.0), (31.0, 81, 0.5), (31.5, 79, 0.5),
                     (32.0, 78, 1.0), (33.0, 81, 0.5), (33.5, 86, 0.5), (34.0, 85, 1.5)]:
        place("keys", piano(m, d, 0.75), t0, 0.24, pan=0.1, rev=0.5, dly=0.15)

    # final: piano chord + bell hook + last soft chord
    for j, m in enumerate([38, 50, 57, 62, 66, 69]):
        place("keys", piano(m, 3.5, 0.9), 36.0 + 0.008 * j, 0.14, rev=0.5)
    for t0, m in [(36.5, 90), (36.75, 93), (37.0, 98), (37.5, 97), (38.0, 93), (38.5, 90), (39.0, 86)]:
        place("keys", bell(m, 0.6, 2.2), t0, 0.06, pan=0.2, rev=0.6, dly=0.25)
    for j, m in enumerate([62, 66, 69, 74]):
        place("keys", epiano(m, 1.5, 0.35), 38.0 + 0.02 * j, 0.10, rev=0.6)

    # sub bass (sine on the root)
    for b, name in enumerate(BARS):
        if b < 2:
            continue
        s = bar_t(b)
        f = mtof(ROOT[name])
        d = 2.0
        if b == 7:
            d = 1.72
        if b == 18:
            d = 4.0
        if b == 19:
            continue
        n = int(d * SR)
        tb = tt(n)
        env = np.minimum(1, tb / 0.02) * np.clip((d - tb) / 0.05, 0, 1)
        if b == 18:
            env *= np.exp(-tb / 1.6)
        g = 0.13 if b < 4 else 0.22 if b < 8 else 0.30 if b < 14 else 0.12 if b < 17 else 0.22
        if b == 18:
            g = 0.38
        place("bass", np.sin(2 * np.pi * f * tb) * env, s, g)

    # build bass: 8ths, filter opening
    for b in range(4, 8):
        f = mtof(ROOT[BARS[b]] + 12)
        for k in range(8):
            s = bar_t(b) + k * 0.25
            if s >= 15.75:
                continue
            n = int(0.24 * SR)
            v = saw(f, n) + 0.5 * square(f, n)
            fc = (300 + 140 * (b - 4) + 120 * k / 8) * (1 + 2.5 * np.exp(-tt(n) / 0.05))
            v = tvf(v, fc, q=1.1) * adsr(0.2, 0.003, 0.08, 0.6, 0.04)[:n]
            place("bass", v, s, 0.10)

    # drop bass: offbeat 8ths + a 16th push
    for b in range(8, 14):
        f = mtof(ROOT[BARS[b]] + 12)
        for s16 in (2, 3, 6, 7, 10, 11, 14, 15):
            s = bar_t(b) + s16 * 0.125
            if s >= 27.0:
                continue
            n = int(0.14 * SR)
            v = saw(f, n) + 0.6 * square(f * 0.5, n)
            fc = 350 + 2200 * np.exp(-tt(n) / 0.045)
            v = tvf(v, fc, q=1.4) * adsr(0.11, 0.002, 0.06, 0.55, 0.03)[:n]
            place("bass", v, s, 0.14 if s16 % 4 == 2 else 0.10)

    # rebuild bass (bar 17)
    f = mtof(ROOT["A"] + 12)
    for k in range(8):
        s = 34.0 + k * 0.25
        if s >= 35.9:
            continue
        n = int(0.22 * SR)
        v = saw(f, n) + 0.5 * square(f, n)
        v = tvf(v, (300 + 900 * k / 8) * (1 + 2 * np.exp(-tt(n) / 0.05)), q=1.2) * adsr(0.18, 0.003, 0.08, 0.6, 0.04)[:n]
        place("bass", v, s, 0.11)


def build_drums():
    # pulse (bars 2-3)
    for s in (4.0, 5.0, 6.0, 7.0):
        hit_kick(s, 0.26)
    for s in np.arange(4.0, 8.0, 0.25):
        place("drums", shaker(), s, 0.05 if (s % 0.5) else 0.028, pan=0.3)
    for s in np.arange(4.25, 8.0, 0.5):
        place("drums", HC, s, 0.08, pan=-0.2)
    # build (bars 4-6)
    for s in np.arange(8.0, 14.0, 0.5):
        hit_kick(s, 0.5)
    for b in range(4, 7):
        for off in (0.5, 1.5):
            place("drums", CL, bar_t(b) + off, 0.2, rev=0.35)
    for s in np.arange(8.0, 14.0, 0.125):
        acc = (s % 0.5) == 0.25
        place("drums", HC, s, 0.18 if acc else 0.1, pan=0.25 if acc else -0.15)
    for s in np.arange(12.25, 14.0, 0.5):
        place("drums", HO, s, 0.09, pan=0.3)
    # pre-drop roll: lands on every word cut, then 32nds
    roll = [w for w in (14.0, 14.25, 14.5, 14.75, 15.0, 15.125, 15.25, 15.375, 15.5, 15.625)] + list(np.arange(15.5, 15.75, 0.0625))
    for s in roll:
        u = (s - 14.0) / 1.75
        place("drums", SN, s, 0.05 + 0.12 * u, pan=0.1, rev=0.3)
    place("fx", riser(1.9, 300, 8000), 14.0, 0.13, rev=0.3)
    place("drums", rev_crash(1.2), 14.8, 0.16, rev=0.3)
    # drop 1 (bars 8-13)
    for s in np.arange(16.0, 27.0, 0.5):
        hit_kick(s, 0.68)
    for b in range(8, 14):
        for off in (0.5, 1.5):
            s = bar_t(b) + off
            if s < 27.0:
                place("drums", CL, s, 0.32, rev=0.3)
                place("drums", SN, s, 0.08, rev=0.2)
    for s in np.arange(16.0, 27.0, 0.125):
        k = round((s % 0.5) / 0.125)
        place("drums", HC, s, [0.065, 0.09, 0.15, 0.09][k], pan=-0.2 + 0.13 * k)
        place("drums", shaker(), s + 0.004, 0.04, pan=0.4)
    for s in np.arange(16.25, 27.0, 0.5):
        place("drums", HO, s, 0.14, pan=0.15)
    for s, g in ((16.0, 0.24), (20.0, 0.13), (24.0, 0.15)):
        place("drums", CR, s, g, rev=0.3)
    for k, s in enumerate(np.arange(23.5, 24.0, 0.125)):
        place("drums", SN, s, 0.07 + 0.03 * k, rev=0.2)
    for k, s in enumerate(np.arange(19.5, 20.0, 0.125)):
        place("drums", tom(170 - 20 * k), s, 0.25, pan=-0.4 + 0.25 * k, rev=0.3)
    # down-lifter after the first drop
    n = int(1.8 * SR)
    place("fx", swept(1.8, 6000, 300, 1.2) * np.exp(-tt(n) / 0.6), 16.0, 0.06, rev=0.3)
    # dive roll (into the impact at 28.0)
    roll = list(np.arange(27.0, 27.5, 0.125)) + list(np.arange(27.5, 27.75, 0.0625)) + list(np.arange(27.75, 27.95, 0.03125))
    for s in roll:
        place("drums", SN, s, 0.04 + 0.13 * (s - 27.0) / 0.95, rev=0.3)
    # breakdown: just a shaker in the second half
    for s in np.arange(30.0, 34.0, 0.25):
        place("drums", shaker(), s, 0.03 if (s % 0.5) else 0.016, pan=0.35)
    # rebuild (bar 17)
    for s in (34.0, 34.5, 35.0, 35.5, 35.75):
        hit_kick(s, 0.45 + 0.1 * (s - 34.0) / 1.75)
    for k, s in enumerate(np.arange(34.0, 35.9, 0.125)):
        place("drums", HC, s, 0.04 + 0.09 * k / 15, pan=0.2)
    roll = list(np.arange(35.0, 35.5, 0.125)) + list(np.arange(35.5, 35.75, 0.0625)) + list(np.arange(35.75, 35.92, 0.03125))
    for s in roll:
        place("drums", SN, s, 0.05 + 0.13 * (s - 35.0) / 0.92, rev=0.3)
    place("fx", riser(1.95, 400, 9000), 34.0, 0.12, rev=0.3)
    place("drums", rev_crash(1.2), 34.8, 0.18, rev=0.3)
    # drop 2: one huge hit
    hit_kick(36.0, 0.85)
    place("drums", CR, 36.0, 0.28, rev=0.5)
    place("drums", CL, 36.0, 0.2, rev=0.6)


# ------------------------------------------------------------------ mix
def sidechain(depth, rel=0.13):
    t = tt(N)
    g = np.ones(N)
    for k in KICKS:
        i0, i1 = int(k * SR), min(N, int((k + 0.5) * SR))
        tb = t[i0:i1] - k
        g[i0:i1] = np.minimum(g[i0:i1], 1 - depth * np.minimum(1, tb / 0.004) * np.exp(-tb / rel))
    return g


def reverb_ir(rt=2.3, pre=0.022):
    n = int((rt + 0.4) * SR)
    t = tt(n)
    ir = np.zeros((2, n))
    for ch in range(2):
        nz = noise(n)
        ir[ch] = filt(nz, "low", 3500) * np.exp(-t / (rt / 6.9)) + filt(nz, "high", 3500) * np.exp(-t / (rt / 14))
        for d, a in ((0.011, 0.5), (0.019, 0.35), (0.027, 0.3), (0.041, 0.22)):
            ir[ch, int((d + 0.003 * ch) * SR)] += a
    ir[:, : int(pre * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return ir


def delay_ir(d=0.375, fb=0.42, taps=7):
    n = int(d * (taps + 1) * SR)
    ir = np.zeros((2, n))
    for k in range(taps):
        ir[k % 2 ^ 1, int(d * (k + 1) * SR)] = fb ** k
    return ir


def glue(x, thr_db=-16, ratio=2.2, att=0.008, rel=0.15):
    lvl = np.abs(x).max(axis=0)
    a_c, r_c = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    # one-pole peak follower with separate attack / release (approximated: fast follower then slow smoother)
    fast = lfilter([1 - a_c], [1, -a_c], lvl)
    env = np.maximum(lfilter([1 - r_c], [1, -r_c], fast), fast * 0.0)
    db = 20 * np.log10(env + 1e-9)
    over = np.maximum(0, db - thr_db)
    gr = -over * (1 - 1 / ratio)
    return x * 10 ** (gr / 20)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    cues = json.loads((OUT / "cues.json").read_text())
    build_music()
    build_drums()
    build_sfx(cues)

    sc_full, sc_soft = sidechain(0.62), sidechain(0.35)
    mix = (BUS["kick"] + BUS["drums"] + BUS["bass"] * sc_full + BUS["pads"] * sc_full
           + BUS["lead"] * sc_soft + BUS["keys"] * sc_soft + BUS["fx"])
    send_d = filt(filt(SEND_DLY, "high", 350), "low", 5000)
    mix += fftconvolve(send_d, delay_ir(), axes=1)[:, :N] * 0.55
    ir = reverb_ir()
    wet = np.vstack([fftconvolve(SEND_REV[c], ir[c])[:N] for c in range(2)])
    mix += filt(wet, "high", 180) * 0.42

    mix = filt(mix, "high", 28)
    mix = peq(peq(mix, 820, -2.5, 0.9), 3200, 1.5, 0.7)   # less boxy mids, a touch more presence
    mix = glue(mix)
    t = tt(N)
    mix *= np.clip((DUR - t) / 0.6, 0, 1)
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.25) / np.tanh(1.25) * 0.89
    write_wav(OUT / "mix_raw.wav", mix)
    for a, b, name in ((0, 4, "intro"), (4, 8, "pulse"), (8, 14, "build"), (14, 15.9, "pre-drop"), (16, 28, "drop 1"),
                       (28, 34, "breakdown"), (34, 35.9, "rebuild"), (36, 40, "drop 2/end")):
        s = mix[:, int(a * SR): int(b * SR)]
        print(f"{name:11s} rms {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dB  peak {20 * np.log10(np.abs(s).max() + 1e-9):6.1f} dB")
