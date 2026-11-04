# Feuille de route — première version réelle

Référence : `PRODUCT.md`, cadrage du 4 novembre 2026. Ces étapes font évoluer l'usine ; elles sont distinctes des six missions exécutées pour chaque application cliente.

## Progression et état
Chaque étape produit un résultat vérifiable et une revue indépendante. Le coordinateur rapporte fichiers touchés, contrôles, preuves et limites. Il préserve le travail existant et ne clôture pas une étape sur un simple statut d'agent.

Le lot courant couvre l'étape 4, à la demande de l'utilisateur après clôture de l'orchestrateur. Son implémentation et ses tests hors ligne sont disponibles ; la première génération fournisseur reste non vérifiée faute de configuration API. Les étapes 5 et 6 restent planifiées. La simulation et le pont d'analyse restent distincts du nouveau transport.

| Étape | État | Dépendance | Critères produit principalement couverts |
| --- | --- | --- | --- |
| 1. Cadrage et règles globales | Terminée — cadrage documentaire revu | Audit de l'existant effectué dans cette conversation | Définit 1 à 15, sans les valider |
| 2. Contrats des six rôles | Terminée — contrats revus, moteur non implémenté | Étape 1 | 3, 4, 12 |
| 3. Orchestrateur persistant | Terminée — vérifiée sur adaptateur injecté | Étape 2 | 2, 4, 8, 9, 10 sur adaptateur injecté |
| 4. Génération réelle isolée | Implémentée hors ligne — ouverte, premier essai API non vérifié | Étape 3 | 5, 6, 7 |
| 5. Boucle de qualité | À réaliser | Étape 4 | 10, 11, 12 |
| 6. Interface, aperçu et recette complète | À réaliser | Étape 5 | 1, 2, 7, 13, 14, 15 et recette de l'ensemble |

Les critères sont cumulatifs. Les étapes techniques préparent les contrats d'interface ; la preuve utilisateur complète arrive à l'étape 6. Aucun critère d'implémentation n'est validé par cette feuille de route.

## Étape 1 — Cadrage et règles globales
**Objectif :** définir une première cible réalisable et les règles de coordination avant de modifier sous-agents et runtime.

**Livrables :** `../AGENTS.md`, `PRODUCT.md`, cette feuille de route et `REVIEW-PLANNING.md` pour la revue indépendante. Préserver les rapports historiques.

**Décisions :** application cliente React/TypeScript/Tailwind, persistance navigateur ; usine locale mono-utilisateur ; une génération active ; six rôles successifs ; tests, aperçu isolé et export requis. Hébergement, comptes et intégrations externes reportés.

**Sortie :** périmètre, exclusions, dépendances, critères et définition de terminé cohérents ; séparation usine/applications clientes explicite ; liens valides et revue traitée. Les contrôles de l'usine restent distincts d'une validation future de génération.

## Étape 2 — Contrats des six rôles
**Objectif :** rendre chaque mission utilisable par l'orchestrateur sans présumer du chargement automatique des TOML par l'adaptateur.

**Travail :** aligner `.codex/agents/*.toml`, documenter les contrats et la transmission effective des instructions. Pour chaque rôle : entrées, versions, objectif, fichiers autorisés, outils, livrables structurés, conditions de succès/blocage et preuves. Prévoir sortie malformée, livrable manquant et demande hors périmètre.

**Sortie :** le brief de référence se décompose en six missions cohérentes avec transmissions explicites et reviewer distinct du développeur. Les chemins sont relatifs au projet confié. Les exemples de contrats ne sont pas présentés comme des missions exécutées.

## Étape 3 — Orchestrateur persistant
**Objectif :** exécuter et suivre le pipeline avec un adaptateur injecté avant tout appel modèle réel.

**Travail :** actualiser architecture et capacités ; choisir stockage et adaptateur ; définir états, transitions, identifiants, tentatives et versions ; implémenter API, validation, persistance, dépendances, exécution unique, pause aux points de reprise, annulation confirmée, erreurs et plafonds. Préserver le pont actuel ou versionner explicitement son évolution.

**Sortie :** tests reproductibles d'un cycle avec adaptateur factice, entrées invalides, concurrence, arrêt non confirmé, dépendances bloquées, relances bornées et récupération après redémarrage. Aucun appel modèle facturable.

## Étape 4 — Génération réelle isolée
**Objectif :** produire les fichiers d'une application dans un espace dédié avec un runtime réel configuré explicitement.

**Travail :** contrôler espaces, chemins résolus, liens et commandes ; connecter l'adaptateur aux contrats des rôles ; matérialiser sources, verrou, documents et sorties traçables. Ne pas simplement retirer les protections du pont actuel. Préparer les frontières du futur aperçu.

**Sortie :** tests de frontière et d'erreurs avec adaptateur injecté ; puis premier projet réellement généré si activation autorisée et prérequis satisfaits. Sinon, conserver la capacité réelle comme non vérifiée sans clôturer cette étape. Du code généré ne vaut pas recette complète.

## Étape 5 — Boucle de qualité
**Objectif :** décider si une version précise est livrable et corriger les défauts dans les limites fixées.

**Travail :** exécuter les commandes clientes, relier critères et preuves, contrôler les versions, organiser QA et revue indépendante, puis corrections, nouveaux contrôles et revue des corrections. Invalider les preuves obsolètes. Définir défauts bloquants et plafonds de correction avant exécution.

