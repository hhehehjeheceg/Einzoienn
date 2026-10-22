"""Score + sound design for claude-30s, v2: hybrid cinematic electronic.

D minor, 128 BPM (beat 0.46875 s, bar 1.875 s), 30 s = 16 bars, two drops. The orchestral and acoustic parts
(piano, strings, choir, brass, harp, celesta, glockenspiel, taiko, timpani, orchestra hits, cymbals) are
sampled instruments: MIDI written here, rendered one stem at a time by fluidsynth with the MuseScore General
soundfont (MIT). The electronic parts (kick, clap, hats, supersaw, sub and offbeat bass, risers) and every
sound effect are synthesized (audiolib.py). Effects sit on the cues exported by the film (out/cues.json).

  bars 0-1   intro: piano motif, warm pad, ignition (orchestra hit, timpani, celesta), harp on the letters
  bars 2-3   build: string ostinato, taiko, four on the floor, filtered bass, brass swell, snare + timpani roll
  bars 4-5   DROP 1: kick, clap, gated supersaw, saw lead hook, strings doubling, brass stabs, choir
  bars 6-7   drop, lighter: glockenspiel line, pizzicato pulse, a bell per reasoning step
  bars 8-10  breakdown: piano, strings, choir, harp
  bar  11    rebuild: piano 8ths, string tremolo, taiko and snare rolls, riser, a 16th of silence
  bars 12-13 DROP 2: everything, hook an octave up, timpani
  bars 14-15 outro: full orchestra on B-flat major 9, resolves on F, celesta

Output: out/mix_raw.wav. Loudness is set afterwards with ffmpeg (two-pass loudnorm to -14 LUFS).
    python3 audio.py
"""
import json
import subprocess
import wave
from pathlib import Path

import mido
import numpy as np

import audiolib as L
from audiolib import (BUS, CL, CR, HC, HO, KICKS, N, OUT, SEND_DLY, SEND_REV, SN, SR, adsr, bell, choir, fftconvolve, filt,
                      hit_kick, impact, lead, lfilter, mtof, noise, pad_chord, peq, place, rev_crash, riser, s_hit, s_key, s_orbit,
                      s_pop, s_scan, s_scribble, s_shimmer, s_suck, s_tick, s_tok, saw, shaker, square, stereo, supersaw, swept, tom, tt,
                      tvf, whoosh)

SF = "/usr/share/sounds/sf3/MuseScore_General_Full.sf3"
STEMDIR = OUT / "stems"
DUR = N / SR
B = 60 / 128
BARL = 4 * B
for k in ("orch", "perc"):
    BUS[k] = np.zeros((2, N))


def bt(n):
    return n * B


def bar_t(b):
    return b * BARL


