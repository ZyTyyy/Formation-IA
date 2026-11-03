# AI Software Factory

## Mission
Construire un atelier React, TypeScript et Tailwind qui distingue toujours simulation locale et exécution réelle. Le Lead Architect coordonne les six rôles de `.codex/agents/`. Le brief utilisateur prime. Ne pas prétendre qu'un rôle affiché dans l'interface est un agent autonome réel.

## Travail d'équipe
- Product Manager : `docs/PRODUCT.md`, critères d'acceptation et périmètre.
- UX Designer : `docs/UX.md`, parcours, accessibilité et direction visuelle.
- Software Architect : `docs/ARCHITECTURE.md`, contrats et capacités.
- Fullstack Developer : application, API locale, adaptateurs et gestion d'erreurs.
- QA Engineer : tests reproductibles et `docs/QA.md` avec résultats observés.
- Code Reviewer : `docs/REVIEW.md`, problèmes priorisés et preuves, sans auto-validation.

Le coordinateur donne une tâche bornée, les fichiers autorisés et le livrable à chaque sous-agent réel. Réutiliser les résultats plutôt que simuler des échanges. Ne pas déléguer sans demande du coordinateur. Les fichiers de rôles sont des instructions; ils ne prouvent pas qu'une exécution a eu lieu.

## Conventions
TypeScript strict, composants ciblés, HTML sémantique, français, labels de formulaire, navigation clavier, reduced-motion. Aucune clé dans le navigateur. Pas de HTML injecté pour les livrables. Valider les données persistées et les entrées API. Les démos ne produisent jamais de véritables rapports de tests ou de code compilé.

## Vérification
`npm run typecheck`, `npm test`, `npm run build`. Vérifier création, pause/reprise, dépendances, historique, rechargement et erreurs. Tester le backend avec adaptateur injecté sans facturer de requêtes IA. Revue indépendante avant livraison.

## Système et autorisations
Le navigateur ne reçoit pas les outils internes du chat Codex. Le pont CLI est local, désactivé par défaut et en lecture seule. Une session authentifiée et un quota sont nécessaires pour les vrais jobs; signaler les coûts avant activation. Garder les limites de sécurité et les politiques du parent. Ne jamais contourner les approbations. MCP et skills hérités restent soumis aux capacités du runtime. Aucun serveur MCP externe activé automatiquement.
