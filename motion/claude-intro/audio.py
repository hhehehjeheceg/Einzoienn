"""Music + sound design for claude-intro, 100 % synthesized (numpy only).

120 BPM (beat 0.5 s, bar 2 s). Drop on 12.0 s, the clay flood. Sound effects are
placed on the cues exported by the film itself (out/cues.json), so picture and
sound share one timeline. Output: out/mix_raw.wav (float), normalised later by ffmpeg.
"""
import json
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
OUT = HERE / "out"
SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

music = np.zeros((2, N))
sfx = np.zeros((2, N))
send = np.zeros((2, N))  # reverb send


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def place(buf, sig, start, gain=1.0, pan=0.0, rev=0.0):
    """Add a mono or stereo signal at `start` seconds with equal-power pan."""
    i0 = int(round(start * SR))
    if i0 >= N:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(sig.shape[1] - j0, N - i0)
    if n <= 0:
        return
    buf[:, i0:i0 + n] += sig[:, j0:j0 + n] * gain
    if rev:
        send[:, i0:i0 + n] += sig[:, j0:j0 + n] * gain * rev


def filt(x, lo=None, hi=None, order=2):
    """Butterworth-shaped magnitude filter in the frequency domain."""
    n = x.shape[-1]
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR) + 1e-9
    g = np.ones_like(f)
    if hi:
        g /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        g *= (f / lo) ** order / np.sqrt(1 + (f / lo) ** (2 * order))
    return np.fft.irfft(X * g, n)


def noise(n):
    return rng.standard_normal(n)


def swept_noise(dur, f0, f1, bands=8, q=0.7, curve=None):
    """Noise whose band centre glides from f0 to f1 (crossfaded band-passes)."""
    n = int(dur * SR)
    base = noise(n)
    centres = np.geomspace(f0, f1, bands)
    p = np.linspace(0, 1, n) if curve is None else curve
    pos = p * (bands - 1)
    out = np.zeros(n)
    for k, c in enumerate(centres):
        w = np.clip(1 - np.abs(pos - k), 0, 1)
        if w.max() == 0:
            continue
        out += filt(base, lo=c * q, hi=c / q) * w
    return out / (np.abs(out).max() + 1e-9)


def env_ar(n, a, r_tau):
    t = tt(n)
    e = np.exp(-t / r_tau)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


# ------------------------------------------------------------------ harmony
CH = {
    "D": [50, 57, 61, 64, 66], "Bm": [47, 54, 57, 61, 62], "G": [43, 50, 54, 57, 59],
    "A": [45, 52, 57, 61, 64], "Asus": [45, 52, 57, 59, 62],
}
ROOT = {"D": 38, "Bm": 35, "G": 31, "A": 33, "Asus": 33}
BARS = ["D", "Bm", "G", "A", "Bm", "Asus", "D", "Bm", "G", "A", "D", "Bm", "G", "D", "D"]
BEATS = np.arange(0, DUR, 0.5)


def duck_curve():
    """Sidechain pump after the drop: dips on every kick."""
    t = tt(N)
    d = np.ones(N)
    for b in BEATS:
        if 12.0 <= b < 21.0:
            m = (t >= b) & (t < b + 0.5)
            d[m] *= 1 - 0.55 * np.exp(-(t[m] - b) / 0.11)
    return d


def pad_bar(notes, dur, bright):
    n = int(dur * SR)
    t = tt(n)
    out = np.zeros((2, n))
    for m in notes:
        for det, pan in ((-9, -0.55), (0, 0.0), (9, 0.55)):
            f = mtof(m) * 2 ** (det / 1200)
            v = np.zeros(n)
            ph = rng.uniform(0, 2 * np.pi)
            for h in range(1, 13):
                fh = f * h
                if fh > 9000:
                    break
                v += np.sin(2 * np.pi * fh * t + ph * h) / h / (1 + (fh / bright) ** 2)
            a = (pan + 1) * np.pi / 4
            out[0] += v * np.cos(a)
            out[1] += v * np.sin(a)
    att, rel = 0.45, 1.1
    e = np.ones(n)
    na = int(att * SR)
    e[:na] = np.linspace(0, 1, na) ** 1.5
    nr = int(rel * SR)
    e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return out * e / len(notes)


