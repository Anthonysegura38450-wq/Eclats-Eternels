# Publier Éclats Éternels sur l'App Store

> ⚠️ Le projet iOS a été généré depuis Linux : il **n'a pas pu être compilé ni testé** ici (Xcode n'existe que sur Mac). Le premier build peut demander de petits ajustements.

## Ce qui est déjà prêt dans le dépôt
| Élément | Où |
|---|---|
| Projet iOS (Capacitor 8, Swift Package Manager, pas de CocoaPods), réglé **iPhone uniquement** | `ios/` |
| Compilation cloud (Codemagic) | `codemagic.yaml` |
| Icône 1024×1024 sans transparence + écran de lancement | `ios/App/App/Assets.xcassets/` (sources : `icon-1024.png`, `splash-2732.png`) |
| Retours haptiques natifs, portrait uniquement, chiffrement déclaré « standard » | `index.html`, `ios/App/App/Info.plist` |
| Captures d'écran 6,9" (1320×2868) | `store/captures-iphone-6.9/` |
| Textes de la fiche (FR + EN) et notes pour la validation | `store/` |
| Politique de confidentialité et page d'assistance | `privacy.html`, `support.html` (publiées via GitHub Pages) |

## À compléter avant d'envoyer
1. ~~Adresse e-mail de contact~~ : renseignée dans `privacy.html` et `support.html`. Apple la vérifie : garde-la valide.
2. **Identifiant de l'app** (`appId`) dans `capacitor.config.json` : actuellement `com.eclatseternels.game`. Il **ne pourra plus être changé** une fois l'app créée sur App Store Connect.
3. Vérifier que `https://anthonysegura38450-wq.github.io/Eclats-Eternels/privacy.html` s'ouvre bien.

## Sans Mac : compilation dans le cloud avec Codemagic *(ton cas)*
Le fichier `codemagic.yaml` du dépôt décrit toute la compilation. Il reste à relier tes comptes. **À faire dans l'ordre :**

### Étape 1 — Déclarer l'identifiant de l'app chez Apple
1. Ouvre https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Identifiers** → bouton **+**.
2. Choisis **App IDs** → **App** → Continue.
3. *Description* : `Éclats Éternels` · *Bundle ID* : **Explicit** → `com.eclatseternels.game` (exactement).
4. Ne coche aucune capacité → Continue → **Register**.

### Étape 2 — Créer l'app dans App Store Connect
1. https://appstoreconnect.apple.com → **Apps** → **+** → **New App**.
2. Plateforme **iOS** · Nom `Éclats Éternels` (s'il est pris, ajoute un petit complément, par exemple `Éclats Éternels : Cristal`) · Langue principale **Français** · Bundle ID = celui de l'étape 1 · SKU libre (par exemple `eclats-eternels-1`) · Accès complet.
3. À la première connexion, accepte les **accords** si Apple le demande (Business → Agreements). Une app gratuite ne demande pas d'infos bancaires.

### Étape 3 — Créer une clé API Apple pour Codemagic
1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys**. Si un bouton « Request Access » apparaît, clique dessus (compte titulaire).
2. **+** → nom `codemagic`, accès **App Manager** → Generate.
3. Note l'**Issuer ID** (en haut de la page) et le **Key ID**, puis **télécharge le fichier `.p8`** : Apple ne le propose **qu'une seule fois**. Garde-le précieusement et ne le partage avec personne, pas même avec moi.

### Étape 4 — Brancher Codemagic
1. https://codemagic.io → connexion avec ton compte **GitHub** → autorise l'accès au dépôt `Eclats-Eternels`.
2. **Add application** → choisis le dépôt → type **Ionic Capacitor** (ou « Other ») → **Finish**.
3. **Teams** → **Personal account** → **Integrations** → **App Store Connect** → **Connect** : nom **`codemagic`** (exactement), Issuer ID, Key ID, et le fichier `.p8`.
4. Dans l'application, vérifie que la configuration utilisée est **`codemagic.yaml`**.

### Étape 5 — Lancer la compilation
1. **Start new build** → branche `claude/lucid-gauss-fft6jj` → workflow **Éclats Éternels - iOS (TestFlight)**.
2. Compte 10 à 25 minutes. À la fin, l'app est envoyée automatiquement vers **TestFlight**.
3. **Si le build échoue** : ouvre l'étape en rouge et envoie-moi le texte de l'erreur. C'est normal que le premier essai demande un ajustement.

### Étape 6 — Tester sur ton iPhone
1. Installe l'app **TestFlight** (App Store).
2. App Store Connect → ton app → **TestFlight** → attends la fin du traitement (quelques minutes) → ajoute-toi en **testeur interne** avec ton identifiant Apple.
3. Ouvre l'invitation sur ton iPhone et installe.

## Avec un Mac (alternative)
```bash
npm install
npm run sync
npx cap open ios
```
Dans Xcode : projet **App** → *Signing & Capabilities* → *Team* = ton compte → *Any iOS Device (arm64)* → **Product → Archive** → **Distribute App → App Store Connect → Upload**.

## Fiche App Store et soumission
1. Dans App Store Connect → ton app → **iOS App → 1.0 Prepare for Submission**.
2. Colle les textes de `store/fiche-fr.md` (et `fiche-en.md` pour l'anglais).
3. Envoie les captures de `store/captures-iphone-6.9/` (**iPhone seulement** : l'app est réglée sur iPhone, aucune capture iPad n'est demandée).
4. URL de confidentialité et d'assistance : voir `store/fiche-fr.md`.
5. **App Privacy** : « Data Not Collected » · **Age Rating** : 4+ · pas de publicité, pas d'achat intégré (voir `store/notes-validation.md`).
6. Choisis la build TestFlight, remplis les notes pour la validation, puis **Add for Review → Submit**.

## Si Apple refuse (règle 4.2 « fonctionnalité minimale »)
Réponds dans le Resolution Center en rappelant que c'est un jeu complet (progression, événements, succès, boutique, prestige, hors-ligne, haptique natif). Si besoin, on ajoutera des notifications locales ou d'autres fonctions natives.
