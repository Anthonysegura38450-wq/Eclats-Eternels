# Éclats Éternels

Jeu mobile HTML5 « clicker » (tactile, installable en PWA) : tape le cristal, achète des améliorations, personnalise ton cristal et ton décor dans la boutique, débloque des succès, puis renais pour gagner des bonus d'éternité. L'ancien jeu d'attrape est dans `catcher.html`.

Lancer : `python3 -m http.server` puis ouvrir `http://localhost:8000` sur mobile (ou héberger sur GitHub Pages).
Contrôles : glisser (tactile/souris) ou flèches ←/→.

## Gemmes
100 % gratuites : +10 💠 par succès débloqué et +10 💠 par ✦ gagné à la renaissance. Elles s'échangent contre cinq « Prismes » (+10 % de production et de clic chacun).

## Événements spéciaux
- ⚡ **Million** : chaque million d'éclats atteint déclenche un ×10 de production pendant 5 minutes.
- ✨ **Cristal doré** : apparaît au hasard, à toucher dans les 8 s (éclats, Frénésie ou gemmes).
- 🌠 **Pluie d'étoiles** : des étoiles tombent sur l'écran, chacune touchée rapporte des éclats.
- 🎁 **Récompense quotidienne** : série de 7 jours (éclats + gemmes, gros bonus au jour 7).
- 🎉 **Week-end lumineux** : production ×1,5 le samedi et le dimanche.
