"""Remplace deux phrases dont le dernier mot (« vues ») était presque inaudible dans la prise d'origine.

audio/vo_fix.mp3 = nouvelle prise (même voix) : « Deux millions de vues ! … Dix millions de vues ! »
Sortie : out/vo_timeline_fix.wav + cues.js mis à jour pour les mots remplacés.
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
SR = 48000


def read(path, *filters):
    af = ['-af', ','.join(filters)] if filters else []
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), *af, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)


base = read(HERE / 'out/vo_timeline.wav')
# (début dans la prise, fin dans la prise, tempo, début dans le film, fin de la zone remplacée, mots)
PIECES = [(0.0, 1.22, 1.12, 7.24, 8.28, ['Deux', 'millions', 'de', 'vues.']),
          (1.50, 2.86, 1.0, 44.12, 45.70, ['dix', 'millions', 'de', 'vues.'])]
src = (HERE / 'cues.js').read_text()
cues = json.loads(src[src.index('['):src.rindex(']') + 1])


def rms(x):
    m = np.abs(x).mean(0) > 0.01
    return np.sqrt((x[:, m] ** 2).mean()) if m.any() else 1e-9


ref = rms(base[:, int(6.3 * SR):int(7.2 * SR)])
for a, b, tempo, t0, t1, words in PIECES:
    p = read(HERE / 'audio/vo_fix.mp3', f'atrim={a}:{b}', 'asetpts=PTS-STARTPTS', f'atempo={tempo}')
    n = p.shape[1]
    fade = int(0.01 * SR)
    p[:, :fade] *= np.linspace(0, 1, fade); p[:, -int(0.06 * SR):] *= np.linspace(1, 0, int(0.06 * SR))
    p *= ref / rms(p)
    s, e = int(t0 * SR), int(t1 * SR)
    base[:, s:e] = 0
    base[:, s:s + n] = p[:, :min(n, base.shape[1] - s)]
    # mots : répartis sur la durée parlée de la nouvelle prise
    env = np.abs(p).mean(0)
    on = np.where(env > env.max() * 0.05)[0]
    sp0, sp1 = t0 + on[0] / SR, t0 + on[-1] / SR
    idx = [i for i, c in enumerate(cues) if c['w'].lower().strip('«».!') in [w.lower().strip('.!') for w in words] and t0 - 0.2 <= c['s'] <= t1]
    idx = idx[:len(words)]
    lens = np.array([len(cues[i]['w']) + 2 for i in idx], float)
    edges = sp0 + np.concatenate([[0], np.cumsum(lens)]) / lens.sum() * (sp1 - sp0)
    for k, i in enumerate(idx):
        cues[i]['s'], cues[i]['e'] = round(float(edges[k]), 3), round(float(edges[k + 1]), 3)
    print(f'{" ".join(words)} : {sp0:.2f} -> {sp1:.2f} s', [(cues[i]['w'], cues[i]['s']) for i in idx])

pcm = (np.clip(base, -1, 1) * 32767).astype('<i2').T.tobytes()
with wave.open(str(HERE / 'out/vo_timeline_fix.wav'), 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)
(HERE / 'cues.js').write_text('window.CUES = ' + json.dumps(cues, ensure_ascii=False) + ';\n')
