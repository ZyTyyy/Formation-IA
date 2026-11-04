# AI Software Factory — première version réelle

Date de cadrage : 4 novembre 2026. Ce document remplace le cadrage initial à dashboard. Il définit une cible, pas des capacités déjà livrées. Les preuves historiques restent dans `QA.md`, `QA-UX.md`, `REVIEW.md`, `REVIEW-UX.md` et `EXECUTION.md`, dans leurs périmètres respectifs.

## Problème et résultat attendu
Un porteur de projet décrit une idée sans devoir piloter six métiers ni assembler leurs réponses. L'usine coordonne PM, UX Designer, Software Architect, Fullstack Developer, QA Engineer et Code Reviewer pour produire une application utilisable, avec code et preuves de vérification.

Première cible : **une application web React, TypeScript et Tailwind, exécutée localement, avec persistance dans le navigateur, tests, aperçu et export des sources**. Un gestionnaire de dépenses personnel sans connexion bancaire sert de scénario de référence. Un dossier de préparation seul ne satisfait pas cette cible.

## État actuel observé
| Capacité | État au cadrage |
| --- | --- |
| Demande unique, bibliothèque, dossier et réglages avancés | Implémentés |
| Six rôles, progression et documents | Simulation déterministe, explicitement étiquetée |
| Sauvegarde des projets simulés | Stockage navigateur ; simulation mise en pause au rechargement |
| Mission CLI réelle | Pont facultatif d'analyse en lecture seule, une mission à la fois, historique serveur en mémoire |
| Orchestrateur persistant (évolution étape 3) | Implémenté avec adaptateur de test injecté, fichiers virtuels et API v1 ; aucun adaptateur activé dans le serveur livré |
| Génération de sources, orchestration réelle, tests de l'application produite | À implémenter |
| Isolation par application, aperçu isolé et export des sources générées | À implémenter |

`UX.md` et `ARCHITECTURE.md` décrivent le parcours et le backend actuels. `ROADMAP.md` précise leur évolution. Aucun changement de capacité n'est activé par ce cadrage.

## Utilisateurs et parcours
Utilisateur principal : porteur de projet individuel sur sa machine. Il veut obtenir une petite application locale et comprendre ce qui a été fait. Un développeur doit pouvoir récupérer les sources et reproduire les contrôles.

1. Décrire l'idée dans le champ existant ; identifier le mode simulation ou réel avant lancement. Le mode réel expose prérequis et consommation possible.
2. Obtenir le périmètre et les critères du PM. Seules les ambiguïtés déterminantes demandent une clarification ; les hypothèses ordinaires sont consignées.
3. Suivre UX, architecture, développement, QA et revue, avec transmission des livrables utiles. Les six rôles restent internes au parcours principal.
4. Consulter l'avancement et les erreurs, demander une pause, reprendre ou annuler sans piloter chaque rôle ni approuver chaque passage déjà autorisé.
5. Laisser l'usine corriger les défauts dans ses plafonds, puis refaire les contrôles concernés et la revue des corrections.
6. Accéder à l'aperçu, aux sources et aux preuves d'une version validée. Une exécution interrompue conserve diagnostic et livrables partiels sans statut de livraison complète.

## Périmètre retenu
- Usine locale, mono-utilisateur, sans compte applicatif ni hébergement cloud requis pour l'usine ou les applications. Le runtime IA réel peut appeler un service distant et nécessite ses propres accès et quotas.
- Applications clientes React/TypeScript/Tailwind ; l'architecte choisit structure et contrats dans ce cadre, sans sélection libre de stack.
- Données clientes dans le navigateur, validation au chargement et traitement des erreurs de stockage.
- Une génération active à la fois ; six missions de rôles distinctes exécutées successivement par un runtime réel, avec traces de leurs transmissions. Un rôle nommé ne prouve pas un sous-agent natif supplémentaire.
- Espace isolé par projet : sources, documents, tests et preuves séparés de ceux de l'usine et des autres projets.
- Historique réel persistant côté serveur, réconciliation après redémarrage, reprises identifiables et plafonds explicites.
- Aperçu local isolé, export des sources et reproduction depuis une extraction neuve sous les prérequis documentés.
- Préservation de la simulation et des anciens projets ; aucune conversion en exécution réelle par changement d'étiquette.

## Hors périmètre
Collaboration multi-utilisateur, synchronisation cloud, backend métier des applications générées, authentification cliente, paiements, données bancaires, intégrations API/MCP externes, applications mobiles natives, publication automatique, import arbitraire de dépôts et générations simultanées.

Une demande hors périmètre reçoit une explication et une proposition réduite. La publication pourra faire l'objet d'une évolution avec ses autorisations propres.

## Pipeline et livrables
Les chemins ci-dessous sont relatifs à l'application produite et ne désignent pas les documents de l'usine.

| Étape | Entrées | Sorties | Condition de passage |
| --- | --- | --- | --- |
| PM | Brief et réponses utiles | `docs/PRODUCT.md`, hypothèses et critères numérotés | Périmètre compatible et critères testables |
| UX | Brief et PM | `docs/UX.md`, parcours, écrans et états | Besoins prioritaires et accessibilité couverts |
| Architecture | PM et UX | `docs/ARCHITECTURE.md`, données, contrats, commandes | Instructions réalisables dans le cadre autorisé |
| Développement | Livrables amont validés | Sources, tests pertinents, scripts et `README.md` | Version identifiable disponible pour vérification |
| QA | Critères et version du code | Tests, journaux et `docs/QA.md` | Résultat et preuve ou limite explicite pour chaque critère |
| Revue | Même version, diff et résultats QA | `docs/REVIEW.md`, constats priorisés | Défauts bloquants renvoyés en correction |
| Correction et livraison | Constats et échecs | Version corrigée, preuves, aperçu et export | Aucun défaut bloquant ouvert ; contrôles et revue à jour |

