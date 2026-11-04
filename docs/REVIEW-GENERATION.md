# Revue indépendante de la génération — 4 novembre 2026

## Verdict et indépendance

**Verdict de clôture de l'étape 4 : `blocked`.** La vérification indispensable G-8, premier projet issu du fournisseur réel, est impossible dans l'environnement observé : activation, clé API et modèle absents. Aucun appel réel, programme client, installation cliente ou publication n'a été exécuté par cette revue.

La revue technique du lot hors ligne est terminée, sans P0/P1 identifié ni constat ouvert. Les constats P2 et P3 ci-dessous ont été corrigés par le coordinateur puis revérifiés ici. Ce bilan permet de poursuivre la préparation technique ; il ne valide ni l'API effective ni une application générée et ne clôture pas l'étape 4.

Contexte confié : `factory`, dépôt `C:\Users\joepa\Desktop\ai-software-factory-source`. Invocation native reviewer `/root/review_generation`, distincte de `/root`, auteur du code et des tests. Le coordinateur a explicitement confirmé une création avec `fork_turns:none`, sans contexte de travail d'auteur réutilisé. Il ne s'agit pas d'une mission enveloppée v1 ; aucune identité fournisseur ou preuve d'appel modèle n'est attribuée à cette revue. Seul ce rapport a été écrit par le reviewer.

Entrées examinées : instructions AGENTS et contrat v1, diff contre `011a9a86bc4fbd4dd7b85ca699eeef3d250f721f`, sources et tests du générateur, orchestrateur et journal, configuration serveur, socle React, script de diagnostic, critères [GENERATION.md](GENERATION.md), rapport final du coordinateur [QA-GENERATION.md](QA-GENERATION.md), mises à jour des documents de référence. La version examinée est l'arbre de travail, pas un commit de livraison.

## Constats corrigés

### R-GEN-1 — P2 — Identité fournisseur perdue lors d'une proposition invalide

- Fichier : `server/generation-adapter.mjs`, lignes 101–107 de la version corrigée ; auparavant, `onSession` et `onProviderResponse` se trouvaient après la validation complète de la proposition.
- Impact : une requête consommée ayant un identifiant `resp_…` et un usage observables pouvait échouer sans conserver cette provenance. Le compteur de tentatives restait chargé, mais l'audit de consommation perdait l'identité et les tokens reçus.
- Reproduction : injecter une réponse HTTP 200 avec identité valide, usage et un `output_text` contenant `{`, ou une réponse `incomplete`/refus. Avant correction, la tentative échouait avec `sessionId:null` et sans événement `provider_response`.
- Correction revérifiée : enregistrement des métadonnées après lecture bornée et validation de l'identité, avant le statut fournisseur et le JSON métier. Les valeurs de tokens négatives ou invalides deviennent inconnues. Les cas négatifs de la suite vérifient désormais la provenance ; les 28 tests ont réussi indépendamment.
- État : **clos par le reviewer**. Une erreur réseau, réponse illisible ou trop grande, ou interruption avant réception laisse légitimement la consommation inconnue ; elle n'est pas déclarée nulle.

### R-GEN-2 — P3 — État documentaire contradictoire du transport

- Fichier : `docs/AGENT-CONTRACTS.md`, lignes 3 et 21 de la version corrigée.
- Impact : l'introduction et le paragraphe sur le chargement annonçaient encore un transport à implémenter, alors que l'appendice décrivait son implémentation. Cette contradiction concernait aussi les instructions injectées aux rôles.
- Reproduction : comparer ces paragraphes initiaux à l'appendice de l'étape 4 et à `server/generation-adapter.mjs`.
- Correction revérifiée : introduction, obligations de l'adaptateur, état du chargement et contrôle des chemins actualisés, avec distinction explicite entre implémentation et fonctionnement fournisseur non vérifié.
- État : **clos par le reviewer**, après relecture de la modification. Aucun changement de permission n'en a été déduit.

## Contrôles et cohérence des preuves

Contrôles exécutés par cette invocation le 4 novembre 2026 :

