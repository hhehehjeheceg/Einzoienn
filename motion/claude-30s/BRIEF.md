# Claude se présente, 30 s

Film de motion design 100 % code. Une page HTML pilotée par `seek(t)` : three.js pour la 3D (SwiftShader dans Chromium headless), canvas 2D pour le texte, les fonds et la post-production. Rendu image par image en 1920×1080 à 60 fps, avec du flou de mouvement et de l'anti-crénelage par sous-images décalées. La musique et tous les sons sont synthétisés en Python sur les mêmes repères que l'image.

## Promesse

« Bonjour, je suis Claude. J'écris, je code, j'analyse. Je parle votre langue. Je réfléchis avant de répondre. Je vois. Quand je ne sais pas, je vous le dis. Utile, honnête, bienveillant. Comment puis-je vous aider ? »

## Système visuel

- Un seul objet traverse tout le film : **l'étincelle**, une étoile 3D en céramique terre cuite à 12 rayons, laquée. Elle naît, se présente, sert de plume, de curseur, de traceur. Elle porte les anneaux des langues, devient la tête du raisonnement et l'œil qui lit l'image. Enfin, elle fonce vers la caméra et inonde l'écran en crème pour la signature.
- **Couleurs fondues** : chaque scène repose sur un dégradé maillé. Ce sont de grandes taches de couleur douces qui dérivent lentement et se mélangent. L'histoire des couleurs va de braises sombres (prune, vin, terre cuite) à une nuit violette pour le drop 1, puis à un crépuscule pour la pause et à la fusion complète pour le drop 2 (orange, rose, lilas, or). Elle se termine en crème pastel.
- Palette de base : encre `#141413`, crème `#f0eee6`, terre cuite `#d97757`.
- Typo : Fraunces (opsz 144, SOFT 100) pour les titres et les lettres 3D, Instrument Serif italique pour les accents, Inter pour l'interface, JetBrains Mono pour le code, Noto pour les salutations non latines.
- Données illustratives étiquetées « Données d'exemple ». La légende de l'image décrit une image dessinée en code.

## Beat map (128 BPM, temps = 0,469 s, mesure = 1,875 s, 64 temps)

| Temps | Secondes | Scène | Image | Musique |
|---|---|---|---|---|
| 0 | 0.00 | Allumage | braise, poussière 3D aspirée | air, nappe filtrée, piano électrique |
| 2 | 0.94 | | **les 12 rayons jaillissent**, flash, éclats | impact, crash inversé |
| 4 | 1.88 | Je suis Claude | lettres 3D qui se redressent, caméra en orbite | kick battement |
| 8 | 3.75 | J'écris / Je code / J'analyse | feuille, panneau de code, graphique, panoramiques filés | montée : 4/4, basse filtrée |
| 14 | 6.56 | Rafale | Résumer. Traduire. Expliquer. Imaginer. | caisse claire sur chaque mot |
| 16 | 7.50 | **DROP 1** · Langues | double anneau de 18 salutations | drop complet, hook |
| 24 | 11.25 | Réflexion | graphe 3D, pistes écartées | drop allégé, cloches |
| 32 | 15.00 | Je vois | image en 4 couches avec parallaxe, détection, légende tapée | pause : piano, chœur |
| 40 | 18.75 | Honnêteté | « Quand je ne sais pas, je vous le dis. » | piano |
| 44 | 20.63 | Orbite | 6 cartes de capacités qui accélèrent, implosion | remontée, roulement, riser |
| 48 | 22.50 | **DROP 2** · Valeurs | fusion de couleurs, Utile. Honnête. Bienveillant. | drop complet, hook à l'octave |
| 56 | 26.25 | Signature | inondation crème, « Claude », boîte de prompt | grand accord Si♭maj9 |
| 62 | 29.06 | | reflet sur la signature | résolution en Fa |
| 64 | 30.00 | fin | | |

## Fabrication

```
python3 tools/prep_fonts.py <dossier fontsource>   # polices statiques + contours des lettres 3D
python3 build.py                                    # -> claude-30s.html (lecteur : Espace, ←/→, R)
node render.mjs stills 1.2 7.9 ...                  # planche d'images clés
node render.mjs cues && python3 audio.py            # repères sonores puis partition
node render.mjs chunk 0 450 part0                   # rendu final par morceaux (4 en parallèle)
```