# ------------------------------------------------------------------ MIDI stems rendered by fluidsynth
class Stem:
    def __init__(self, name, program, drum=False):
        self.name, self.program, self.drum, self.ev, self.cc = name, program, drum, [], []

    def n(self, beat, dur, m, vel=90):
        self.ev.append((beat, dur, int(m), int(max(1, min(127, vel)))))

    def chord(self, beat, dur, notes, vel=90, spread=0.0):
        for j, m in enumerate(notes):
            self.n(beat + j * spread, dur, m, vel)

    def ramp(self, b0, b1, v0, v1, cc=11, steps=24):
        for k in range(steps + 1):
            u = k / steps
            self.cc.append((b0 + (b1 - b0) * u, cc, int(v0 + (v1 - v0) * u)))

    def render(self):
        STEMDIR.mkdir(parents=True, exist_ok=True)
        tpb = 960
        ch = 9 if self.drum else 0
        evs = [(0, 0, mido.Message("control_change", channel=ch, control=11, value=127)),
               (0, 0, mido.Message("control_change", channel=ch, control=7, value=110))]
        if not self.drum:
            evs.append((0, 0, mido.Message("program_change", channel=ch, program=self.program)))
        for beat, dur, m, vel in self.ev:
            t0, t1 = int(round(beat * tpb)), int(round((beat + dur) * tpb))
            evs.append((t0, 2, mido.Message("note_on", channel=ch, note=m, velocity=vel)))
            evs.append((max(t0 + 1, t1), 1, mido.Message("note_off", channel=ch, note=m, velocity=0)))
        for beat, cc, v in self.cc:
            evs.append((int(round(beat * tpb)), 0, mido.Message("control_change", channel=ch, control=cc, value=max(0, min(127, v)))))
        evs.sort(key=lambda e: (e[0], e[1]))
        mid = mido.MidiFile(ticks_per_beat=tpb)
        tr = mido.MidiTrack()
        mid.tracks.append(tr)
        tr.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(128)))
        last = 0
        for t, _, msg in evs:
            tr.append(msg.copy(time=t - last))
            last = t
        mp, wp = STEMDIR / f"{self.name}.mid", STEMDIR / f"{self.name}.wav"
        mid.save(mp)
        subprocess.run(["fluidsynth", "-ni", "-q", "-o", "synth.reverb.active=0", "-o", "synth.chorus.active=0", "-g", "0.6",
                        "-r", str(SR), "-F", str(wp), SF, str(mp)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        with wave.open(str(wp)) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(float).reshape(-1, 2).T / 32768
        out = np.zeros((2, N))
        n = min(N, x.shape[1])
        out[:, :n] = x[:, :n]
        pk = np.abs(out).max()
        return out / pk if pk > 0 else out


def put(bus, stem, db, rev=0.0, dly=0.0, hp=0.0, lp=0.0):
    """Mix a stem: its RMS over the moments it plays is set to -20 dBFS + db (balance by loudness, not by peak)."""
    x = stem.render()
    act = np.abs(x).max(axis=0) > 0.01
    rms = np.sqrt((x[:, act] ** 2).mean()) if act.any() else 1.0
    gain = 10 ** ((-20 + db) / 20) / rms
    if hp:
        x = filt(x, "high", hp)
    if lp:
        x = filt(x, "low", lp)
    BUS[bus] += x * gain
    if rev:
        SEND_REV[:] += x * gain * rev
    if dly:
        SEND_DLY[:] += x * gain * dly


# ------------------------------------------------------------------ harmony
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
DROPS = (4, 5, 12, 13)


def hook_notes(bars=(0, 1)):   # (beat from the first bar played, length in beats, midi)
    for bo, st, m, ln in HOOK:
        if bo in bars:
            yield (bo - bars[0]) * 4 + st * 0.5, ln * 0.5, m


def compose_orchestra():
    cues = json.loads((OUT / "cues.json").read_text())
    letter_t = [c["t"] for c in cues if c["k"] == "pop"][:6]

    # piano: intro motif, breakdown, rebuild 8ths, outro
    pn = Stem("piano", 0)
    pn.chord(0, 4, [38, 45], 58)
    for b, d, m, v in [(0, 1, 69, 64), (1, .5, 72, 58), (1.5, .5, 74, 60), (2, 1.5, 77, 72), (3.5, .5, 76, 58)]:
        pn.n(b, d, m, v)
    pn.chord(4, 4, [34, 41], 56)
    for b, d, m, v in [(4, 1.5, 74, 66), (5.5, .5, 72, 56), (6, 1, 70, 60), (7, 1, 69, 58)]:
        pn.n(b, d, m, v)
    for bar in (8, 9, 10):
        v = V[BARS[bar]]
        pn.chord(bar * 4, 4, [ROOT[BARS[bar]] + 12, ROOT[BARS[bar]] + 24], 60)
        for k, m in enumerate([v[0], v[1], v[2], v[3], v[2], v[1], v[0], v[1]]):
            pn.n(bar * 4 + k * .5, .5, m - 12, 44)
    for b, d, m in [(32, 2, 77), (34, 1, 74), (35, 1, 77), (36, 2, 81), (38, 2, 79), (40, 1.5, 79), (41.5, .5, 77), (42, 2, 74)]:
        pn.n(b, d, m, 84)
    for k in range(15):   # rebuild: pulsing octaves, crescendo
        pn.chord(44 + k * .25, .22, [62, 74], 46 + 4 * k)
    pn.chord(56, 4, [34, 46, 58, 62, 65, 69, 72], 90, .01)
    for b, d, m in [(57, 1, 77), (58, 1, 81), (59, 1, 84), (60, 2, 79)]:
        pn.n(b, d, m, 78)
    pn.chord(62, 2.2, [29, 41, 60, 65, 69, 72, 77], 86, .012)
    for b in (0, 4, 32, 36, 40, 56, 62):
        pn.cc += [(b + .02, 64, 127), (b + 3.9, 64, 0)]
    put("orch", pn, -1, rev=0.4)

    # harp: glissando on the ignition, one note per letter of "Claude", arpeggios in the breakdown
    hp = Stem("harp", 46)
    for k, m in enumerate([50, 53, 57, 60, 62, 65, 69, 72, 74, 77, 81, 84, 86]):
        hp.n(2 - .5 + k * .036, 2, m, 60 + 3 * k)
    for t, m in zip(letter_t, [62, 65, 69, 74, 77, 81]):
        hp.n(t / B, 2, m, 92)
    for bar in (8, 9):
        v = V[BARS[bar]]
        for k in range(16):
            hp.n(bar * 4 + k * .25, 1, [v[0], v[1], v[2], v[3]][k % 4] + (12 if k >= 8 else 0), 52)
    put("orch", hp, -6, rev=0.5)

    # celesta: sparkle on the ignition and on the final chord; glockenspiel: the reasoning line (bars 6-7)
    ce = Stem("celesta", 8)
    for k, m in enumerate([93, 89, 86, 81, 77, 74, 81, 86]):
        ce.n(2 + k * .12, 1.5, m, 70)
    for k, m in enumerate([77, 81, 84, 89, 93, 96]):
        ce.n(62 + k * .1, 2, m, 76)
    for k, m in enumerate([72, 77, 81, 84]):
        ce.n(56.5 + k * .25, 1.5, m, 60)
    put("orch", ce, -9, rev=0.6, dly=0.2)
    gl = Stem("glock", 9)
    for b, d, m in hook_notes((2, 3)):
        gl.n(24 + b, d, m, 72)
    put("orch", gl, -9, rev=0.5, dly=0.25)

    # strings: swell on "Je suis Claude", ostinato in the build, chords + hook in the drops, tremolo rebuild, outro
    st = Stem("strings", 48)
    st.chord(4, 4, [46, 58, 62, 65], 80)
    st.ramp(4, 7.8, 30, 105)
    for bar in (2, 3):
        r = ROOT[BARS[bar]] + 12
        for k in range(16):
            beat = bar * 4 + k * .25
            if beat >= 15.75:
                continue
            st.n(beat, .2, [r, r + 12, r + 7, r + 12][k % 4], 62 + 12 * (bar - 2) + (16 if k % 4 == 0 else 0))
    st.cc += [(8, 11, 90), (14, 11, 110), (15.9, 11, 127)]
    for bar in range(4, 8):
        st.chord(bar * 4, 4, [ROOT[BARS[bar]] + 12] + [m - 12 for m in V[BARS[bar]][:3]], 82 if bar in DROPS else 66)
    for b, d, m in hook_notes():
        st.n(16 + b, d, m - 12, 88)
    for bar in (8, 9, 10):
        st.chord(bar * 4, 4, [ROOT[BARS[bar]] + 12] + [m - 12 for m in V[BARS[bar]][:3]], 72)
    st.ramp(32, 35.5, 60, 100)
    st.ramp(36, 39.5, 70, 100)
    st.ramp(40, 43.8, 80, 60)
    for k in range(30):   # tremolo, climbing every beat
        beat = 44 + k * .125
        st.chord(beat, .11, [m + 12 * (beat >= 46) for m in (48, 55, 60, 64)], 70 + k)
    st.ramp(44, 47.7, 50, 127)
    st.cc.append((48, 11, 110))
    for bar in (12, 13):
        st.chord(bar * 4, 4, [ROOT[BARS[bar]] + 12] + [m - 12 for m in V[BARS[bar]][:3]], 90)
    for b, d, m in hook_notes():
        st.n(48 + b, d, m - 12, 96)
    st.chord(56, 4, [34, 46, 53, 58, 62, 65, 69], 100)
    st.chord(60, 2, [36, 48, 55, 60, 65, 67], 84)
    st.chord(62, 2.2, [29, 41, 53, 60, 65, 69, 72], 92)
    st.ramp(56, 58, 127, 95)
    put("orch", st, -2, rev=0.4)

    # choir
    ch = Stem("choir", 52)
    for bar in list(DROPS) + [8, 9, 10]:
        ch.chord(bar * 4, 4, V[BARS[bar]][:3], 78 if bar in DROPS else 64)
    ch.chord(56, 6, [58, 62, 65, 69], 90)
    ch.chord(62, 2.2, [60, 65, 69, 72], 80)
    ch.ramp(30, 34, 60, 110)
    put("orch", ch, -5, rev=0.55)

    # brass: swells into the drops, stabs on the drop downbeats, outro
    br = Stem("brass", 61)
    br.chord(14, 1.9, [48, 55, 60, 64], 96)
    br.ramp(14, 15.9, 20, 127)
    br.chord(46, 1.9, [48, 55, 60, 64], 100)
    br.ramp(46, 47.9, 20, 127)
    for bar in DROPS:
        for off in (0, 2.5):
            br.chord(bar * 4 + off, .7 if off else 1.2, [ROOT[BARS[bar]] + 12] + [m - 12 for m in V[BARS[bar]][:3]], 104)
        br.cc += [(bar * 4, 11, 120)]
    br.chord(56, 4, [34, 46, 53, 58, 62], 100)
    br.ramp(56, 59.5, 120, 70)
    br.chord(62, 2, [41, 53, 60, 65], 84)
    put("orch", br, -3, rev=0.35)

    # warm pad bed
    pd = Stem("pad", 89)
    for bar in (0, 1, 8, 9, 10):
        pd.chord(bar * 4, 4.2, V[BARS[bar]], 70)
    pd.chord(56, 6, V["Bbmaj9"], 70)
    pd.chord(62, 2.2, V["Fadd9"], 70)
    put("orch", pd, -8, rev=0.4)

    # saw lead hook (drop 1, drop 2 with the octave)
    ld = Stem("lead", 81)
    for b, d, m in hook_notes():
        ld.n(16 + b, d - .05, m, 100)
    for b, d, m in hook_notes():
        ld.n(48 + b, d - .05, m, 108)
        ld.n(48 + b, d - .05, m + 12, 80)
    put("lead", ld, -1, rev=0.25, dly=0.3)

    # percussion: orchestra hits, timpani, taiko, cymbals and snare rolls (GM kit)
    oh = Stem("orchhit", 55)
    for b, m in [(2, 62), (14, 62), (14.5, 65), (15, 69), (15.5, 74), (16, 62), (48, 62), (56, 58)]:
        oh.chord(b, 1.5, [m, m - 12], 120)
    put("perc", oh, -1, rev=0.35)
    tp = Stem("timpani", 47)
    for k in range(14):
        tp.n(14 + k * .125, .12, 38, 50 + 4 * k)
    for k in range(14):
        tp.n(46 + k * .125, .12, 45, 50 + 4 * k)
    for b, ms in [(2, (38,)), (16, (38, 45)), (32, (34,)), (48, (38, 45)), (56, (34, 46)), (62, (41,))]:
        for m in ms:
            tp.n(b, 2, m, 120)
    put("perc", tp, -1, rev=0.35, lp=4000)
    tk = Stem("taiko", 116)
    for bar in (2, 3):
        for off in (0, 2, 3.5):
            tk.n(bar * 4 + off, 1, 50, 100 + 12 * (bar - 2))
    for k, b in enumerate([13.0, 13.25, 13.5, 13.75]):
        tk.n(b, .5, 52, 90 + 8 * k)
    for bar in DROPS:
        for off in (0, 1.5, 2.5):
            tk.n(bar * 4 + off, 1, 48, 110 if off == 0 else 90)
    for k in range(16):
        tk.n(44 + k * (.5 if k < 8 else .25 if k < 12 else .125), .5, 50, 70 + 3 * k)
    for k, b in enumerate([22, 22.5, 23, 23.25, 23.5, 23.75]):
        tk.n(b, .5, 52, 90 + 6 * k)
    tk.n(56, 2, 45, 127)
    put("perc", tk, -1, rev=0.3)
    gm = Stem("kit", 0, drum=True)
    for b in (16, 48, 56, 62):
        gm.n(b, 4, 49, 120)
        gm.n(b, 4, 57, 100)
    for b in (24, 32, 40):
        gm.n(b, 4, 55, 90)
    for k in range(28):
        gm.n(14 + k * .0625, .06, 38, 40 + 3 * k)
        gm.n(46 + k * .0625, .06, 38, 40 + 3 * k)
    for k, b in enumerate([23, 23.25, 23.5, 23.75]):
        gm.n(b, .3, [50, 48, 45, 43][k], 105)
    put("perc", gm, -6, rev=0.3)


# ------------------------------------------------------------------ electronic layer (synthesized)
def gated_chord(name, b, gain, bright, octave=12):
    n = int(BARL * SR)
    chd = sum(supersaw(mtof(m + octave), n, det=0.2) for m in V[name][:4]) / 3.2
    gate = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]
    g = np.zeros(n)
    st = int(n / 16)
    tb = tt(st)
    for k, on in enumerate(gate):
        if on:
            g[k * st:(k + 1) * st] = np.minimum(1, tb / 0.003) * (0.55 + 0.45 * np.exp(-tb / 0.05)) * np.clip((st / SR - tb) / 0.012, 0, 1)
    place("pads", filt(chd * g, "low", bright), bar_t(b), gain, rev=0.25, dly=0.12)


def build_electro():
    for b in DROPS:
        gated_chord(BARS[b], b, 1.6, 7000 if b >= 12 else 6000)
    for b in (6, 7):
        gated_chord(BARS[b], b, 0.6, 3800)
    for b0 in (4, 12):   # supersaw layer under the sampled lead
        for bo, st_, m, ln in HOOK:
            if bo > 1:
                continue
            place("lead", lead(m, ln * BARL / 8 - 0.02, 0.8), bar_t(b0) + bo * BARL + st_ * BARL / 8, 0.45, rev=0.2, dly=0.25)
    # sub bass on the roots
    for b, name in enumerate(BARS):
        if b < 2 or b == 15 or b in (8, 9, 10):
            continue
        s, d = bar_t(b), BARL
        if b == 3:
            d = bt(3.75)
        if b == 11:
            d = bt(3.6)
        g = 0.14 if b < 4 else 0.32 if b in DROPS else 0.24 if b in (6, 7) else 0.2 if b == 11 else 0.34
        n = int(d * SR)
        tb = tt(n)
        env = np.minimum(1, tb / 0.02) * np.clip((d - tb) / 0.05, 0, 1) * (np.exp(-tb / 1.4) if b == 14 else 1)
        place("bass", np.sin(2 * np.pi * mtof(ROOT[name]) * tb) * env, s, g)
    n = int((DUR - bt(62)) * SR)
    place("bass", np.sin(2 * np.pi * mtof(29) * tt(n)) * np.minimum(1, tt(n) / 0.02) * np.exp(-tt(n) / 1.2), bt(62), 0.3)
    for b in (2, 3, 11):   # build bass: 8ths, filter opening
        f = mtof(ROOT[BARS[b]] + 12)
        for k in range(8):
            s = bar_t(b) + k * BARL / 8
            if (b == 3 and s >= bt(15.75)) or (b == 11 and s >= bt(47.6)):
                continue
            n = int(0.22 * SR)
            v = saw(f, n) + 0.5 * square(f, n)
            fc = (320 + (160 if b == 3 else 0) + 700 * k / 8) * (1 + 2.5 * np.exp(-tt(n) / 0.05))
            place("bass", tvf(v, fc, q=1.1) * adsr(0.19, 0.003, 0.08, 0.6, 0.03)[:n], s, 0.1)
    for b in (4, 5, 6, 7, 12, 13):   # drop bass: offbeat 16ths
        f = mtof(ROOT[BARS[b]] + 12)
        for s16 in (2, 3, 6, 7, 10, 11, 14, 15):
            s = bar_t(b) + s16 * BARL / 16
            n = int(0.13 * SR)
            v = saw(f, n) + 0.6 * square(f * 0.5, n)
            v = tvf(v, 350 + 2600 * np.exp(-tt(n) / 0.045), q=1.4) * adsr(0.1, 0.002, 0.06, 0.55, 0.03)[:n]
            place("bass", v, s, (0.14 if s16 % 4 == 2 else 0.1) * (0.8 if b in (6, 7) else 1))


def kick2():   # a punchier kick for the drops: longer body, tighter click, a little saturation
    n = int(0.6 * SR)
    t = tt(n)
    f = 45 + 160 * np.exp(-t / 0.028) + 60 * np.exp(-t / 0.004)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.36)
    cl = filt(noise(n), "high", 3000) * np.exp(-t / 0.002) * 0.5
    return np.tanh(2.2 * (body + cl)) / np.tanh(2.2)


