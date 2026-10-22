"""Score + sound design for claude-30s, 100 % synthesized (numpy + scipy).

D minor, 128 BPM (beat 0.46875 s, bar 1.875 s), 30 s = 16 bars. Picture and sound share one
timeline: the sound effects sit on the cues exported by the film (out/cues.json).

  bars 0-1   intro: air, filtered pad, e-piano, heartbeat, ignition       Bonjour / Je suis Claude
  bars 2-3   build: four on the floor, 8th bass opening, 16th plucks,     verbs, word burst
             snare roll on the burst, riser, a 16th of silence
  bars 4-5   DROP 1: kick, clap, hats, gated supersaw, hook, sidechain     language rings
  bars 6-7   drop, lighter: plucked counter-melody, a bell per step        reasoning graph
  bars 8-10  breakdown: piano, choir pad, shaker                           Je vois / je ne sais pas
  bar  11    rebuild: kicks 4 > 8 > 16, roll, riser, silence              orbit
  bars 12-13 DROP 2: everything, hook doubled an octave up                Utile. Honnete. Bienveillant.
  bars 14-15 outro: big warm chord, piano, bells, resolves on F            signature

Output: out/mix_raw.wav (16-bit). Loudness is set afterwards with ffmpeg (two-pass loudnorm).
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

HERE = Path(__file__).parent
OUT = HERE / "out"
SR = 48000
DUR = 30.0
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


B = 60 / 128            # beat
BARL = 4 * B            # bar


def bt(n):
    return n * B


def bar_t(b):
    return b * BARL


def s_grow(dur):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    v = np.sin(2 * np.pi * np.cumsum(900 * 2 ** (1.2 * p)) / SR) * 0.25 + swept(dur, 1200, 5000, 3.0) * 0.6
    return v * np.sin(np.pi * p) ** 0.6


def build_sfx(cues):
    for c in cues:
        k, t, i, soft = c["k"], c["t"], c.get("i", 0), c.get("soft", 0)
        g = 0.55 if soft else 1.0
        if k == "blip":
            n = int(0.4 * SR)
            tb = tt(n)
            place("fx", np.sin(2 * np.pi * 1174.7 * tb) * np.exp(-tb / 0.08) * np.minimum(1, tb / 0.003), t, 0.05, rev=0.6)
        elif k == "thump":
            n = int(0.6 * SR)
            tb = tt(n)
            f = 40 + 60 * np.exp(-tb / 0.05)
            place("fx", np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tb / 0.18), t, 0.35)
        elif k == "ignite":
            place("fx", impact(0.8), t, 0.42, rev=0.5)
            place("fx", s_shimmer(), t + 0.02, 0.06, pan=0.1, rev=0.7)
            place("drums", rev_crash(0.9), t - 0.9, 0.12, rev=0.3)
        elif k == "sparkle":
            n = int(c["d"] * SR)
            tb = tt(n)
            out = np.zeros(n)
            r = np.random.default_rng(int(t * 1000))
            for j in range(int(c["d"] * 14)):
                o = int(r.random() * n * 0.8)
                m = int(0.08 * SR)
                seg_ = np.sin(2 * np.pi * (3000 + 3000 * r.random()) * tt(m)) * np.exp(-tt(m) / 0.02)
                out[o:o + m] += seg_[: n - o] * (1 - o / n)
            place("fx", out, t, 0.025 * g, pan=0.3, rev=0.6)
        elif k == "key":
            place("fx", s_key(i), t, (0.07 if soft else 0.11) * (0.85 + 0.3 * ((i * 37) % 7) / 7), pan=0.1 * ((i % 3) - 1))
        elif k == "pop":
            place("fx", s_pop(i), t, 0.09 * g, pan=0.25 * np.sin(i * 1.7), rev=0.25)
        elif k == "tick":
            place("fx", s_tick(i), t, 0.05 * g, pan=0.2 * np.sin(i * 2.3), rev=0.25)
        elif k == "swoosh":
            place("fx", whoosh(0.5, 600, 4200), t - 0.25, 0.09, rev=0.3)
        elif k == "swish":
            place("fx", whoosh(0.3, 1500, 6000, 0.35), t, 0.06, rev=0.2)
        elif k == "whip":
            d = c["d"] + 0.15
            v = whoosh(d, 400, 5200, 0.5)
            pan = np.linspace(-0.8, 0.8, len(v)) * (1 if i % 2 == 0 else -1)
            st = np.vstack([v * np.cos((pan + 1) * np.pi / 4), v * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)
            place("fx", st, t - d / 2, 0.16, rev=0.2)
        elif k == "scribble":
            place("fx", s_scribble(c["d"]), t, 0.035, pan=0.3)
        elif k == "scan":
            place("fx", s_scan(c["d"]), t, 0.045, pan=0.25)
        elif k == "ping":
            place("fx", bell([81, 84, 86, 88, 93][i % 5], 0.6, 1.6), t, 0.05, pan=-0.3 + 0.15 * i, rev=0.5, dly=0.2)
        elif k == "grow":
            place("fx", s_grow(c["d"]), t, 0.03, pan=0.2, rev=0.3)
        elif k == "hit":
            place("fx", s_hit(i), t, 0.26, pan=0.18 * (1 if i % 2 else -1), rev=0.15)
        elif k == "suck":
            place("fx", s_suck(c["d"]), t, 0.17, rev=0.2)
        elif k == "boom":
            place("fx", impact(1.4), t, 0.55, rev=0.55)
        elif k == "impact":
            place("fx", impact(0.7), t, 0.32, rev=0.45)
        elif k == "shimmer":
            place("fx", s_shimmer(), t, 0.05 * g, pan=0.15, rev=0.7)
        elif k == "orbit":
            place("fx", s_orbit(c["d"]), t, 0.11, rev=0.3)
        elif k == "riser":
            place("fx", riser(c["d"], 500, 8000), t, 0.12, rev=0.3)
        elif k == "tok":
            place("fx", s_tok(i), t, 0.09, rev=0.35)
        elif k == "chime":
            place("fx", bell(89, 0.6, 2.4) + 0.6 * bell(96, 0.4, 2.4), t, 0.07, rev=0.6, dly=0.2)


# ------------------------------------------------------------------ harmony (D minor, the outro lifts to F)
V = {
    "Dm": [62, 65, 69, 74], "Bb": [62, 65, 70, 74], "F": [60, 65, 69, 72], "C": [60, 64, 67, 72],
    "Gm": [62, 67, 70, 74], "Bbmaj9": [58, 62, 65, 69, 72], "Csus": [60, 65, 67, 72], "Fadd9": [60, 65, 67, 69, 72, 77],
}
ROOT = {"Dm": 38, "Bb": 34, "F": 41, "C": 36, "Gm": 43, "Bbmaj9": 34, "Csus": 36, "Fadd9": 41}
BARS = ["Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C", "Bb", "F", "Gm", "C", "Dm", "Bb", "Bbmaj9", "Csus"]
HOOK = [  # (bar offset, 8th step, midi, length in 8ths): 4 bars over Dm Bb F C
    (0, 0, 81, 2), (0, 2, 81, 1), (0, 3, 79, 1), (0, 4, 77, 2), (0, 6, 74, 2),
    (1, 0, 77, 2), (1, 2, 74, 1), (1, 3, 77, 1), (1, 4, 79, 2), (1, 6, 77, 1), (1, 7, 74, 1),
    (2, 0, 84, 2), (2, 2, 81, 2), (2, 4, 79, 1), (2, 5, 77, 1), (2, 6, 81, 2),
    (3, 0, 79, 3), (3, 3, 76, 1), (3, 4, 72, 1), (3, 5, 74, 1), (3, 6, 76, 2),
]


def arp_tones(name):
    v = V[name]
    return [m + 12 for m in v] + [v[1] + 24]


def gated_chord(name, b, gain, bright, octave=12):
    n = int(BARL * SR)
    ch = sum(supersaw(mtof(m + octave), n, det=0.2) for m in V[name][:4]) / 3.2
    gate = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]
    g = np.zeros(n)
    st = int(n / 16)
    tb = tt(st)
    for k, on in enumerate(gate):
        if on:
            g[k * st:(k + 1) * st] = np.minimum(1, tb / 0.003) * (0.55 + 0.45 * np.exp(-tb / 0.05)) * np.clip((st / SR - tb) / 0.012, 0, 1)
    place("pads", filt(ch * g, "low", bright), bar_t(b), gain, rev=0.25, dly=0.12)


def build_music():
    n = int(4.2 * SR)   # air bed for the intro
    air = filt(noise(n), "bp", (300, 5000)) * np.minimum(1, tt(n) / 1.0) * np.clip((4.2 - tt(n)) / 1.5, 0, 1)
    place("pads", stereo(air), 0.0, 0.012)

    # pads: filtered in the intro, opening through the build, wide in the drops, warm in the breakdown
    for b, name in enumerate(BARS):
        s = bar_t(b)
        if b <= 2:
            place("pads", pad_chord(V[name], BARL + 0.1, [700, 1000, 1500][b]), s - 0.05, 0.42, rev=0.45)
        elif b == 3:
            place("pads", pad_chord(V[name], BARL - 0.12, 0, sweep=(1500, 9000), rel=0.05), s, 0.36, rev=0.4)
        elif 4 <= b <= 7 or 12 <= b <= 13:
            place("pads", pad_chord(V[name], BARL, 2600), s, 0.14, rev=0.3)
        elif 8 <= b <= 10:
            place("pads", pad_chord(V[name], BARL + 0.2, 1100, att=0.5, rel=1.0), s, 0.3, rev=0.5)
            place("pads", choir([m + 12 for m in V[name][:3]], BARL), s, 0.3, rev=0.6)
        elif b == 11:
            place("pads", pad_chord(V[name], BARL - 0.12, 0, sweep=(900, 8000), rel=0.05), s, 0.3, rev=0.4)
            place("pads", choir([m + 12 for m in V[name][:3]], BARL - 0.15, rel=0.1), s, 0.6, rev=0.5)

    for b in (4, 5, 6, 7, 12, 13):   # gated supersaw in the drops
        gated_chord(BARS[b], b, 1.25 if b in (4, 5, 12, 13) else 0.85, 6500 if b >= 12 else 5200)

    # outro: a big warm chord on the flood, a softer one, the final F on beat 62
    n = int(4.0 * SR)
    big = sum(supersaw(mtof(m), n, det=0.22) for m in V["Bbmaj9"] + [46]) / 4.0
    big = tvf(big, np.geomspace(9000, 1000, n), q=0.8) * np.exp(-tt(n) / 1.5) * np.minimum(1, tt(n) / 0.004)
    place("pads", big, bar_t(14), 0.9, rev=0.5)
    place("pads", pad_chord(V["Bbmaj9"], BARL, 1800, att=0.05, rel=0.6), bar_t(14), 0.3, rev=0.6)
    place("pads", pad_chord(V["Csus"], bt(2), 1600, att=0.2, rel=0.3), bar_t(15), 0.26, rev=0.6)
    place("pads", pad_chord(V["Fadd9"], 30.0 - bt(62), 2200, att=0.03, rel=0.4), bt(62), 0.34, rev=0.7)

    # e-piano: intro motif
    ev = [(0.0, V["Dm"], 0.42, 1.8), (bt(1), [74], 0.45, 0.4), (bt(1.5), [77], 0.45, 0.4), (bt(3), [81], 0.5, 0.45),
          (bar_t(1), V["Bb"], 0.42, 1.8), (bar_t(1) + bt(1), [77], 0.4, 0.4), (bar_t(1) + bt(2), [74], 0.4, 0.8)]
    for t0, notes, vel, d in ev:
        for j, m in enumerate(notes):
            place("keys", epiano(m, d, vel), t0 + 0.012 * j, 0.15, pan=-0.35 + 0.2 * j, rev=0.35, dly=0.1)

    # plucks: 16ths in the build and the drops, counter-melody in bars 6-7
    for b in list(range(2, 8)) + [12, 13]:
        tones = arp_tones(BARS[b])
        pat = [0, 2, 1, 3, 2, 4, 3, 1]
        step = BARL / 8 if b == 2 else BARL / 16
        for k in range(int(round(BARL / step))):
            s = bar_t(b) + k * step
            if b == 3 and s >= bt(15.75):
                continue
            m = tones[pat[k % 8]]
            gn = {2: 0.05, 3: 0.065}.get(b, 0.06 if b in (4, 5, 12, 13) else 0.075)
            place("keys", pluck(m, 0.7, 1.3 if b >= 4 else 1.0), s, gn, pan=0.45 if k % 2 else -0.45, rev=0.3, dly=0.15)

    # hook lead: drop 1 (bars 4-5 = first half), drop 2 (bars 12-13, doubled an octave up)
    for start, octs, gain in ((bar_t(4), (0, -12), 0.5), (bar_t(12), (0, 12, -12), 0.5)):
        for bo, st_, m, ln in HOOK:
            if bo > 1:
                continue
            s = start + bo * BARL + st_ * BARL / 8
            for o in octs:
                place("lead", lead(m + o, ln * BARL / 8 - 0.02, 0.8 if o == 0 else 0.45), s, gain * (1 if o == 0 else 0.45), rev=0.25, dly=0.3)
    # bars 6-7: the second half of the hook as a soft bell line (the "thinking" colour)
    for bo, st_, m, ln in HOOK:
        if bo < 2:
            continue
        s = bar_t(4) + bo * BARL + st_ * BARL / 8
        place("keys", bell(m, 0.55, 1.4), s, 0.05, pan=0.2, rev=0.5, dly=0.25)

    # breakdown piano (bars 8-10) and a slow melody
    for b in (8, 9, 10):
        v = V[BARS[b]]
        for j, m in enumerate(v[:3]):
            place("keys", piano(m - 12, BARL, 0.5), bar_t(b) + 0.01 * j, 0.15, pan=-0.2, rev=0.45)
        for k, m in enumerate([v[0], v[1], v[2], v[3], v[2], v[1], v[0], v[1]]):
            place("keys", piano(m, 0.3, 0.38), bar_t(b) + k * BARL / 8, 0.09, pan=0.3, rev=0.45)
    for t0, m, d in [(bar_t(8), 77, 1.0), (bar_t(8) + bt(2), 74, 0.5), (bar_t(8) + bt(3), 77, 0.4), (bar_t(9), 81, 1.0), (bar_t(9) + bt(2), 79, 0.9),
                     (bar_t(10), 79, 0.6), (bar_t(10) + bt(1.5), 77, 0.4), (bar_t(10) + bt(2), 74, 1.2)]:
        place("keys", piano(m, d, 0.75), t0, 0.22, pan=0.1, rev=0.5, dly=0.15)

    # outro: piano chord, bell motif, final bells
    for j, m in enumerate([34, 46, 58, 62, 65, 69]):
        place("keys", piano(m, 3.0, 0.85), bar_t(14) + 0.008 * j, 0.14, rev=0.5)
    for t0, m in [(bar_t(14) + bt(1), 81), (bar_t(14) + bt(1.5), 84), (bar_t(14) + bt(2), 89), (bar_t(14) + bt(3), 88), (bar_t(15), 84), (bar_t(15) + bt(1), 81)]:
        place("keys", bell(m, 0.55, 2.0), t0, 0.05, pan=0.2, rev=0.6, dly=0.25)
    for j, m in enumerate([41, 53, 60, 65, 69, 72, 77]):
        place("keys", piano(m, 30.0 - bt(62), 0.8), bt(62) + 0.01 * j, 0.13, rev=0.6)

    # sub bass on the roots
    for b, name in enumerate(BARS):
        if b < 2 or b in (8, 9, 10) and False:
            continue
        s, d = bar_t(b), BARL
        if b == 3:
            d = bt(3.75)
        if b == 11:
            d = bt(3.6)
        g = 0.14 if b < 4 else 0.3 if b in (4, 5, 12, 13) else 0.24 if b in (6, 7) else 0.12 if b < 11 else 0.2 if b == 11 else 0.32
        if b == 15:
            continue
        n = int(d * SR)
        tb = tt(n)
        env = np.minimum(1, tb / 0.02) * np.clip((d - tb) / 0.05, 0, 1) * (np.exp(-tb / 1.4) if b == 14 else 1)
        place("bass", np.sin(2 * np.pi * mtof(ROOT[name]) * tb) * env, s, g)
    n = int((30.0 - bt(62)) * SR)
    tb = tt(n)
    place("bass", np.sin(2 * np.pi * mtof(29) * tb) * np.minimum(1, tb / 0.02) * np.exp(-tb / 1.2), bt(62), 0.3)

    # build bass: 8ths, filter opening (bars 2-3, 11)
    for b in (2, 3, 11):
        f = mtof(ROOT[BARS[b]] + 12)
        for k in range(8):
            s = bar_t(b) + k * BARL / 8
            if (b == 3 and s >= bt(15.75)) or (b == 11 and s >= bt(47.6)):
                continue
            n = int(0.22 * SR)
            v = saw(f, n) + 0.5 * square(f, n)
            fc = (320 + (160 if b == 3 else 0) + 600 * k / 8) * (1 + 2.5 * np.exp(-tt(n) / 0.05))
            place("bass", tvf(v, fc, q=1.1) * adsr(0.19, 0.003, 0.08, 0.6, 0.03)[:n], s, 0.1)

    # drop bass: offbeat 16ths push
    for b in (4, 5, 6, 7, 12, 13):
        f = mtof(ROOT[BARS[b]] + 12)
        for s16 in (2, 3, 6, 7, 10, 11, 14, 15):
            s = bar_t(b) + s16 * BARL / 16
            n = int(0.13 * SR)
            v = saw(f, n) + 0.6 * square(f * 0.5, n)
            v = tvf(v, 350 + 2400 * np.exp(-tt(n) / 0.045), q=1.4) * adsr(0.1, 0.002, 0.06, 0.55, 0.03)[:n]
            place("bass", v, s, (0.14 if s16 % 4 == 2 else 0.1) * (0.8 if b in (6, 7) else 1))


def build_drums():
    # intro: heartbeat kicks under "Je suis Claude"
    for s in (bt(4), bt(5), bt(6), bt(7)):
        hit_kick(s, 0.24)
    for s in np.arange(bt(4) + bt(0.5), bt(8), B):
        place("drums", HC, s, 0.06, pan=-0.2)
    # build (bars 2-3)
    for s in np.arange(bt(8), bt(14), B):
        hit_kick(s, 0.5)
    for b in (2, 3):
        for off in (1, 3):
            if bar_t(b) + bt(off) < bt(14):
                place("drums", CL, bar_t(b) + bt(off), 0.2, rev=0.35)
    for s in np.arange(bt(8), bt(14), B / 4):
        acc = abs((s / B) % 1 - 0.5) < 1e-6
        place("drums", HC, s, 0.16 if acc else 0.08, pan=0.25 if acc else -0.15)
    # word burst: snare on every word, then 32nds, a 16th of silence before the drop
    roll = list(T_ for T_ in (bt(14), bt(14.5), bt(15), bt(15.5))) + list(np.arange(bt(15.5), bt(15.75), B / 8))
    for s in roll:
        u = (s - bt(14)) / bt(1.75)
        place("drums", SN, s, 0.06 + 0.12 * u, pan=0.1, rev=0.3)
    place("fx", riser(BARL, 300, 8000), bar_t(3), 0.11, rev=0.3)
    place("drums", rev_crash(1.0), bt(16) - 1.0, 0.16, rev=0.3)

    def drop(b0, b1, full=True):
        for s in np.arange(bar_t(b0), bar_t(b1), B):
            hit_kick(s, 0.7 if full else 0.6)
        for b in range(b0, b1):
            for off in (1, 3):
                place("drums", CL, bar_t(b) + bt(off), 0.32 if full else 0.24, rev=0.3)
                place("drums", SN, bar_t(b) + bt(off), 0.08, rev=0.2)
        for s in np.arange(bar_t(b0), bar_t(b1), B / 4):
            k = int(round((s / B) % 1 * 4)) % 4
            place("drums", HC, s, [0.06, 0.085, 0.14, 0.085][k], pan=-0.2 + 0.13 * k)
            if full:
                place("drums", shaker(), s + 0.004, 0.035, pan=0.4)
        for s in np.arange(bar_t(b0) + B / 2, bar_t(b1), B):
            place("drums", HO, s, 0.12 if full else 0.08, pan=0.15)
        place("drums", CR, bar_t(b0), 0.24, rev=0.3)

    drop(4, 6)
    drop(6, 8, full=False)
    for k, s in enumerate(np.arange(bar_t(5) + bt(3), bar_t(6), B / 4)):   # tom fill into bar 6
        place("drums", tom(170 - 20 * k), s, 0.22, pan=-0.4 + 0.25 * k, rev=0.3)
    n = int(1.8 * SR)   # down-lifters after each drop impact and into the breakdown
    for s in (bt(16), bt(32), bt(48)):
        place("fx", swept(1.8, 6000, 300, 1.2) * np.exp(-tt(n) / 0.6), s, 0.05, rev=0.3)
    # breakdown: a soft shaker in bar 9-10
    for s in np.arange(bar_t(9), bar_t(11), B / 2):
        place("drums", shaker(), s, 0.03 if (s / B) % 1 else 0.018, pan=0.35)
    # rebuild (bar 11): kicks on beats, 8ths, then 16ths; roll; a 16th of silence
    ks = list(np.arange(bt(44), bt(46), B)) + list(np.arange(bt(46), bt(47), B / 2)) + list(np.arange(bt(47), bt(47.75), B / 4))
    for j, s in enumerate(ks):
        hit_kick(s, 0.42 + 0.2 * (s - bt(44)) / bt(3.75))
    roll = list(np.arange(bt(46), bt(47), B / 2)) + list(np.arange(bt(47), bt(47.5), B / 4)) + list(np.arange(bt(47.5), bt(47.75), B / 8))
    for s in roll:
        place("drums", SN, s, 0.05 + 0.13 * (s - bt(46)) / bt(1.75), rev=0.3)
    place("drums", rev_crash(1.0), bt(48) - 1.0, 0.18, rev=0.3)
    drop(12, 14)
    for k, s in enumerate(np.arange(bar_t(13) + bt(2.5), bar_t(14), B / 4)):   # build into the flood
        place("drums", SN, s, 0.06 + 0.02 * k, rev=0.3)
    # outro: one big hit on the flood, then air
    hit_kick(bar_t(14), 0.8)
    place("drums", CR, bar_t(14), 0.26, rev=0.5)
    place("drums", CR, bt(62), 0.12, rev=0.6)


# ------------------------------------------------------------------ mix
def sidechain(depth, rel=0.13):
    t = tt(N)
    g = np.ones(N)
    for k in KICKS:
        i0, i1 = int(k * SR), min(N, int((k + 0.45) * SR))
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


def delay_ir(d=B * 0.75, fb=0.42, taps=7):
    n = int(d * (taps + 1) * SR)
    ir = np.zeros((2, n))
    for k in range(taps):
        ir[k % 2 ^ 1, int(d * (k + 1) * SR)] = fb ** k
    return ir


def glue(x, thr_db=-16, ratio=2.2, att=0.008, rel=0.15):
    lvl = np.abs(x).max(axis=0)
    a_c, r_c = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    fast = lfilter([1 - a_c], [1, -a_c], lvl)
    env = lfilter([1 - r_c], [1, -r_c], fast)
    db = 20 * np.log10(env + 1e-9)
    gr = -np.maximum(0, db - thr_db) * (1 - 1 / ratio)
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
    mix += fftconvolve(send_d, delay_ir(), axes=1)[:, :N] * 0.5
    ir = reverb_ir()
    wet = np.vstack([fftconvolve(SEND_REV[c], ir[c])[:N] for c in range(2)])
    mix += filt(wet, "high", 180) * 0.42
    mix = filt(mix, "high", 28)
    mix = peq(peq(peq(mix, 820, -2.5, 0.9), 3200, 1.5, 0.7), 60, 1.5, 0.8)
    mix = glue(mix)
    t = tt(N)
    mix *= np.clip((DUR - t) / 0.5, 0, 1)
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.25) / np.tanh(1.25) * 0.89
    write_wav(OUT / "mix_raw.wav", mix)
    for a, b, name in ((0, 3.75, "intro"), (3.75, 7.4, "build"), (7.5, 11.25, "drop 1"), (11.25, 15, "drop 1b"), (15, 20.6, "breakdown"),
                       (20.6, 22.4, "rebuild"), (22.5, 26.25, "drop 2"), (26.25, 30, "outro")):
        s = mix[:, int(a * SR): int(b * SR)]
        print(f"{name:10s} rms {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dB  peak {20 * np.log10(np.abs(s).max() + 1e-9):6.1f} dB")
