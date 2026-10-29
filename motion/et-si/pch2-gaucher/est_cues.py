"""Minutage PROVISOIRE (avant la vraie voix) : répartit les mots du texte au rythme d'une voix off.
Remplacé par build_cues.py dès que la voix réelle et son alignement mot à mot existent."""
import json, re
from pathlib import Path
HERE = Path(__file__).parent
lines = [l for l in (HERE / 'script.txt').read_text().splitlines() if l.strip()]
t, cues = 0.35, []
for li, line in enumerate(lines):
    for w in line.split():
        if not re.search(r'[\wÀ-ÿ]', w):
            if cues: cues[-1]['w'] += w
            continue
        n = len(re.sub(r'[^\wÀ-ÿ]', '', w))
        d = 0.09 + 0.055 * n
        cues.append({'w': w, 's': round(t, 3), 'e': round(t + d * 0.85, 3)})
        t += d + (0.28 if re.search(r'[.?!…]$', w) else 0.06 if w.endswith(',') else 0.0)
    t += 0.35
(HERE / 'cues.js').write_text('window.CUES = ' + json.dumps(cues, ensure_ascii=False) + ';\n')
print('fin', round(t, 2), 's,', len(cues), 'mots')
