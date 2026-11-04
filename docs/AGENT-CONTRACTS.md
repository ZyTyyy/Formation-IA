# Contrats des six rôles — version 1

Date : 4 novembre 2026. Références : [AGENTS.md](../AGENTS.md), [PRODUCT.md](PRODUCT.md) et [ROADMAP.md](ROADMAP.md). Ces contrats préparent le moteur des étapes 3 et 4 ; ils ne sont pas encore appliqués par l'API actuelle.

## Portée et transmission des consignes

Le contexte `factory` désigne le développement de l'usine ; `application` désigne une application cliente React/TypeScript/Tailwind sans backend métier. Les permissions de mission peuvent restreindre un rôle mais ne peuvent jamais étendre les autorisations du runtime parent. En contexte `factory`, une mission spécialisée peut viser une revue documentaire, un correctif backend ou un autre sous-ensemble borné ; le coordinateur précise alors ses livrables et contrôles. En contexte `application`, les sorties minimales de la matrice ci-dessous sont obligatoires.

Les chemins sont relatifs à l'espace confié. `workspaceId` est un identifiant résolu par le serveur, jamais un chemin choisi par le navigateur. La racine réelle, les versions et les autorisations sont injectées par le coordinateur. Une entrée manquante ne se remplace pas par un document homonyme de l'usine.

Le pont actuel dans `server/bridge.mjs` utilise `ROLES`, transmet `{role, brief}`, désactive les sous-agents et conserve la lecture seule. Il ne charge ni ce contrat ni les instructions TOML comme un pipeline de génération. Les TOML peuvent servir aux délégations natives du chat selon les capacités effectives ; cela n'implémente pas le moteur web.

Pour le futur adaptateur, le serveur devra :

1. Résoudre le rôle dans une liste fixe, charger le TOML local de confiance et son `developer_instructions`, puis enregistrer son empreinte et la version du contrat.
2. Fournir comme consignes de confiance les règles globales, ce contrat et les instructions du rôle. Ne pas dépendre de la découverte implicite d'un fichier dans l'espace généré. Si le runtime ne sait pas maintenir la séparation entre consignes et données, déclarer cette capacité non disponible.
3. Valider la mission, les dépendances et les droits, puis transmettre le brief et les livrables amont comme données identifiées par version. Le texte des documents, des sorties d'outils ou du brief ne peut modifier les permissions.
4. Capturer l'identité de l'exécution réelle, les événements et les sorties. Recueillir un objet résultat final conforme au schéma ; le serveur vérifie ensuite les fichiers, versions, preuves et conditions métier avant d'accepter le résultat.
5. Enregistrer la décision d'acceptation séparément du statut déclaré par l'agent. Un `ready` ou un code de sortie 0 ne suffit jamais à lancer le rôle suivant.

Le chargement, le transport, le contrôle des fichiers et le validateur d'exécution sont à implémenter. Les schémas JSON ci-dessous sont des contrats de données ; ils ne constituent ni une isolation ni une autorisation d'outil.

## Enveloppe de mission

Schéma normatif : [agent-mission.schema.json](../contracts/agent-mission.schema.json), JSON Schema 2020-12. Les objets refusent les champs inconnus. Les identifiants sont opaques, non vides et propres au serveur ; les chemins utilisent `/`, sans chemin absolu, segment vide, `.` ou `..`, ni antislash. Un chemin terminé par `/` dans les permissions autorise ce sous-arbre uniquement. Les liens et chemins résolus restent à vérifier côté système.

