# FreshPro B2B

Application web B2B pour professionnels alimentaires:
- catalogue produits
- paiement immediat obligatoire
- gestion stock automatique
- suivi commandes/livraisons
- commandes recurrentes
- support client
- dashboard admin (marges, rentabilite, alertes)
- SEO technique de base (metadata, sitemap, robots, schema.org)

## 1) Lancer le projet (simple)

```bash
npm install
npm run dev
```

Ouvre ensuite:
- `http://localhost:3000`

## 2) Pages disponibles

- `/` accueil
- `/catalogue` catalogue produits
- `/commander` passage de commande + paiement + recurrence
- `/historique` historique commandes et factures
- `/support` tickets support client
- `/admin` dashboard administrateur

## 3) Logique metier deja implementee

- Paiement obligatoire avant creation commande.
- Pas d'acompte, pas de paiement differe.
- Stock decremente automatiquement apres paiement valide.
- Blocage si stock insuffisant.
- Livraison:
  - commande avant 19h -> livraison J+1
  - commande apres 19h -> livraison J+2
- Marge calculee:
  - marge euro
  - marge pourcentage
  - alertes marge faible / vente a perte (admin)

## 4) Acces admin (MVP)

Les API admin demandent:
- header `x-user-role: ADMIN`
- header `x-admin-key: <ADMIN_API_KEY>`

Dans l'UI admin, la cle par defaut est:
- `dev-admin-key`

Change-la en production via `.env`:

```env
ADMIN_API_KEY="une-cle-secrete-forte"
```

## 5) Base de donnees PostgreSQL (preparation scale)

Le MVP tourne en memoire pour aller vite.
Le schema PostgreSQL complet est pret dans:
- `prisma/schema.prisma`

Variables:
- copier `.env.example` vers `.env`

Demarrer PostgreSQL local (Docker):

```bash
npm run db:up
```

Arreter:

```bash
npm run db:down
```

## 6) Scripts utiles

```bash
npm run lint
npm run build
npm run db:up
npm run db:down
npm run db:generate
npm run db:push
```

## 7) Notes MVP

- Facture exportee en fichier texte (`.txt`) pour la demo.
- Pour une version production: brancher Stripe/Open Banking reel + PDF fiscal.
