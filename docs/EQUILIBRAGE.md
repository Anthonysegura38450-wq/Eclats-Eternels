# Simulation d'équilibrage — Éclats Éternels

_Généré par `node tools/simulate.js` à partir des constantes réelles de `index.html`._

> **Hypothèses prudentes** : on ne compte ni cristaux dorés, ni pluie d'étoiles, ni récompense quotidienne, ni week-end, ni Frénésie, ni succès (+2 %), ni Prismes/Cœurs. Le vrai jeu est donc un peu plus rapide que ces chiffres.

## 1. Coût du niveau suivant

| Amélioration | niv. 1 | niv. 10 | niv. 25 | niv. 50 | niv. 100 | niv. 150 |
|---|---|---|---|---|---|---|
| Doigt de lumière (+1/clic) | 47 | 193 | 2.03k | 102.6k | 263.4M | 676.0B |
| Étincelle (+1/s) | 150 | 1.12k | 31.8k | 8.41M | 589.1B | 41.3Qa |
| Mineur de cristal (+5/s) | 1.50k | 11.2k | 317.6k | 84.1M | 5.89T | 412.7Qa |
| Golem de quartz (+30/s) | 17.5k | 130.4k | 3.71M | 980.9M | 68.7T | 4.82Qi |
| Dragon prismatique (+200/s) | 200.0k | 1.49M | 42.4M | 11.2B | 785.5T | 55.0Qi |
| Étoile éternelle (+1500/s) | 2.25M | 16.8M | 476.5M | 126.1B | 8.84Qa | 619.1Qi |

## 2. Premier cycle — joueur actif

Premier achat de chaque amélioration (et niveau atteint à la fin de la 1ʳᵉ partie) :

| Amélioration | 1ᵉʳ achat | niveau 10 | niveau 25 | niveau 50 |
|---|---|---|---|---|
| Doigt de lumière | 15 s | 70 s | 8.0 min | — |
| Étincelle | 1.7 min | 25.9 min | — | — |
| Mineur de cristal | 2.9 min | 53.0 min | — | — |
| Golem de quartz | 7.2 min | — | — | — |
| Dragon prismatique | 25.8 min | — | — | — |
| Étoile éternelle | 50.4 min | — | — | — |

Première renaissance possible (10 M cumulés) après **54.7 min** de jeu actif.

## 3. Paliers ×10 (premier cycle, joueur actif)

| Palier atteint | Après |
|---|---|
| 1.00M | 47.2 min |
| 5.00M | 52.9 min |

## 4. Durée des cycles selon le profil et la politique de renaissance

Règle actuelle (cumul de vie). Politique « renaître dès que le gain ≥ N ✦ » (N = 1, 3, 10). Durée de chacun des 6 premiers cycles :

| Profil | N | Cycle 1 | Cycle 2 | Cycle 3 | Cycle 4 | Cycle 5 | Cycle 6 | ✦ après 7 jours |
|---|---|---|---|---|---|---|---|---|
| Actif (joue en continu, 3 clics/s) | 1 | 54.7 min | 72.6 min | 55.1 min | 42.5 min | 32.9 min | 59.8 min | 2790 |
| Actif (joue en continu, 3 clics/s) | 3 | 2.1 h | 63.0 min | 1.5 h | 76.3 min | 47.7 min | 72.5 min | 969 |
| Actif (joue en continu, 3 clics/s) | 10 | 8.9 h | 4.9 h | 3.9 h | 3.4 h | 3.8 h | 3.6 h | 670 |
| Régulier (3 sessions de 8 min par jour, 2 clics/s) | 1 | 32.1 h | 23.9 h | 24.0 h | 12.0 h | 17.0 h | 24.0 h | 8 |
| Régulier (3 sessions de 8 min par jour, 2 clics/s) | 3 | 44.0 h | 24.0 h | 36.0 h | 24.0 h | 24.0 h | 12.0 h | 23 |
| Régulier (3 sessions de 8 min par jour, 2 clics/s) | 10 | 3.8 j | 2.0 j | — | — | — | — | 20 |
| Occasionnel (1 session de 5 min par jour, 2 clics/s) | 1 | 4.8 j | — | — | — | — | — | 1 |
| Occasionnel (1 session de 5 min par jour, 2 clics/s) | 3 | 6.8 j | — | — | — | — | — | 4 |
| Occasionnel (1 session de 5 min par jour, 2 clics/s) | 10 | — | — | — | — | — | — | 0 |

## 5. Temps d'attente entre deux achats (joueur actif, 1ᵉʳ cycle)

