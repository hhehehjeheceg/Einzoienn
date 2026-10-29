# « Et si… » / « Pourquoi c'est horrible… » — séries de YouTube Shorts

Shorts verticaux (9:16) d'une minute en motion design 2D. Deux formats en alternance :

- **« Et si… »** : le spectateur plonge dans un scénario, sur soi (aveugle, trisomie 21,
  couleur de peau…) ou sur le monde (plus de vent, plus d'oxygène…). Avec Léo et Max.
- **« Pourquoi c'est horrible… »** : une histoire à la 2e personne sur une situation de vie
  (être né le 1er avril, avoir des parents influenceurs, être l'enfant du milieu…).
  **Pas de Max**, et **des personnages différents à chaque épisode** (nouvelle famille,
  nouveau héros, jamais Léo).

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
pas), **bruitages** et, à partir de l'épisode 3, **la musique de la chaîne**
(`musique/musique-chaine.wav`) dès la première seconde, à **17 %** du volume.
Pas d'effet sonore « titre » au début ni à la fin. La voix reste toujours au moins
6 dB au-dessus des bruitages. La fin demande toujours de s'abonner et de liker.

Ne jamais reprendre les situations d'un épisode précédent (déclaration, classe…).
**Pas de morale, jamais de « bon moment » avant la chute** : la fin tourne mal, et ça empire
jusqu'au bout. Pas de chuchotement dans la voix off : on doit entendre chaque mot (les fins
de phrase sont remontées au mixage, un mot inaudible est réenregistré). Pas d'écho dans la voix.

## Épisodes

| # | Titre | Dossier | Vidéo |
|---|---|---|---|
| 1 | Et si… tu pouvais entendre les pensées des autres ? | `ep1-pensees/` | `ep1-pensees/out/et-si-ep1-pensees.mp4` |
| 2 | Et si… tu ne pouvais plus mentir ? | `ep2-mentir/` | `ep2-mentir/out/et-si-ep2-mentir.mp4` |
| 3 | Et si… tu pouvais remonter le temps de 10 secondes ? | `ep3-rembobine/` | `ep3-rembobine/et-si-ep3-rembobine.mp4` |
| 4 | Et si… tout le monde voyait ta note au-dessus de ta tête ? | `ep4-note/` | `ep4-note/et-si-ep4-note.mp4` |
| 5 | Et si… tout ce que tu dessines devenait réel ? | `ep5-dessin/` | `ep5-dessin/et-si-ep5-dessin.mp4` |

| # | Pourquoi c'est horrible… | Dossier | Vidéo |
|---|---|---|---|
| 1 | … d'avoir des parents influenceurs | `pch1-influenceurs/` | `pch1-influenceurs/pch1-influenceurs.mp4` (720p 60 i/s) |

### Rig v2 et gestes (à partir de « Pourquoi c'est horrible » 1)

- `personnages/rig2.js` (`EtSi2.person`) : un seul gabarit pour tous les corps (enfant, ado,
  adulte, rond, âgé, petit), ombrage cel, 51 émotions, mains (ouverte, poing, pointe, prière,
  téléphone, filmer…), coude « bas » pour les gestes devant le buste.
- `personnages/gestes.js` (`EtSi2.geste(nom, corps)`) : 106 gestes calculés depuis les repères
  du corps (prière, supplier, filmer à une ou deux mains, bras croisés…).
- `pch1-influenceurs/pch1_lib.js` : acteurs animés (poses mélangées en ressort, regard qui
  bouge, clignements, respiration, cheveux qui suivent) + effets (compteurs de vues,
  notifications, viseur REC, clap, tampon, lumière annulaire…).
- Rendu : chaque image est capturée deux fois et gardée seulement si les deux captures sont
  identiques (le navigateur rate parfois un découpage d'ombre).

## Fabriquer un épisode (pipeline de ep1)

1. Voix off ElevenLabs (`eleven_v4`, voix « Martin »), balises d'émotion dans le texte.
2. Alignement mot à mot (Scribe) → `audio/words_a.json`.
3. `python3 build_cues.py` : insère les silences dramatiques, écrit `out/vo_timeline.wav`
   et `cues.js` (temps de chaque mot sur la timeline du film).
4. `ep1.js` : moteur `seek(t)` déterministe, scènes calées sur les mots, sous-titres karaoké.
5. `node render.mjs stills <t…>` pour vérifier, puis `node render.mjs video 60 6`.
6. `python3 audio.py` : bruitages ElevenLabs placés sur leur pic + synthèse, -14 LUFS.
7. Encodage final H.264 1080 x 1920, yuv420p, BT.709 plage TV, AAC, faststart.