K2 = kick2()


def build_drums():
    for s in (bt(4), bt(5), bt(6), bt(7)):   # heartbeat under "Je suis Claude"
        hit_kick(s, 0.22)
    for s in np.arange(bt(8), bt(14), B):
        place("kick", K2, s, 0.5)
        KICKS.append(s)
    for b in (2, 3):
        for off in (1, 3):
            if bar_t(b) + bt(off) < bt(14):
                place("drums", CL, bar_t(b) + bt(off), 0.2, rev=0.35)
    for s in np.arange(bt(10), bt(14), B / 2):
        if abs((s / B) % 1 - 0.5) < 1e-6:
            place("drums", HC, s, 0.12, pan=0.25)
    place("fx", riser(BARL, 300, 9000), bar_t(3), 0.1, rev=0.3)
    place("drums", rev_crash(1.0), bt(16) - 1.0, 0.15, rev=0.3)

    def drop(b0, b1, full=True):
        for s in np.arange(bar_t(b0), bar_t(b1), B):
            place("kick", K2, s, 0.6 if full else 0.5)
            KICKS.append(s)
        for b in range(b0, b1):
            for off in (1, 3):
                place("drums", CL, bar_t(b) + bt(off), 0.42 if full else 0.3, rev=0.3)
                place("drums", SN, bar_t(b) + bt(off), 0.07, rev=0.2)
        for s in np.arange(bar_t(b0), bar_t(b1), B / 4):
            k = int(round((s / B) % 1 * 4)) % 4
            place("drums", HC, s, [0.07, 0.1, 0.17, 0.1][k], pan=-0.2 + 0.13 * k)
            if full:
                place("drums", shaker(), s + 0.004, 0.03, pan=0.4)
        for s in np.arange(bar_t(b0) + B / 2, bar_t(b1), B):
            place("drums", HO, s, 0.11 if full else 0.07, pan=0.15)

    drop(4, 6)
    drop(6, 8, full=False)
    n = int(1.8 * SR)
    for s in (bt(16), bt(32), bt(48)):
        place("fx", swept(1.8, 6000, 300, 1.2) * np.exp(-tt(n) / 0.6), s, 0.05, rev=0.3)
    for s in np.arange(bar_t(9), bar_t(11), B / 2):
        place("drums", shaker(), s, 0.028 if (s / B) % 1 else 0.016, pan=0.35)
    ks = list(np.arange(bt(44), bt(46), B)) + list(np.arange(bt(46), bt(47), B / 2)) + list(np.arange(bt(47), bt(47.75), B / 4))
    for s in ks:
        place("kick", K2, s, 0.4 + 0.22 * (s - bt(44)) / bt(3.75))
        KICKS.append(s)
    place("fx", riser(BARL, 400, 10000), bar_t(11), 0.11, rev=0.3)
    place("drums", rev_crash(1.0), bt(48) - 1.0, 0.18, rev=0.3)
    drop(12, 14)
    place("kick", K2, bar_t(14), 0.8)
    KICKS.append(bar_t(14))


