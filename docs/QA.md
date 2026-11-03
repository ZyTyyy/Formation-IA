# QA — vérification du MVP

## Périmètre confié au QA Engineer

Tests automatisés du moteur déterministe (`src/domain.ts`), de la persistance navigateur (`src/storage.ts`), des parcours React, du suivi des jobs réels et du backend local. Le QA Engineer a écrit les suites métier et persistance, puis exécuté la suite consolidée comprenant les tests livrés par le coordinateur et le développeur Fullstack. Aucun appel de modèle IA ni aucun job Codex payant n'est requis par ces tests.

## Tests livrés

`src/domain.test.ts` contient 12 cas : normalisation du brief, bornes valides et invalides, création des six tâches, démarrage du premier rôle, ordre des dépendances, absence de mutation de l'état précédent, pause/reprise sans doublon, terminaison idempotente, progression et exemples initiaux.

Les assertions sur les livrables vérifient la mention explicite « SIMULATION LOCALE », l'origine déterministe et l'absence de prétention à une génération de code, un test exécuté ou une approbation de code.

`src/storage.test.ts` contient 16 cas : session vide, sérialisation versionnée, rechargement, arrêt d'une simulation au rechargement, erreurs de lecture et de quota, JSON tronqué, format/version invalides, doublons, limite de volume et cohérence des rôles, tâches, dates, livrables et événements.

`src/App.test.tsx` contient 4 cas : mode simulé et six rôles, consultation/fermeture des consignes, création persistée sans lancement automatique, simulation jusqu'à terminaison puis rechargement/historique, recherche et filtres. Certains de ces comportements sont regroupés dans un même cas.

`src/useRealJobs.test.tsx` contient 4 cas : résultat récupéré indépendamment de la page Connexions, reprise après coupure et échec réel conservé, tâche perdue après un HTTP 404 classée « inconnue » avec arrêt du polling, conservation de la sortie partielle et des événements déjà reçus lorsqu'une tâche disparaît ensuite. Aucun de ces cas ne transforme une absence de preuve en réussite.

`server/bridge.test.mjs` contient 13 cas : pont désactivé par défaut, validation des entrées et de la présence du CLI, réussite fondée sur une fin de tour réelle et un code de sortie nul, concurrence, sorties partielles, échecs et timeouts, annulation non confirmée, bornes des journaux, commande sans shell en lecture seule, protections HTTP Host/Origin/type/taille et cycle de vie d'un job via un adaptateur injecté.

## Exécution

Vérification finale exécutée le **3 novembre 2026** depuis la racine du projet, après mise à jour des dépendances :

| Commande | Résultat observé |
| --- | --- |
| `npm test` | Code 0 : **36 tests frontend réussis** dans 4 fichiers avec Vitest 4.1.12, puis **13 tests backend réussis** avec `node --test`. Total : **49 réussis, aucun échec**. |
| `npm run build` | Code 0 : TypeScript `tsc --noEmit` puis build Vite 6.4.5 réussis, 1 588 modules transformés. |

Le premier lancement de Vitest dans le sandbox a rencontré une erreur d'infrastructure `EPERM` lors du renommage de son cache temporaire, avant le chargement des tests. Une relance avec l'autorisation d'exécution locale prévue a réussi. La dernière exécution, après correction de la conservation du dernier instantané d'une tâche disparue, rapporte 6,39 secondes pour le frontend, environ 0,31 seconde pour le backend et 6,08 secondes pour le build Vite. Aucun appel de modèle réel n'a été lancé.

## Traçabilité des critères produit

| Critère | Couverture livrée | Vérification complémentaire |
| --- | --- | --- |
| Création valide | Validation métier, bornes et création via formulaire React | Rendu des erreurs et parcours clavier dans un navigateur |
| Persistance | Aller-retour, données invalides, refus/quota, reprise manuelle et remontage de l'interface | Rechargement dans un navigateur réel |
| Dashboard cohérent | Calcul de progression, recherche et filtre avec état vide | Compteurs et rendu des vues |
| Six rôles explicites | Identifiants et ordre exact, six titres de rôles et dialogue de consignes | Lisibilité des responsabilités et livrables |
| Simulation honnête | Mentions dans l'interface, les documents et les événements | Mention visible dans chaque vue concernée |
| Suivi traçable | Dépendances, pause/reprise, documents par étape, terminaison et historique React | Consultation/téléchargement d'un résultat dans un navigateur |
| Capacités réelles | Protections API, cycle de vie injecté et erreurs du suivi frontend | CLI authentifié et appel de modèle réel non exécutés |
| Interface utilisable | Contrôles React retrouvés par rôle/label, dialogue et état vide | Clavier, focus, responsive, chargement/erreur dans un navigateur |

## Contrôles navigateur du coordinateur

Contrôles manuels effectués sur la version locale finale : création d’un projet valide, présence des six tâches sans lancement automatique, démarrage et pause du cycle, diagnostic API avec CLI détecté et pont désactivé. Le menu mobile fermé disparaît de l’arbre accessible ; son ouverture déplace le focus, et Échap ferme le menu et rend le focus au bouton d’ouverture. Aucun message de console de niveau warning/error n’a été observé sur le parcours vérifié.

Aux largeurs 320, 768, 1 024 et 1 440 pixels, la largeur du document reste inférieure ou égale à celle de la fenêtre (hors barre de défilement). Les captures montrent l’adaptation du dashboard et de la navigation. Les libellés du pipeline sont tronqués visuellement si nécessaire ; leur nom accessible reste complet. Une capture finale du dashboard est fournie séparément avec les livrables locaux.

## Limites conservées

Les tests avec `jsdom` ne remplacent pas une inspection du rendu ni un essai clavier dans un navigateur. Le coordinateur effectue séparément les contrôles navigateur aux largeurs 320, 768, 1 024 et 1 440 pixels ; leurs résultats ne sont pas présumés dans ce rapport. L'authentification Codex et les réponses d'un modèle réel ne sont pas validées par cette suite. Les tests du backend utilisent un adaptateur injecté afin de vérifier ses protections et transitions sans facturer une exécution IA.
