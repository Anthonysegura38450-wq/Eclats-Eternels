# Éclats Éternels

Jeu mobile HTML5 « clicker » (tactile, installable en PWA) : tape le cristal, achète des améliorations, personnalise ton cristal et ton décor dans la boutique, débloque des succès, puis renais pour gagner des bonus d'éternité. L'ancien jeu d'attrape est dans `catcher.html`.

Publication sur l'App Store : voir `docs/PUBLIER-IOS.md`.

Équilibrage : `node tools/simulate.js` joue plusieurs profils de joueurs avec les vraies constantes du jeu ; rapport dans `docs/EQUILIBRAGE.md`.

Lancer : `python3 -m http.server` puis ouvrir `http://localhost:8000` sur mobile (ou héberger sur GitHub Pages).
Contrôles : glisser (tactile/souris) ou flèches ←/→.

## Gemmes
100 % gratuites : +10 💠 par succès débloqué et +10 💠 par ✦ gagné à la renaissance. Elles s'échangent contre cinq « Prismes » (+10 % de production et de clic chacun).

## Événements spéciaux
- ⚡ **Million** : les paliers 1M, 5M, 25M, 125M… d'éclats déclenchent chacun un ×10 de production pendant 5 minutes.
- ✨ **Cristal doré** : apparaît au hasard, à toucher dans les 8 s (éclats, Frénésie ou gemmes).
- 🌠 **Pluie d'étoiles** : des étoiles tombent sur l'écran, chacune touchée rapporte des éclats.
- 🎁 **Récompense quotidienne** : série de 7 jours (éclats + gemmes, gros bonus au jour 7).
- 🎉 **Week-end lumineux** : production ×1,5 le samedi et le dimanche.

## Paramètres
Engrenage ⚙️ en haut à droite : Renaissance (avec aperçu du gain), sons, vibrations, statistiques de la partie, effacement de la progression (double confirmation) et lien vers la politique de confidentialité.

_Version courante : 1.1_

## Sauvegarde et tutoriel
- ⚙️ → Sauvegarde : exporte un code (avec contrôle d'intégrité) et réimporte-le sur un autre appareil. Le code importé est validé et nettoyé ; une copie de secours de la partie remplacée est conservée.
- Un tutoriel guidé accompagne les nouveaux joueurs (ignorable, rejouable depuis les paramètres).

## Renaissance (règle « cumul de vie »)
✦ total = √(éclats cumulés sur toute la vie / 10 M). On ne gagne que la différence avec les ✦ déjà possédés : chaque ✦ demande plus de jeu que le précédent. Détails et simulation : `docs/EQUILIBRAGE.md`.

## Mises à jour
Le jeu vérifie `version.json` (sans cache) et affiche un bandeau « Nouvelle version disponible » quand une version plus récente est publiée. À chaque version : modifier `VERSION` dans `index.html` **et** `version.json` (contrôle : `npm test`).

## Pierres précieuses et événements de saison
- **Une pierre par renaissance** : Diamant, Rubis, Émeraude, Saphir, Améthyste, Topaze, Opale, Perle (puis le cycle recommence). Chacune a sa taille, ses facettes et sa couleur naturelle ; un style équipé depuis la Boutique remplace la couleur. Un halo entoure le cristal toutes les 3 renaissances.
- **Événements de saison** (automatiques, selon la date) : 🎃 Halloween (24 oct → 1er nov, chapeau de sorcière), 🎄 Noël (1er → 26 déc, bonnet de Père Noël + neige), 🎆 Nouvel An (27 déc → 3 jan, chapeau de fête), 💘 Saint-Valentin (7 → 15 fév, cœur), 🐣 Pâques (semaine de Pâques, œuf décoré).
- **Les joueurs ne peuvent pas modifier les événements** : ils suivent uniquement la date de l'appareil. L'aperçu (boutons dans ⚙️ → « Aspect du cristal », adresse `?season=noel`, objet de débogage `window.__ee`) n'existe **qu'en local** (`http://localhost…`), jamais sur le site publié ni dans l'application iOS.
  Pour prévisualiser : `python3 -m http.server` puis `http://localhost:8000/?season=noel` (valeurs : halloween, noel, an, valentin, paques).
