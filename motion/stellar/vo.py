"""Place the ElevenLabs voice-over on the picture: cut the take on its own pauses and put each phrase
at the film time listed in src/js/01-timeline.js (VO table, exported in out/cues.json).

    python3 vo.py assets/vo/vo_take1.mp3   -> out/vo_placed.wav (48 kHz stereo, 60 s)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
SR = 48000
src = Path(sys.argv[1] if len(sys.argv) > 1 else HERE / "assets/vo/vo_take1.mp3")
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
voice = np.frombuffer(raw, np.float32)
vo = json.loads((HERE / "out/cues.json").read_text())["vo"]
out = np.zeros(int(60 * SR), np.float32)
for s0, s1, t, text in vo:
    a, b = int(max(0, s0 - .05) * SR), int(min(len(voice) / SR, s1 + .12) * SR)
    seg = voice[a:b].copy()
    fi, fo = int(.008 * SR), int(.06 * SR)
    seg[:fi] *= np.linspace(0, 1, fi)
    seg[-fo:] *= np.linspace(1, 0, fo)
    i = int((t - .05) * SR)
    n = min(len(seg), len(out) - i)
    out[i:i + n] += seg[:n]
    print(f"{t:6.2f}s  {text}")
st = np.stack([out, out], 1)
import wave
with wave.open(str(HERE / "out/vo_placed.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())
