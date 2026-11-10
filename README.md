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