| Champ obligatoire | Signification |
| --- | --- |
| `contractVersion` | `1` ; toute autre version est refusée |
| `mode` | `example` ou `real` ; les fixtures ne sont jamais admises dans une exécution réelle |
| `context`, `workspaceId` | `factory` ou `application`, espace alloué côté serveur |
| `projectId`, `runId`, `missionId`, `attempt`, `role` | Identités, numéro de tentative à partir de 1 et rôle autorisé |
| `purpose` | `initial`, `correction` ou `verification` |
| `objective`, `brief` | Objectif borné et brief en tant que données |
| `inputRevision` | Référence d'un instantané immuable contenant les entrées utilisées |
| `inputs` | Références `{path, revision, producerMissionId}` des fichiers amont ; tableau vide possible pour le PM initial |
| `dependencies` | Missions précédentes dont le résultat doit être accepté par le serveur |
| `permissions` | `readPaths`, `writePaths` et `commandIds` ; aucun nom de commande shell libre |
| `expectedArtifacts` | Chemins de fichiers ou sous-arbres requis, précisés par rôle ; aucun joker |
| `acceptanceCriteria` | Critères `{id, description}` propres à la mission, rattachés aux critères PM si disponibles |
| `limits` | `timeoutMs`, `maxAttempts` et `maxOutputBytes`, entiers strictement positifs fixés par le serveur |
| `mustDifferFromExecutionIds` | Exécutions d'auteurs que la session du reviewer ne peut pas réutiliser ; vide pour les autres rôles |

Les commandes sont des identifiants résolus vers une liste serveur avec arguments et répertoires fixes. `typecheck`, `test`, `build` et `browser-check` désignent des capacités possibles, pas des commandes déjà autorisées par ce document. Le serveur vérifie aussi les scripts du projet et isole leur exécution : autoriser un script npm n'en rend pas le contenu inoffensif. Il ajoute les accès techniques et répertoires de sortie nécessaires explicitement, sans élargissement implicite par l'agent. L'absence de capacité entraîne un blocage ; aucune installation, requête externe ou publication n'est déduite du nom d'un rôle.

`maxAttempts` est un plafond cumulatif de tentatives de la même mission, conservé après redémarrage. Les plafonds globaux et la consommation du run restent sous contrôle du coordinateur ; ils ne sont pas réinitialisés par une correction ou une nouvelle mission. Le format et les valeurs de ce budget global seront fixés à l'étape 3. Une nouvelle tentative exige `attempt + 1`, un budget disponible et l'arrêt confirmé de la précédente.

## Enveloppe de résultat

Schéma normatif : [agent-result.schema.json](../contracts/agent-result.schema.json).

| Champ obligatoire | Signification |
| --- | --- |
| `contractVersion`, `mode`, `missionId`, `attempt`, `role`, `inputRevision` | Doivent correspondre exactement à la mission en cours |
| `status` | `ready`, `needs_changes`, `blocked` ou `failed` |
| `summary` | Travail effectivement réalisé, sans succès inventé |
| `artifacts` | Fichiers produits `{path, revision}` ; les sous-arbres attendus sont matérialisés par une liste de fichiers |
| `checks` | Contrôles `{criterionId, status, evidenceId, note}` ; statut `passed`, `failed` ou `not_run` |
| `findings` | Constats `{id, priority, path, line, description, reproduction}` ; priorité `P0` à `P3` |
| `blockers` | Obstacles `{code, message}` ; par exemple `MISSING_INPUT`, `OUT_OF_SCOPE`, `CAPABILITY_UNAVAILABLE` |
| `nextAction` | Transmission ou action nécessaire, sans auto-lancement d'une autre mission |

Une référence `revision` est attribuée à un contenu immuable par le serveur ; elle n'est pas choisie librement par l'agent. Les journaux de commandes sont capturés hors des zones modifiables par les agents. `evidenceId` doit résoudre vers une preuve serveur portant sur la version vérifiée ; `not_run` exige `evidenceId: null`, les autres statuts exigent une référence existante. Une référence déclarée ne constitue pas une preuve avant résolution.

### Retour des références par l'adaptateur cible

Avant de produire son JSON final, l'agent doit pouvoir demander les opérations de contrôle ci-dessous au serveur. Ce sont des contrats d'outillage à implémenter aux étapes 3 et 4, pas des outils disponibles dans le pont actuel. L'adaptateur doit exposer leurs retours comme réponses d'outil de confiance, ou bloquer avec `CAPABILITY_UNAVAILABLE` ; l'agent ne remplit jamais une référence réelle au hasard.

