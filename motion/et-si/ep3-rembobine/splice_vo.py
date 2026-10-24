"""Remplace la phrase du penalty (9,10 -> 13,94 s) par la phrase du contrôle, dans la voix et les timings."""
import json, subprocess, wave
from pathlib import Path
import numpy as np
A = Path(__file__).parent / "audio"
SR = 48000
CUT_A, CUT_B = 9.10, 13.94          # silences mesurés avant « Au foot » et avant « Puis »
LINE_WORDS = [{"text": "[amused]", "start": 0, "end": 0.133}, {"text": "En", "start": 0.16, "end": 0.32}, {"text": "contrôle,", "start": 0.4, "end": 1.04},
              {"text": "tu", "start": 1.12, "end": 1.2}, {"text": "vois", "start": 1.24, "end": 1.36}, {"text": "la", "start": 1.4, "end": 1.44},
              {"text": "correction…", "start": 1.52, "end": 2.08}, {"text": "Rembobine.", "start": 2.64, "end": 3.4}, {"text": "Tu", "start": 3.68, "end": 3.76},
              {"text": "écris", "start": 3.84, "end": 4.08}, {"text": "les", "start": 4.16, "end": 4.24}, {"text": "bonnes", "start": 4.28, "end": 4.48},
              {"text": "réponses.", "start": 4.56, "end": 5.28}, {"text": "Vingt", "start": 5.36, "end": 5.44}, {"text": "sur", "start": 5.6, "end": 5.76},
              {"text": "vingt", "start": 5.84, "end": 6.0}]
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T
main, line = load(A / "vo.mp3"), load(A / "vo_controle.mp3")
line = line[:, :int(6.5 * SR)]
out = np.concatenate([main[:, :int(CUT_A * SR)], line, main[:, int(CUT_B * SR):]], axis=1)
with wave.open(str(A / "vo_final.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(out, -1, 1) * 32767).astype("<i2").T.tobytes())
shift = CUT_A + line.shape[1] / SR - CUT_B
words = json.loads((A / "words.json").read_text())["words"]
new = [w for w in words if w["end"] <= CUT_A] + [dict(w, start=w["start"] + CUT_A, end=w["end"] + CUT_A) for w in LINE_WORDS] + \
      [dict(w, start=w["start"] + shift, end=w["end"] + shift) for w in words if w["start"] >= CUT_B]
(A / "words_final.json").write_text(json.dumps({"words": new}, ensure_ascii=False))
print(f"décalage après la phrase : {shift:+.2f} s, durée {out.shape[1] / SR:.2f} s")
