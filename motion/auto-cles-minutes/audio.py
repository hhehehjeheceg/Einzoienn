"""Score + sound design for the Auto Clés Minutes film, 100 % synthesized (numpy + scipy).

A minor, 120 BPM (beat 0.5 s, bar 2 s), 30 s = 15 bars. Picture and sound share one
timeline: sound effects sit on the cues exported by the film (out/cues.json).

  bars 0-1   intro: dark drone, heartbeat, fob click, unlock chirps, pluck motif
  bars 2-3   groove: kick, synthwave 16th bass, hats             blade cut (milling)
  bars 4-5   claps, 16th hats, arp                               chip programming
  bar  6     snare on every brand word, riser                    brands
  bar  7     engine rev to the limiter, roll, breath             tach
  bars 8-11  DROP: gated supersaw, hook lead, sidechain          wordmark, proof
  bar  12    E chord, hook echo, roll into the final             map, pin
  bars 13-14 deceptive cadence E -> F (26 s), resolve on C       lockup

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
    f0 = mtof([69, 72, 76, 79, 81, 84][i % 6])
    f = f0 * (1 + 0.9 * (1 - np.exp(-t / 0.02)))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * np.minimum(1, t / 0.002)


def s_tick(i):
    n = int(0.06 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * (2300 + 90 * (i % 5)) * t) * np.exp(-t / 0.01) + filt(noise(n), "high", 4000) * np.exp(-t / 0.003) * 0.3


def s_tok(i):
    n = int(0.5 * SR)
    t = tt(n)
    f = mtof([69, 72, 76, 81][i % 4])
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
    tone = np.sin(2 * np.pi * mtof([81, 84, 88, 86, 91, 93][i % 6]) * t) * np.exp(-t / 0.06) * 0.22
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



# ------------------------------------------------------------------ sound design specific to this film
def beep(f, dur, vel=1.0):
    """Car-lock chirp: bright square pair, soft edges."""
    n = int(dur * SR)
    t = tt(n)
    v = filt(square(f, n) + 0.5 * square(f * 1.5, n), "low", 6000)
    e = np.minimum(1, t / 0.004) * np.clip((dur - t) / 0.012, 0, 1)
    return v * e * vel


def s_click():
    n = int(0.08 * SR)
    t = tt(n)
    v = filt(noise(n), "bp", (1500, 6000)) * np.exp(-t / 0.004)
    return v + np.sin(2 * np.pi * 1100 * t) * np.exp(-t / 0.01) * 0.5


def s_radio(dur=0.32):
    n = int(dur * SR)
    t = tt(n)
    f = 1900 + 900 * np.sign(np.sin(2 * np.pi * 26 * t)) + 300 * np.sin(2 * np.pi * 7 * t)
    v = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return v * np.minimum(1, t / 0.01) * np.clip((dur - t) / 0.08, 0, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 52 * t) ** 2)


def s_metal(dur=0.6):
    n = int(dur * SR)
    t = tt(n)
    v = sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / d)
            for f, a, d in ((2140, 1.0, 0.18), (3470, 0.7, 0.12), (4930, 0.5, 0.09), (6610, 0.35, 0.06), (8350, 0.2, 0.04)))
    return v * np.minimum(1, t / 0.001)


def s_flip():
    n = int(0.6 * SR)
    t = tt(n)
    snap = filt(noise(n), "bp", (2000, 9000)) * np.exp(-t / 0.006)
    thump = np.sin(2 * np.pi * (90 + 120 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.05)
    return snap * 0.9 + thump * 0.7 + s_metal(0.6) * 0.35


def s_slide(dur):
    n = int(dur * SR)
    t = tt(n)
    p = np.linspace(0, 1, n)
    v = filt(noise(n), "bp", (2500, 9000)) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * t) ** 2)
    return v * np.sin(np.pi * p) ** 0.6


def s_grind(dur):
    n = int(dur * SR)
    t = tt(n)
    p = np.linspace(0, 1, n)
    body = filt(noise(n), "bp", (1800, 7500)) * (0.55 + 0.45 * np.sin(2 * np.pi * 118 * t) ** 2)
    whine = sum(a * np.sin(2 * np.pi * f * (1 + 0.012 * np.sin(2 * np.pi * 3.3 * t)) * t) for f, a in ((2960, 0.35), (5920, 0.15), (1480, 0.12)))
    crack = np.zeros(n)
    for _ in range(int(dur * 70)):
        i = int(rng.random() * (n - 400))
        crack[i:i + 400] += filt(noise(400), "high", 5000) * np.exp(-tt(400) / 0.0015) * (0.5 + rng.random())
    env = np.minimum(1, t / 0.06) * np.clip((dur - t) / 0.08, 0, 1) * (0.85 + 0.15 * np.sin(2 * np.pi * 1.7 * t))
    return (body * 0.8 + whine + crack * 0.6) * env


def s_data(i):
    out = np.zeros(int(0.4 * SR))
    scale = [81, 84, 88, 91, 93, 96]
    for k in range(4):
        m = scale[int(hashf(i, k) * len(scale))]
        n = int(0.045 * SR)
        tb = tt(n)
        b = filt(square(mtof(m), n), "low", 7000) * np.minimum(1, tb / 0.002) * np.exp(-tb / 0.02)
        o = int(k * 0.0625 * SR)
        out[o:o + n] += b * (1 - 0.15 * k)
    return out


def hashf(a, b):
    x = np.sin(a * 127.1 + b * 311.7) * 43758.5453
    return x - np.floor(x)


def s_rev(dur):
    """Engine revving to the limiter: firing frequency climbs, then the limiter chops it."""
    n = int(dur * SR)
    t = tt(n)
    p = t / dur
    climb = np.clip(p / 0.7, 0, 1) ** 0.85
    f = 38 + 150 * climb
    lim = p > 0.7
    f = np.where(lim, 186 + 10 * np.sin(2 * np.pi * 17 * t), f)
    ph = np.cumsum(f) / SR
    v = (2 * (ph % 1) - 1) + 0.6 * (2 * ((2 * ph) % 1) - 1) + 0.35 * np.sin(2 * np.pi * 4 * ph)
    v += filt(noise(n), "low", 1200) * 0.5 * (0.5 + 0.5 * np.sin(2 * np.pi * ph))
    v = np.tanh(2.2 * v)
    v = tvf(v, 260 + 22 * f, q=1.2)
    amp = np.minimum(1, t / 0.05) * (0.55 + 0.45 * climb)
    amp = np.where(lim, amp * (0.35 + 0.65 * (np.sin(2 * np.pi * 17 * t) > -0.2)), amp)
    return v * amp * np.clip((dur - t) / 0.03, 0, 1)


def s_whistle(dur, f0=1800, f1=600):
    n = int(dur * SR)
    t = tt(n)
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur)


def s_thud():
    n = int(0.6 * SR)
    t = tt(n)
    f = 52 + 90 * np.exp(-t / 0.03)
    return np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)) + filt(noise(n), "bp", (200, 1500)) * np.exp(-t / 0.03) * 0.4


def s_keyturn():
    out = np.zeros(int(0.7 * SR))
    for o, g in ((0, 1.0), (0.075, 0.8)):
        c = s_click() * g
        i = int(o * SR)
        out[i:i + len(c)] += c
    m = s_metal(0.5) * 0.25
    out[: len(m)] += m
    return out


def s_gauge(dur):
    out = np.zeros(int((dur + 0.1) * SR))
    for k in range(20):
        o = dur * (k / 20) ** 0.8
        c = s_tick(k) * (0.5 + 0.5 * k / 20)
        i = int(o * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


def build_sfx(cues):
    for c in cues:
        k, t, i, soft = c["k"], c["t"], c.get("i", 0), c.get("soft", 0)
        g = 0.55 if soft else 1.0
        d = c.get("d", 0.4)
        if k == "sweep":
            place("fx", whoosh(d, 300, 2400, 0.6), t, 0.05, rev=0.5)
        elif k == "click":
            place("fx", s_click(), t, 0.22, pan=-0.1)
        elif k == "radio":
            place("fx", s_radio(), t, 0.035, pan=-0.2, rev=0.4, dly=0.3)
        elif k == "chirp":
            place("fx", beep(2350, 0.105), t, 0.07, pan=-0.6, rev=0.35)
            place("fx", beep(2350, 0.105), t + 0.012, 0.07, pan=0.6, rev=0.35)
        elif k == "key":
            place("fx", s_keyturn(), t, 0.2, rev=0.3)
        elif k == "type":
            place("fx", s_key(i), t, 0.12 * (0.85 + 0.3 * ((i * 37) % 7) / 7), pan=0.1 * ((i % 3) - 1))
        elif k == "pop":
            place("fx", s_pop(i), t, 0.11 * g, pan=0.25 * np.sin(i * 1.7), rev=0.25)
        elif k == "chip":
            place("fx", s_pop(i + 2), t, 0.09, pan=0.35, rev=0.25)
            place("fx", whoosh(0.25, 1500, 5000, 0.3), t - 0.05, 0.05, pan=0.4)
        elif k == "tick":
            place("fx", s_tick(i), t, 0.06 * g, pan=0.2 * np.sin(i * 2.3), rev=0.2)
        elif k in ("swoosh", "rise"):
            dd = 0.42 if k == "swoosh" else 0.32
            place("fx", whoosh(dd, 700, 4200 if k == "swoosh" else 2600), t - dd * 0.45, 0.10 if k == "swoosh" else 0.07, rev=0.3)
        elif k == "swish":
            place("fx", whoosh(0.3, 1500, 6000, 0.35), t, 0.07, rev=0.2)
        elif k == "zoom":
            place("fx", whoosh(d + 0.1, 300, 5000, 0.85), t, 0.12, rev=0.3)
        elif k == "flip":
            place("fx", s_flip(), t, 0.3, pan=0.25, rev=0.3)
        elif k == "slide":
            place("fx", s_slide(d), t, 0.05, pan=0.5)
        elif k == "grind":
            place("fx", s_grind(d), t, 0.07, pan=0.15, rev=0.15)
        elif k == "ding":
            place("fx", bell(88, 0.7) + 0.5 * bell(93, 0.4), t, 0.07, rev=0.5, dly=0.25)
        elif k == "shimmer":
            place("fx", s_shimmer(), t, 0.04 * g, pan=0.15, rev=0.6)
        elif k == "scan":
            place("fx", s_scan(d), t, 0.05, pan=0.3 if i == 0 else -0.3)
        elif k == "data":
            place("fx", s_data(i), t, 0.035, pan=0.4 * np.sin(i * 1.3), rev=0.3, dly=0.2)
        elif k == "success":
            for j, m in enumerate((76, 81, 84, 88)):
                place("fx", bell(m, 0.6, 2.2), t + 0.045 * j, 0.06, pan=-0.3 + 0.2 * j, rev=0.55)
            place("fx", s_shimmer(), t + 0.05, 0.03, rev=0.6)
        elif k == "suck":
            place("fx", s_suck(d), t, 0.16, rev=0.2)
        elif k == "hit":
            place("fx", s_hit(i), t, 0.30, pan=0.18 * (1 if i % 2 else -1), rev=0.15)
        elif k == "impact":
            place("fx", impact(0.8), t, 0.3 if i == 0 else 0.26, rev=0.4)
        elif k == "boom":
            place("fx", impact(1.4), t, 0.6 if i == 0 else 0.55, rev=0.6)
        elif k == "dive":
            place("fx", s_dive(d), t, 0.16, rev=0.3)
        elif k == "whoosh":
            v = whoosh(d + 0.2, 400, 3800, 0.5)
            pan = np.linspace(-0.7, 0.7, len(v)) * c.get("pan", 1)
            st = np.vstack([v * np.cos((pan + 1) * np.pi / 4), v * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)
            place("fx", st, t - 0.05, 0.14, rev=0.25)
        elif k == "warp":
            n = int(d * SR)
            place("fx", swept(d, 7000, 250, 1.2) * np.exp(-tt(n) / 0.7), t, 0.08, rev=0.35)
        elif k == "chime":
            place("fx", bell([81, 84, 88][i % 3], 0.6, 1.8), t, 0.06, rev=0.5)
        elif k == "riser":
            place("fx", riser(d, 500, 8000), t, 0.14, rev=0.3)
        elif k == "rev":
            place("fx", s_rev(d), t, 0.3, rev=0.12)
        elif k == "drop":
            place("fx", s_whistle(d), t, 0.025, rev=0.3)
        elif k == "thud":
            place("fx", s_thud(), t, 0.35, rev=0.3)
        elif k == "gauge":
            place("fx", s_gauge(d), t, 0.8, pan=0.2, rev=0.3)


# ------------------------------------------------------------------ harmony (A minor, 120 BPM, bar = 2 s)
V = {
    "Am": [45, 52, 57, 60, 64], "F": [41, 48, 53, 57, 60], "C": [48, 52, 55, 60, 64],
    "G": [43, 50, 55, 59, 62], "E": [40, 47, 52, 56, 59],
}
ROOT = {"Am": 33, "F": 29, "C": 36, "G": 31, "E": 28}
BARS = ["Am", "Am", "F", "G", "Am", "F", "C", "E", "Am", "F", "C", "G", "E", "F", "C"]
HOOK = [  # (bar offset from 16 s, 8th step, midi, length in 8ths)
    (0, 0, 76, 2), (0, 2, 74, 1), (0, 3, 72, 1), (0, 4, 74, 2), (0, 6, 76, 2),
    (1, 0, 77, 2), (1, 2, 76, 1), (1, 3, 74, 1), (1, 4, 72, 3), (1, 7, 69, 1),
    (2, 0, 72, 1), (2, 1, 74, 1), (2, 2, 76, 2), (2, 4, 79, 2), (2, 6, 76, 2),
    (3, 0, 74, 2), (3, 2, 71, 1), (3, 3, 74, 1), (3, 4, 79, 3), (3, 7, 80, 1),
]


def bar_t(b):
    return b * 2.0


def arp_tones(name):
    v = V[name]
    return [m + 12 for m in v[1:]] + [v[1] + 24]


def build_music():
    # air + dark drone for the intro
    n = int(4.5 * SR)
    air = filt(noise(n), "bp", (300, 5000)) * np.minimum(1, tt(n) / 1.0) * np.clip((4.5 - tt(n)) / 1.5, 0, 1)
    place("pads", stereo(air, 0.0), 0.0, 0.012)
    n = int(4.2 * SR)
    drone = (saw(mtof(33), n) + saw(mtof(45) * 1.003, n)) * 0.5
    drone = tvf(drone, np.geomspace(180, 900, n), q=1.3) * np.minimum(1, tt(n) / 0.8) * np.clip((4.2 - tt(n)) / 0.4, 0, 1)
    place("bass", stereo(drone), 0.0, 0.10)

    # pads
    for b, name in enumerate(BARS):
        s = bar_t(b)
        if b <= 1:
            place("pads", pad_chord(V[name], 2.15, [600, 900][b]), s - 0.05, 0.34, rev=0.5)
        elif b <= 6:
            place("pads", pad_chord(V[name], 2.15, [1000, 1250, 1500, 1800, 2300][b - 2]), s - 0.05, 0.3, rev=0.45)
        elif b == 7:
            place("pads", pad_chord(V[name], 1.65, 0, sweep=(1500, 9000), rel=0.1), s - 0.05, 0.3, rev=0.4)
        elif 8 <= b <= 11:
            place("pads", pad_chord(V[name], 2.1, 2600), s, 0.13, rev=0.3)
        elif b == 12:
            place("pads", pad_chord(V[name], 1.9, 0, sweep=(1200, 8000), rel=0.1), s, 0.26, rev=0.4)
            place("pads", choir([m + 12 for m in V[name][1:4]], 1.85, rel=0.15), s, 0.6, rev=0.5)

    # gated supersaw chords in the drop
    gate = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]
    for b in range(8, 12):
        name = BARS[b]
        n = int(2.0 * SR)
        ch = sum(supersaw(mtof(m + 12), n, det=0.2) for m in V[name][1:]) / 3.0
        g = np.zeros(n)
        st = int(0.125 * SR)
        tb = tt(st)
        for k, on in enumerate(gate):
            if on:
                g[k * st:(k + 1) * st] = np.minimum(1, tb / 0.003) * (0.55 + 0.45 * np.exp(-tb / 0.05)) * np.clip((0.125 - tb) / 0.015, 0, 1)
        ch = filt(ch * g, "low", 6500 if b >= 10 else 5000)
        place("pads", ch, bar_t(b), 1.3, rev=0.25, dly=0.12)

    # final: deceptive cadence E -> F (26 s), then C (28 s)
    n = int(2.4 * SR)
    big = sum(supersaw(mtof(m), n, det=0.22) for m in V["F"] + [72, 77, 81]) / 4.0
    big = tvf(big, np.geomspace(9000, 1200, n), q=0.8) * np.exp(-tt(n) / 1.4) * np.minimum(1, tt(n) / 0.004)
    place("pads", big * np.clip((2.4 - tt(n)) / 0.4, 0, 1), 26.0, 1.0, rev=0.5)
    place("pads", pad_chord(V["F"], 1.95, 1800, att=0.05, rel=0.3), 26.0, 0.3, rev=0.6)
    place("pads", pad_chord(V["C"] + [67, 72], 2.0, 2200, att=0.2, rel=1.2), 28.0, 0.32, rev=0.6)
    place("pads", choir([64, 67, 72], 2.0, att=0.3, rel=1.0), 28.0, 0.5, rev=0.6)

    # pluck motif in the intro (from the question on screen), then 16th arp
    for k, m in enumerate([69, 72, 76, 81, 76, 72, 69, 72]):
        place("keys", pluck(m, 0.6, 0.9), 2.0 + k * 0.25, 0.05, pan=0.4 if k % 2 else -0.4, rev=0.4, dly=0.25)
    for b in range(2, 13):
        tones = arp_tones(BARS[b])
        pat = [0, 1, 2, 3, 4, 3, 2, 1]
        step = 0.25 if b < 4 else 0.125
        for k in range(int(2.0 / step)):
            s = bar_t(b) + k * step
            if 15.0 <= s < 16.0:
                continue
            m = tones[pat[k % 8]]
            gg = 0.04 if b < 4 else 0.045 + 0.008 * (b - 4) if b < 8 else 0.055 if b < 12 else 0.045
            place("keys", pluck(m, 0.7, 1.3 if b >= 8 else 1.0), s, gg, pan=0.45 if k % 2 else -0.45, rev=0.3, dly=0.15)

    # hook lead (drop)
    for bo, st_, m, ln in HOOK:
        s = 16.0 + bo * 2.0 + st_ * 0.25
        place("lead", lead(m, ln * 0.25 - 0.02), s, 0.5, rev=0.25, dly=0.32)
        place("lead", lead(m - 12, ln * 0.25 - 0.02, 0.5), s, 0.2, rev=0.2)
    # echo of the hook on bar 12 (E), softer, then the final bells
    for st_, m in ((0, 76), (2, 80), (4, 83), (6, 88)):
        place("lead", lead(m, 0.4, 0.5), 24.0 + st_ * 0.25, 0.22, rev=0.4, dly=0.35)
    for t0, m in [(26.0, 81), (26.5, 84), (27.0, 89), (27.5, 88), (28.0, 84), (28.5, 79), (29.0, 76)]:
        place("keys", bell(m, 0.6, 2.2), t0, 0.06, pan=0.2, rev=0.6, dly=0.25)
    for j, m in enumerate([29, 41, 48, 53, 57, 60]):
        place("keys", piano(m, 1.9, 0.9), 26.0 + 0.008 * j, 0.14, rev=0.5)
    for j, m in enumerate([36, 48, 55, 60, 64, 67, 72]):
        place("keys", piano(m, 2.0, 0.75), 28.0 + 0.01 * j, 0.13, rev=0.55)

    # sub bass on the root
    for b, name in enumerate(BARS):
        if b < 2:
            continue
        s = bar_t(b)
        f = mtof(ROOT[name])
        d = 2.0
        if b == 7:
            d = 1.0   # stops for the engine rev and the breath
        if b >= 13:
            d = 2.0
        n = int(d * SR)
        tb = tt(n)
        env = np.minimum(1, tb / 0.02) * np.clip((d - tb) / 0.05, 0, 1)
        if b >= 13:
            env *= np.exp(-tb / 1.4)
        gsub = 0.13 if b < 4 else 0.22 if b < 8 else 0.30 if b < 12 else 0.24
        if b == 13:
            gsub = 0.38
        place("bass", np.sin(2 * np.pi * f * tb) * env, s, gsub)

    # synthwave 16th bass in the groove (bars 2-6), filter opening
    for b in range(2, 8):
        f = mtof(ROOT[BARS[b]] + 12)
        for k in range(16):
            s = bar_t(b) + k * 0.125
            if s >= 15.0:
                continue
            oct_ = 2 if k % 4 == 2 else 1
            n = int(0.12 * SR)
            v = saw(f * oct_, n) + 0.5 * square(f * oct_ * 0.5, n)
            fc = (260 + 110 * (b - 2) + 60 * (k % 4)) * (1 + 2.6 * np.exp(-tt(n) / 0.035))
            v = tvf(v, fc, q=1.3) * adsr(0.1, 0.002, 0.05, 0.5, 0.025)[:n]
            place("bass", v, s, 0.07 if b < 4 else 0.085)

    # drop bass: offbeat 8ths + a 16th push
    for b in range(8, 13):
        f = mtof(ROOT[BARS[b]] + 12)
        for s16 in (2, 3, 6, 7, 10, 11, 14, 15):
            s = bar_t(b) + s16 * 0.125
            if s >= 25.0:
                continue
            n = int(0.14 * SR)
            v = saw(f, n) + 0.6 * square(f * 0.5, n)
            fc = 350 + 2200 * np.exp(-tt(n) / 0.045)
            v = tvf(v, fc, q=1.4) * adsr(0.11, 0.002, 0.06, 0.55, 0.03)[:n]
            place("bass", v, s, 0.14 if s16 % 4 == 2 else 0.10)


def build_drums():
    # heartbeat in the intro
    for s in (0.5, 0.75, 2.5, 2.75):
        place("kick", kick(0.25, 0.2), s, 0.16 if s % 1 == 0.5 else 0.1)
    # groove (bars 2-3): kick + offbeat hats
    for s in np.arange(4.0, 8.0, 0.5):
        hit_kick(s, 0.42)
    for s in np.arange(4.25, 8.0, 0.5):
        place("drums", HC, s, 0.1, pan=-0.2)
    for s in np.arange(4.0, 8.0, 0.25):
        place("drums", shaker(), s, 0.04 if (s % 0.5) else 0.022, pan=0.3)
    # bars 4-6: claps, 16th hats
    place("drums", CR, 8.0, 0.14, rev=0.3)
    for s in np.arange(8.0, 15.0, 0.5):
        hit_kick(s, 0.55)
    for b in range(4, 7):
        for off in (0.5, 1.5):
            place("drums", CL, bar_t(b) + off, 0.22, rev=0.35)
    for s in np.arange(8.0, 15.0, 0.125):
        acc = (s % 0.5) == 0.25
        place("drums", HC, s, 0.17 if acc else 0.09, pan=0.25 if acc else -0.15)
    for s in np.arange(12.25, 15.0, 0.5):
        place("drums", HO, s, 0.09, pan=0.3)
    # brand words: snare on every word
    for s in (12.0, 12.5, 13.0, 13.5, 14.0, 14.5):
        place("drums", SN, s, 0.12 + 0.02 * (s - 12), rev=0.35)
    # rev section: snare roll into the breath
    roll = list(np.arange(15.0, 15.375, 0.125)) + list(np.arange(15.375, 15.625, 0.0625)) + list(np.arange(15.625, 15.75, 0.03125))
    for s in roll:
        place("drums", SN, s, 0.05 + 0.12 * (s - 15.0) / 0.75, pan=0.1, rev=0.3)
    place("fx", riser(1.75, 300, 8000), 14.0, 0.12, rev=0.3)
    place("drums", rev_crash(0.95), 14.8, 0.16, rev=0.3)
    # drop (bars 8-11) + bar 12 until the pin
    for s in np.arange(16.0, 25.0, 0.5):
        hit_kick(s, 0.68)
    for b in range(8, 13):
        for off in (0.5, 1.5):
            s = bar_t(b) + off
            if s < 25.0:
                place("drums", CL, s, 0.32, rev=0.3)
                place("drums", SN, s, 0.08, rev=0.2)
    for s in np.arange(16.0, 25.0, 0.125):
        k = round((s % 0.5) / 0.125)
        place("drums", HC, s, [0.065, 0.09, 0.15, 0.09][k], pan=-0.2 + 0.13 * k)
        place("drums", shaker(), s + 0.004, 0.035, pan=0.4)
    for s in np.arange(16.25, 25.0, 0.5):
        place("drums", HO, s, 0.13, pan=0.15)
    for s, g in ((16.0, 0.26), (20.0, 0.16), (24.0, 0.14)):
        place("drums", CR, s, g, rev=0.3)
    for k, s in enumerate(np.arange(19.5, 20.0, 0.125)):
        place("drums", tom(170 - 20 * k), s, 0.25, pan=-0.4 + 0.25 * k, rev=0.3)
    n = int(1.8 * SR)
    place("fx", swept(1.8, 6000, 300, 1.2) * np.exp(-tt(n) / 0.6), 16.0, 0.06, rev=0.3)
    # dive into the final hit
    roll = list(np.arange(25.0, 25.5, 0.125)) + list(np.arange(25.5, 25.75, 0.0625)) + list(np.arange(25.75, 25.95, 0.03125))
    for s in roll:
        place("drums", SN, s, 0.04 + 0.13 * (s - 25.0) / 0.95, rev=0.3)
    place("fx", riser(1.0, 400, 9000), 25.0, 0.12, rev=0.3)
    place("drums", rev_crash(0.9), 25.1, 0.16, rev=0.3)
    # final hit + a soft pulse under the lockup
    hit_kick(26.0, 0.85)
    place("drums", CR, 26.0, 0.28, rev=0.5)
    place("drums", CL, 26.0, 0.2, rev=0.6)
    for s in (27.0, 28.0):
        hit_kick(s, 0.3)
    hit_kick(28.0, 0.5)
    place("drums", CR, 28.0, 0.12, rev=0.5)
    for s in np.arange(28.0, 29.5, 0.25):
        place("drums", shaker(), s, 0.025 * (1 - (s - 28) / 1.6), pan=0.3)


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
    fast = lfilter([1 - a_c], [1, -a_c], lvl)
    env = lfilter([1 - r_c], [1, -r_c], fast)
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
           + BUS["lead"] * sc_soft + BUS["keys"] * sc_soft)
    send_d = filt(filt(SEND_DLY, "high", 350), "low", 5000)
    mix += fftconvolve(send_d, delay_ir(), axes=1)[:, :N] * 0.55
    ir = reverb_ir()
    wet = np.vstack([fftconvolve(SEND_REV[c], ir[c])[:N] for c in range(2)])
    mix += filt(wet, "high", 180) * 0.42

    # the breath before the drop: everything but the tail of the engine goes quiet
    t = tt(N)
    breath = 1 - 0.85 * np.clip((t - 15.74) / 0.04, 0, 1) * np.clip((16.0 - t) / 0.01, 0, 1)
    mix = mix * breath + BUS["fx"]
    mix = filt(mix, "high", 28)
    mix = peq(peq(mix, 820, -2.5, 0.9), 3200, 1.5, 0.7)
    mix = glue(mix)
    mix *= np.clip((DUR - t) / 0.7, 0, 1)
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.25) / np.tanh(1.25) * 0.89
    write_wav(OUT / "mix_raw.wav", mix)
    for a, b, name in ((0, 4, "intro"), (4, 8, "groove"), (8, 12, "chip"), (12, 15, "brands"), (15, 16, "rev"),
                       (16, 24, "drop"), (24, 26, "map"), (26, 30, "final")):
        s = mix[:, int(a * SR): int(b * SR)]
        print(f"{name:8s} rms {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dB  peak {20 * np.log10(np.abs(s).max() + 1e-9):6.1f} dB")
