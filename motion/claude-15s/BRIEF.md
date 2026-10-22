# Claude se présente, 15 s

Film de motion design 100 % code. Une page HTML pilotée par `seek(t)` (three.js pour la 3D, canvas 2D pour le texte et la post-production), rendue image par image en 1920×1080 à 60 fps, avec du flou de mouvement en sous-images. La musique et les sons sont synthétisés en Python sur les mêmes repères que l'image.

## Promesse

« Bonjour, je suis Claude. J'écris, je code, j'analyse, je parle votre langue, je réfléchis avant de répondre. Comment puis-je vous aider ? »

## Système visuel

- Un seul objet traverse tout le film : **l'étincelle**, une étoile 3D en céramique terre cuite à 12 rayons, laquée. Elle naît, se présente, écrit, code, analyse, porte l'anneau des langues, devient le nœud final du raisonnement, puis inonde l'écran en crème pour la signature.
- Palette : encre `#141413`, crème `#f0eee6`, terre cuite `#d97757`. Accents discrets d'une teinte par idée (menthe pour le code, ciel pour l'analyse, ambre pour les langues).
- Typo : Fraunces (opsz 144, SOFT 100) pour les titres et les lettres 3D, Inter pour l'interface, JetBrains Mono pour le code, Noto pour les salutations non latines.
- Données illustratives étiquetées « Exemple ».

## Beat map (128 BPM, temps = 0,469 s, mesure = 1,875 s, 32 temps)

| Temps | Secondes | Scène | Image | Son |
|---|---|---|---|---|
| 0 | 0.00 | 1 · Allumage | braise dans le noir, poussière 3D aspirée en spirale | nappe, souffle |
| 1 | 0.47 | | battement : anneau d'onde | sub doux |
| 2 | 0.94 | | **les 12 rayons jaillissent**, flash, éclats 3D | impact clair, scintillement |
| 2.5 | 1.17 | | « Bonjour. » monte lettre par lettre | piano électrique |
| 4 | 1.88 | 2 · Je suis Claude | l'étincelle glisse à gauche, lettres 3D « Claude » basculent en place, caméra en orbite | cloche, accord |
| 6 | 2.81 | | balayage de lumière sur les lettres | shimmer |
| 7.5 | 3.52 | | les lettres basculent en arrière, panoramique filé | whoosh |
| 8 | 3.75 | 3 · J'écris. | feuille courbe 3D, l'étincelle est la plume | kick 4/4 commence |
| 10 | 4.69 | Je code. | panneau de code laqué, accolades 3D en orbite | frappe clavier |
| 12 | 5.63 | J'analyse. | barres 3D qui poussent, courbe qui se trace | pops |
| 14 | 6.56 | 4 · Rafale | Résumer. Traduire. Expliquer. Imaginer. (croches, flashs couleur) | roulement de caisse, riser |
| 15.75 | 7.38 | | implosion vers le centre | aspiration, silence d'une double croche |
| 16 | 7.50 | 5 · **DROP** · Langues | explosion, double anneau 3D de « bonjour » en 14 langues | drop complet |
| 17 | 7.97 | | « Je parle votre langue. » | |
| 20 | 9.38 | 6 · Réflexion | graphe 3D : les étapes s'allument, les pistes écartées s'éteignent | ping par étape |
| 22 | 10.31 | | « Je réfléchis avant de répondre. » | |
| 24 | 11.25 | 7 · Signature | le nœud final devient l'étincelle, inondation crème | impact, accord large |
| 24.5 | 11.48 | | « Claude » monte à côté de l'étincelle | |
| 26 | 12.19 | | boîte de prompt qui remonte, « Comment puis-je vous aider ? » se tape | frappes |
| 30 | 14.06 | | reflet sur la signature, l'étincelle tourne | accord final résolu |
| 32 | 15.00 | fin | | |

## Calques (de l'arrière vers l'avant)

1. Fond 2D : champ de bruit lent (noir chaud ou crème), rayons volumétriques.
2. Scène three.js (fond transparent) : étincelle, lettres, objets, anneaux, graphe, particules.
3. Texte et interface 2D : titres, étiquettes, boîte de prompt.
4. Post : bloom, aberration chromatique sur les impacts, tremblement de caméra, vignette, grain.

## Son

Partition synthétisée en ré majeur à 128 BPM : intro (nappe + piano électrique), montée (kick, charleston, basse filtrée), rafale (roulement, riser, coupure), drop (supersaw gaté, basse, lead), résolution (piano, cloches). SFX placés sur `out/cues.json` exporté par le film. Loudness -14 LUFS.
