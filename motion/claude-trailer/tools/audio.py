"""Original score + sound design for the claude-trailer, 100 % synthesized, placed on src/cues.js.

120 BPM (beat 0.5 s, bar 2 s), D minor moving to a D major resolution.
  0-3   mystery: sub drone, airy pad, crystal ting, two pulses, riser
  3-7   reveal: first beats, metal clinks per fragment, big impact on the shock, letter hits
  7-12  exploration: four on the floor, arpeggio, interface sounds, three word hits
  12-17 power: full groove, chord stabs, six module activations, three accents
  17-22 construction: keystrokes, wire crackle, floor clunks, spin, brake, pulse
  22-26 climax: riser, monumental impact, slow-motion drone, pass-bys, hard cut
  26-30 signature: warm swell, final low hit + crystal + warm chord, ring out
Writes out/mix_raw.wav and stems out/music.wav, out/sfx.wav. Loudness is set with ffmpeg afterwards.
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.signal import fftconvolve

sys.path.insert(0, str(Path(__file__).parent))
from synth import adsr as _adsr
from synth import (SR, bell, choir, clap, crash, delay_ir, epiano, filt, glue, hat, impact, kick, metal, mtof,
                   noise, pad_chord, peq, piano, pluck, reverb_ir, riser, rev_crash, saw, shaker, snare, stereo,
                   supersaw, swept, tom, tt, tvf, whoosh, write_wav)



def adsr(dur, a=0.005, d=0.12, s=0.7, r=0.15):
    """envelope padded with silence so it can be sliced to any note length"""
    return np.pad(_adsr(dur, a, d, s, r), (0, 2 * SR))


HERE = Path(__file__).parent.parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
src = (HERE / "src" / "cues.js").read_text()
CUES = json.loads(src[src.index("=") + 1: src.rindex(";")])
DUR = 30.0
N = int(SR * DUR)
BUS = {k: np.zeros((2, N)) for k in ("drums", "bass", "music", "sfx")}
REV = np.zeros((2, N))
DLY = np.zeros((2, N))
KICKS = []


def place(bus, sig, start, gain=1.0, pan=0.0, rev=0.0, dly=0.0):
    sig = stereo(np.asarray(sig, float), pan)
    i0 = int(round(start * SR))
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(sig.shape[1] - j0, N - i0)
    if n <= 0:
        return
    s = sig[:, j0:j0 + n] * gain
    BUS[bus][:, i0:i0 + n] += s
    if rev:
        REV[:, i0:i0 + n] += s * rev
    if dly:
        DLY[:, i0:i0 + n] += s * dly


def peak_at(sig):
    """seconds from the start of a sound to its loudest sample: SFX are placed by their peak"""
    s = sig if sig.ndim == 1 else np.abs(sig).max(axis=0)
    return int(np.argmax(np.abs(s))) / SR


def hit(bus, sig, t, **kw):
    place(bus, sig, t - peak_at(sig), **kw)


# ------------------------------------------------------------------ sound design voices
def ting(m=86, dur=1.8):
    n = int(dur * SR); t = tt(n)
    v = sum(np.sin(2 * np.pi * mtof(m) * r * t) * np.exp(-t / (0.9 / (1 + k))) * a for k, (r, a) in enumerate(((1, 1), (2.76, 0.4), (5.4, 0.2), (8.93, 0.1))))
    return v * np.minimum(1, t / 0.002)


def clink(i):
    # small metal-on-metal contact, pitch varies per fragment
    n = int(0.6 * SR); t = tt(n)
    f0 = 1300 * 2 ** ((i * 5 % 12) / 24)
    v = sum(np.sin(2 * np.pi * f0 * r * t + i) * np.exp(-t / d) * a for r, d, a in ((1, 0.12, 1), (2.32, 0.07, 0.6), (3.97, 0.04, 0.4), (5.1, 0.03, 0.25)))
    tk = filt(noise(n), "high", 3000) * np.exp(-t / 0.004) * 0.5
    thud = np.sin(2 * np.pi * (110 + 40 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05) * 0.5
    return (v * 0.6 + tk + thud) * np.minimum(1, t / 0.0008)


def thump(f=55, dec=0.35, g=1.0):
    n = int((dec * 5) * SR); t = tt(n)
    fr = f + f * 2 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / dec) * g


def blip(m, dur=0.18, up=True):
    n = int(dur * SR); t = tt(n)
    f = mtof(m) * (1 + (0.5 if up else -0.3) * (1 - np.exp(-t / 0.03)))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur / 3.5)) * np.minimum(1, t / 0.002)


def click(i=0):
    n = int(0.05 * SR); t = tt(n)
    return filt(noise(n), "bp", (2500, 9000)) * np.exp(-t / 0.004) + np.sin(2 * np.pi * (2400 + 170 * (i % 5)) * t) * np.exp(-t / 0.008) * 0.5


def activate(i):
    # interface activation: click + two-note rising chirp + soft tail
    m = [74, 77, 81, 79, 84, 86][i % 6]
    out = np.zeros(int(0.7 * SR))
    c = click(i); out[: len(c)] += c * 0.8
    b1 = blip(m, 0.2); o = int(0.03 * SR); out[o:o + len(b1)] += b1 * 0.6
    b2 = blip(m + 7, 0.3); o = int(0.09 * SR); out[o:o + len(b2)] += b2 * 0.45
    return out


def text_hit(i):
    n = int(0.9 * SR); t = tt(n)
    k = thump(60, 0.12)[:n]
    k = np.pad(k, (0, max(0, n - len(k))))
    snap = filt(noise(n), "bp", (1800, 7000)) * np.exp(-t / 0.03) * 0.6
    tone = np.sin(2 * np.pi * mtof([74, 77, 81][i % 3]) * t) * np.exp(-t / 0.25) * 0.25
    return np.tanh(1.5 * (k + snap + tone))


def zap(dur=0.4, f0=800, f1=3200):
    n = int(dur * SR); t = tt(n); p = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** p
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * p) ** 1.5 * 0.4 + swept(dur, f0, f1, 4.0) * np.sin(np.pi * p) * 0.6


def crackle(dur):
    n = int(dur * SR); t = tt(n)
    rng = np.random.default_rng(5)
    v = np.zeros(n)
    for k in rng.uniform(0, dur, int(dur * 70)):
        i = int(k * SR); m = min(n - i, int(0.006 * SR))
        v[i:i + m] += rng.uniform(0.3, 1) * np.exp(-np.arange(m) / (0.0012 * SR)) * rng.choice([-1, 1])
    buzz = filt(saw(110 * (1 + 0.02 * np.sin(2 * np.pi * 9 * t)), n), "bp", (1500, 5000)) * 0.08
    return filt(v, "high", 1500) + buzz


def clunk(i):
    n = int(0.35 * SR); t = tt(n)
    f = 140 * 2 ** ((i % 4) / 12)
    body = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.06) + np.sin(2 * np.pi * f * 2.7 * t) * np.exp(-t / 0.03) * 0.4
    return np.tanh(2 * (body + filt(noise(n), "bp", (300, 2500)) * np.exp(-t / 0.015) * 0.6))


def spin(dur):
    n = int(dur * SR); t = tt(n); p = np.linspace(0, 1, n)
    rate = 3 + 14 * np.sin(np.pi * np.minimum(p * 1.1, 1)) ** 0.7
    ph = 2 * np.pi * np.cumsum(rate) / SR
    v = tvf(noise(n), 900 * (1.6 + np.sin(ph)), q=2.5, kind="bp") * (0.3 + 0.7 * np.sin(np.pi * p))
    pan = np.sin(ph) * 0.85
    return np.vstack([v * np.cos((pan + 1) * np.pi / 4), v * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)


def boom(big=1.0, dur=3.5):
    n = int(dur * SR); t = tt(n)
    f = 28 + 60 * np.exp(-t / 0.12)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (1.1 * big))
    body = filt(noise(n), "low", 900) * np.exp(-t / 0.2) * 0.5
    air = filt(noise(n), "high", 4000) * np.exp(-t / 0.5) * 0.12
    return np.tanh(1.2 * (sub + body + air))


def pass_by(dur=0.7, left_to_right=True):
    n = int(dur * SR); p = np.linspace(0, 1, n)
    e = np.exp(-((p - 0.5) / 0.16) ** 2)
    v = swept(dur, 700, 5000, 1.0, np.clip(p * 1.4 - 0.2, 0, 1)) * e
    pan = (p * 2 - 1) * (1 if left_to_right else -1)
    return np.vstack([v * np.cos((pan + 1) * np.pi / 4), v * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)


def rumble(dur):
    n = int(dur * SR); t = tt(n); p = np.linspace(0, 1, n)
    return filt(noise(n), "low", 120) * 3 * np.sin(np.pi * p) ** 0.6 + np.sin(2 * np.pi * 36.7 * t) * 0.4 * np.sin(np.pi * p)


# ------------------------------------------------------------------ harmony
BAR = 2.0
CH = {"Dm": [50, 53, 57, 62], "Bb": [46, 50, 53, 58], "F": [45, 48, 53, 57], "C": [48, 52, 55, 60], "Gm": [43, 50, 55, 58], "A": [45, 49, 52, 57], "D": [50, 54, 57, 62, 64]}
PROG = ["Dm", "Bb", "F", "C"]
chord_at = lambda b: PROG[b % 4]


def build_music():
    C1, C2, C3, C4, C5, C6, C7 = (CUES[k] for k in ("s1", "s2", "s3", "s4", "s5", "s6", "s7"))
    # --- 0-3 mystery
    n = int(3.4 * SR); t = tt(n)
    drone = (np.sin(2 * np.pi * mtof(26) * t) + 0.3 * np.sin(2 * np.pi * mtof(38) * t)) * np.minimum(1, t / 1.5) * np.clip((3.4 - t) / 0.5, 0, 1)
    place("bass", drone, 0, 0.45)
    place("music", pad_chord([50, 57, 64, 69], 3.0, None, att=1.6, rel=0.8, sweep=(300, 2600)), 0, 0.22, rev=0.5)
    air = filt(noise(n), "bp", (3000, 9000)) * np.minimum(1, t / 2) * 0.05
    place("music", air, 0, 1.0, pan=0.3, rev=0.4)
    place("music", choir([62, 69], 2.6, att=1.2), 0.4, 0.12, rev=0.6)
    # --- 3-7 reveal: half time first, then the beat
    for b in range(3, 7):
        place("music", pad_chord(CH[chord_at(b)][1:] , 1.0, 2400, att=0.12, rel=0.6), b if b > 3 else 3.0, 0.12, rev=0.35)
    for t0 in np.arange(3.0, 7.0, 0.25):
        root = CH[chord_at(int(t0 // 2))][0] - 12
        place("bass", np.tanh(1.5 * filt(saw(mtof(root), int(0.24 * SR)), "low", 500)) * adsr(0.18, 0.003, 0.08, 0.5, 0.05)[: int(0.24 * SR)], t0, 0.28)
    # arp from 5.0
    for k, t0 in enumerate(np.arange(5.0, 7.0, 0.125)):
        ch = CH[chord_at(int(t0 // 2))]
        place("music", pluck(ch[k % len(ch)] + 12, 0.5, 0.8), t0, 0.12, pan=0.5 * np.sin(k), dly=0.3)
    # --- 7-12 exploration
    for t0 in np.arange(7.5, 12.0, 0.125):
        k = int(t0 * 8)
        ch = CH[chord_at(int(t0 // 2))]
        place("music", pluck(ch[(k * 3) % len(ch)] + 12 + (12 if k % 7 == 0 else 0), 0.55, 1.0 + 0.6 * (t0 - 7.5) / 4.5), t0, 0.14, pan=0.6 * np.sin(k * 0.7), dly=0.35)
    for b in range(4, 6):
        ch = CH[chord_at(b)]
        place("music", pad_chord(ch, 2.0, None, att=0.3, rel=0.5, sweep=(800, 3500)), b * 2, 0.16, rev=0.3)
    for t0 in np.arange(7.5, 12.0, 0.5):
        root = CH[chord_at(int(t0 // 2))][0] - 12
        place("bass", np.tanh(2 * filt(saw(mtof(root), int(0.45 * SR)), "low", 650)) * adsr(0.3, 0.004, 0.1, 0.6, 0.08)[: int(0.45 * SR)], t0 + 0.25, 0.3)
    # --- 12-17 power
    for b in range(6, 9):
        ch = CH[chord_at(b)]
        place("music", pad_chord(ch, 2.0, None, att=0.05, rel=0.4, sweep=(1500, 5000)), b * 2, 0.15, rev=0.3)
    for t0 in np.arange(12.0, 17.0, 0.25):
        root = CH[chord_at(int(t0 // 2))][0] - 12
        if (t0 * 4) % 2 == 1:
            place("bass", np.tanh(2.2 * filt(saw(mtof(root), int(0.22 * SR)), "low", 800)) * adsr(0.16, 0.003, 0.06, 0.6, 0.05)[: int(0.22 * SR)], t0, 0.34)
    for k, t0 in enumerate(np.arange(12.0, 16.9, 0.125)):
        ch = CH[chord_at(int(t0 // 2))]
        place("music", pluck(ch[(k * 5) % len(ch)] + 24, 0.45, 1.6), t0, 0.1, pan=0.7 * np.sin(k * 1.3), dly=0.3)
    for i, t0 in enumerate(C4["words"]):  # supersaw stabs on the three words
        ch = CH[["F", "C", "Dm"][i]]
        st = sum(supersaw(mtof(m + 12), int(0.6 * SR), det=0.2) for m in ch) / len(ch)
        place("music", filt(st, "low", 5000) * adsr(0.35, 0.003, 0.12, 0.4, 0.2)[: int(0.6 * SR)], t0, 0.32, rev=0.4)
    place("music", riser(0.45, 600, 9000), C4["rise"], 0.35)
    # --- 17-22 construction: tension in A/Gm then lift
    prog5 = [(17, "Gm"), (18, "Bb"), (19, "C"), (20, "A"), (21, "Dm")]
    for t0, c in prog5:
        place("music", pad_chord(CH[c], 1.0, None, att=0.1, rel=0.4, sweep=(1200, 4500)), t0, 0.15, rev=0.3)
    for t0 in np.arange(17.0, 22.0, 0.125):
        c = [c for s, c in prog5 if s <= t0][-1]
        root = CH[c][0] - 12
        place("bass", np.tanh(2 * filt(saw(mtof(root), int(0.12 * SR)), "low", 400 + 300 * (t0 - 17))) * adsr(0.09, 0.002, 0.04, 0.5, 0.03)[: int(0.12 * SR)], t0, 0.24)
    for k, t0 in enumerate(np.arange(18.0, 21.0, 0.0625)):
        c = [c for s, c in prog5 if s <= t0][-1]
        place("music", pluck(CH[c][k % 4] + 24 + 12 * (k % 8 == 0), 0.35, 1.2 + (t0 - 18) * 0.4), t0, 0.06 + 0.04 * (t0 - 18) / 3, pan=0.8 * np.sin(k), dly=0.2)
    place("music", riser(1.0, 400, 8000), 20.0, 0.3)
    place("music", choir([62, 69, 74], 1.0, att=0.2), C5["pulse"], 0.18, rev=0.6)
    # --- 22-26 climax
    place("music", pad_chord([38, 50, 57, 62, 65], 1.5, None, att=1.2, rel=0.1, sweep=(400, 6000)), 22.0, 0.22, rev=0.4)
    place("music", choir([50, 57, 62, 65], 1.5, att=1.2, rel=0.2), 22.0, 0.2, rev=0.5)
    place("music", riser(1.5, 300, 10000), 22.0, 0.45)
    big = sum(supersaw(mtof(m), int(1.3 * SR), det=0.22) for m in (38, 50, 57, 62, 66, 69)) / 6  # D major: the light
    env = adsr(0.4, 0.002, 0.25, 0.5, 0.6)[: int(1.3 * SR)]
    place("music", filt(big, "low", 7000) * env, C6["pulse"], 0.5, rev=0.5)
    n = int(1.0 * SR)
    slow = pad_chord([38, 45, 50, 57], 0.95, None, att=0.15, rel=0.05, sweep=(1800, 250))
    place("music", slow, C6["slow0"], 0.25, rev=0.8)
    place("bass", rumble(1.0), C6["slow0"], 0.5)
    place("music", riser(0.6, 500, 12000), C6["slow1"], 0.4)
    # --- 26-30 signature in D major
    place("music", pad_chord([50, 54, 57, 62, 64, 69], 3.8, None, att=1.0, rel=0.2, sweep=(500, 3000)), 26.0, 0.17, rev=0.6)
    place("music", choir([62, 66, 69], 3.5, att=1.2, rel=0.3), 26.2, 0.1, rev=0.7)
    place("bass", np.sin(2 * np.pi * mtof(38) * tt(int(3.8 * SR))) * np.minimum(1, tt(int(3.8 * SR)) / 0.8), 26.0, 0.25)
    for m, t0, v in ((74, 27.0, 0.5), (78, 27.4, 0.4), (81, 27.8, 0.45), (86, C7["final"], 0.6)):
        place("music", piano(m, 1.2, v), t0, 0.3, rev=0.6, dly=0.15)
    for m in (50, 57, 62, 66, 69):
        place("music", epiano(m, 1.3, 0.55), C7["final"], 0.16, rev=0.7)


def build_drums():
    K, SN, CL, HC, HO = kick(), snare(), clap(), hat(0.035), hat(0.2)
    def k(t, g=0.9):
        place("drums", K, t, g); KICKS.append(t)
    k(3.0, 0.8); k(4.0, 0.8)
    for t0 in np.arange(5.0, 7.0, 0.5):
        k(t0, 0.75)
    for t0 in np.arange(7.5, 11.75, 0.5):
        k(t0, 0.85)
    for t0 in np.arange(7.75, 11.75, 0.5):
        place("drums", HO, t0, 0.12, pan=0.2)
    for t0 in np.arange(9.0, 11.75, 1.0):
        place("drums", CL, t0 + 0.5, 0.35, rev=0.2)
    for t0 in np.arange(12.0, 16.6, 0.5):
        k(t0, 0.95)
    for t0 in np.arange(12.0, 16.6, 0.125):
        place("drums", HC, t0, 0.1 if (t0 * 8) % 2 else 0.16, pan=-0.3)
    for t0 in np.arange(12.5, 16.6, 1.0):
        place("drums", CL, t0, 0.42, rev=0.25); place("drums", SN, t0, 0.2)
    place("drums", tom(180), 16.25, 0.4); place("drums", tom(140), 16.375, 0.4); place("drums", tom(110), 16.5, 0.45)
    # construction: half time then a roll
    for t0 in (17.0, 18.0, 19.0, 19.5, 20.0, 20.5):
        k(t0, 0.85)
    for t0 in np.arange(17.0, 20.0, 0.25):
        place("drums", shaker(), t0, 0.14, pan=0.4)
    for i, t0 in enumerate(np.arange(20.0, 21.0, 1 / 16)):
        place("drums", SN, t0, 0.06 + 0.22 * i / 16, pan=0.1)
    k(21.0, 1.0); place("drums", crash(), 21.0, 0.22, rev=0.4)
    for t0 in np.arange(21.5, 22.0, 0.5):
        k(t0, 0.8)
    # climax build
    for i, t0 in enumerate(np.arange(22.0, 23.5, 0.25)):
        k(t0, 0.6 + 0.3 * i / 6) if i % 2 == 0 else None
    for i, t0 in enumerate(np.arange(22.5, 23.5, 1 / 16)):
        place("drums", SN, t0, 0.05 + 0.25 * i / 16)
    k(CUES["s6"]["pulse"], 1.0)
    place("drums", crash(3.0), CUES["s6"]["pulse"], 0.35, rev=0.5)
    place("drums", CL, CUES["s6"]["pulse"], 0.5, rev=0.6)


def build_sfx():
    C1, C2, C3, C4, C5, C6, C7 = (CUES[k] for k in ("s1", "s2", "s3", "s4", "s5", "s6", "s7"))
    hit("sfx", ting(86), C1["spark"], gain=0.28, rev=0.6, dly=0.3)
    hit("sfx", thump(45, 0.5), C1["pulse1"], gain=0.5)
    hit("sfx", ting(93, 1.2), C1["pulse1"] + 0.02, gain=0.12, pan=0.4, rev=0.6)
    # granular sparkle while particles spawn
    rs = np.random.default_rng(3)
    for t0 in np.sort(rs.uniform(C1["spawn0"], C1["spawn1"], 26)):
        place("sfx", ting(int(rs.integers(86, 100)), 0.5), t0, 0.03 + 0.04 * (t0 - 0.8), pan=rs.uniform(-0.8, 0.8), rev=0.5)
    hit("sfx", thump(40, 0.6, 1.2), C1["pulse2"], gain=0.6)
    place("sfx", rev_crash(0.9), C1["formed"] - 0.9, 0.18)
    place("sfx", riser(1.3, 300, 6000), 1.7, 0.22)
    place("sfx", whoosh(0.8, 300, 2500, 0.8), 1.95, 0.18)
    for t0 in (C1["formed"],):
        place("sfx", ting(98, 1.6), t0, 0.12, rev=0.6)
    # reveal
    hit("sfx", thump(50, 0.25), C2["burst"], gain=0.35)
    place("sfx", whoosh(0.6, 2000, 400, 0.2), C2["burst"], 0.16, pan=-0.3)
    for i in range(C2["frags"]):
        hit("sfx", clink(i), C2["frag0"] + i * C2["fragStep"], gain=0.22, pan=0.6 * np.sin(i * 1.9), rev=0.25)
        place("sfx", whoosh(0.3, 600, 3500, 0.85), C2["frag0"] + i * C2["fragStep"] - 0.26, 0.05, pan=0.6 * np.sin(i * 1.9))
    place("sfx", riser(0.55, 500, 8000), C2["shock"] - 0.55, 0.25)
    hit("sfx", boom(1.2), C2["shock"], gain=0.75, rev=0.3)
    place("sfx", crash(2.4), C2["shock"], 0.2, rev=0.4)
    place("sfx", whoosh(1.0, 3000, 300, 0.05), C2["shock"], 0.2)
    for i in range(6):
        hit("sfx", text_hit(i), C2["letter0"] + i * C2["letterStep"], gain=0.22, pan=-0.5 + i * 0.2)
    hit("sfx", ting(81, 1.4), C2["sub"] + 0.05, gain=0.12, rev=0.5)
    place("sfx", swept(0.85, 1500, 7000, 3.0) * np.sin(np.pi * np.linspace(0, 1, int(0.85 * SR))), C2["sweep"], 0.12, pan=0)
    # dive and portal
    place("sfx", rev_crash(0.5), C3["dive"] - 0.25, 0.12)
    place("sfx", whoosh(0.65, 200, 4500, 0.7), C3["dive"], 0.5)
    place("sfx", whoosh(0.5, 900, 6000, 0.75), C3["dive"] + 0.05, 0.25, pan=0.4)
    hit("sfx", boom(0.5, 2.0), C3["cross"], gain=0.45)
    place("sfx", whoosh(0.9, 5000, 400, 0.08), C3["cross"], 0.22)
    for i, t0 in enumerate(C3["panels"]):
        hit("sfx", activate(i), t0, gain=0.3, pan=-0.6 + 0.3 * i, rev=0.25)
        place("sfx", whoosh(0.35, 800, 3000, 0.8), t0 - 0.3, 0.07, pan=-0.6 + 0.3 * i)
    for i in range(4):
        place("sfx", zap(0.45, 900 + 200 * i, 3500), C3["links"] + i * 0.12, 0.08, pan=-0.4 + 0.3 * i)
    for i, t0 in enumerate(C3["words"]):
        hit("sfx", text_hit(i), t0, gain=0.42)
    place("sfx", whoosh(0.32, 400, 7000, 0.9), C3["whip"], 0.55)
    # lab
    hit("sfx", boom(0.9), C4["core"], gain=0.6, rev=0.3)
    place("sfx", whoosh(0.9, 6000, 500, 0.05), C4["core"], 0.18)
    for i, t0 in enumerate(C4["modules"]):
        hit("sfx", activate(i + 2), t0, gain=0.24, pan=0.7 * np.sin(i * 1.05), rev=0.3)
        place("sfx", zap(0.42, 700 + 120 * i, 2600 + 300 * i), t0 + C4["beamLag"], 0.08, pan=0.7 * np.sin(i * 1.05))
        hit("sfx", ting(86 + [0, 3, 5, 7, 10, 12][i], 0.7), t0 + C4["beamLag"] + 0.4, gain=0.07, pan=0.7 * np.sin(i * 1.05), rev=0.5)
    w = C4["words"]
    hit("sfx", boom(0.6, 1.5), w[0], gain=0.45); hit("sfx", ting(86), w[0] + 0.01, gain=0.12, rev=0.5)
    hit("sfx", clink(3) * 1.4, w[1], gain=0.4); hit("sfx", thump(70, 0.15), w[1], gain=0.5); place("sfx", rev_crash(0.4), w[1] - 0.4, 0.1)
    hit("sfx", boom(0.8, 2.0), w[2], gain=0.5); place("sfx", crash(1.6), w[2], 0.12, rev=0.4)
    place("sfx", whoosh(0.42, 300, 8000, 0.92), C4["rise"], 0.4)
    hit("sfx", boom(0.7, 1.5), C5["code"], gain=0.45)
    # construction
    rk = np.random.default_rng(9)
    tk = C5["code"] + 0.05
    while tk < C5["codeEnd"]:
        place("sfx", click(int(rk.integers(0, 9))), tk, 0.1 + rk.uniform(0, 0.05), pan=rk.uniform(-0.4, 0.4))
        tk += rk.uniform(0.045, 0.075)
    place("sfx", crackle(C5["wire1"] - C5["wire0"]), C5["wire0"], 0.12, pan=0.2, rev=0.2)
    place("sfx", whoosh(0.75, 300, 3000, 0.6), 18.0, 0.25, pan=0.3)
    place("sfx", whoosh(0.65, 400, 5000, 0.5), 18.75, 0.3)
    for i, t0 in enumerate(np.linspace(C5["fill0"], C5["fill1"] - 0.05, 12)):
        place("sfx", clunk(i), t0, 0.13, pan=0.5 * np.sin(i), rev=0.15)
    place("sfx", spin(C5["spin1"] - C5["spin0"]), C5["spin0"], 0.3)
    place("sfx", whoosh(0.5, 3000, 200, 0.1), C5["brake"], 0.3)
    hit("sfx", ting(93, 1.2), C5["mat"] + 0.1, gain=0.1, rev=0.5)
    hit("sfx", boom(0.9), C5["pulse"], gain=0.55, rev=0.3)
    place("sfx", zap(0.9, 300, 4000), C5["pulse"], 0.12)
    # climax
    for t0 in np.sort(rk.uniform(22.0, 23.3, 22)):
        place("sfx", clink(int(rk.integers(0, 12))), t0, 0.05, pan=rk.uniform(-0.9, 0.9), rev=0.3)
    place("sfx", whoosh(0.55, 4000, 300, 0.2), C6["pull"], 0.4)
    place("sfx", rev_crash(1.0), C6["pulse"] - 1.0, 0.25)
    hit("sfx", boom(1.6, 3.0), C6["pulse"], gain=0.95, rev=0.4)
    hit("sfx", impact(1.2), C6["pulse"], gain=0.35)
    place("sfx", swept(0.4, 6000, 900, 1.2) * np.exp(-tt(int(0.4 * SR)) / 0.12), C6["burst"], 0.3)
    place("sfx", whoosh(1.0, 300, 900, 0.5) * 0.8, C6["slow0"], 0.2, rev=0.6)
    for i, t0 in enumerate(C6["pass"]):
        place("sfx", pass_by(0.6, i % 2 == 0), t0 - 0.3, 0.45)
    place("sfx", whoosh(0.5, 500, 8000, 0.95), C6["cut"] - 0.5, 0.35)
    # signature
    place("sfx", ting(98, 2.2), 26.1, 0.06, rev=0.7)
    hit("sfx", thump(45, 0.6, 0.8), C7["word"], gain=0.35)
    hit("sfx", ting(86, 1.5), C7["tag"], gain=0.1, rev=0.6)
    hit("sfx", boom(0.9, 3.0), C7["final"], gain=0.42, rev=0.4)
    hit("sfx", ting(98, 2.8), C7["final"] + 0.01, gain=0.16, rev=0.7, dly=0.25)
    hit("sfx", ting(93, 2.4), C7["final"] + 0.06, gain=0.1, pan=0.3, rev=0.7)
    place("sfx", swept(0.8, 3000, 9000, 3.0) * np.sin(np.pi * np.linspace(0, 1, int(0.8 * SR))), C7["sheen"], 0.08, pan=0.5)


def sidechain(depth, rel=0.14):
    t = tt(N); g = np.ones(N)
    for k in KICKS:
        i0, i1 = int(k * SR), min(N, int((k + 0.45) * SR))
        tb = t[i0:i1] - k
        g[i0:i1] = np.minimum(g[i0:i1], 1 - depth * np.minimum(1, tb / 0.004) * np.exp(-tb / rel))
    return g


if __name__ == "__main__":
    build_music(); build_drums(); build_sfx()
    sc = sidechain(0.5)
    music = BUS["music"] * sc + BUS["bass"] * sidechain(0.7) + BUS["drums"]
    ir = reverb_ir(2.6)
    wet = np.vstack([fftconvolve(REV[c], ir[c])[:N] for c in range(2)])
    dl = fftconvolve(filt(filt(DLY, "high", 300), "low", 6000), delay_ir(0.375, 0.4), axes=1)[:, :N]
    fx = BUS["sfx"]
    mix = music + fx + filt(wet, "high", 200) * 0.45 + dl * 0.5
    # the breath before the signature: hard cut at 25.4, only tails survive
    t = tt(N)
    cut = CUES["s6"]["cut"]
    gate = np.where((t > cut) & (t < 26.0), 0.0, 1.0)
    gate = np.convolve(gate, np.ones(240) / 240, mode="same")
    dry = (music + fx) * gate
    mix = dry + (filt(wet, "high", 200) * 0.45 + dl * 0.5) * np.maximum(gate, 0.35)
    mix = filt(mix, "high", 25)
    mix = peq(peq(mix, 300, -1.5, 0.8), 3500, 1.5, 0.7)
    mix = glue(mix, -14, 2.0)
    mix *= np.clip((DUR - t) / 0.5, 0, 1) ** 0.7  # the last reverb tail ends with the film, no hard stop
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.9
    write_wav(OUT / "mix_raw.wav", mix)
    for name, x in (("music", music + filt(wet, "high", 200) * 0.3), ("sfx", fx)):
        write_wav(OUT / f"{name}.wav", x / max(1e-9, np.abs(x).max()) * 0.9)
    for a, b, name in ((0, 3, "mystery"), (3, 7, "reveal"), (7, 12, "explore"), (12, 17, "power"), (17, 22, "build"), (22, 25.4, "climax"), (25.4, 26, "breath"), (26, 30, "signature")):
        s = mix[:, int(a * SR): int(b * SR)]
        print(f"{name:10s} rms {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dB  peak {20 * np.log10(np.abs(s).max() + 1e-9):6.1f} dB")