# ------------------------------------------------------------------ sound effects on the film's cues
def s_key2(i):   # mechanical key: press click, short body, release click
    n = int(0.09 * SR)
    t = tt(n)
    r = np.random.default_rng(1000 + i)
    press = filt(noise(n), "bp", (1800, 7000)) * np.exp(-t / 0.004)
    body = np.sin(2 * np.pi * (180 + 40 * r.random()) * t) * np.exp(-t / 0.02) * 0.5
    rel = np.zeros(n)
    o = int((0.045 + 0.01 * r.random()) * SR)
    rel[o:] = filt(noise(n - o), "bp", (2500, 8000)) * np.exp(-tt(n - o) / 0.003) * 0.45
    return press + body + rel


def s_glitch(i):   # digital stutter for the burst cuts
    n = int(0.16 * SR)
    t = tt(n)
    f = [1800, 2400, 1400, 3000, 2000, 2600, 1600][i % 7]
    sq = np.sign(np.sin(2 * np.pi * f * t * (1 + 0.5 * np.exp(-t / 0.02))))
    g = (np.floor(t / 0.012) % 2 == 0).astype(float)
    return filt(sq * g, "bp", (500, 7000)) * np.exp(-t / 0.05)


def s_shepard(dur):   # endless rise: octave-spaced sines climbing, loudness bell over log frequency
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    out = np.zeros(n)
    for k in range(6):
        oc = (k + 1.6 * p) % 6
        f = 55 * 2 ** oc
        a = np.exp(-((oc - 3) ** 2) / 2.2)
        out += np.sin(2 * np.pi * np.cumsum(f) / SR) * a
    return out / 3 * p ** 1.5


