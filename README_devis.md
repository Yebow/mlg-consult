# Guide de déploiement — Formulaire de devis MLG

> **Pour qui** : ce guide suppose que tu n'as pas de connaissances techniques.
> Chaque étape est décrite avec exactement ce qu'il faut faire, dans l'ordre.
> Ne saute aucune étape.

---

## ÉTAPE 1 — Déployer le backend (Google Apps Script)

### 1.1 Ouvrir Apps Script

1. Ouvre ton navigateur (Chrome de préférence).
2. Va sur **[script.google.com](https://script.google.com)**.
3. Connecte-toi avec le compte Google associé à `mlg.consult.be@gmail.com`.

### 1.2 Créer un nouveau projet

1. Clique sur le bouton **"Nouveau projet"** (en haut à gauche).
2. En haut de la page, clique sur le titre par défaut **"Projet sans titre"**.
3. Renomme-le en **`MLG Quote Backend`** → clique sur **OK**.

### 1.3 Coller le code

1. Dans l'éditeur qui s'affiche, tu vois du code par défaut (une fonction `myFunction`).
2. **Sélectionne tout le texte** (Ctrl+A ou Cmd+A) et **supprime-le**.
3. Ouvre le fichier **`apps-script-backend.gs`** avec un éditeur de texte (Bloc-notes sous Windows, TextEdit sous Mac, ou VS Code si tu l'as).
4. **Sélectionne tout le contenu** (Ctrl+A) et **copie-le** (Ctrl+C).
5. Retourne dans Apps Script et **colle** (Ctrl+V).
6. **Sauvegarde** : Ctrl+S (ou Cmd+S sur Mac). Le titre du projet doit rester `MLG Quote Backend`.

### 1.4 Déployer en webhook public

C'est l'étape la plus importante. Elle rend ton script accessible depuis internet.

1. En haut à droite, clique sur **"Déployer"** → **"Nouveau déploiement"**.
2. À gauche, clique sur l'icône engrenage ⚙️ à côté de "Sélectionner le type".
3. Choisis **"Application Web"**.
4. Remplis les champs comme suit :
   - **Description** : `v1`
   - **Exécuter en tant que** : `Moi (ton adresse email)`
   - **Qui a accès** : **`Tout le monde`** (pas "Tout le monde, connecté à Google" — exactement "Tout le monde")
5. Clique sur **"Déployer"**.
6. Une fenêtre demande d'**autoriser les permissions** → clique sur **"Autoriser l'accès"**, puis connecte-toi avec le compte Google si demandé, et clique sur **"Autoriser"** même si Google affiche un avertissement "Application non vérifiée" (c'est normal pour les scripts personnels — clique sur "Options avancées" → "Accéder à MLG Quote Backend").
7. Une fois déployé, une **URL de déploiement** s'affiche. Elle ressemble à :
   `https://script.google.com/macros/s/AKfycb.../exec`
8. **Copie cette URL** (bouton "Copier" ou sélectionne-la manuellement). Tu en auras besoin à l'étape suivante.

> ⚠️ **Important** : Ne ferme pas cette fenêtre avant d'avoir copié l'URL.
> Si tu la perds, elle est accessible via Déployer → Gérer les déploiements.

---

## ÉTAPE 2 — Connecter le frontend au backend

1. Ouvre le fichier **`devis.html`** avec un éditeur de texte.
2. Utilise la fonction **Rechercher** (Ctrl+F) et cherche :
   ```
   TODO_REPLACE_WITH_APPS_SCRIPT_URL
   ```
3. Remplace `TODO_REPLACE_WITH_APPS_SCRIPT_URL` (garde les guillemets simples autour) par l'URL copiée à l'étape 1.7. Exemple :
   ```
   WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
4. Cherche maintenant :
   ```
   MOCK_BACKEND: true
   ```
5. Change `true` en `false` :
   ```
   MOCK_BACKEND: false,
   ```
6. **Sauvegarde** le fichier (Ctrl+S).

---

## ÉTAPE 3 — Tester en local avant de mettre en ligne

1. Ouvre le fichier `devis.html` **directement dans ton navigateur** (double-clic dessus, ou glisse-le dans Chrome).
2. Remplis le formulaire du début à la fin avec de **fausses données** :
   - Utilise **ton propre email** dans le champ Email (pour vérifier que l'email de confirmation arrive).
   - Pour les fichiers, uploade n'importe quelle image depuis ton ordinateur.
3. Clique sur **"Send request"** (bouton final).
4. **Vérifie les 4 points suivants** :

| Quoi vérifier | Où regarder |
|---|---|
| Email de notification reçu côté MLG | Boîte de `mlg.consult.be@gmail.com` |
| Email de confirmation reçu côté prospect | Ta propre boîte email (celle que tu as saisie dans le formulaire) |
| Nouvelle ligne dans la Sheet | Ouvre la Google Sheet avec l'ID `1aSl7GAdTudK-SXl1OcMe8hEDImJ4XE3LHRrayaoqUJk` |
| Nouveau dossier créé dans Drive | Ouvre le dossier Drive avec l'ID `1f47R0kPfyhxjtSFArhZmKAvg-gdsBOFE` |

> Si quelque chose ne fonctionne pas, consulte la section **Troubleshooting** en bas de ce guide.

---

## ÉTAPE 4 — Mettre en ligne sur l'hébergeur

Tu dois uploader **`devis.html`** sur ton hébergeur (OVH, Hostinger, etc.), **au même niveau que `MLG.html`** (dans le dossier `public_html` ou `www`, selon ton hébergeur).

### Option A — Via le gestionnaire de fichiers du panel hébergeur (le plus simple)

1. Connecte-toi au panel d'administration de ton hébergeur (cPanel, Plesk, hPanel…).
2. Ouvre le **Gestionnaire de fichiers** (File Manager).
3. Navigue jusqu'au dossier `public_html` (ou `www`).
4. Clique sur **Uploader** et sélectionne `devis.html`.
5. Vérifie que le fichier est bien au même niveau que `MLG.html`.

### Option B — Via FTP avec FileZilla (si tu as les identifiants FTP)

1. Télécharge et ouvre [FileZilla](https://filezilla-project.org).
2. Connecte-toi avec les identifiants FTP de ton hébergeur (hôte, identifiant, mot de passe, port 21).
3. Dans le panneau de droite (serveur), navigue jusqu'à `public_html` ou `www`.
4. Dans le panneau de gauche (ordinateur), navigue jusqu'au dossier contenant `devis.html`.
5. Glisse `devis.html` vers le panneau de droite.

### Vérification finale

Une fois uploadé, ouvre dans un navigateur :
```
https://tonsite.com/devis.html
```
Le formulaire doit s'afficher. Fais un test rapide de soumission depuis cette URL pour confirmer que tout fonctionne en production.

---

## TROUBLESHOOTING

### "L'email n'arrive pas" (ni côté MLG, ni côté prospect)

1. Vérifie les **spams** des deux boîtes.
2. Dans Apps Script → **Exécutions** (menu de gauche) : est-ce que la dernière exécution est marquée en rouge ? Si oui, clique dessus pour voir l'erreur.
3. Il est possible que les permissions d'envoi d'email n'aient pas été accordées lors du déploiement. Relis l'étape 1.4 et ré-autorise si nécessaire.

### "Erreur CORS" dans la console du navigateur

Cela signifie que le script ne laisse pas le navigateur appeler le webhook. Cause la plus fréquente : le déploiement a été fait avec **"Tout le monde, connecté à Google"** au lieu de **"Tout le monde"**.

**Solution** : dans Apps Script → Déployer → Gérer les déploiements → clique sur le crayon ✏️ → change "Qui a accès" en **"Tout le monde"** → Déployer à nouveau → copier la nouvelle URL → mettre à jour `devis.html`.

### "La soumission semble fonctionner mais rien n'apparaît dans la Sheet ou Drive"

1. Vérifie que tu as bien collé les bons IDs dans `CONFIG` au début du script.
2. Vérifie que le compte Google utilisé pour déployer Apps Script a bien accès au Drive et à la Sheet (ce doit être le même compte que celui qui possède le dossier Drive et la Sheet).

### "Fichier trop gros — la soumission échoue"

Google Apps Script a une limite d'environ **50 MB par fichier** reçu via `doPost`. Si un prospect essaie d'uploader un fichier plus lourd (vidéo HD, fichier source…) :
- Dis-leur de partager un lien **WeTransfer** ou **Google Drive** à la place.
- Le champ "Additional info" en fin de formulaire peut accueillir ce lien.

### "Je veux re-déployer après une modification du script"

Dans Apps Script → **Déployer** → **Gérer les déploiements** → clique sur le crayon ✏️ → dans "Version", choisis **"Nouvelle version"** → clique sur **Déployer**.
L'URL reste la même — pas besoin de mettre à jour `devis.html`.

---

## Récapitulatif des fichiers

| Fichier | Rôle | Où il vit |
|---|---|---|
| `apps-script-backend.gs` | Backend : traite les soumissions, écrit dans Drive + Sheet, envoie les emails | Google Apps Script |
| `devis.html` | Formulaire de devis frontend | Hébergeur (même dossier que `MLG.html`) |
| `MLG.html` | Site vitrine MLG | Hébergeur |
