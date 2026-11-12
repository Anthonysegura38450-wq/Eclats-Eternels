# État du projet et prochaines étapes

_Dernière mise à jour : 11 novembre 2026. Branche de travail : `claude/lucid-gauss-fft6jj`._

## Le jeu (terminé et en ligne)
- Jeu « clicker » **Éclats Éternels**, version **1.5.2**, en ligne : https://anthonysegura38450-wq.github.io/Eclats-Eternels/
- Fonctions : améliorations (achat x1/x5/x10/x100/Max), boutique (styles, décors, boosts), 25 succès, événements (cristal doré, pluies, ×10 par paliers 1M/5M/25M…), récompense quotidienne, renaissance (règle « cumul de vie »), pierres précieuses à chaque renaissance, fêtes de l'année (Halloween, Noël, Nouvel An, Saint-Valentin, Pâques) avec événements thématiques, sauvegarde export/import, tutoriel, mise à jour automatique.
- Gemmes 100 % gratuites. **Aucun paiement** (pas de statut d'entreprise).
- Aperçu des fêtes réservé au développement local (`?season=noel` sur localhost).

## Application iOS (en cours)
### Fait
- Compte **Apple Developer** actif (particulier).
- Identifiant `com.eclatseternels.game` déclaré ; app **Éclats Éternels** créée dans App Store Connect.
- Fiche : texte promotionnel, description, mots-clés, URL d'assistance, copyright remplis. Confidentialité publiée (« Données non collectées »). Catégorie Jeux, âge 4+. Tarif gratuit, 175 pays, Mac et Vision Pro décochés.
- **Codemagic** (compilation sans Mac) : dépôt ajouté, clé API Apple connectée (nom `codemagic`), certificat `eclats_distribution` (créé en double, sans conséquence), profil `Eclats Eternels AppStore` récupéré.
- **Build 2 compilé et envoyé** à TestFlight ; groupe interne « Moi » créé ; app installée sur l'iPhone.

### Défaut trouvé au test
- **Pas d'écran de lancement** : cause = images mal nommées. **Corrigé** dans le commit `e7306aa`, **pas encore compilé**.

### À faire demain, dans l'ordre
1. **Codemagic** → Applications → Eclats-Eternels → Start new build (branche `claude/lucid-gauss-fft6jj`, workflow « Éclats Éternels - iOS (TestFlight) »). Cela produit le **build 3** avec l'écran de lancement.
2. **TestFlight** : ajouter le build 3 au groupe « Moi » si besoin, mettre à jour sur l'iPhone (si l'ancien écran persiste : supprimer puis réinstaller l'app).
3. **Tester sur iPhone** et noter *tous* les défauts d'un coup : écran de lancement, texte coupé par l'encoche ou la barre du bas, vibrations, son, ⚙️ + sauvegarde + lien de confidentialité, mode avion, événements. (Corriger en une seule fois pour ne refaire qu'un build.)
4. **App Store Connect → Distribution → App iOS Version 1.0** :
   - **Connexion requise : décocher** (le jeu n'a pas de compte) ;
   - Coordonnées de contact (prénom, nom, téléphone, e-mail) ;
   - Remarques pour la vérification : texte dans `store/notes-validation.md` ;
   - Mode de publication : « manuellement » conseillé pour une première version ;
   - **Captures d'écran** iPhone 6,9″ : dossier `store/captures-iphone-6.3/ (1206 × 2622, iPhone « écran moyen »)` ;
   - Associer le **dernier build** (bouton « Ajouter une build »).
5. **À vérifier (non confirmé)** : la déclaration « législation sur les services numériques » (Informations sur l'app → Configurer). Sans elle, l'app peut ne pas être disponible dans l'UE. C'est une déclaration légale personnelle (professionnel / non-professionnel).
6. **Ajouter pour vérification**.

## À ne jamais partager
Le fichier `.p8`, l'Issuer ID de la clé API Apple, le mot de passe du compte Apple. Ils ne servent que dans Codemagic.

## Idées pour la suite (facultatif)
- Récompense propre à chaque fête (cadeaux à ouvrir à Noël, œufs à retrouver à Pâques).
- Plus d'améliorations pour la fin de partie, version anglaise, notifications locales.
- Android : bloqué tant qu'il n'y a pas d'appareil Android pour la vérification Google Play.
- Compte Stripe : liens de test désactivés ; rien de créé en mode réel.
