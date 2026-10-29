"""Timeline de la voix off : respirations entre les phrases + temps de chaque mot (cues.js).
Entrées : audio/vo.mp3 (prise retenue), audio/words.json (Scribe). Sorties : out/vo_timeline.wav, cues.js."""
import json, re, subprocess, wave
from pathlib import Path
import numpy as np
HERE = Path(__file__).parent
SR = 48000
LEAD = 0.35
# respiration ajoutée après la phrase qui finit par ce mot (n-ième occurrence)
GAPS = {('gaucher.', 1): 0.45, ('papier.', 1): 0.35, ('bleu.', 1): 0.35, ('poignet.', 1): 0.3, ('bouchée.', 1): 0.35,
        ('manche.', 1): 0.4, ('»', 1): 0.45, ('bavure.', 1): 0.4, ('fier.', 1): 0.5, ('blanche.', 1): 0.55,
        ('zéro.', 1): 0.25, ('blanche.', 2): 0.6, ('commentaire.', 1): 0.15}
raw = json.loads((HERE / 'audio/words.json').read_text())
words = raw['words'] if isinstance(raw, dict) else raw
words = [w for w in words if w.get('type', 'word') == 'word' and not re.match(r'^\[.*\]$', w['text'])]
# ponctuation seule (« » ?) : collée au mot voisin
toks = []
for w in words:
    if not re.search(r'[\wÀ-ÿ]', w['text']):
        if w['text'].startswith('»') or w['text'] == '?':
            if toks: toks[-1]['text'] += w['text']; toks[-1]['punct_end'] = w['end']
        continue
    toks.append(dict(w))
x = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(HERE / 'audio/vo.mp3'), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
x = np.frombuffer(x, np.float32).astype(np.float64)
seen, cuts = {}, []
for i, w in enumerate(toks[:-1]):
    key = w['text'].lower().replace('».', '»').rstrip('?').strip()
    k2 = re.sub(r'.*»$', '»', key)
    for kk in {key, k2}:
        seen[kk] = seen.get(kk, 0) + 1
    g = GAPS.get((key, seen[key])) or GAPS.get((k2, seen.get(k2, 0)) if k2 == '»' else ('', 0))
    if g:
        # coupe au point le plus silencieux entre les deux mots (évite de garder le début du mot suivant)
        a0, b0 = int((w['end'] - 0.12) * SR), int((toks[i + 1]['start'] + 0.03) * SR)
        hop = int(0.005 * SR); win = int(0.02 * SR)
        en = [np.sqrt((x[j:j + win] ** 2).mean()) for j in range(a0, max(a0 + hop, b0 - win), hop)]
        cut = (a0 + int(np.argmin(en)) * hop + win // 2) / SR
        cuts.append((cut, g))
out = [np.zeros(int(LEAD * SR))]
bounds = [0.0] + [c for c, _ in cuts] + [len(x) / SR]
gaps = [g for _, g in cuts] + [0.0]
for (a, b), g in zip(zip(bounds[:-1], bounds[1:]), gaps):
    seg = x[int(a * SR):int(b * SR)].copy()
    f = int(0.008 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    out.append(seg); out.append(np.zeros(int(g * SR)))
# temps de chaque mot sur la timeline (décalage cumulé par segment)
cues, t0 = [], LEAD
for (a, b), g in zip(zip(bounds[:-1], bounds[1:]), gaps):
    for w in toks:
        if a <= w['start'] < b:
            cues.append({'w': w['text'], 's': round(t0 + w['start'] - a, 3), 'e': round(t0 + w['end'] - a, 3)})
    t0 += (b - a) + g
y = np.concatenate(out)
pcm = (np.clip(np.vstack([y, y]).T, -1, 1) * 32767).astype('<i2').tobytes()
(HERE / 'out').mkdir(exist_ok=True)
with wave.open(str(HERE / 'out/vo_timeline.wav'), 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm)
(HERE / 'cues.js').write_text('window.CUES = ' + json.dumps(cues, ensure_ascii=False) + ';\n')
print('timeline', round(len(y) / SR, 2), 's,', len(cues), 'mots,', len(cuts), 'respirations')
