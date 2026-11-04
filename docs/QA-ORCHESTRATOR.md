# Validation de l'orchestrateur persistant — étape 3

Date : 4 novembre 2026. Exécutant : coordinateur `/root`, auteur du code et des tests du lot. La revue indépendante appartient à [REVIEW-ORCHESTRATOR.md](REVIEW-ORCHESTRATOR.md) ; ce rapport n'est pas une auto-revue de code.

## Version et périmètre

Copie locale non commitée : nouveaux modules `server/orchestrator.mjs`, `orchestration-contracts.mjs`, `orchestration-store.mjs` et `orchestrator.test.mjs` ; intégration dans `server/app.mjs`, `server/index.mjs` et scripts/dépendances npm. La documentation de l'usine est alignée. Aucun fichier frontend ni protection de `server/bridge.mjs` n'a été modifié.

Node 20.18.0, npm 10.8.2 sur Windows. L'adaptateur du moteur et les contrôles clients sont injectés et factices ; les tests créent leurs journaux dans des répertoires temporaires dédiés. Les tests HTTP ouvrent une écoute sur `127.0.0.1` et un port éphémère. Le test de verrou mort lance uniquement un processus Node vide pour obtenir un PID réellement terminé.

## Résultats observés

| Commande | Résultat |
| --- | --- |
| `npm run test:orchestrator` | Code 0, **29 tests réussis** après corrections de revue |
| `npm run typecheck` | Code 0 |
| `npm test` | Code 0, **81 tests réussis** : 39 frontend, 13 pont historique, 29 orchestrateur |
| `npm run build` | Code 0, TypeScript puis Vite 6.4.5, 1 588 modules |
| `python scripts/check_agent_contracts.py` | Code 0 : six TOML, deux schémas et sept exemples valides ; vingt cas invalides rejetés |
| `git diff --check` | Code 0, aucun défaut de whitespace |

Les commandes npm nécessitant les sous-processus de test/esbuild ont été exécutées hors du sandbox de l'outil avec l'autorisation prévue par l'environnement. Aucun appel CLI Codex authentifié, modèle, service métier externe ou déploiement n'a été exécuté.

## Couverture observée et critères produit

| Contrat ou critère cible | Vérification dans ce lot | Limite |
| --- | --- | --- |
| Préconditions et mode, critère 2 | Adaptateur absent refusé, diagnostic `liveGeneration:false`, run `example`, `deliveryVerified:false`, champs API non autorisés rejetés | Information utilisateur du parcours réel à l'étape 6 |
| Missions et dépendances, critère 4 | Six rôles successifs, consignes chargées/épinglées, entrées versionnées, pas de départ après résultat malformé ou fichier manquant | Les textes produits par le test sont fictifs, pas une recette métier |
| Persistance/reprise, critère 8 | Réouverture après interruption sans relance, arrêt non confirmé réservé, réconciliation puis tentative 2 ; réouverture d'un run terminé avec preuves et historique identiques | Aucun processus modèle réel contrôlé |
| Pause et annulation, critère 9 | Pause attend le point de reprise, aucun nouveau rôle avant reprise, annulation attend `onClose`, seconde exécution refusée pendant réservation | Pas de suspension/reprise en place d'un processus |
| Erreurs et plafonds, critère 10 | Timeout, sortie trop volumineuse, budget global, tentatives maximales, commande interdite, résultat/identité invalide et stockage défaillant | Pas de mesure de prix ou de tokens ; aucun budget réel modifié depuis le navigateur |
| Versions et preuves | QA exige quatre contrôles, preuve forgée ou périmée rejetée, test modifié après contrôle invalide la preuve, snapshot historique DEV conservé après modification autorisée du test par QA | Les journaux de contrôle proviennent du contrôleur factice |
| Séparation des rôles | Session requise et réutilisation de session refusée ; rapports et écritures alloués par rôle | Identités de test ; indépendance de sessions Codex réelles à vérifier à l'étape 4 |
| Journal et robustesse | Propriétaire exclusif, marqueur vide de PID mort récupéré, corruption et succès forgé refusés, erreur d'écriture bloque sans avancer | Tests locaux ; pas d'audit de stockage partagé ni panne matérielle |
| Frontières API | Host/Origin, JSON, taille, commande/chemin/configuration client refusés, ancien `/api/health` conservé | Aucun nouvel aperçu ni frontend dans cette étape |

Les critères produit complets ne sont pas déclarés validés : ces preuves concernent le moteur avec adaptateur injecté. La génération réelle, l'isolation système et la recette utilisateur restent aux étapes 4 à 6.

## Corrections issues de la revue

1. **Sorties partielles** : chaque écriture virtuelle archive sa version dans la tentative ; la réponse JSON partielle est persistée avant validation. Un échec suivi d'une réécriture lors d'une nouvelle tentative conserve le contenu initial après redémarrage.
2. **Invariants persistés** : un `completed` sans six résultats acceptés, une mission acceptée sans tentative ou une acceptation sans preuve/instantané cohérent est refusé. Une mission acceptée ne peut pas être remise en file pour rejouer sa décision. Chaque résultat accepté est revérifié contre son instantané historique, afin que QA puisse modifier un test autorisé sans invalider rétroactivement la décision DEV.
3. **Plafond cumulé** : les journaux des contrôles comptent dans `outputBytes` avec les écritures et le résultat ; le cinquième journal de 1 000 octets est refusé sous plafond de 4 096 octets.
4. **Verrou après crash précoce** : les marqueurs uniques portent le PID dans leur nom dès leur création. Un marqueur vide d'un processus effectivement terminé est récupéré sans effacement manuel d'un verrou anonyme.

Une première assertion attendait `MISSING_ARTIFACT` pour un résultat vide rejeté d'abord par le schéma ; le test a été corrigé pour soumettre un résultat structurellement valide référençant un fichier absent. Une erreur de suppression d'un répertoire vide dans un test de panne a aussi été corrigée. Ces premières passes n'étaient pas des validations finales.

## Reproduction et limites

Depuis la racine, exécuter `npm run test:orchestrator`, puis les trois contrôles obligatoires ci-dessus. Les tests incluent les fixtures et le contrôleur injecté ; aucun identifiant IA n'est nécessaire. Le contrôle Python requiert Python 3.11+ et `jsonschema`, déjà présents dans l'environnement testé.

Les tests de contrats et de moteur sont automatisés ; aucun contrôle navigateur supplémentaire n'a été effectué, car l'interface reste inchangée. Aucune application cliente n'a été générée, compilée, testée ou exportée. La connexion à un adaptateur réel et les droits d'écriture système demeurent indisponibles dans l'instance livrée. La relecture indépendante des corrections est terminée sans constat ouvert dans ce périmètre ; l'étape 3 est clôturée pour le moteur avec adaptateur injecté.