def pluck(f, dur=0.6, bright=1.0):
    n = int(dur * SR)
    t = tt(n)
    v = np.zeros(n)
    for h in range(1, 9):
        v += np.sin(2 * np.pi * f * h * t) / h ** 1.3 * np.exp(-t / (0.32 / h ** (0.9 / bright)))
    v *= np.minimum(1, t / 0.003)
    return v


def kick():
    n = int(0.6 * SR)
    t = tt(n)
    f = 46 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    v = np.sin(ph) * np.exp(-t / 0.3)
    v[: int(0.004 * SR)] += filt(noise(int(0.004 * SR)), lo=1500) * 0.3
    return v


def clap():
    n = int(0.4 * SR)
    t = tt(n)
    nz = filt(noise(n), lo=900, hi=3200)
    e = np.zeros(n)
    for k, o in enumerate((0, 0.011, 0.022)):
        m = t >= o
        e[m] += np.exp(-(t[m] - o) / (0.008 if k < 2 else 0.14))
    return nz * e


def hat(dec=0.03):
    n = int(0.15 * SR)
    return filt(noise(n), lo=7000, order=3) * np.exp(-tt(n) / dec)


def build_music():
    duck = duck_curve()
    padbus = np.zeros((2, N))
    for b, name in enumerate(BARS):
        start = b * 2.0
        bright = 700 if start < 4 else 1100 if start < 8 else 1600 if start < 12 else 2600 if start < 22 else 1400
        dur = 3.3 if b < len(BARS) - 1 else 2.0
        g = 0.21 if start < 8 else 0.17 if start < 12 else 0.17 if start < 22 else 0.15
        if b == 13:
            dur, g = 4.0, 0.2
        if b == 14:
            continue
        place(padbus, pad_bar(CH[name], dur, bright), start - 0.15, g, rev=0.5)
    # final chord fades out with the film
    t = tt(N)
    padbus *= np.where(t > 27.5, np.clip(1 - (t - 27.5) / 2.6, 0, 1) ** 1.5, 1)
    padbus *= np.where((t > 12.0) & (t < 21.9), duck, 1)
    music[:, :] += padbus

    # sub bass
    for b, name in enumerate(BARS):
        start = b * 2.0
        f = mtof(ROOT[name])
        if 8.0 <= start < 12.0:
            n = int(2.0 * SR)
            tb = tt(n)
            v = np.sin(2 * np.pi * f * tb) * np.minimum(1, tb / 0.2) * np.exp(-tb / 2.5)
            place(music, v, start, 0.16)
        elif 12.0 <= start < 22.0:
            for k in range(4):
                for off in (0.0, 0.25):
                    s = start + k * 0.5 + off
                    if s >= 21.9:
                        continue
                    n = int(0.24 * SR)
                    tb = tt(n)
                    v = (np.sin(2 * np.pi * f * tb) + 0.25 * np.sin(4 * np.pi * f * tb)) * np.minimum(1, tb / 0.008) * np.exp(-tb / 0.2)
                    place(music, v, s, 0.22 if off else 0.14)
        elif start >= 22.0:
            n = int((4.0 if start == 26.0 else 2.0) * SR)
            tb = tt(n)
            v = np.sin(2 * np.pi * f * tb) * np.minimum(1, tb / 0.4) * np.exp(-tb / 3.0)
            place(music, v, start, 0.12 if start < 26 else 0.2)

    # arpeggio (16ths)
    for i, s in enumerate(np.arange(4.0, 26.0, 0.125)):
        if 11.9 <= s < 12.0 or 21.75 <= s < 22.0:
            continue
        if s < 8.0 and i % 2:
            continue
        name = BARS[int(s // 2)]
        tones = CH[name][1:] + [CH[name][1] + 12]
        pat = [0, 1, 2, 3, 4, 3, 2, 1]
        m = tones[pat[i % 8]] + 12
        g = 0.035 if s < 8 else 0.035 + 0.03 * (s - 8) / 4 if s < 12 else 0.07 if s < 22 else 0.04
        pan = 0.45 if i % 2 else -0.45
        place(music, pluck(mtof(m), bright=1.4 if 12 <= s < 22 else 1.0), s, g, pan=pan, rev=0.35)

    # drums
    k = kick()
    for b in BEATS:
        if 12.0 <= b < 21.0:
            place(music, k, b, 0.55)
    for b in BEATS:
        if 12.0 <= b < 21.0 and (b % 2.0) in (0.5, 1.5):
            place(music, clap(), b, 0.16, rev=0.4)
    for s in np.arange(6.0, 21.0, 0.25):
        if 11.9 <= s < 12.0:
            continue
        off = (s % 0.5) == 0.25
        if s < 10.0:
            if off:
                place(music, hat(), s, 0.035, pan=0.3)
        elif s < 12.0:
            place(music, hat(), s, 0.02 + 0.03 * (s - 10) / 2, pan=0.3 if off else -0.2)
        else:
            place(music, hat(0.06 if off else 0.025), s, 0.06 if off else 0.03, pan=0.25 if off else -0.25)
    # snare roll into the drop
    hits = list(np.arange(11.0, 11.5, 0.125)) + list(np.arange(11.5, 11.75, 0.0625)) + list(np.arange(11.75, 11.9, 0.03125))
    for h in hits:
        place(music, clap(), h, 0.05 + 0.11 * (h - 11.0) / 0.9, rev=0.3)
    # pre-drop breath: everything holds its breath for the last 80 ms before the flood
    t = tt(N)
    m = (t >= 11.86) & (t < 12.0)
    g = np.ones(N)
    g[m] = np.interp(t[m], [11.86, 11.91, 12.0], [1, 0.08, 0.08])
    music[:, :] *= g
    # crash on the drop
    n = int(2.2 * SR)
    place(music, filt(noise(n), lo=5000, order=2) * np.exp(-tt(n) / 0.55), 12.0, 0.09, rev=0.5)


# ------------------------------------------------------------------ sound effects
def s_key(i):
    n = int(0.05 * SR)
    t = tt(n)
    v = filt(noise(n), lo=2500, hi=9000) * np.exp(-t / 0.006)
    v += np.sin(2 * np.pi * (1900 + 160 * (i % 4)) * t) * np.exp(-t / 0.012) * 0.4
    return v


def s_pop(i):
    n = int(0.16 * SR)
    t = tt(n)
    f0 = 420 * 2 ** (i * 2 / 12)
    f = f0 + f0 * 1.2 * (1 - np.exp(-t / 0.02))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * np.minimum(1, t / 0.002)


def s_tick(i):
    n = int(0.06 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * (2300 + 90 * (i % 5)) * t) * np.exp(-t / 0.01) + filt(noise(n), lo=4000) * np.exp(-t / 0.003) * 0.3


def s_whoosh(dur, f0=500, f1=3500, peak=0.55):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    v = swept_noise(dur, f0, f1, bands=7)
    e = np.where(p < peak, (p / peak) ** 2, ((1 - p) / (1 - peak)) ** 1.6)
    return v * e


def s_tok(i):
    n = int(0.5 * SR)
    t = tt(n)
    f = mtof([74, 78, 81, 86][i])
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.05)) * np.exp(-t / 0.16) * np.minimum(1, t / 0.002)