**Sortie :** un défaut injecté est détecté et renvoyé en correction ; la version corrigée est recontrôlée ; défaut persistant ou budget épuisé produit un blocage explicite. Le scénario de dépenses possède ses tests métier, de persistance et de parcours navigateur. Séparer preuves de l'usine et de l'application.

## Étape 6 — Interface, aperçu et recette complète
**Objectif :** proposer le pipeline réel dans le parcours simple et livrer une application récupérable.

**Travail :** connecter demande, suivi, erreurs, pause/reprise et résultats à l'orchestrateur ; exposer mode et consommation avant lancement ; actualiser `UX.md` ; gérer un aperçu d'origine distincte refusant l'accès aux capacités privilégiées de l'usine ; exporter les sources sans secrets ni dépendances installées ; documenter lancement et limites.

**Sortie :** recette des 15 critères, génération réelle autorisée du gestionnaire de dépenses, contrôles navigateur, redémarrage et erreurs, isolation de l'aperçu, non-régression des flux existants et reproduction depuis une extraction neuve. La version livrée possède preuves et revue indépendante sans défaut bloquant ouvert. Aucun déploiement externe inclus.

## Preuves de l'étape courante
L'étape 1 est clôturée le 4 novembre 2026 : revue indépendante sans défaut bloquant dans [REVIEW-PLANNING.md](REVIEW-PLANNING.md), références documentaires vérifiées et `git diff --check` réussi. Le coordinateur a exécuté `npm run typecheck`, `npm test` (39 tests frontend et 13 backend, soit 52 réussis) et `npm run build` avec succès. Ces contrôles portent sur l'usine actuelle ; aucun job modèle réel n'a été lancé par le pont et aucune application cliente n'a été générée dans ce lot.

L'étape 2 est clôturée le 4 novembre 2026. Le lot comprend [AGENT-CONTRACTS.md](AGENT-CONTRACTS.md), les six TOML alignés, deux schémas JSON et des exemples explicitement fictifs. Le contrôle `python scripts/check_agent_contracts.py` réussit : six TOML, deux schémas et sept exemples valides, vingt cas invalides rejetés. La [revue indépendante](REVIEW-CONTRACTS.md) est terminée sans constat correctif ouvert, après correction du défaut d'ancrage des identifiants et chemins et précision du protocole de retour des preuves.

Contrôles de l'usine exécutés par le coordinateur : `npm run typecheck`, `npm test` (39 frontend + 13 backend = 52 réussis) et `npm run build`, tous avec code 0. Références du lot vérifiées et `git diff --check` réussi. Aucun fichier de `src/`, `server/` ou `.codex/config.toml` n'a été modifié ; aucun job réel n'a été lancé via le pont. Aucun chargement automatique des TOML, validateur serveur ou cycle réel de génération n'est activé.

Les résultats historiques de `QA-UX.md` ne prouvent pas le fonctionnement de la cible. Les 15 critères d'implémentation complets restent à vérifier sur une génération réelle et la recette utilisateur. À la clôture de l'étape 2, le lot suivant était l'orchestrateur persistant avec adaptateur injecté, sans appel modèle facturable.

L'étape 3 ajoute le moteur serveur et son API v1, le journal JSON local validé et verrouillé, les instructions épinglées, les six missions séquentielles, les plafonds, les sorties partielles et instantanés historiques, la pause/reprise et la réconciliation explicite après redémarrage. L'exécution demeure `example` sur adaptateur injecté, avec fichiers virtuels et contrôles factices ; aucune application cliente réelle ni connexion au CLI n'est activée. Voir [ORCHESTRATION.md](ORCHESTRATION.md), [QA-ORCHESTRATOR.md](QA-ORCHESTRATOR.md) et [REVIEW-ORCHESTRATOR.md](REVIEW-ORCHESTRATOR.md).

Clôture de l'étape 3 le 4 novembre 2026 : 29 tests d'orchestrateur réussis, suite complète de 81 tests (39 frontend, 13 pont, 29 moteur), TypeScript et build réussis. Revue indépendante des corrections clôturée sans constat ouvert. Le contrôle des contrats et les liens locaux sont vérifiés. Les preuves concernent l'usine et son pipeline injecté ; aucun critère de génération réelle n'est déclaré satisfait.

L'étape 4 ajoute l'adaptateur OpenAI Responses sans outils, les propositions structurées validées puis projetées vers le contrat v1, les instantanés physiques versionnés, les contrôles de chemins/liens/collisions et d'intégrité, le socle de dépendances verrouillé et un script de premier essai. Les appels API sont distincts du CLI et demandent clé, modèle explicite et activation côté serveur. Les preuves factices ne peuvent pas valider un projet réel. Voir [GENERATION.md](GENERATION.md), [QA-GENERATION.md](QA-GENERATION.md) et [REVIEW-GENERATION.md](REVIEW-GENERATION.md).

**Étape courante non clôturée : 4 — premier essai réel à effectuer.** `generation:check` constate activation désactivée, clé et modèle absents ; aucun appel API réel ni compilation d'application générée n'a été effectué. L'implémentation hors ligne et sa revue ne satisfont pas le critère G-8. La prochaine action est de configurer localement le transport puis d'exécuter et consigner l'essai borné, en tenant compte de sa consommation possible. Après cette preuve, l'étape 5 sera la boucle de qualité avec exécution cliente réellement isolée. Le moteur Docker observé n'est pas accessible ; sa disponibilité devra être résolue ou une autre isolation explicite choisie avant ces commandes.
