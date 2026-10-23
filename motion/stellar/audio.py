"""Score + sound design for the Project Stellar trailer, 100 % synthesized (no samples), then the mix.

    python3 audio.py            -> out/music.wav, out/sfx.wav, out/mix.wav (+ voice if out/vo_placed.wav exists)

Music: chill lo-fi / dream-synthwave at 90 BPM in D major (Gmaj9 - F#m7 - Em9 - A7sus4), drop on bar 9 (24.0 s).
SFX are placed on the exact cue times exported by the page (out/cues.json).
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

HERE = Path(__file__).parent
OUT = HERE / "out"
SR = 48000
DUR = 60.0
N = int(SR * DUR)
BPM = 90
BEAT = 60 / BPM
BAR = BEAT * 4
DROP = 9 * BAR
rng = np.random.default_rng(2020)


def t_(d):
    return np.arange(int(d * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_ad(n, a, d, curve=4.0):
    """attack (s) then exponential-ish decay over d (s), length n samples"""
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4))
    return e * np.exp(-curve * np.maximum(0, x - a) / max(d, 1e-4))


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 * .99) / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [f1 / (SR / 2), min(f2, SR / 2 * .99) / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


def add(buf, x, t0, gain=1.0, pan=0.0):
    """mix mono or stereo x into stereo buf at time t0"""
    i = int(round(t0 * SR))
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += x[:n] * gain


def reverb_ir(dur=2.4, decay=3.2, seed=1):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    e = np.exp(-decay * np.arange(n) / SR / dur * 3)
    ir = np.stack([r.standard_normal(n) * e, r.standard_normal(n) * e], 1)
    ir = lp(ir, 7000)
    ir[:int(.012 * SR)] *= np.linspace(0, 1, int(.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0)).max() * .6


IR = reverb_ir()


def verb(x, wet=.3, ir=IR):
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet * .3) + y * wet


# ===================================================================================== MUSIC
def rhodes(f, d, vel=1.0):
    """FM electric piano tine: carrier + 1:1 modulator with decaying index, bell partial, tremolo"""
    x = t_(d)
    idx = 1.6 * vel * np.exp(-x * 3.5) + .25
    s = np.sin(2 * np.pi * f * x + idx * np.sin(2 * np.pi * f * x))
    s += .25 * np.sin(2 * np.pi * f * 14 * x) * np.exp(-x * 18)  # tine ping
    s *= env_ad(len(x), .004, d * .9, 2.2) * (1 + .12 * np.sin(2 * np.pi * 4.5 * x))
    return s * vel


def supersaw(f, d, voices=5, det=.012):
    x = t_(d)
    s = np.zeros(len(x))
    for v in range(voices):
        fv = f * (1 + det * (v - (voices - 1) / 2) / 2)
        ph = rng.random()
        s += signal.sawtooth(2 * np.pi * (fv * x + ph))
    return s / voices


def pluck(f, d, bright=1.0):
    x = t_(d)
    s = signal.square(2 * np.pi * f * x, .3) * .5 + np.sin(2 * np.pi * f * x)
    # filter envelope: crossfade a bright and a dark version
    e = np.exp(-x * 14)
    s = lp(s, 900 + 5000 * bright) * e + lp(s, 700) * (1 - e) * .3
    return s * env_ad(len(x), .002, d * .6, 3.5)


# chord voicings (MIDI) per bar of the 4-bar loop: Gmaj9, F#m7, Em9, A7sus4
CHORDS = [
    [55, 59, 62, 66, 69],      # G B D F# A
    [54, 57, 61, 64, 69],      # F# A C# E A
    [52, 55, 59, 62, 66],      # E G B D F#
    [57, 62, 64, 67, 71],      # A D E G B
]
ROOTS = [43, 42, 40, 45]       # G2 F#2 E2 A2


def gate(spans, ramp=.08):
    """0..1 envelope that is 1 inside the given [start, end] spans (seconds), with short linear ramps"""
    x = np.arange(N) / SR
    g = np.zeros(N)
    for a, b in spans:
        g = np.maximum(g, np.clip(np.minimum((x - a) / ramp + 1, (b - x) / ramp + 1), 0, 1))
    return g[:, None]


def music(S):
    """S = scene table exported by the page: every section change follows the picture"""
    keys = np.zeros((N, 2))
    pad = np.zeros((N, 2))
    bass = np.zeros((N, 2))
    kicks = np.zeros((N, 2))
    snares = np.zeros((N, 2))
    hats = np.zeros((N, 2))
    arp = np.zeros((N, 2))
    LAST = 20 * BAR                     # 53.33 s: final chord rings out under the end card
    nbars = int(np.ceil(DUR / BAR))
    for b in range(nbars):
        t0 = b * BAR
        ch = CHORDS[b % 4]
        last = t0 >= LAST - .01
        pd = BAR + .6 if not last else DUR - t0
        p = sum(supersaw(midi(m), pd) for m in ch[:4]) / 4
        pe = np.minimum(1, t_(pd) / .5) * np.minimum(1, (pd - t_(pd)) / (.6 if not last else 4.5))
        add(pad, lp(p, 2200) * pe, t0, .16 if not last else .2, 0)
        if last:
            for i, m in enumerate(CHORDS[0] + [74, 78]):
                add(keys, rhodes(midi(m), DUR - t0, .5), t0 + i * .03, .2, -.4 + i * .12)
            break
        for i, m in enumerate(ch):
            add(keys, rhodes(midi(m), 2.4, .55), t0 + i * .012, .22, -.3 + i * .15)
        if b >= 1:
            for i, m in enumerate(ch[1:4]):
                add(keys, rhodes(midi(m + 12), 1.0, .35), t0 + 2.5 * BEAT + i * .01, .12, .2)
        r = ROOTS[b % 4]
        for (bt, ln, m) in [(0, 1.4, r), (1.5, .5, r), (2.5, .9, r + 7 if b % 2 else r), (3.5, .45, r + 12)]:
            x = t_(ln * BEAT)
            s_ = np.sin(2 * np.pi * midi(m) * x) + .25 * np.sin(4 * np.pi * midi(m) * x)
            s_ = np.tanh(s_ * 1.4) * env_ad(len(x), .005, ln * BEAT, 2.0)
            add(bass, s_, t0 + bt * BEAT, .32, 0)
        for k in ([0, 1.75, 2.5] if b % 2 == 0 else [0, 2.25, 2.75]):
            add(kicks, kick(), t0 + k * BEAT, .85)
        for s16 in [1, 3]:
            add(snares, snare(), t0 + s16 * BEAT, .45)
        for h in range(8):
            tt = t0 + (h * .5 + (.08 if h % 2 else 0)) * BEAT   # swung 8ths
            add(hats, hat(open_=(h == 7 and b % 2 == 1)), tt, .16 if h % 2 else .21, .25)
        for h in range(16):
            if h % 4 == 2:
                add(hats, shaker(), t0 + h * .25 * BEAT + .02, .08, -.3)
        pat = [0, 2, 4, 3, 1, 3, 2, 4]
        for s16 in range(16):
            m = ch[pat[s16 % 8]] + 12
            add(arp, pluck(midi(m), .35, .6 + .4 * ((s16 % 4) == 0)), t0 + s16 * BEAT / 4, .1, .35 if s16 % 2 else -.35)
    # ---- arrangement, driven by the picture
    fade0, drop, isle0, isle1, end0 = S["fade"][0], S["logo"][0], S["isle"][0], S["isle"][1], S["end"][0]
    groove_off = [(fade0, drop - .02), (isle0, isle1)]
    def not_in(spans):
        return 1 - gate(spans, .1)
    kicks *= gate([(4.0, LAST)]) * not_in(groove_off)
    snares *= gate([(S["secret"][0] - .05, LAST)]) * not_in(groove_off)
    hats *= gate([(4.0, LAST)]) * not_in(groove_off) * (.75 + .25 * gate([(drop, LAST)]))
    bass *= gate([(4.0, LAST)]) * not_in([(fade0, drop - .02)]) * (1 - .6 * gate([(isle0, isle1)]))
    arp *= gate([(drop, LAST)]) * (1 - .45 * gate([(isle0, isle1)]))
    keys *= gate([(2.6, DUR)], .6)
    # snare roll into the drop
    roll = np.zeros((N, 2))
    for i in range(12):
        add(roll, snare(), drop - 1.25 + i * BEAT / 4 * (1 - i / 30), .08 + i * .02, 0)
    drums = kicks + snares + hats + roll
    # ping-pong delay on the arp
    d = int(BEAT * .75 * SR)
    delayed = np.zeros_like(arp)
    delayed[d:, 0] += arp[:-d, 1] * .45
    delayed[2 * d:, 1] += arp[:-2 * d, 0] * .3
    arp = arp + lp(delayed, 3500)
    # sidechain pump from the kick grid where the groove plays
    duck = np.ones(N)
    for b in range(int(LAST / BAR)):
        for k in [0, 2]:
            t = b * BAR + k * BEAT
            if t < 4.0 or fade0 <= t < drop or isle0 <= t < isle1:
                continue
            i = int(t * SR)
            n = int(.42 * SR)
            curve = 1 - .45 * np.exp(-np.arange(n) / SR / .12)
            duck[i:i + n] = np.minimum(duck[i:i + n], curve[:len(duck[i:i + n])])
    keys *= duck[:, None]
    pad *= duck[:, None]
    arp *= duck[:, None]
    # filter: the bed opens from the dark intro to full at Midas, closes again in the memory scene, opens on the drop
    bed = keys + pad
    dark = lp(bed, 500)
    x = np.arange(N) / SR
    w = np.clip((x - 1.0) / (S["midas"][0] - 1.0), 0, 1) ** 1.5
    fz = np.clip((x - fade0) / 2.0, 0, 1) * (x < drop)
    w = np.clip(w - fz * .85, 0, 1)[:, None]
    bed = dark * (1 - w) + bed * w
    mus = verb(bed, .35) + verb(arp, .4) + bass + verb(drums, .12) + vinyl() * .05
    mus = lp(mus, 11000)   # lo-fi warmth: nothing harsh above 11 kHz
    g = np.ones(N)
    i0, i1 = int((drop - .14) * SR), int(drop * SR)
    g[i0:i1] = np.linspace(1, .15, i1 - i0)    # a breath right before the drop
    mus *= g[:, None]
    fe = np.clip((DUR - x) / 3.5, 0, 1)[:, None]
    return mus * fe


def kick():
    x = t_(.45)
    f = 45 + 80 * np.exp(-x * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7)
    s += .3 * hp(rng.standard_normal(len(x)), 2000) * np.exp(-x * 120)
    return np.tanh(s * 1.5) * .9


def snare():
    x = t_(.35)
    n = bp(rng.standard_normal(len(x)), 900, 7000) * np.exp(-x * 16)
    tone = np.sin(2 * np.pi * 185 * x) * np.exp(-x * 25)
    return lp(n * .8 + tone * .5, 6000)


def hat(open_=False):
    x = t_(.25 if open_ else .06)
    return bp(rng.standard_normal(len(x)), 5500, 10000) * np.exp(-x * (14 if open_ else 70))


def shaker():
    x = t_(.08)
    return bp(rng.standard_normal(len(x)), 4000, 11000) * np.sin(np.pi * x / .08) ** 2


def vinyl():
    n = rng.standard_normal(N) * .08
    n = lp(hp(n, 300), 3000)
    clicks = np.zeros(N)
    pos = rng.integers(0, N, 160)
    clicks[pos] = rng.standard_normal(160) * .8
    clicks = bp(clicks, 1500, 7000)
    return np.stack([n + clicks, n * .9 + np.roll(clicks, 37)], 1)


# ===================================================================================== SFX
def noise(d):
    return rng.standard_normal(int(d * SR))


def whoosh(d=.55, f0=300, f1=3500, peak=.55):
    x = t_(d)
    n = noise(d)
    out = np.zeros(len(x))
    # sweep a band-pass in 12 blocks (good enough, inaudible stepping thanks to the crossfade)
    blocks = 16
    L = len(x) // blocks + 1
    for i in range(blocks):
        fc = f0 * (f1 / f0) ** (i / (blocks - 1)) if i / (blocks - 1) < peak else f1 * (f0 / f1) ** ((i / (blocks - 1) - peak) / (1 - peak))
        seg_ = bp(n, max(60, fc * .6), fc * 1.6)
        w = np.zeros(len(x))
        a, b = max(0, (i - 1) * L), min(len(x), (i + 2) * L)
        w[a:b] = np.hanning(b - a)
        out += seg_ * w
    e = np.sin(np.pi * np.clip(x / d, 0, 1)) ** 1.5
    e *= np.exp(-2.5 * np.maximum(0, x / d - peak))
    return out * e * 1.2


def stereo_sweep(x, a=-.8, b=.8):
    p = np.linspace(a, b, len(x))
    return np.stack([x * np.cos((p + 1) * np.pi / 4), x * np.sin((p + 1) * np.pi / 4)], 1) * 1.414


def boom(d=1.6, f0=95, f1=38):
    x = t_(d)
    f = f1 + (f0 - f1) * np.exp(-x * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 3.2)
    return np.tanh(s * 1.8)


def crash(d=2.0):
    x = t_(d)
    return hp(noise(d), 3000) * np.exp(-x * 2.6) * .5


def ping(f, d=1.2):
    x = t_(d)
    return (np.sin(2 * np.pi * f * x) + .3 * np.sin(2 * np.pi * f * 2.01 * x)) * env_ad(len(x), .002, d, 4)


def make_sfx(kind):
    if kind == "whoosh":
        return stereo_sweep(whoosh(.5))
    if kind == "whoosh_big":
        w = whoosh(.9, 150, 2500, .6)
        b = np.concatenate([np.zeros(int(.35 * SR)), boom(.8, 80, 40) * .4])
        n = max(len(w), len(b))
        w = np.pad(w, (0, n - len(w)))
        b = np.pad(b, (0, n - len(b)))
        return stereo_sweep(w + b, -.6, .6)
    if kind == "whoosh_soft":
        return stereo_sweep(lp(whoosh(1.1, 200, 1500), 2500) * .7)
    if kind == "swipe":
        return stereo_sweep(hp(whoosh(.32, 900, 6000, .7), 600), .8, -.8)
    if kind == "stamp":
        x = t_(.9)
        thud = np.sin(2 * np.pi * (60 + 60 * np.exp(-x * 40)) * x) * np.exp(-x * 9)
        slap = lp(noise(.9), 2500) * np.exp(-x * 40)
        click = hp(noise(.9), 3000) * np.exp(-x * 200)
        return np.tanh((thud * 1.2 + slap * .8 + click * .5) * 1.6)
    if kind == "impact_big":
        b = boom(2.2, 110, 34)
        c = crash(2.2)
        x = t_(2.2)
        ring = sum(np.sin(2 * np.pi * midi(m) * x) for m in [62, 69, 74, 78]) * np.exp(-x * 2) * .08
        return verb(np.stack([b + c + ring, b + c * .9 + ring], 1), .35)
    if kind == "impact_soft":
        x = t_(1.0)
        s = boom(1.0, 90, 50) * .6 + lp(noise(1.0), 1200) * np.exp(-x * 14) * .4
        return verb(np.stack([s, s], 1), .25)
    if kind == "riser":
        d = 2.0
        x = t_(d)
        f = 180 * (12 ** (x / d))
        tone = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * .25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .2
        n = bp(noise(d), 800, 9000) * .5
        e = (x / d) ** 2.2
        s = lp(tone, 4000) * e + n * e
        return stereo_sweep(s, -.3, .3)
    if kind == "riser_short":
        d = 1.0
        x = t_(d)
        n = bp(noise(d), 1500, 10000) * (x / d) ** 2
        return stereo_sweep(n * .7, .4, -.4)
    if kind == "shimmer":
        notes = [86, 90, 93, 98, 102, 95, 88]
        s = np.zeros(int(2.4 * SR))
        for i, m in enumerate(notes):
            p = ping(midi(m), 1.6) * .25
            i0 = int(i * .045 * SR)
            s[i0:i0 + len(p)] += p[:len(s) - i0]
        return verb(np.stack([s, np.roll(s, 300)], 1), .5)
    if kind == "pop":
        x = t_(.12)
        f = 320 + 900 * (x / .12)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(x), .002, .1, 5) * .8
    if kind == "flap":
        s = np.zeros(int(.25 * SR))
        for i in range(3):
            c = bp(noise(.03), 1800, 6000) * np.exp(-t_(.03) * 160)
            i0 = int(i * .035 * SR)
            s[i0:i0 + len(c)] += c * (1 - i * .25)
        return s
    if kind == "type":
        c = bp(noise(.05), 2000, 9000) * np.exp(-t_(.05) * 180)
        c += np.sin(2 * np.pi * 2400 * t_(.05)) * np.exp(-t_(.05) * 260) * .3
        return c * (.7 + .6 * rng.random())
    if kind == "liquid":
        d = 1.2
        x = t_(d)
        s = lp(noise(d), 700) * np.sin(np.pi * x / d) * .8
        for i in range(14):
            f0 = 400 + rng.random() * 900
            xb = t_(.08)
            blip = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2 * xb / .08)) / SR) * np.exp(-xb * 40) * .35
            i0 = int((.1 + rng.random() * .9) * SR)
            s[i0:i0 + len(blip)] += blip[:len(s) - i0]
        return np.stack([s, np.roll(s, 200)], 1)
    if kind == "shatter":
        d = 1.8
        x = t_(d)
        s = hp(noise(d), 2500) * np.exp(-x * 5) * .5
        for i in range(30):
            p = ping(3000 + rng.random() * 6000, .3) * .12
            i0 = int(rng.random() * .5 * SR)
            s[i0:i0 + len(p)] += p[:len(s) - i0]
        return verb(np.stack([s, np.roll(s, 400)], 1), .45)
    if kind == "build":
        x = t_(.35)
        s = np.sin(2 * np.pi * (170 + 90 * np.exp(-x * 50)) * x) * np.exp(-x * 22)
        s += lp(noise(.35), 1800) * np.exp(-x * 45) * .7
        s += hp(noise(.35), 4000) * np.exp(-x * 300) * .4
        return np.tanh(s * 1.4)
    if kind == "tap":
        x = t_(.08)
        return (np.sin(2 * np.pi * 1300 * x) * np.exp(-x * 90) + hp(noise(.08), 3000) * np.exp(-x * 250) * .3)
    if kind == "success":
        s = np.zeros(int(1.4 * SR))
        for i, m in enumerate([81, 86, 93]):
            p = ping(midi(m), 1.1) * .3
            i0 = int(i * .09 * SR)
            s[i0:i0 + len(p)] += p[:len(s) - i0]
        return verb(np.stack([s, s], 1), .35)
    if kind == "confetti":
        d = 1.2
        x = t_(d)
        s = bp(noise(d), 1500, 9000) * np.exp(-x * 30) * .9
        cr = np.zeros(len(x))
        pos = rng.integers(int(.05 * SR), len(x), 90)
        cr[pos] = rng.standard_normal(90)
        s += hp(cr, 3000) * np.exp(-x * 2.5) * .6
        return np.stack([s, np.roll(s, 500)], 1)
    if kind == "wind":
        d = 1.9
        x = t_(d)
        n = noise(d)
        s = bp(n, 250, 1800) * (.6 + .4 * np.sin(2 * np.pi * .9 * x)) * np.sin(np.pi * x / d) ** .8
        return np.stack([s, bp(noise(d), 250, 1800) * np.sin(np.pi * x / d) ** .8], 1) * .8
    if kind == "waves":
        d = 3.6
        x = t_(d)
        s = lp(noise(d), 1500) * (.4 + .6 * np.sin(np.pi * x / d * 2) ** 2) * np.sin(np.pi * x / d)
        return np.stack([s, np.roll(s, 2000)], 1) * .6
    raise ValueError(kind)


def sfx(cues):
    buf = np.zeros((N, 2))
    pans = {"pop": 0.15, "type": -.1, "build": 0, "tap": .2}
    for c in cues:
        x = make_sfx(c["type"])
        pk = np.argmax(np.abs(x if x.ndim == 1 else x.sum(1)))
        # risers end on their cue; everything else lands its peak on the cue
        t0 = c["t"] - (len(x) / SR if c["type"].startswith("riser") else pk / SR if c["type"] in ("stamp", "impact_big", "impact_soft", "build", "pop", "tap") else 0)
        if c["type"] == "riser":
            t0 = DROP - len(x) / SR
        add(buf, x, t0, .5 * c["g"], pans.get(c["type"], 0))
    return lp(buf, 14000)


def write_wav(path, x):
    import wave
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def read_wav(path):
    import wave
    with wave.open(str(path), "rb") as w:
        assert w.getframerate() == SR
        d = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32767
        return d.reshape(-1, w.getnchannels())


def loudnorm(src, dst, lufs=-14):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(src), "-af", f"loudnorm=I={lufs}:TP=-1.3:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    js = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    af = (f"loudnorm=I={lufs}:TP=-1.3:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", af + ",aresample=48000", "-ar", "48000", str(dst)], check=True)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    meta = json.loads((OUT / "cues.json").read_text())
    cues = meta["cues"]
    mus = music(meta["S"])
    fx = sfx(cues)
    write_wav(OUT / "music.wav", mus / max(1, np.abs(mus).max()))
    write_wav(OUT / "sfx.wav", fx / max(1, np.abs(fx).max()))
    vo_path = OUT / "vo_placed.wav"
    mix = mus * .55 + fx * .8
    if vo_path.exists():
        vo = read_wav(vo_path)
        vo = vo[:N] if len(vo) >= N else np.pad(vo, ((0, N - len(vo)), (0, 0)))
        if vo.shape[1] == 1:
            vo = np.repeat(vo, 2, 1)
        # duck music + sfx ~8 dB under the voice (smoothed envelope)
        env = np.abs(vo).max(1)
        env = signal.filtfilt(*signal.butter(1, 6 / (SR / 2)), env)
        g = 1 - .6 * np.clip(env / (env.max() * .25 + 1e-9), 0, 1)
        mix = mix * g[:, None] + vo * 1.6
    peak = np.abs(mix).max()
    write_wav(OUT / "mix_raw.wav", mix / peak * .89)
    loudnorm(OUT / "mix_raw.wav", OUT / "mix.wav")
    print("audio written:", "with voice" if vo_path.exists() else "music + sfx only")