def s_scribble(dur):
    n = int(dur * SR) + int(0.05 * SR)
    t = tt(n)
    v = filt(noise(n), lo=2000, hi=7000)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 34 * t + rng.uniform(0, 6)) ** 2
    e = np.minimum(1, t / 0.02) * np.clip((n / SR - t) / 0.05, 0, 1)
    return v * am * e


def s_impact(big=True):
    n = int(2.5 * SR)
    t = tt(n)
    f = 34 + 60 * np.exp(-t / 0.08)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.9 if big else 0.5))
    body = filt(noise(n), hi=900) * np.exp(-t / 0.12)
    return sub * 0.9 + body * (0.35 if big else 0.2)


def s_suck(dur):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    return swept_noise(dur, 400, 6000, bands=8) * p ** 3


def s_chime(i):
    n = int(1.6 * SR)
    t = tt(n)
    f = mtof([81, 86][i])
    v = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, 0.7), (2.76, 0.35, 0.25), (5.4, 0.12, 0.1)))
    return v * np.minimum(1, t / 0.002)


def s_shimmer():
    n = int(2.6 * SR)
    out = np.zeros(n)
    for k, m in enumerate((86, 90, 93, 98)):
        o = int(k * 0.06 * SR)
        tb = tt(n - o)
        out[o:] += np.sin(2 * np.pi * mtof(m) * tb) * np.exp(-tb / 0.9) * np.minimum(1, tb / 0.004) * (0.8 ** k)
    return out