Les contrats détaillés sont définis dans [AGENT-CONTRACTS.md](AGENT-CONTRACTS.md) et les schémas du dossier `contracts/`. Le moteur de l'étape 3 les valide avec un adaptateur de test ; leur application à une vraie génération reste à implémenter. Le coordinateur gère les transitions ; aucun rôle ne s'attribue toutes les validations. Une modification des entrées entraîne la revalidation des étapes dépendantes.

## Critères d'acceptation de la cible
Ces critères doivent être démontrés avant de déclarer la première version réelle livrée. Leur rédaction ne vaut pas réussite.

1. **Demande simple.** Un brief valide crée un projet identifiable sans gestion manuelle des agents ; une demande invalide affiche une erreur et ne lance aucun job.
2. **Mode et prérequis.** Avant exécution réelle, mode, prérequis, consommation possible et plafonds configurés sont visibles. Sans capacité disponible, aucun job n'est annoncé comme lancé et aucune simulation ne le remplace silencieusement.
3. **Cadrage.** Le PM consigne périmètre, exclusions, hypothèses et critères numérotés. Une demande hors périmètre ou une ambiguïté déterminante bloque les étapes dépendantes avec une explication exploitable.
4. **Six missions traçables.** Chaque rôle reçoit ses entrées de référence et produit un livrable identifiable. Le journal conserve missions réellement lancées, tentatives, résultats et transmissions ; une dépendance non validée empêche le lancement suivant.
5. **Écritures isolées.** Chaque application possède son espace ; les tests démontrent que chemins hors espace, traversées et liens sortants ne permettent pas d'écrire dans l'usine ou un autre projet. Outils et commandes sont limités côté serveur.
6. **Code exploitable.** Les sources existent avec manifeste, verrou de dépendances, scripts de développement, vérification et build, et README de lancement ; un texte décrivant du code ne suffit pas.
7. **Persistance cliente.** Les dépenses du scénario de référence sont retrouvées au rechargement. Données invalides et refus de stockage ont un comportement explicite sans fausse confirmation de sauvegarde.
8. **Exécution durable.** Après redémarrage serveur, projets, tentatives, événements et livrables restent consultables. Une mission interrompue est réconciliée ou d'issue inconnue, sans faux succès ni relance facturable implicite.
9. **Pause, reprise et annulation.** Une pause empêche les nouveaux départs et devient effective au point de reprise enregistré de la mission active. Une reprise conserve l'historique ; une annulation exige un arrêt confirmé avant réutilisation des ressources.
10. **Échecs et plafonds.** Timeout, sortie invalide, commande échouée ou plafond atteint bloquent les dépendances et conservent le diagnostic. Les corrections sont bornées ; dépasser les plafonds exige une nouvelle décision explicite de l'utilisateur. Si les coûts ne sont pas mesurables, aucun plafond financier garanti n'est annoncé.
11. **Vérifications de l'application.** TypeScript, tests métier, build et parcours navigateur prioritaires sont exécutés sur une version identifiée de l'application générée. Le rapport relie critères, résultats, commandes et dates ; les tests de l'usine ne les remplacent pas.
12. **Revue indépendante.** Un intervenant distinct de l'auteur examine la version livrée, priorise les constats et vérifie les corrections. Aucun défaut bloquant ni contrôle requis non vérifié ne subsiste pour une livraison complète.
13. **Aperçu isolé.** L'application s'ouvre localement sur une origine distincte avec un cycle de vie contrôlé, sans accès au DOM de l'usine, à son API privilégiée ou aux secrets serveur. Les tests couvrent les appels depuis l'aperçu ; aucun HTML généré n'est injecté dans la page de l'usine.
14. **Export reproductible.** Une archive contient sources, verrou, documents et preuves utiles, sans secret ni dépendances installées. Depuis une extraction neuve, les commandes documentées d'installation, vérification et build réussissent ; les prérequis réseau sont indiqués.
15. **Accessibilité et régression.** Demande, suivi et résultats restent utilisables au clavier et sur mobile, avec labels, focus, retours d'erreur et reduced-motion. Les projets simulés existants restent lisibles et explicitement simulés.

## Scénario de référence
Brief : « Une application personnelle pour saisir mes dépenses en euros, les classer et voir le total du mois, avec conservation sur cet appareil. »

Le cadrage fixe au minimum date, libellé, montant strictement positif à deux décimales et catégorie. Le total mensuel utilise une représentation monétaire évitant les erreurs de calcul usuelles. La recette vérifie création, saisie invalide, modification, suppression, filtre mensuel, recalcul et rechargement. Un jeu vide, une donnée persistée corrompue et un refus de stockage sont exercés. Ces vérifications restent à implémenter et exécuter aux étapes 5 et 6.

## Définition de livré et décisions restantes
La première version est livrée quand les 15 critères sont vérifiés sur une version identifiée, que le scénario a été exercé avec le runtime réel et que preuves, aperçu et export correspondent à cette version. Un contrôle absent reste « non vérifié » ; une livraison partielle ne clôture pas la cible.

Décisions techniques restantes : adaptateur réel, formats des contrats, stockage serveur, états détaillés, racine des espaces, isolation des commandes et de l'aperçu, limites de durée/tentatives et mesure de consommation. Le moteur doit pouvoir être testé avec un adaptateur injecté sans coût modèle. Une recette réelle sera distincte, après activation autorisée et information sur la consommation ; aucun appel réel n'est autorisé par cette étape documentaire.
