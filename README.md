# FitTogether API

[![CI](https://github.com/Nolan910/FitTogether-CDA/actions/workflows/ci.yml/badge.svg)](https://github.com/Nolan910/FitTogether-CDA/actions/workflows/ci.yml)

API REST de FitTogether, une application pour trouver des partenaires de sport, publier des photos de ses séances et discuter avec ses partenaires.

Front-end : [FitTogether](https://github.com/Nolan910/FitTogether)

## Stack

- **Node.js / Express 4**
- **MongoDB Atlas** avec **Mongoose**
- **JWT** pour l'authentification, **bcrypt** pour les mots de passe
- **Cloudinary** pour les images, avec un moteur de stockage multer maison (`config/cloudinary.js`)
- **express-validator** pour la validation des entrées, **express-rate-limit** contre le brute-force
- **Jest**, **Supertest** et **mongodb-memory-server** pour les tests

## Installation

```bash
npm install
cp .env.example .env
```

Puis remplir le fichier `.env` :

| Variable | Description |
|---|---|
| `PORT` | Port du serveur (3000 par défaut) |
| `MONGO_URL` | URL de connexion MongoDB. Un replica set est nécessaire pour les transactions (c'est le cas sur Atlas). |
| `JWT_SECRET` | Secret de signature des tokens |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Identifiants Cloudinary |

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le serveur avec rechargement automatique (nodemon) |
| `npm start` | Lance le serveur (production) |
| `npm test` | Lance les tests |
| `npm run cleanup:legacy` | Script de migration ponctuel : retire les anciens champs `partners` et `receivedRequests` des utilisateurs |

## Architecture

```
index.js              Point d'entrée : connexion MongoDB et démarrage du serveur
app.js                Configuration Express (CORS, JSON, routes, gestion d'erreurs)
routes/               Déclaration des routes et des middlewares appliqués à chacune
controllers/          Lecture de la requête et envoi de la réponse HTTP
services/             Logique métier et accès à la base
models/               Schémas Mongoose
Middleware/
  authJwt.js          verifyToken (JWT) et isSelf (l'utilisateur agit sur son propre compte)
  validators.js       Règles de validation des entrées
  validateObjectId.js Vérification des identifiants dans l'URL
  limiter.js          Limitation du nombre de requêtes
  errorHandler.js     Gestion centralisée des erreurs
config/               Cloudinary et champs utilisateur exposés
utils/                HttpError et asyncHandler
tests/                Tests d'intégration
scripts/              Scripts de maintenance
```

Une requête traverse les couches dans cet ordre : `route → middlewares → controller → service → modèle`. Les services lèvent des `HttpError` (404, 403, 409…), que le gestionnaire d'erreurs central transforme en réponse JSON `{ message }`.

## Sécurité

- **Authentification** : le token est envoyé dans l'en-tête `Authorization: Bearer <token>`. `verifyToken` le vérifie, recharge l'utilisateur en base (un compte supprimé est donc refusé) et renseigne `req.userId` et `req.isAdmin`.
- **Identité** : l'auteur d'un post, d'un commentaire, d'un message ou d'une demande de partenariat vient toujours du token, jamais du body.
- **Droits** : seuls l'auteur ou un admin peuvent supprimer un post ou un commentaire. Un utilisateur ne peut modifier que son propre profil. Seul le destinataire peut répondre à une demande de partenariat. On ne peut écrire qu'à ses partenaires.
- **Données exposées** : le mot de passe et l'email ne sont jamais renvoyés, sauf l'email à l'utilisateur lui-même.
- **Images** : l'upload passe par l'API (5 Mo maximum, jpg, jpeg ou png).
- **Rate limit** : 10 échecs de connexion par IP toutes les 15 minutes sur `/login`.
- **Suppression de compte** : faite dans une transaction, elle efface les posts, commentaires, messages et demandes de l'utilisateur.
- **Droit à l'effacement** : les images sont supprimées de Cloudinary quand on supprime un post, son compte, ou qu'on change de photo de profil. Le `public_id` est déduit de l'URL, ce qui couvre aussi les anciennes images.
- **Emails** : enregistrés et comparés en minuscules. Une inscription en double renvoie toujours une 400, même en cas d'envoi simultané.

## Routes

🔒 : token requis

| Méthode | Route | Description | Règle d'accès |
|---|---|---|---|
| GET | `/health` | État de l'API : commit déployé et connexion à la base (503 si la base est injoignable) | |
| POST | `/createUser` | Inscription | |
| POST | `/login` | Connexion, renvoie un token valable 4 h | |
| GET | `/user/:id` | Profil public | |
| PUT | `/user/:id` 🔒 | Modifier son profil (multipart, champ `profilPic`) | Soi-même |
| DELETE | `/deleteUser` 🔒 | Supprimer son compte | Soi-même |
| GET | `/user/:id/posts` | Posts d'un utilisateur | |
| GET | `/user/:id/partners` | Partenaires d'un utilisateur | |
| GET | `/user/:id/partner-requests` 🔒 | Demandes reçues en attente | Soi-même |
| POST | `/user/:id/request-partner` 🔒 | Envoyer une demande à l'utilisateur `:id` | |
| PUT | `/partner-requests/:id` 🔒 | Accepter (`accepted`) ou refuser (`rejected`) une demande | Destinataire |
| GET | `/posts` | Tous les posts | |
| GET | `/post/:id` | Détail d'un post et ses commentaires | |
| POST | `/createPoste` 🔒 | Publier un post (multipart, champs `description` et `image`) | |
| DELETE | `/post/:id` 🔒 | Supprimer un post | Auteur ou admin |
| POST | `/post/:id/comment` 🔒 | Commenter un post | |
| DELETE | `/comments/:id` 🔒 | Supprimer un commentaire | Auteur ou admin |
| GET | `/messages/:partnerId` 🔒 | Conversation avec un utilisateur | Participant |
| POST | `/messages` 🔒 | Envoyer un message | Partenaires uniquement |

## Tests

```bash
npm test                    # tous les tests
npm test -- --coverage      # avec le rapport de couverture (dossier coverage/)
```

Les tests tournent sur une base MongoDB en mémoire (`mongodb-memory-server`, en replica set pour les transactions) et Cloudinary est simulé : ils ne touchent jamais la base ni les images de production, et ne demandent aucune variable d'environnement. Ils couvrent :

- `verifyToken` : token absent, mal formé, signé avec un autre secret, expiré, compte supprimé ;
- les contrôles de droits (403) sur les posts, commentaires, profils, demandes de partenariat et messages ;
- l'identité tirée du token plutôt que du body ;
- l'inscription, la validation des entrées, la connexion et l'injection NoSQL ;
- la limitation du nombre de tentatives de connexion ;
- la suppression complète d'un compte et de ses images Cloudinary ;
- la route `/health`.

Le détail des cas et la recette manuelle sont décrits dans le plan de tests du dossier de projet.

## Environnements

| Environnement | Rôle | Base de données | Images | Variables d'environnement |
|---|---|---|---|---|
| Local | Développement | La base indiquée dans `MONGO_URL` (aujourd'hui la base Atlas de production ; une base dédiée au développement est recommandée) | Le compte Cloudinary indiqué dans `.env` | Fichier `.env` (non versionné), modèle dans `.env.example` |
| Tests (local et CI) | Tests d'intégration automatisés | MongoDB en mémoire, recréée à chaque exécution | Simulées | Aucune : fournies par `tests/setupEnv.js` |
| Production | Application en ligne | MongoDB Atlas (cluster de production) | Cloudinary, dossier `FitTogether` | Tableau de bord Render, onglet *Environment* |

Les secrets (`MONGO_URL`, `JWT_SECRET`, clés Cloudinary) ne sont jamais versionnés : `.env` est dans le `.gitignore`, et en production ils ne vivent que dans Render.

## Déploiement

L'API est hébergée sur **Render** (service web Node.js, offre gratuite) et la base sur **MongoDB Atlas**.

### Pipeline

```
push / pull request ──► CI GitHub Actions ──► CI verte ? ──► Render déploie ──► health check /health ──► smoke test (manuel)
                         audit npm, tests        │ non                              │ échec
                                                 └─► rien n'est déployé             └─► l'ancienne version reste en ligne
```

| Fichier | Déclenchement | Étapes |
|---|---|---|
| `.github/workflows/ci.yml` | Push et pull request sur `master` | `npm ci` → `npm audit --omit=dev --audit-level=critical` → tests avec couverture → rapport de couverture en artefact (7 jours) |
| `.github/workflows/post-deploy.yml` | À la main (*Actions* → *Vérification après déploiement* → *Run workflow*). Render ne signale pas ses déploiements à GitHub, ce workflow ne peut donc pas se lancer seul. | Attend que `/health` renvoie le commit déployé et une base `up` (10 min maximum), puis vérifie `/posts` (200), une route protégée sans token (401) et un identifiant invalide (400) |
| `.github/dependabot.yml` | Chaque semaine | Pull requests de mise à jour des dépendances npm (mineures et correctifs) et des actions GitHub |

### Procédure de mise en production

1. Créer une branche depuis `master`, développer, lancer `npm test` en local.
2. Pousser la branche et ouvrir une pull request vers `master` : la CI s'exécute.
3. Si la CI est rouge : lire le job en échec (onglet *Actions*), corriger, pousser à nouveau.
4. Si la CI est verte : fusionner la pull request.
5. La CI s'exécute sur `master`, puis Render déploie automatiquement (*Auto-Deploy : After CI Checks Pass*) : `npm ci --omit=dev`, puis `node index.js`.
6. Render appelle `/health` : la nouvelle version ne remplace l'ancienne que si elle répond 200.
7. Lancer le smoke test (`post-deploy.yml`) depuis l'onglet *Actions* et vérifier qu'il est vert.
8. Dérouler la recette manuelle sur le site en ligne pour les fonctionnalités modifiées.

L'offre gratuite de Render met le service en veille après une période d'inactivité : la première requête après une veille peut prendre une minute environ. Le smoke test en tient compte (tentatives répétées).

### Configuration initiale (une seule fois)

**MongoDB Atlas**

1. Créer un cluster, puis un utilisateur de base avec un mot de passe fort et les seuls droits de lecture et écriture sur la base de l'application.
2. *Network Access* : Render (offre gratuite) n'a pas d'adresse IP fixe, l'accès est donc ouvert (`0.0.0.0/0`). La protection repose sur l'authentification et le chiffrement TLS de la connexion.
3. Copier la chaîne de connexion dans `MONGO_URL`.

**Render**

| Paramètre | Valeur |
|---|---|
| Runtime | Node (version 22, lue dans `engines`) |
| Build command | `npm ci --omit=dev` (versions exactes du `package-lock.json`, sans les dépendances de développement) |
| Start command | `node index.js` (équivalent à `npm start`) |
| Health check path | `/health` |
| Auto-Deploy | After CI Checks Pass |
| Variables d'environnement | `MONGO_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (le port est fourni par Render) |

**CORS** : les origines autorisées sont listées dans `app.js` (`allowedOrigins`). Si l'URL du front change, l'ajouter à cette liste avant de déployer.

**GitHub**
- Installer l'application GitHub **Render** sur le dépôt (*Installed GitHub Apps*) : sans elle, Render ne reçoit ni les pushes ni le résultat de la CI, et l'auto-deploy ne se déclenche pas.
- Protéger `master` par un ruleset (*Settings* → *Rules* → *Rulesets*) : suppression et force-push interdits, fusion uniquement par pull request, job *Tests* obligatoirement vert. L'administrateur du dépôt figure dans la liste de contournement (*bypass*) et peut pousser directement sur `master`. La CI s'exécute quand même, et Render ne déploie que si elle est verte.

### Retour à une version précédente (rollback)

- **Rapide** : Render → onglet *Events* → choisir le dernier déploiement qui fonctionnait → *Rollback*.
- **Durable** : `git revert <commit>` puis push sur `master` ; la correction passe par la CI comme n'importe quel changement.

### Sauvegarde et restauration de la base

L'offre gratuite d'Atlas ne fait pas de sauvegarde automatique. Avant toute opération risquée (migration, script de maintenance), faire une sauvegarde avec les [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/) :

```bash
# Sauvegarde
mongodump --uri "$MONGO_URL" --out ./backup/$(date +%F)

# Restauration (--drop remplace les collections existantes)
mongorestore --uri "$MONGO_URL" --drop ./backup/2026-10-07
```

Une sauvegarde contient des données personnelles : la stocker hors du dépôt (`backup/` ne doit jamais être commité), dans un espace chiffré, et la supprimer quand elle n'est plus utile.

### En cas d'incident

| Symptôme | Où regarder | Action |
|---|---|---|
| `/health` répond 503 (`database: down`) | Statut d'Atlas, logs Render | Vérifier `MONGO_URL` et l'accès réseau Atlas ; redémarrer le service |
| Le déploiement échoue | Logs de build Render | Corriger, pousser ; l'ancienne version reste en ligne pendant ce temps |
| Une régression est en ligne | Signalement, smoke test | Rollback Render, puis correctif + test de non-régression |
| Erreurs CORS côté front | Console du navigateur | Vérifier `allowedOrigins` dans `app.js` |

## Veille

- **Dépendances** : `npm audit` bloque la CI en cas de faille critique ; Dependabot propose les mises à jour chaque semaine. C'est ainsi que `multer-storage-cloudinary`, qui imposait une version vulnérable de Cloudinary, a été remplacé.
- **Sources suivies** : [CERT-FR](https://www.cert.ssi.gouv.fr/) (alertes de sécurité), [OWASP Top 10](https://owasp.org/www-project-top-ten/), [annonces de sécurité Node.js](https://nodejs.org/en/blog/vulnerability), [GitHub Advisory Database](https://github.com/advisories), journaux des changements de Render, Atlas et Vercel.
