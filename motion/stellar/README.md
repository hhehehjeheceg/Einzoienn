# Project Stellar, trailer 60 s (9:16)

Motion design 100 % code : moteur HTML (canvas 2D + three.js), chaque image calculée à partir du temps,
rendu image par image avec Playwright, voix off ElevenLabs, musique et bruitages synthétisés.

- **Format** : 1080 × 1920, 30 i/s, 60 s, H.264 BT.709, AAC 48 kHz, -14 LUFS.
- **Voix** : ElevenLabs `eleven_v3`, voix « Paul K, French Ad & Trailer Voice », découpée sur ses propres pauses et calée phrase par phrase (`VO` dans `src/js/01-timeline.js`).
- **Musique** : lo-fi / synthwave chill 90 BPM en ré majeur (Gmaj9, F#m7, Em9, A7sus4), drop sur la mesure 9 (24,0 s) = « Project Stellar la ramène ». Synthétisée dans `audio.py`, aucun sample.
- **Bruitages** : 20 types synthétisés (tampon, whoosh, split-flap, machine à écrire, verre brisé, construction, confettis...) placés sur les repères exportés par la page.
- **3D** : île low-poly procédurale avec rivière, forêts et les lieux (L'Agence au dôme doré, Le Yacht, Le Requin, La Plateforme), Battle Bus sous son ballon, nébuleuse + 5000 étoiles, étoile chromée Stellar, murs de construction en plan bleu.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/js/01-timeline.js` | toutes les scènes et la voix, en secondes |
| `src/js/10-gl.js`, `20-gl-shots.js` | modèles 3D et caméras |
| `src/js/30-2d.js` | typo, cartes, tampon, split-screen, particules |
| `src/js/80-compose.js` | post (punch, shake, flou de transition, bloom, grain), flou de mouvement, repères son |
| `build.py` | assemble `stellar.html` (polices intégrées) |
| `render.mjs` | `stills`, `draft`, `chunk`, `cues` |
| `vo.py`, `audio.py` | voix placée, musique, bruitages, mix |
| `add_gameplay.py` | insère de vraies vidéos de gameplay dans les 2 emplacements prévus |
| `REFERENCES.md` | sources des faits et vidéos de référence |

## Reproduire

```bash
python3 build.py
python3 -m http.server 8765 --bind 127.0.0.1 &          # la page charge three.js en module
node render.mjs cues && python3 vo.py assets/vo/vo_take1.mp3 && python3 audio.py
node render.mjs chunk 0 600 c1 & node render.mjs chunk 600 1200 c2 & node render.mjs chunk 1200 1800 c3 & wait
# concat + mux : voir la commande « encode » en bas de ce fichier
```

Aperçu interactif : ouvrir `http://127.0.0.1:8765/stellar.html` (Espace lecture, flèches image par image, R rejouer).

## Ajouter du vrai gameplay

L'environnement de création bloquait YouTube : les deux emplacements gameplay jouent pour l'instant des plans 3D codés.
Avec tes captures (mp4) :

```bash
python3 add_gameplay.py A ma_partie.mp4 12.5   # 6,8 s à partir de 12,5 s, sous « revivre le Fortnite OG »
python3 add_gameplay.py B mon_top1.mp4 3       # 3,1 s, sous « Top 1 »
python3 build.py   # puis re-rendre 800-1000 et 1300-1390 et ré-encoder
```

## Encode

```bash
printf "file 'c1.mkv'\nfile 'c2.mkv'\nfile 'c3.mkv'\n" > out/list.txt
ffmpeg -f concat -i out/list.txt -i out/mix.wav -map 0:v -map 1:a \
  -vf "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -crf 16 -preset slow -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -movflags +faststart out/project-stellar-trailer-9x16.mp4
```
