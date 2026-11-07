# ✦ Éclats Éternels

Jeu mobile de **construction de royaume et de stratégie** sur une île flottante. Bâtis ta cité, récolte des ressources, entraîne une armée et libère l'île des Ombres.

## Le jeu

- **Carte isométrique** : glisse un doigt pour te déplacer, pince pour zoomer.
- **Bâtiments** : Chaumière (or et population), Champ (nourriture), Scierie (bois), Carrière (pierre), Entrepôt (réserves), Sanctuaire d'éclats (gemmes), Caserne, Antre des créatures, Tour de guet et décorations.
- **Récolte** : une bulle apparaît au-dessus d'un bâtiment quand sa production est prête. Touche-le pour récolter.
- **Arbres et rochers** : touche-les pour récupérer du bois et de la pierre.
- **Armée** : Écuyer, Archère, Chevalier et Mage d'éclat, entraînés à la Caserne. Les Chaumières agrandissent l'armée.
- **Créatures** : 13 monstres à invoquer à l'Antre des créatures, en 4 raretés (commune, rare, épique, légendaire). Certains ne s'apprivoisent qu'après avoir vaincu un repaire. L'**Œuf mystère** donne une créature au hasard, et le **Bestiaire** garde la trace de ta collection. Tes créatures se promènent autour de leur Antre et combattent avec ton armée.
- **Repaires d'ombre** : 6 repaires de plus en plus puissants, jusqu'au Dragon d'obsidienne. Chaque victoire rapporte un butin et libère des terres constructibles.
- **Progression** : expérience, niveaux qui débloquent bâtiments et soldats, et 24 quêtes pour guider le joueur.
- **Temps réel** : constructions, récoltes et entraînements continuent quand le jeu est fermé. La partie est sauvegardée automatiquement.

## Jouer en local

```bash
cd www
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Structure

```
www/index.html     page du jeu
www/css/style.css  interface
www/js/data.js     données et équilibrage (bâtiments, soldats, ennemis, coûts)
www/js/game.js     moteur : carte, rendu, interactions, batailles, quêtes
```

Le dossier `www/` est prêt à être emballé avec Capacitor pour publier le jeu sur Google Play et l'App Store.
