# Capacités et limites

## État des étapes 3 et 4 — 4 novembre 2026

Le moteur serveur sait persister et suivre un pipeline avec un adaptateur de test injecté. Les contrats v1 sont validés dans le serveur et les consignes des six TOML sont explicitement chargées et épinglées. Le stockage, les tentatives, les plafonds, la pause/reprise et la récupération sont décrits dans [ORCHESTRATION.md](ORCHESTRATION.md), avec preuves dans [QA-ORCHESTRATOR.md](QA-ORCHESTRATOR.md).

Sans configuration explicite, le diagnostic v1 annonce `available:false` et `liveGeneration:false`. Avec clé API côté serveur, modèle explicite et activation, le moteur peut injecter l'adaptateur OpenAI Responses sans outils et matérialiser des instantanés de projets contrôlés. Ce transport est vérifié par HTTP injecté uniquement ; une fixture en mode `real` dans un test ne prouve aucun appel réel. Les contrôles factices restent réservés à `example` et ne peuvent valider les projets réels. Le pont CLI reste indépendant ; l'interface n'est pas encore raccordée au nouveau moteur.

Le diagnostic `generation:check` observe génération désactivée, clé et modèle absents. Le CLI détecté lors de cette inspection est `0.164.0-alpha.11.1` ; le moteur Docker n'est pas accessible et WSL refuse l'énumération dans ce contexte. Aucun code généré n'est exécuté sur l'hôte. Premier projet fournisseur, contrôles clients isolés, aperçu et recette complète restent non vérifiés ou à implémenter. Voir [GENERATION.md](GENERATION.md) et [QA-GENERATION.md](QA-GENERATION.md).

Les sections ci-dessous conservent le bilan initial daté ; leurs versions et nombres de tests historiques ne remplacent pas l'état et les preuves ci-dessus.

Ce document distingue l'environnement de construction, les fonctions du MVP et les intégrations à activer. La présence d'un outil ne prouve ni son authentification ni la réussite d'une tâche.

## Capacités observées pendant l'inspection

| Capacité | État observé | Usage prévu |
| --- | --- | --- |
| Sous-agents du chat Codex | Outils de délégation disponibles, quatre agents simultanés au total | Six rôles délégués par vagues, livrables réels dans le dépôt |
| Exécution locale | PowerShell, Node.js 20.18.0, npm 10.8.2 | Développement, tests et build |
| Git | Git 2.46.2 installé | Historique local et revue des changements ; disponibilité d'un remote à vérifier |
| Codex CLI | `0.166.0-alpha.5.1` détecté ; aide `exec` consultée | Pont local optionnel, sans supposer une authentification valide |
| Skills | Consignes Sites, frontend et OpenAI Docs disponibles | Workflow de construction et vérifications adaptées |
| MCP / connecteurs | Outils accessibles au chat | Accès limité à leurs autorisations propres ; aucune transmission automatique au navigateur |

L'inspection du CLI a émis des avertissements d'accès à ses dossiers temporaires utilisateur. La présence du binaire est confirmée ; une exécution modèle complète n'est pas présumée possible pour autant.

## Ce que fait l'application

- Créer et conserver localement des projets et leur brief.
- Afficher les responsabilités des six rôles et le pipeline de tâches.
- Exécuter une simulation déterministe avec résultats explicitement étiquetés.
- Consulter la progression, les événements et les résultats sauvegardés.
- Diagnostiquer un backend local lorsqu'il est disponible.
- Proposer, si le pont est activé, une vraie tâche Codex limitée à la lecture seule et afficher sa sortie réelle.

La simulation n'appelle aucun modèle, n'utilise pas les sous-agents de ce chat et ne fabrique pas une application fonctionnelle à partir du brief. Ses durées et résultats illustrent le déroulement d'un projet. L'historique simulé reste identifié comme tel.

## Ce qui demande une configuration externe

| Action | Prérequis | Coût ou autorisation |
| --- | --- | --- |
| Lancer un vrai job Codex | Backend local, pont activé, CLI utilisable et authentifié | Consommation possible de quota ou de crédits selon le compte ; aucun tarif présumé |
| Appeler une API modèle directement | Adaptateur serveur et identifiants dédiés | Appels potentiellement facturables ; aucune clé dans le frontend |
| Connecter un service MCP | Serveur MCP configuré et accès autorisé | Identifiants et permissions du service concerné |
| Modifier des dépôts par des agents | Isolation, politique d'outils et autorisation d'écriture | Hors du pont MVP en lecture seule |
| Publier ou partager une application | Hébergement et politique d'accès adaptés | Autorisations de publication et éventuels coûts de service |
| Synchroniser plusieurs utilisateurs | Authentification, backend persistant et base de données | Infrastructure supplémentaire |

Le MVP ne demande pas à l'utilisateur de coller une clé API dans le navigateur. L'activation du pont est un choix du processus serveur et ne peut pas être imposée par un projet importé ou un champ de formulaire.

## Signification des états affichés

« Simulé » signifie qu'un moteur local produit un exemple. « Connecté » signifie qu'un backend répond, pas qu'une tâche modèle a réussi. « CLI détecté » signifie que le binaire est trouvé, pas qu'il est connecté à un compte. « En cours » pour un job réel exige qu'un processus ait été démarré. « Terminé » pour un job réel exige un arrêt réussi et une sortie exploitable. Un échec conserve sa provenance et son diagnostic sans résultat de remplacement inventé.

## Vérification finale

Le rapport QA et la revue constituent la preuve des vérifications effectuées. Les journaux de test avec adaptateur factice ne sont pas des exécutions Codex facturables. L'orchestrateur complète le bilan final avec les tests passés, les éventuelles limites de prévisualisation et l'état réel de publication.

Résultat livré : 49 tests réussis, TypeScript et build réussis, audit npm sans vulnérabilité connue au contrôle. Revue indépendante clôturée après corrections. L’aperçu local et les formats 320/768/1024/1440 ont été contrôlés. Le pont réel n’a pas été authentifié ni exécuté contre un modèle.

Publication : une fiche Site privée non publiée existe, mais le workflow d’envoi du code a été refusé par la vérification automatique des autorisations. La publication attend l’accord explicite de l’utilisateur pour l’envoi du code vers le dépôt privé Sites. Aucun code n’a été poussé et aucune URL de déploiement n’est annoncée comme opérationnelle.