def s_whoosh2(dur, pan_dir):
    v = whoosh(dur, 300, 6000, 0.55)
    v += whoosh(dur, 80, 600, 0.6) * 0.5
    pan = np.linspace(-0.85, 0.85, len(v)) * pan_dir
    return np.vstack([v * np.cos((pan + 1) * np.pi / 4), v * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)


def s_boom():   # layered drop impact: sub drop, body, air
    n = int(3.5 * SR)
    t = tt(n)
    sub = np.sin(2 * np.pi * np.cumsum(28 + 90 * np.exp(-t / 0.12)) / SR) * np.exp(-t / 1.3)
    body = filt(noise(n), "low", 900) * np.exp(-t / 0.18)
    air = filt(noise(n), "high", 4000) * np.exp(-t / 0.6) * 0.25
    return np.tanh(1.5 * (sub + 0.5 * body + air))


def s_sparkle(d, seed):
    n = int(d * SR)
    out = np.zeros((2, n))
    r = np.random.default_rng(seed)
    for _ in range(int(d * 16)):
        o = int(r.random() * n * 0.85)
        m = int(0.1 * SR)
        f = 2500 + 4500 * r.random()
        s = np.sin(2 * np.pi * f * tt(m)) * np.exp(-tt(m) / 0.025)
        pan = r.random() * 2 - 1
        k = min(m, n - o)
        out[0, o:o + k] += s[:k] * np.cos((pan + 1) * np.pi / 4) * (1 - o / n)
        out[1, o:o + k] += s[:k] * np.sin((pan + 1) * np.pi / 4) * (1 - o / n)
    return out


def build_sfx(cues):
    for c in cues:
        k, t, i, soft = c["k"], c["t"], c.get("i", 0), c.get("soft", 0)
        g = 0.55 if soft else 1.0
        if k == "blip":
            n = int(0.5 * SR)
            tb = tt(n)
            place("fx", np.sin(2 * np.pi * 1174.7 * tb) * np.exp(-tb / 0.1) * np.minimum(1, tb / 0.003), t, 0.05, rev=0.7)
        elif k == "thump":
            n = int(0.7 * SR)
            tb = tt(n)
            place("fx", np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-tb / 0.05)) / SR) * np.exp(-tb / 0.22), t, 0.4)
        elif k == "ignite":
            place("fx", s_boom(), t, 0.36, rev=0.5)
            place("drums", rev_crash(0.9), t - 0.9, 0.14, rev=0.3)
        elif k == "sparkle":
            place("fx", s_sparkle(c["d"], int(t * 1000)), t, 0.03 * g, rev=0.6)
        elif k == "key":
            place("fx", s_key2(i), t, (0.09 if soft else 0.13) * (0.85 + 0.3 * ((i * 37) % 7) / 7), pan=0.12 * ((i % 3) - 1), rev=0.08)
        elif k == "pop":
            place("fx", s_pop(i), t, 0.08 * g, pan=0.25 * np.sin(i * 1.7), rev=0.3)
        elif k == "tick":
            place("fx", s_tick(i), t, 0.045 * g, pan=0.2 * np.sin(i * 2.3), rev=0.3)
        elif k == "swoosh":
            place("fx", s_whoosh2(0.55, 1 if i % 2 == 0 else -1), t - 0.3, 0.1, rev=0.3)
        elif k == "swish":
            place("fx", whoosh(0.35, 1500, 7000, 0.35), t, 0.06, rev=0.25)
        elif k == "whip":
            d = c["d"] + 0.18
            place("fx", s_whoosh2(d, 1 if i % 2 == 0 else -1), t - d / 2, 0.2, rev=0.2)
        elif k == "scribble":
            place("fx", s_scribble(c["d"]), t, 0.04, pan=0.3)
        elif k == "scan":
            place("fx", s_scan(c["d"]), t, 0.045, pan=0.25, rev=0.2)
        elif k == "ping":
            place("fx", bell([81, 84, 86, 88, 93][i % 5], 0.6, 1.6), t, 0.05, pan=-0.3 + 0.15 * i, rev=0.5, dly=0.2)
        elif k == "grow":
            n = int(c["d"] * SR)
            p = np.linspace(0, 1, n)
            place("fx", swept(c["d"], 1200, 6000, 3.0) * np.sin(np.pi * p) ** 0.6, t, 0.03, pan=0.2, rev=0.3)
        elif k == "hit":
            place("fx", s_hit(i), t, 0.22, pan=0.18 * (1 if i % 2 else -1), rev=0.15)
            place("fx", s_glitch(i), t + 0.03, 0.05, pan=-0.3 if i % 2 else 0.3)
        elif k == "suck":
            place("fx", s_suck(c["d"]), t, 0.18, rev=0.2)
            place("fx", s_shepard(c["d"] + 0.4), t - 0.4, 0.05)
        elif k == "boom":
            place("fx", s_boom(), t, 0.4, rev=0.55)
        elif k == "impact":
            place("fx", impact(0.8), t, 0.3, rev=0.5)
        elif k == "shimmer":
            place("fx", s_shimmer(), t, 0.05 * g, pan=0.15, rev=0.7)
        elif k == "orbit":
            place("fx", s_orbit(c["d"]), t, 0.1, rev=0.3)
            place("fx", s_shepard(c["d"]), t, 0.035)
        elif k == "riser":
            place("fx", riser(c["d"], 500, 9000), t, 0.1, rev=0.3)
            place("fx", s_shepard(c["d"]), t, 0.03)
        elif k == "tok":
            place("fx", s_tok(i), t, 0.08, rev=0.35)
        elif k == "chime":
            place("fx", bell(89, 0.6, 2.4) + 0.6 * bell(96, 0.4, 2.4), t, 0.06, rev=0.6, dly=0.2)
        elif k == "zap":
            n = int(0.25 * SR)
            tb = tt(n)
            place("fx", np.sin(2 * np.pi * np.cumsum(3200 * np.exp(-tb / 0.05) + 200) / SR) * np.exp(-tb / 0.06), t, 0.025, pan=c.get("pan", 0), rev=0.4, dly=0.2)