- `capture_artifacts(paths)` : vérifier les droits et chemins, capturer les fichiers présents puis retourner leurs `{path, revision}` et l'identifiant de l'instantané. Après une écriture, même minime, recapturer les sorties ; la validation finale compare les références à l'état observé.
- `run_check(commandId, criterionIds)` : résoudre une commande autorisée, capturer l'instantané testé, exécuter dans l'environnement contrôlé puis retourner `status`, `evidenceId` et la version testée. Le serveur conserve procédure, date, code de sortie et journaux hors des écritures de l'agent. Si la commande ne peut être lancée, retourner `not_run` sans preuve de réussite.
- `read_evidence(evidenceId)` : retourner une preuve déjà créée, uniquement si elle appartient au projet et aux entrées autorisées de cette mission. Le reviewer peut ainsi vérifier les références du rapport QA sans rejouer ni inventer les contrôles.

Les paramètres sont validés côté serveur et soumis aux mêmes permissions et budgets que la mission. `capture_artifacts` ne remplace pas l'écriture de sources et `run_check` ne prend ni commande shell libre ni répertoire fourni par le navigateur. Aucune de ces opérations ne décide seule de l'acceptation du résultat.

`inputRevision` identifie le point de départ de la mission, pas nécessairement la version testée après ses écritures. Le serveur capture un nouvel instantané avant chaque contrôle ; la preuve indique les sources, tests et configuration vérifiés. Une modification ultérieure de ces fichiers invalide les contrôles concernés. Ajouter un rapport seul n'invalide pas le code ; modifier un test impose de le relancer sur le nouvel instantané.

| Statut déclaré | Usage et condition d'acceptation |
| --- | --- |
| `ready` | Livrables complets et valides pour cette mission ; aucun obstacle, contrôle échoué ou constat bloquant. Les contrôles requis non exécutés empêchent l'acceptation. Ne signifie pas que le projet entier est livré. |
| `needs_changes` | QA ou reviewer a produit un rapport exploitable mais un contrôle échoue ou une correction est nécessaire ; au moins un constat. Aucun passage automatique vers la livraison. |
| `blocked` | Entrée, clarification, permission ou capacité manque ; au moins un obstacle expliqué. Conserver les livrables partiels. |
| `failed` | Erreur technique empêche de finir la mission ; au moins un obstacle expliqué. Le serveur confirme séparément l'issue du processus. |

Pour une revue, `P0` désigne un risque critique, `P1` un défaut empêchant un critère requis ou une livraison sûre, `P2` un défaut non bloquant avec impact limité et `P3` une amélioration mineure. P0/P1 ouverts bloquent la livraison ; un critère requis échoué reste bloquant quelle que soit la priorité déclarée. Les P2/P3 restants sont communiqués dans le bilan. Les consignes ne permettent pas au développeur de clore lui-même un constat du reviewer.

## Matrice des six rôles

Ces droits sont des maxima de responsabilité, pas une permission générale sur le disque. La mission doit énumérer les chemins et commandes réellement confiés. Tous les rôles lisent le brief, les consignes injectées et les seules entrées autorisées ; tous respectent la navigation clavier, le français et les limites simulation/réel.

