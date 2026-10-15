"""Synth library for claude-trailer: oscillators, instruments, drums, fx, mix tools.
Adapted from motion/claude-intro/audio.py (same pipeline). Imported by tools/audio.py."""
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 48000
rng = np.random.default_rng(7)

def tt(n):
    return np.arange(n) / SR


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def stereo(sig, pan=0.0):
    if sig.ndim == 2:
        return sig
    a = (pan + 1) * np.pi / 4
    return np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)

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
