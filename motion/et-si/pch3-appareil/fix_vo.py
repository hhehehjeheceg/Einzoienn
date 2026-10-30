"""Remplace « … dans les cheveux de la prof. » par « … du prof. » (épisode avec seulement des garçons).
À lancer après build_cues.py. Entrée : audio/vo_fix_prof.mp3 (même voix). Sorties : out/vo_timeline_fix.wav, cues.js mis à jour."""
import json, subprocess, wave
from pathlib import Path
import numpy as np
HERE = Path(__file__).parent
SR = 48000
src = (HERE / 'cues.js').read_text()
cues = json.loads(src[src.index('['):src.rindex(']') + 1])
i0 = next(i for i, c in enumerate(cues) if c['w'] == "L'élastique")
i1 = next(i for i in range(i0, len(cues)) if cues[i]['w'].startswith('prof'))
nxt = cues[i1 + 1]['s']
t0, t1 = cues[i0]['s'] - 0.03, nxt - 0.12


def read(path, af=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', str(path)] + (['-af', af] if af else []) + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).T.astype(np.float64)


base = read(HERE / 'out/vo_timeline.wav')
x = read(HERE / 'audio/vo_fix_prof.mp3', 'atrim=0.02:3.52,asetpts=PTS-STARTPTS')
tempo = max(1.0, (x.shape[1] / SR) / (t1 - t0))
if tempo > 1.0:
    x = read(HERE / 'audio/vo_fix_prof.mp3', f'atrim=0.02:3.52,asetpts=PTS-STARTPTS,atempo={tempo:.4f}')
rms = lambda y: np.sqrt((y[:, np.abs(y).mean(0) > 0.01] ** 2).mean())
x *= rms(base[:, int(t0 * SR):int(t1 * SR)]) / rms(x)
f = int(0.01 * SR); x[:, :f] *= np.linspace(0, 1, f); x[:, -int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
a, n = int(t0 * SR), x.shape[1]
base[:, a:int(t1 * SR)] = 0
base[:, a:a + n] = x
# nouveaux mots : temps donnés par Scribe sur la nouvelle prise (décalés du découpage et du tempo)
SCRIBE = [("L'élastique", 0, 0.56), ('part', 0.68, 0.8), ('tout', 0.88, 0.96), ('seul…', 1.0, 1.68), ('et', 1.76, 1.84), ('atterrit', 1.92, 2.4),
          ('dans', 2.427, 2.48), ('les', 2.56, 2.64), ('cheveux', 2.72, 2.96), ('du', 3.0, 3.04), ('prof.', 3.12, 3.5)]
new = [{'w': w, 's': round(t0 + max(0, s - 0.02) / tempo, 3), 'e': round(t0 + (e - 0.02) / tempo, 3)} for w, s, e in SCRIBE]
cues = cues[:i0] + new + cues[i1 + 1:]
pcm = (np.clip(base, -1, 1) * 32767).astype('<i2').T.tobytes()
with wave.open(str(HERE / 'out/vo_timeline_fix.wav'), 'wb') as fw:
    fw.setnchannels(2); fw.setsampwidth(2); fw.setframerate(SR); fw.writeframes(pcm)
(HERE / 'cues.js').write_text('window.CUES = ' + json.dumps(cues, ensure_ascii=False) + ';\n')
print(f'phrase remplacée {t0:.2f}–{t1:.2f} s (tempo {tempo:.3f})', [(c['w'], c['s']) for c in new])