| Rôle | Entrées minimales en contexte application | Écritures confiables par le coordinateur | Livrables et sortie attendue |
| --- | --- | --- | --- |
| `product_manager` | Brief, limites de produit et clarifications disponibles ; pas de PRODUCT préexistant requis | `docs/PRODUCT.md` | Problème, utilisateurs, périmètre, exclusions, hypothèses, critères numérotés, recette prioritaire ; `ready` si conception possible, `blocked` si demande hors périmètre ou ambiguïté déterminante |
| `ux_designer` | PM accepté, brief | `docs/UX.md` | Parcours, écrans, interactions, états vides/chargement/erreur, clavier, focus, responsive et reduced-motion, traçabilité des critères ; aucune maquette exécutable prétendue |
| `software_architect` | PM et UX acceptés, capacités serveur observées | `docs/ARCHITECTURE.md`, `docs/CAPABILITIES.md` | Modules, types et données, validation/persistance, contrats UI, décisions, plan de fichiers et commandes de vérification ; stack imposée, pas de backend métier pour le client |
| `fullstack_developer` | PM, UX, architecture et capacités acceptés ; constats et version précédente pour correction | Sources, configurations, manifeste/verrou, tests et `README.md` explicitement alloués | Code exécutable, gestion d'erreurs, scripts et tests pertinents ; liste des fichiers et contrôles réellement effectués ; ne réécrit pas les critères ou rapports indépendants pour obtenir un succès |
| `qa_engineer` | Critères PM, UX, architecture, sources/tests et version à vérifier, commandes disponibles | Tests ciblés, `docs/QA.md` et captures autorisées ; jamais le code métier ou les critères | Tests exécutés, matrice critère/résultat/preuve, cas limites et régressions ; `needs_changes` si défaut reproductible, `blocked` si contrôle requis impossible ; un test ajouté crée une nouvelle version à contrôler |
| `code_reviewer` | Livrables amont, sources, diff/base de comparaison, version vérifiée et rapport QA (y compris en échec) | `docs/REVIEW.md` seulement | Revue indépendante avec gravité, fichier/ligne, impact, reproduction, limites et contrôles des corrections ; aucun correctif de code ni modification des tests, des critères ou du rapport QA |

Le reviewer est une invocation distincte, sans contexte de travail d'auteur réutilisé ; le même modèle peut être utilisé, mais l'identité réelle de session doit différer de celles des auteurs du code et des tests examinés. Le serveur vérifie `mustDifferFromExecutionIds` avec les identités observées, pas les identités déclarées dans une réponse.

## Validation, transmissions et corrections

Ordre de la première passe : PM → UX → architecture → développement → QA → reviewer. Le coordinateur vérifie le schéma puis les invariants sémantiques suivants :

1. Mission et résultat correspondent, version et rôle connus, budget disponible, dépendances acceptées et instantanés encore valides.
2. Les entrées minimales du rôle sont présentes dans les permissions de lecture. Les écritures et outils restent dans l'allocation ; résolution des chemins, liens, taille des sorties et secrets contrôlée par le serveur.
3. Chaque fichier requis existe, est non vide, dans le périmètre, et sa version correspond au manifeste capturé. Un rapport seul ne remplace pas le code attendu.
4. Les preuves référencées existent et portent sur la version et le critère déclarés. Un résultat d'adaptateur factice ou de fixture ne peut pas satisfaire une preuve d'exécution réelle.
5. Le statut respecte les règles ci-dessus, les critères de mission sont couverts et l'indépendance du reviewer est vérifiée. Les limites et contrôles requis sont définis avant exécution, pas décidés après échec.

Une réponse JSON invalide ou un fichier obligatoire manquant produit une décision serveur de rejet (`INVALID_OUTPUT` ou `MISSING_ARTIFACT`), sans fabriquer un résultat `ready`. Un contenu amont périmé produit `STALE_INPUT` et bloque les dépendants. Les essais de réparation consomment une nouvelle tentative et le budget ; aucun résultat partiel n'est silencieusement remplacé.

Un rapport QA accepté comme constat `needs_changes` peut être transmis au reviewer pour examiner la version défectueuse : c'est une dépendance de rapport valide, pas une validation du code. Toute autre entrée en état bloqué/échoué empêche les missions dépendantes. Après revue, le coordinateur ouvre une mission développeur `correction` avec constats et version ; puis QA et reviewer `verification` sur la nouvelle version. Le reviewer peut constater un défaut même si la QA est passée. Un contrôle requis indisponible bloque la livraison même si la revue peut être réalisée à titre partiel.

