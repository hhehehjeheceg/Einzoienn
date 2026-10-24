"""Monte la voix off sur la timeline du film et écrit les timings de chaque mot.

Entrées : audio/vo.mp3 (ElevenLabs, ép. 2), audio/words.json (alignement Scribe).
Sorties : out/vo_timeline.wav (48 kHz stéréo, silences dramatiques insérés)
          cues.js (window.CUES = mots + segments en temps film, lu par ep1.html)
"""
import json
import subprocess
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
OUT = HERE / "out"
SR = 48000
START = 0.30          # la voix démarre après le premier impact visuel
TOTAL = 59.0          # durée du film
# (coupure dans la VO en s, silence inséré en s) : coupures placées dans des silences mesurés
GAPS = [(24.22, 0.45),   # « Et évidemment… Max a compris. »
        (31.22, 0.60),   # « Tout le monde se tait. »
        (39.17, 0.55)]   # « Silence. »


def vo_to_film(t):
    off = START
    for cut, gap in GAPS:
        if t >= cut:
            off += gap
    return t + off


def main():
    OUT.mkdir(exist_ok=True)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(HERE / "audio/vo_iso.mp3"), "-f", "f32le",
                          "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    vo = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T
    film = np.zeros((2, int(TOTAL * SR)), dtype=np.float32)
    cuts = [0.0] + [c for c, _ in GAPS] + [vo.shape[1] / SR]
    for a, b in zip(cuts[:-1], cuts[1:]):
        ia, ib = int(a * SR), int(b * SR)
        piece = vo[:, ia:ib].copy()
        f = int(0.006 * SR)  # micro fondu pour éviter les clics aux coupures
        piece[:, :f] *= np.linspace(0, 1, f)
        piece[:, -f:] *= np.linspace(1, 0, f)
        o = int(vo_to_film(a + 1e-6) * SR)
        film[:, o:o + piece.shape[1]] += piece
    pcm = (np.clip(film, -1, 1) * 32767).astype("<i2").T.tobytes()
    import wave
    with wave.open(str(OUT / "vo_timeline.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm)

    words = json.loads((HERE / "audio/words.json").read_text())["words"]
    cues = []
    for w in words:
        txt = w["text"]
        if txt.startswith("[") or txt.endswith("]") or txt in "«»?!":
            continue
        cues.append({"w": txt, "s": round(vo_to_film(w["start"]), 3), "e": round(vo_to_film(w["end"]), 3)})
    (HERE / "cues.js").write_text("window.CUES = " + json.dumps(cues, ensure_ascii=False) + ";\n")
    print(len(cues), "mots ; dernier mot fini à", cues[-1]["e"], "s")


if __name__ == "__main__":
    main()
