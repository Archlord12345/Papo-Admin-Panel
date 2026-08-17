# PAPO — Panel administrateur

Panel web d’administration PAPO, construit avec React, Vite et Supabase. Il est destiné à l’exploitation du backend Supabase auto-hébergé et ne contient aucune clé `service_role`.

## Prérequis

Installez Node.js 20 ou une version plus récente, puis installez les dépendances :

```bash
npm install
```

## Variables d’environnement

Configurez les variables publiques suivantes dans votre environnement de déploiement. Ne committez jamais de fichier `.env` ni de clé `service_role`.

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL publique de l’instance Supabase auto-hébergée. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé anon/publishable publique acceptée par Kong/Supabase. |

## Commandes

```bash
npm run dev
npm run test:env
npm run lint
npm run build
```

`npm run test:env` vérifie la présence des variables publiques et valide que la passerelle Auth accepte la clé configurée.

## Sécurité

Le navigateur utilise exclusivement la clé publique Supabase. Les opérations sensibles doivent être protégées par les politiques RLS et les RPC du backend v4.1.