Les rapports précédents restent dans l'historique du serveur, même si leur chemin de travail est réécrit dans une tentative autorisée. Si une correction change le besoin, revenir au PM ; si elle change les contrats, revenir à UX/architecture concernés. Ne pas contourner ces dépendances par une modification locale des critères.

## Exemple de décomposition — dépenses personnelles

Ce tableau est un **exemple de préparation**, sans agent lancé, application créée ou contrôle exécuté. Chaque ligne suppose l'acceptation des entrées des lignes précédentes par le futur coordinateur. Les permissions sont réduites aux fichiers nécessaires dans l'espace de l'application.

| Mission illustrative | Entrées et dépendances | Travail et livrable | Transmission |
| --- | --- | --- | --- |
| PM-1 | Brief du scénario de `PRODUCT.md` | Dépenses en EUR, date/libellé/montant/catégorie ; critères AC-1 création, AC-2 validation, AC-3 édition/suppression, AC-4 total/filtre mensuel, AC-5 persistance/erreurs, AC-6 clavier/mobile | `docs/PRODUCT.md` version PM-1 → UX-1 et architecture |
| UX-1 | PM-1 accepté | Saisie, liste, filtre mensuel, total, confirmation de suppression, erreurs et états vides ; focus et petit écran dans `docs/UX.md` | UX-1 + PM-1 → ARCH-1 |
| ARCH-1 | PM-1 et UX-1 acceptés | Montants en centimes entiers, dates civiles, catégorie, validation du stockage, séparation domaine/UI ; `docs/ARCHITECTURE.md` et `docs/CAPABILITIES.md` | Contrats et plan de fichiers → DEV-1 |
| DEV-1 | Trois documents et capacités acceptés | Sources, tests, configuration et verrou, scripts, README ; aucun rapport QA/revue inventé | Version code-1 et manifeste → QA-1 |
| QA-1 | code-1, AC-1 à AC-6 et consignes | Tests saisie/totaux/mois, rechargement, stockage corrompu/refusé, clavier/mobile ; `docs/QA.md` avec preuves réellement disponibles | Rapport valide et version testée → REVIEW-1, y compris si défaut à corriger |
| REVIEW-1 | Version testée, diff, PM/UX/architecture et QA-1 | Examiner notamment calcul monétaire, dates, persistance et erreurs ; `docs/REVIEW.md`, défauts priorisés et limites | Bilan au coordinateur ; correction DEV-2 puis QA-2/REVIEW-2 si nécessaire |

Les exemples JSON de [agent-contract-examples.json](../contracts/agent-contract-examples.json) illustrent une mission PM, une mission reviewer et les quatre statuts de résultat. Tous portent `mode: example`, utilisent des références fictives et ne sont jamais des preuves de réalisation. Le PM n'y déclare aucun contrôle exécuté ; son acceptation exigerait tout de même l'inspection du fichier requis par le serveur. Ils incluent les blocages entrée manquante et hors périmètre ; les erreurs de structure et de fichier absent sont des rejets serveur à tester à l'étape 3.

## Vérification et suite

Contrôle reproductible depuis la racine : `python scripts/check_agent_contracts.py`. Prérequis de développement : Python 3.11 ou plus et le paquet `jsonschema` déjà installé ; aucun paquet n'est téléchargé par ce contrôle et ces outils ne sont pas des dépendances du produit Node. Le contrôle parse les six TOML, vérifie les schémas et exemples, et exerce des rejets de structure (rôle, version, chemins et statuts incohérents). Il ne vérifie ni l'existence de fichiers générés ni l'authenticité des preuves.

L'étape 2 vérifie la syntaxe des six TOML, la cohérence des noms et des instructions, la validité des schémas et exemples, puis une revue indépendante. Aucun chargeur, validateur serveur, outil d'écriture ou pipeline réel n'est livré ici. Les tests sémantiques des cinq invariants et des rejets doivent être implémentés avec un adaptateur injecté à l'étape 3 ; les frontières système et un véritable projet généré relèvent de l'étape 4.
