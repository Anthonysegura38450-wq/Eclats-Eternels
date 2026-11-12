# État du projet et prochaines étapes

_Dernière mise à jour : 12 novembre 2026. Branche de travail : `claude/lucid-gauss-fft6jj`._

## Le jeu (terminé et en ligne)
- Jeu « clicker » **Éclats Éternels**, version **1.5.2**, en ligne : https://anthonysegura38450-wq.github.io/Eclats-Eternels/
- Fonctions : améliorations (achat x1/x5/x10/x100/Max), boutique (styles, décors, boosts), 25 succès, événements (cristal doré, pluies, ×10 par paliers 1M/5M/25M…), récompense quotidienne, renaissance (règle « cumul de vie »), pierres précieuses à chaque renaissance, fêtes de l'année (Halloween, Noël, Nouvel An, Saint-Valentin, Pâques) avec événements thématiques, sauvegarde export/import, tutoriel, mise à jour automatique.
- Gemmes 100 % gratuites. **Aucun paiement** (pas de statut d'entreprise).
- Aperçu des fêtes réservé au développement local (`?season=noel` sur localhost).

## Application iOS : **soumise à Apple le 12 novembre 2026 à 10 h 09**
- État : **« En attente de vérification »** (iOS App 1.0, build 3). Délai habituel : 1 à 3 jours.
- Tout est fait : compte développeur, app et fiche App Store Connect, confidentialité (aucune donnée collectée), âge 4+, gratuit, déclaration sur les services numériques, 7 captures d'écran (1206 × 2622), compilation Codemagic (sans Mac), test sur iPhone via TestFlight (build 3 validé).
- La soumission peut être annulée depuis la page « Soumission iOS » tant que l'app n'est pas approuvée.

### Ce qui se passe ensuite
1. E-mails d'Apple : « En cours de vérification », puis « Prêt pour la vente » ou « Refusé » (le motif est détaillé ; copier le texte pour qu'on corrige).
2. Si approuvée : cliquer sur **Publier cette version** (si la publication manuelle a été choisie).
3. Si une correction du jeu est nécessaire : modifier le code, lancer un nouveau build dans Codemagic (workflow « Éclats Éternels - iOS (TestFlight) »), puis associer le nouveau build à une nouvelle version.

## À ne jamais partager
Le fichier `.p8`, l'Issuer ID de la clé API Apple, le mot de passe du compte Apple. Ils ne servent que dans Codemagic.

## Idées pour la suite (facultatif)
- Récompense propre à chaque fête (cadeaux à ouvrir à Noël, œufs à retrouver à Pâques).
- Plus d'améliorations pour la fin de partie, version anglaise, notifications locales.
- Android : bloqué tant qu'il n'y a pas d'appareil Android pour la vérification Google Play.
- Compte Stripe : liens de test désactivés ; rien de créé en mode réel.
