# FitTogether API

[![CI](https://github.com/Nolan910/FitTogether-CDA/actions/workflows/ci.yml/badge.svg)](https://github.com/Nolan910/FitTogether-CDA/actions/workflows/ci.yml)

API REST de FitTogether, une application pour trouver des partenaires de sport, publier des photos de ses séances et discuter avec ses partenaires.

Front-end : [FitTogether](https://github.com/Nolan910/FitTogether)

## Stack

- **Node.js / Express 4**
- **MongoDB Atlas** avec **Mongoose**
- **JWT** pour l'authentification, **bcrypt** pour les mots de passe
- **Cloudinary** pour les images
- **Jest**, **Supertest** et **mongodb-memory-server** pour les tests

## Installation

```bash
npm install
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le serveur avec rechargement automatique (nodemon) |
| `npm start` | Lance le serveur (production) |
| `npm test` | Lance les tests |
| `npm run lint` | Vérifie le code avec ESLint |

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

- **Authentification** : le token est envoyé dans l'en-tête `Authorization: Bearer <token>`. `verifyToken` le vérifie, recharge l'utilisateur en base et renseigne `req.userId` et `req.isAdmin`.
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
| GET | `/user/:id/relationship` 🔒 | Relation avec l'utilisateur `:id` : `partners`, `sent` (demande envoyée), `received` (demande reçue) ou `none` | |
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
npm test
```

Les tests tournent sur une base MongoDB en mémoire et Cloudinary est simulé : ils ne touchent jamais la base ni les images de production, et ne demandent aucune variable d'environnement. Ils couvrent :

- `verifyToken` : token absent, mal formé, signé avec un autre secret, expiré, compte supprimé ;
- les contrôles de droits (403) sur les posts, commentaires, profils, demandes de partenariat et messages ;
- l'identité tirée du token plutôt que du body ;
- l'inscription, la validation des entrées, la connexion et l'injection NoSQL ;
- la limitation du nombre de tentatives de connexion ;
- la suppression complète d'un compte et de ses images Cloudinary ;
- la route `/health`.

## Déploiement

L'API est hébergée sur Render et la base sur MongoDB Atlas

### Procédure de mise en production

1. Créer une branche depuis `master`, développer, lancer `npm run lint` et `npm test` en local
2. Pousser la branche et ouvrir une pull request vers `master` : la CI s'exécute
3. Si la CI est verte : fusionner la pull request
4. La CI s'exécute sur `master`, puis Render déploie automatiquement
5. Render appelle `/health` : la nouvelle version ne remplace l'ancienne que si elle répond 200
6. Dérouler la recette manuelle sur le site en ligne pour les fonctionnalités modifiées

### Retour à une version précédente (rollback)

Possibilité de revenir à une version précédente avec Render

## Veille

- **Dépendances** : `npm audit` bloque la CI en cas de faille critique ; Dependabot propose les mises à jour chaque semaine
