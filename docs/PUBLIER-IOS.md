# Publier Éclats Éternels sur l'App Store

> ⚠️ Le projet iOS a été généré depuis Linux : il **n'a pas pu être compilé ni testé** ici (Xcode n'existe que sur Mac). Le premier build peut demander de petits ajustements.

## Ce qui est déjà prêt dans le dépôt
| Élément | Où |
|---|---|
| Projet iOS (Capacitor 8, Swift Package Manager, pas de CocoaPods) | `ios/` |
| Icône 1024×1024 sans transparence + écran de lancement | `ios/App/App/Assets.xcassets/` (sources : `icon-1024.png`, `splash-2732.png`) |
| Retours haptiques natifs, portrait uniquement, chiffrement déclaré « standard » | `index.html`, `ios/App/App/Info.plist` |
| Captures d'écran 6,9" (1320×2868) | `store/captures-iphone-6.9/` |
| Textes de la fiche (FR + EN) et notes pour la validation | `store/` |
| Politique de confidentialité et page d'assistance | `privacy.html`, `support.html` (publiées via GitHub Pages) |

## À compléter avant d'envoyer
1. ~~Adresse e-mail de contact~~ : renseignée dans `privacy.html` et `support.html`. Apple la vérifie : garde-la valide.
2. **Identifiant de l'app** (`appId`) dans `capacitor.config.json` : actuellement `com.eclatseternels.game`. Il **ne pourra plus être changé** une fois l'app créée sur App Store Connect.
3. Vérifier que `https://anthonysegura38450-wq.github.io/Eclats-Eternels/privacy.html` s'ouvre bien.

## Avec un Mac
```bash
npm install
npm run sync
npx cap open ios
```
Dans Xcode :
1. Sélectionne le projet **App** → onglet *Signing & Capabilities* → *Team* = ton compte développeur. Laisse « Automatically manage signing ».
2. Onglet *General* : Version `1.0`, Build `1`.
3. Choisis « Any iOS Device (arm64) » en haut, puis menu **Product → Archive**.
4. Dans l'Organizer : **Distribute App → App Store Connect → Upload**.
5. Sur appstoreconnect.apple.com, la build apparaît dans **TestFlight** après quelques minutes : installe-la sur ton iPhone pour tester.

## Sans Mac
Un service de compilation cloud (par exemple Codemagic) peut produire et envoyer la build. Il faut un compte développeur actif, une clé d'API App Store Connect, puis un fichier de configuration `codemagic.yaml`. À préparer une fois ton compte validé.

## Dans App Store Connect
1. **Mes apps → + → Nouvelle app** : plateforme iOS, nom *Éclats Éternels*, langue principale français, identifiant = celui de `capacitor.config.json`.
2. Colle les textes de `store/fiche-fr.md` (et `fiche-en.md` pour l'anglais).
3. Envoie les captures de `store/captures-iphone-6.9/`.
4. Renseigne les URL de confidentialité et d'assistance.
5. Questionnaires : confidentialité « aucune donnée collectée », âge 4+, pas de pub, pas d'achat intégré (voir `store/notes-validation.md`).
6. Choisis la build TestFlight, renseigne les notes pour la validation, puis **Envoyer pour validation**.

## Si Apple refuse (règle 4.2 « fonctionnalité minimale »)
Réponds dans le Resolution Center en rappelant que c'est un jeu complet (progression, événements, succès, boutique, prestige, hors-ligne, haptique natif). Si besoin, on ajoutera des notifications locales ou d'autres fonctions natives.