| Procédure | Résultat observé |
| --- | --- |
| `node --test server/generation.test.mjs` | Échec du lanceur `spawn EPERM` avant exécution des tests dans le contexte restreint |
| `node server/generation.test.mjs` sur la version finale des tests | Code 0, **28/28 réussis**, y compris redémarrage réel simulé et panne du journal pendant les callbacks |
| `node server/orchestrator.test.mjs` | 28/29 réussis ; test du marqueur de propriétaire arrêté échoué sur création du sous-processus (`spawnSync` sans statut de sortie), donc non vérifié indépendamment ici |
| `node scripts/generate-smoke.mjs --check` | Code 2 attendu ; activation, clé et modèle absents, aucun appel API |
| `git diff --check` | Code 0 après les corrections documentaires |

Le rapport QA du coordinateur indique séparément une exécution autorisée de `npm test` avec 109 tests réussis, dont les 29 tests d'orchestration et les 28 de génération, ainsi que TypeScript, build et validation des contrats réussis. Ces résultats ont été lus comme preuves rapportées ; ils ne sont pas présentés comme des commandes toutes rejouées par le reviewer. Les deux attentes expirées de la campagne intermédiaire restent décrites dans le rapport QA et ne sont pas assimilées à des réussites.

L'analyse et les tests couvrent les frontières G-1 à G-7 : droits par rôle, chemins Windows, collisions et liens, empreintes et instantanés, distinction des modes, réservations et reprise, budget, données fournisseur non fiables, absence d'outils, refus de preuves factices et contrôle de l'indépendance. Les deux nouveaux tests ont été lus : le redémarrage exige une réconciliation et une nouvelle tentative explicites, ignore l'ancienne réponse ; une panne de journal conserve la réservation et bloque le moteur sans rejet de promesse non géré. Leurs résultats restent des simulations HTTP, même avec un adaptateur étiqueté `real`.

## Version des sources examinées

Empreintes SHA-256 relevées sur l'arbre de travail le 4 novembre 2026, avant finalisation du rapport :

| Fichier | SHA-256 |
| --- | --- |
| `server/generation-adapter.mjs` | `C5A4CCCDA98F8586D7E1BAA8C45B5D18763D83C86B4C2FAB6EC3209F6A0670E7` |
| `server/generation-workspace.mjs` | `E0B75F6F5D7C665C310E38A5E9FCE98F7E1AF7103113714AD0005F995535F97A` |
| `server/generation.test.mjs` | `6B5A027224B0CDE2B41FF02F6027F3E027CA0E51E9FC824BB1653701B5B1DFAA` |
| `server/orchestrator.mjs` | `79CF17CBBC871F072584030D0E2DB43B5BF2C19F5E8226D8ABFA660995B7BE06` |
| `server/orchestration-store.mjs` | `CB0CCAE37DD1B90ED226997FC473FD50109E2743E55086518E5AE37DA77F34C7` |
| `server/orchestration-contracts.mjs` | `47B965EBDBA706A25A942DEADCDCA60575A27048D3B73563BDD5755520723183` |
| `server/index.mjs` | `C6E590E62701D5E9BC5A5DE0769CF59F109142B811A3AB38D9D771EF2D52F6D7` |
| `scripts/generate-smoke.mjs` | `D19B3A0A926AE8A276D28E701A3FF11E8EEF89D0E16B82374CC14CA3A7B739C6` |
| `templates/react/package.json` | `660D89A6A064250E76A42662D443B11228E5F742E649EFD409FBBD8B03C1B4A7` |
| `templates/react/package-lock.json` | `370AA5C823399477A41EDF85CFA1AFFFCFDC081AC19CCDBB0E9BF07C10236883` |

## Limites et suite requise

G-8 reste **non vérifié**, comme l'annoncent la roadmap et les documents du lot. L'acceptation du schéma par le fournisseur, l'authentification et le quota, la qualité du code produit et sa compilation ne sont pas établis par les fixtures. L'arrêt du transport local ne prouve pas l'arrêt du calcul distant ni de la facturation. Aucun plafond monétaire n'est démontré.

Les instantanés contrôlés et l'absence d'outils protègent la frontière proposée au modèle ; ils ne constituent pas un sandbox contre un processus local hostile concurrent. L'exécution cliente isolée, la QA applicative, les corrections suivies de nouvelle revue, l'aperçu et l'export restent hors livraison de ce lot. Le premier essai fournisseur doit être exécuté et consigné dans le périmètre autorisé avant clôture de G-8 ; aucune commande cliente ne doit en être déduite avant l'étape 5.