# ------------------------------------------------------------------ mix
def sidechain(depth, rel=0.13):
    t = tt(N)
    g = np.ones(N)
    for k in KICKS:
        i0, i1 = int(k * SR), min(N, int((k + 0.45) * SR))
        tb = t[i0:i1] - k
        g[i0:i1] = np.minimum(g[i0:i1], 1 - depth * np.minimum(1, tb / 0.004) * np.exp(-tb / rel))
    return g


def reverb_ir(rt=2.6, pre=0.025):
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


def glue(x, thr_db=-15, ratio=2.4, att=0.008, rel=0.15):
    lvl = np.abs(x).max(axis=0)
    a_c, r_c = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    env = lfilter([1 - r_c], [1, -r_c], lfilter([1 - a_c], [1, -a_c], lvl))
    gr = -np.maximum(0, 20 * np.log10(env + 1e-9) - thr_db) * (1 - 1 / ratio)
    return x * 10 ** (gr / 20)


def widen(x, amt=1.25):
    m, s = (x[0] + x[1]) / 2, (x[0] - x[1]) / 2
    s = filt(s, "high", 250) * amt + (s - filt(s, "high", 250))
    return np.vstack([m + s, m - s])


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    cues = json.loads((OUT / "cues.json").read_text())
    compose_orchestra()
    build_electro()
    build_drums()
    build_sfx(cues)
    sc_full, sc_soft = sidechain(0.6), sidechain(0.3)
    mix = (BUS["kick"] + BUS["drums"] + BUS["perc"] + BUS["bass"] * sc_full + BUS["pads"] * sc_full + BUS["orch"] * sc_soft
           + BUS["lead"] * sc_soft + BUS["keys"] * sc_soft + BUS["fx"])
    send_d = filt(filt(SEND_DLY, "high", 350), "low", 5000)
    mix += fftconvolve(send_d, delay_ir(), axes=1)[:, :N] * 0.45
    ir = reverb_ir()
    wet = np.vstack([fftconvolve(SEND_REV[c], ir[c])[:N] for c in range(2)])
    mix += filt(wet, "high", 200) * 0.45
    mix = filt(mix, "high", 26)
    mix = peq(peq(peq(peq(mix, 820, -2.0, 0.9), 3200, 1.5, 0.7), 55, 2.0, 0.8), 11000, 1.5, 0.7)
    mix = widen(mix)
    mix = glue(mix)
    t = tt(N)
    mix *= np.clip((DUR - t) / 0.6, 0, 1)
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.3) / np.tanh(1.3) * 0.9
    write_wav(OUT / "mix_raw.wav", mix)
    for k, x in BUS.items():
        for a, b, name in ((7.5, 11.25, "drop"), (15, 20.6, "break")):
            q = x[:, int(a * SR): int(b * SR)]
            print(f"  bus {k:5s} {name:5s} rms {20 * np.log10(np.sqrt((q ** 2).mean()) + 1e-9):6.1f} dB")
    for a, b, name in ((0, 3.75, "intro"), (3.75, 7.4, "build"), (7.5, 11.25, "drop 1"), (11.25, 15, "drop 1b"), (15, 20.6, "breakdown"),
                       (20.6, 22.4, "rebuild"), (22.5, 26.25, "drop 2"), (26.25, 30, "outro")):
        s = mix[:, int(a * SR): int(b * SR)]
        print(f"{name:10s} rms {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dB  peak {20 * np.log10(np.abs(s).max() + 1e-9):6.1f} dB")
