# Journal de construction réel — 3 novembre 2026

Ce journal décrit les délégations effectivement lancées dans le chat Codex. Il est indépendant des données d’exemple et des simulations produites par le navigateur.

| Rôle réel | Mission bornée | Livrables obtenus |
| --- | --- | --- |
| Product Manager (`/root/product_manager`) | Définir le MVP et huit critères d’acceptation | `docs/PRODUCT.md` |
| UX Designer (`/root/ux_designer`) | Parcours, tokens, responsive et accessibilité | `docs/UX.md` |
| Software Architect (`/root/software_architect`) | Architecture, capacités et contrat du pont | `docs/ARCHITECTURE.md`, `docs/CAPABILITIES.md` |
| Fullstack Developer (`/root/fullstack_developer`) | Implémenter API Node, adaptateur CLI, lanceur et tests backend | `server/*.mjs`, `scripts/dev.mjs` ; corrections d’isolation et de timeout |
| QA Engineer (`/root/qa_engineer`) | Tester le domaine et la persistance, documenter les preuves | 28 tests dans deux fichiers, `docs/QA.md` |
| Code Reviewer (`/root/code_reviewer`) | Revue indépendante des frontières, transitions et résultats | `docs/REVIEW.md`, trois constats initiaux et vérification des corrections |

Le Lead Architect a inspecté l’environnement, vérifié la documentation officielle, configuré les rôles, intégré les livrables, implémenté le frontend et le moteur, ajouté les tests UI et de suivi des missions, réalisé les contrôles visuels et préparé la livraison. Les sous-agents ont été lancés par vagues dans la limite de quatre agents actifs, coordinateur inclus. Aucun sous-agent n’a été représenté dans l’interface comme toujours actif.

## Mécanismes réellement utilisés

- Délégation native : création et reprise de sous-agents, messages de coordination, livrables écrits dans des fichiers distincts.
- Consignes persistantes : `AGENTS.md`, `.codex/config.toml` et six fichiers de rôles TOML.
- Skills : Sites, frontend UI engineering, OpenAI Docs et Computer Use pour le workflow et les vérifications adaptées.
- MCP : Sites pour la livraison privée et outils de l’application Codex pour l’aperçu ; aucun héritage automatique de ces outils vers la page web.
- Git : dépôt isolé dans le dossier de l’application ; source versionnée séparément du dépôt parent.
- Vérification : tests métier/persistance, interface et suivi des jobs ; tests HTTP/backend injectés sans modèle ; build et revue indépendante.

## Limites de preuve

Aucune mission modèle n’a été lancée via le pont web pendant les tests. Le binaire et ses options ont été inspectés, et l’intégration est couverte avec un adaptateur injecté. L’authentification, le quota et une véritable sortie modèle restent à vérifier lors de la première mission autorisée. La présence d’un fichier de rôle ne constitue pas à elle seule une preuve de délégation.

## Livraison locale et publication

49 tests ont réussi (36 frontend et 13 backend), ainsi que TypeScript et le build de production. L’audit npm installé ne signale aucune vulnérabilité connue. Vérifications navigateur : création de projet, démarrage/pause, diagnostic CLI avec pont désactivé, focus du menu mobile et Échap, dimensions 320/768/1024/1440 sans débordement horizontal ; aucune erreur de console observée sur le parcours contrôlé.

L’envoi du code par le workflow Sites a été refusé par la vérification automatique des autorisations, faute d’accord utilisateur explicite pour le dépôt hébergé privé. Aucun push ni déploiement n’a eu lieu. Le code local, son archive et le build sont livrés ; la publication attend cet accord. La fiche Site déjà créée et son identifiant doivent être réutilisés si l’utilisateur autorise la suite.


## Refonte UX demandée par l’utilisateur

Interface recentrée sur une seule demande en langage naturel. Préparation automatique, trois étapes visibles, dossier et bibliothèque. Suppression des menus de gestion d’agents, du dashboard et du formulaire technique. Conservation des données v1 et du backend. Design sombre à surfaces de verre ; clavier, focus et responsive vérifiés. Revue indépendante dans REVIEW-UX.md, 52 tests réussis et build validé dans QA-UX.md. Code livré localement et archive mise à jour ; aucune publication externe tentée pour cette refonte.
