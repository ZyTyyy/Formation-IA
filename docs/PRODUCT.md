# AI Software Factory — cadrage produit du MVP

## Finalité

Permettre de décrire une application, de répartir son travail entre six rôles spécialisés et de suivre les tâches et livrables. Le MVP offre un parcours immédiatement utilisable en simulation locale. Une orchestration Codex réelle n'est présentée comme telle que lorsqu'un connecteur disponible a réellement exécuté le travail et produit des preuves.

## Utilisateurs et besoins

| Persona | Besoin principal | Résultat attendu |
| --- | --- | --- |
| Porteur de projet | Transformer une idée en travail structuré | Brief enregistré, étapes et responsabilités lisibles |
| Développeur indépendant | Explorer un processus de livraison assisté | Tâches, consignes et livrables réutilisables |
| Responsable technique | Comprendre ce qui a réellement été exécuté | Mode explicite, résultats consultables et limites connues |

## Périmètre

Application web React, TypeScript et Tailwind CSS : dashboard, création d'un projet, équipe de six rôles, suivi des tâches, historique et consultation des résultats. Les données de démonstration et les nouvelles données sont distinguées. La persistance locale permet de retrouver les projets après rechargement. Le backend local expose les capacités effectivement détectées ; le pont CLI Codex reste optionnel et doit rendre visibles ses prérequis.

Le MVP n'inclut pas la collaboration multiutilisateur, la facturation, la gestion de secrets dans le navigateur ou un déploiement automatique d'applications produites. Une progression de simulation décrit un scénario déterministe : elle ne prouve ni génération par un modèle, ni tests exécutés, ni validation humaine.

## Parcours et responsabilités

| Étape et rôle | Responsabilités | Livrable identifiable | Passage à l'étape suivante |
| --- | --- | --- | --- |
| 1. Product Manager | Clarifier le problème, le périmètre et les critères d'acceptation | Brief et backlog priorisé | Critères suffisamment précis pour concevoir |
| 2. UX Designer | Définir les parcours, états et règles d'accessibilité | Parcours, structure des écrans et spécification UI | Parcours couvrant les besoins prioritaires |
| 3. Software Architect | Définir modules, données, contrats et limites d'intégration | Document d'architecture et décisions techniques | Contrats utilisables par le développement |
| 4. Fullstack Developer | Implémenter les fonctionnalités et gérer les erreurs | Code frontend/backend et instructions de lancement | Version exécutable et vérifiable |
| 5. QA Engineer | Vérifier les critères, les transitions et la persistance | Tests et rapport avec commandes et résultats observés | Échecs corrigés ou explicitement documentés |
| 6. Code Reviewer | Examiner correction, sécurité, lisibilité et régressions | Revue priorisée avec références et corrections | Problèmes bloquants corrigés ou livraison limitée explicitement |

L'orchestrateur coordonne les dépendances et consolide les résultats. Des délégations parallèles sont possibles pour les tâches indépendantes ; les six rôles ne supposent pas six agents simultanés. Dans l'interface, un rôle est une définition de responsabilité, pas la preuve d'un processus autonome actif.

## Critères d'acceptation

1. **Création valide.** Depuis le formulaire, un nom et un brief valides créent un projet identifiable ; les champs requis vides empêchent la soumission et affichent une erreur compréhensible.
2. **Persistance.** Après création d'un projet et rechargement de la page, le projet et son état enregistré sont retrouvés ; une donnée locale illisible produit un état de repli utilisable.
3. **Dashboard cohérent.** Les compteurs et listes reflètent les projets et leurs états ; une absence de projet propose une action de création.
4. **Six rôles explicites.** La vue équipe contient exactement les six rôles demandés et permet d'identifier leurs responsabilités et leurs livrables.
5. **Simulation honnête.** Toute exécution locale simulée porte une indication visible « Simulation » ; ses résultats ne déclarent pas qu'un modèle, un test ou un commit réel a été exécuté.
6. **Suivi traçable.** Une simulation fait évoluer les tâches selon leurs dépendances, affiche leur état et conserve des résultats consultables dans l'historique associé au projet.
7. **Capacités réelles vérifiables.** La disponibilité d'un backend ou du CLI est établie par une réponse réelle ; si le pont est absent, l'interface explique le prérequis et ne présente aucun agent comme connecté. Une exécution réelle échouée reste un échec visible.
8. **Interface utilisable.** Les principales actions sont accessibles au clavier, les formulaires disposent de labels et les vues restent utilisables sur petit et grand écran ; chargement, erreur et liste vide ont un retour explicite.

## Priorités de livraison

- **P0 :** parcours création → simulation → suivi → résultats, séparation simulation/réel, six rôles et persistance.
- **P1 :** dashboard, recherche et filtres, capacités du backend, export des livrables, tests automatisés et revue indépendante.
- **P2 :** orchestration réelle plus étendue, streaming, isolation des exécutions, stockage partagé et authentification, après validation des contrats et prérequis.

## Identifiants, coûts et autorisations

La simulation locale ne nécessite pas de clé d'API et n'effectue aucun appel de modèle. La détection d'un binaire ne prouve pas que son compte est authentifié ou qu'une exécution est autorisée. Une connexion réelle peut nécessiter une session Codex ou des identifiants, consommer un quota ou générer un coût selon le service utilisé. Ces conditions doivent apparaître avant l'action correspondante. Les secrets restent côté serveur ; publication, accès à des dépôts externes et opérations irréversibles respectent les autorisations effectives.

## Mesure de réussite

Un utilisateur peut créer un projet et retrouver ses résultats sans aide, comprendre le rôle de chaque membre de l'équipe et identifier immédiatement si le travail affiché est simulé ou réellement exécuté. La livraison est accompagnée des résultats de tests observés et d'une revue du code ; aucune métrique de qualité n'est inventée à partir d'une animation.