def s_dive(dur):
    """Long whoosh whose loudness follows the camera speed of the dive (ioq profile)."""
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    speed = np.where(p < 0.5, 80 * p ** 4, 80 * (1 - p) ** 4)
    speed /= speed.max()
    return swept_noise(dur, 300, 4000, bands=8, curve=speed ** 0.7) * speed ** 1.2


def build_sfx(cues):
    for c in cues:
        k, t, i = c["k"], c["t"], c.get("i", 0)
        if k == "key":
            place(sfx, s_key(i), t, 0.16 * (0.85 + 0.3 * ((i * 37) % 7) / 7), pan=0.1 * ((i % 3) - 1))
        elif k == "pop":
            place(sfx, s_pop(i), t, 0.13, pan=0.25 * np.sin(i * 1.7), rev=0.25)
        elif k == "tick":
            place(sfx, s_tick(i), t, 0.07, pan=0.2 * np.sin(i * 2.3), rev=0.2)
        elif k in ("swoosh", "rise"):
            d = 0.42 if k == "swoosh" else 0.32
            place(sfx, s_whoosh(d, 700, 4200 if k == "swoosh" else 2600), t - d * 0.45, 0.07 if k == "swoosh" else 0.045, rev=0.3)
        elif k == "swish":
            place(sfx, s_whoosh(0.3, 1500, 6000, 0.35), t, 0.05, rev=0.2)
        elif k == "tok":
            place(sfx, s_tok(i), t, 0.12, pan=-0.2 + 0.13 * i, rev=0.35)
        elif k == "scribble":
            place(sfx, s_scribble(c["d"]), t, 0.025, pan=0.35)
        elif k == "suck":
            place(sfx, s_suck(c["d"]), t, 0.13, rev=0.2)
        elif k == "impact":
            place(sfx, s_impact(i == 0), t, 0.42 if i == 0 else 0.26, rev=0.45)
        elif k == "dive":
            place(sfx, s_dive(c["d"]), t, 0.13, rev=0.3)
        elif k == "whoosh":
            v = s_whoosh(c["d"] + 0.2, 400, 3800, 0.5)
            pan = np.linspace(-0.7, 0.7, len(v)) * c.get("pan", 1)
            st = np.vstack([v * np.cos((pan + 1) * np.pi / 4), v * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)
            place(sfx, st, t - 0.05, 0.11, rev=0.25)
        elif k == "chime":
            place(sfx, s_chime(i), t, 0.07, rev=0.5)
        elif k == "riser":
            d = c["d"]
            n = int(d * SR)
            p = np.linspace(0, 1, n)
            place(sfx, swept_noise(d, 500, 7000, bands=8, curve=p ** 2) * p ** 2.5, t, 0.14, rev=0.3)
        elif k == "boom":
            place(sfx, s_impact(True), t, 0.3, rev=0.6)
        elif k == "shimmer":
            place(sfx, s_shimmer(), t, 0.045, pan=0.15, rev=0.6)


# ------------------------------------------------------------------ reverb + master
def reverb(x, rt=2.4, pre=0.02):
    n = int((rt + 0.3) * SR)
    t = tt(n)
    ir = np.zeros((2, n))
    for ch in range(2):
        nz = noise(n)
        ir[ch] = filt(nz, hi=4500) * np.exp(-t / (rt / 6.9)) + filt(nz, lo=4500) * np.exp(-t / (rt / 16))
    ir[:, : int(pre * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    m = 1 << int(np.ceil(np.log2(N + n)))
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:, :N]
    return y


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x.T * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    cues = json.loads((OUT / "cues.json").read_text())
    build_music()
    build_sfx(cues)
    wet = reverb(send) * 0.32
    mix = music + sfx + wet
    mix = filt(mix, lo=28, order=2)  # clean sub rumble
    t = tt(N)
    mix *= np.clip((DUR - t) / 0.35, 0, 1)  # no click at the very end
    peak = np.abs(mix).max()
    mix = np.tanh(mix / peak * 1.1) / np.tanh(1.1) * 0.7
    write_wav(OUT / "mix_raw.wav", mix)
    for a, b, name in ((0, 4, "intro"), (4, 11.9, "build"), (12, 21.9, "drop"), (22, 26, "breakdown"), (26, 30, "end")):
        s = mix[:, int(a * SR): int(b * SR)]
        print(f"{name:10s} rms {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dB  peak {20 * np.log10(np.abs(s).max() + 1e-9):6.1f} dB")
