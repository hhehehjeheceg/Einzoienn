# « Et si… » — série de YouTube Shorts

Shorts verticaux (9:16) d'une minute en motion design 2D. Chaque épisode plonge
le spectateur dans un scénario « Et si… » : sur soi (aveugle, trisomie 21,
couleur de peau…) ou sur le monde (plus de vent, plus d'oxygène…).

## Règles d'écriture

- **Toujours à la 2e personne du singulier.** Titre et narration parlent au
  spectateur : « Et si **tu** étais aveugle ? », « Tu te réveilles et… ».
  Jamais « Et si j'étais… ».
- Léo vit le scénario à la place du spectateur : on le voit tout le temps.
- Max est la personne qui lui pourrit la vie dans le scénario (moqueries,
  discrimination, injustice). Le récit montre toujours clairement qu'il a tort.

## Personnages

| | Rôle | Signes distinctifs |
|---|---|---|
| **Léo** | Le héros | Sweat jaune, épi, grands yeux, taches de rousseur |
| **Max** | L'ennemi | Mèche blonde, blouson rouge écusson M, filme tout au téléphone |

Rig, fiche et maquette : `personnages/` (`node render.mjs <page.html> <sortie.png> [l] [h]`).
Passants et chat : `personnages/extras.js`.

Format sonore : **voix off du narrateur uniquement** (les personnages ne parlent
pas) et **bruitages, sans musique**. La fin demande toujours de s'abonner et de liker.

## Épisodes

| # | Titre | Dossier | Vidéo |
|---|---|---|---|
| 1 | Et si… tu pouvais entendre les pensées des autres ? | `ep1-pensees/` | `ep1-pensees/out/et-si-ep1-pensees.mp4` |

## Fabriquer un épisode (pipeline de ep1)

1. Voix off ElevenLabs (`eleven_v4`, voix « Martin »), balises d'émotion dans le texte.
2. Alignement mot à mot (Scribe) → `audio/words_a.json`.
3. `python3 build_cues.py` : insère les silences dramatiques, écrit `out/vo_timeline.wav`
   et `cues.js` (temps de chaque mot sur la timeline du film).
4. `ep1.js` : moteur `seek(t)` déterministe, scènes calées sur les mots, sous-titres karaoké.
5. `node render.mjs stills <t…>` pour vérifier, puis `node render.mjs video 60 6`.
6. `python3 audio.py` : bruitages ElevenLabs placés sur leur pic + synthèse, -14 LUFS.
7. Encodage final H.264 1080 x 1920, yuv420p, BT.709 plage TV, AAC, faststart.