Les 5 plus longues attentes :

| Attente | Avant d'acheter | À l'instant |
|---|---|---|
| 14.7 min | Étoile éternelle niv. 1 | 50.4 min |
| 12.5 min | Dragon prismatique niv. 1 | 25.8 min |
| 7.4 min | Dragon prismatique niv. 2 | 34.7 min |
| 2.5 min | Golem de quartz niv. 1 | 7.2 min |
| 2.2 min | Golem de quartz niv. 2 | 10.2 min |

## 6. Niveaux au moment de la première renaissance (actif)

Doigt de lumière 33 · Étincelle 14 · Mineur de cristal 11 · Golem de quartz 8 · Dragon prismatique 5 · Étoile éternelle 3

## 7. Règle de renaissance : ancienne règle vs règle actuelle

Ancienne règle : gain = √(éclats de la partie / 10 M) — les cycles raccourcissaient sans limite. Règle actuelle : ✦ total = √(éclats cumulés sur toute la vie / 10 M), on ne gagne que la différence ; chaque ✦ demande plus de jeu que le précédent.

Joueur **actif**, politique « renaître dès que gain ≥ 1 ». Durée de chaque cycle :

| Règle | C1 | C2 | C3 | C4 | C5 | C6 | C8 | C10 | ✦ à 1 jour | ✦ à 3 jours | ✦ à 7 jours |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ancienne | 54.7 min | 47.6 min | 36.1 min | 31.0 min | 27.2 min | 24.2 min | 19.9 min | 16.8 min | 989 | 24 086 | 113 877 |
| **actuelle (cumul de vie)** | 54.7 min | 72.6 min | 55.1 min | 42.5 min | 32.9 min | 59.8 min | 46.3 min | 33.1 min | 69 | 762 | 2 790 |

## Conclusions

**Ce qui est sain**
- **Pas de blocage au début** : un joueur actif n'attend jamais plus de ~15 minutes entre deux achats, et la plupart du temps quelques secondes à quelques minutes. Les six améliorations s'ouvrent progressivement (Étoile éternelle vers 50 min).
- **Le Doigt de lumière est corrigé** : le niveau 36 coûte ~11 k au lieu de ~7 M ; un joueur actif atteint le niveau ~33 avant sa première renaissance.
- **Cadence selon le profil** : première renaissance après ~55 min (actif), ~1,3 jour (3 sessions de 8 min par jour), ~5 jours (5 min par jour). Pour ce dernier profil, la récompense quotidienne, les cristaux dorés et les succès, non modélisés ici, accélèrent un peu.

**Règle de renaissance « cumul de vie » (appliquée)**
Avant, gain = √(éclats de la partie / 10 M) : un joueur qui renaît dès que possible voyait ses cycles raccourcir sans limite (55 min → 17 min au 10ᵉ cycle) et ses ✦ exploser (~114 000 après 7 jours de jeu non-stop).

Maintenant, ✦ total = √(éclats cumulés sur toute la vie / 10 M) et on ne gagne que la différence. Résultat (joueur actif, renaissance dès que possible) : ~2 800 ✦ après 7 jours au lieu de ~114 000, soit ~40 fois moins. Les cycles se stabilisent entre ~30 et ~75 min au lieu de s'effondrer.

Nuances honnêtes :
- Les cycles **raccourcissent encore doucement** (73 min au 2ᵉ cycle → 33 min au 10ᵉ) : la règle freine la boule de neige, elle ne la supprime pas. Si besoin, on peut durcir davantage (par exemple un exposant plus élevé que √).
- **Renaître souvent reste la stratégie la plus rentable** (2 790 ✦ en 7 jours en renaissant dès +1 ✦, contre 670 ✦ en attendant +10).

**Migration des parties existantes** : un joueur qui avait déjà des ✦ repart du seuil correspondant (cumul de vie = ✦² × 10 M). Il garde tous ses ✦, mais doit à nouveau cumuler de quoi gagner le suivant ; un joueur à 0 ✦ n'est pas affecté.

## Limites de la simulation
- Joueurs simulés avec une stratégie d'achat « avisée » (meilleur rapport gain/coût, on économise pour l'achat visé) ; un joueur réel est moins optimal.
- Non modélisés : cristaux dorés, pluie d'étoiles, récompense quotidienne, week-end lumineux, Frénésie, succès, Prismes, Cœurs de cristal. Les temps réels sont donc plus courts.
- Pas de simulation du comportement hors-ligne au-delà du plafond de 4 h ni des achats en boutique.
