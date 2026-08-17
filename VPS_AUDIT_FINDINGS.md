# Audit du panel VPS — 2026-08-17

## Constat initial

URL auditée : `http://82.165.150.150:20081/`.

La page de connexion se charge et expose le formulaire PAPO avec téléphone, mot de passe et bouton de connexion. Le titre HTML est `PAPO — Administration`.

## Défaut visuel confirmé

Le rendu déployé est pratiquement non stylé : les classes Tailwind et les classes utilitaires `.btn`, `.input`, `.card` ne sont pas appliquées correctement. Le formulaire s’affiche pleine largeur, sans conteneur central, sans carte, sans hiérarchie visuelle et sans responsive design exploitable. Le déploiement ne sert donc pas la feuille CSS attendue ou sert un ancien build incomplet.

## Console

Aucune erreur JavaScript n’est apparue dans la console lors du chargement initial. Le problème visible est prioritairement un problème d’assets/build CSS et de synchronisation entre le dépôt GitHub et le contenu réellement servi par le port 20081.

## À vérifier ensuite

Comparer les fichiers servis par le VPS avec le commit GitHub, vérifier la présence de `dist/assets/*.css`, puis reconstruire et redémarrer le service `paypoint-web` depuis le commit corrigé.

## Vérification après correction locale

La configuration PostCSS/Tailwind ajoutée produit un CSS de 13,6 Ko sans occurrence `@tailwind`, et le bundle contient bien l’URL Supabase ainsi que la clé publique injectées. Le preview local restait blanc avec une erreur React minifiée dans le composant racine. La cause était l’absence de l’import React requis par le mode JSX classique ; l’import a été ajouté à App et PostsPanel, puis le bootstrap a reçu un ErrorBoundary explicite. Après reconstruction, le formulaire s’affiche correctement avec sa carte sombre, ses champs et son bouton, et la console ne signale plus d’erreur runtime. Le VPS actuel reste sur l’ancien build CSS non compilé et n’a pas encore été modifié.
