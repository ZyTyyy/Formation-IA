# Orchestrateur persistant — étape 3

Évolution étape 4 : les routes et transitions ci-dessous sont conservées. Le serveur peut désormais injecter explicitement un adaptateur `real` OpenAI Responses sans outils et un gestionnaire d'instantanés sur disque. Le mode d'un run est fixé à sa création ; les preuves factices restent interdites en réel. Configuration, plafonds réels et limites d'arrêt distant sont décrits dans [GENERATION.md](GENERATION.md). Les sections suivantes constituent le contrat et les preuves historiques de l'étape 3 sur adaptateur `example`.

Version livrée le 4 novembre 2026. Cette étape implémente le moteur serveur avec un adaptateur de test injecté ; elle ne produit pas d'application réelle et ne connecte pas le navigateur aux outils de ce chat.

## Frontières et composants

- `server/orchestration-contracts.mjs` charge les six TOML avec `smol-toml`, épingle les consignes et leurs empreintes, valide les enveloppes v1 avec Ajv 2020 et définit les allocations des rôles.
- `server/orchestration-store.mjs` conserve un journal JSON, validé à la lecture et avant chaque transaction, sous `.local/orchestrator/`. Il utilise un fichier temporaire synchronisé puis renommé, et un verrou exclusif de propriétaire.
- `server/orchestrator.mjs` coordonne les six missions, garde les événements, tentatives, sorties partielles, captures et preuves, et décide des transitions.
- `server/app.mjs` expose une API `/api/v1/` distincte. `/api/health` et `/api/jobs` restent les routes du pont CLI historique, avec ses protections inchangées.

Le stockage reste local, mono-processus propriétaire et mono-utilisateur. Aucun service de base de données n'est nécessaire. Les transactions sont synchrones, copiées et validées avant remplacement de l'état mémoire : une erreur de persistance bloque le moteur et demande l'arrêt de l'adaptateur sans inventer de fermeture confirmée. Le journal est limité à 32 Mio et 100 runs ; aucun historique n'est effacé automatiquement. Chaque décision d'acceptation conserve son instantané de fichiers : une modification autorisée d'un test par QA ne réécrit pas la version historique acceptée du développeur. Chaque écriture virtuelle archive sa version dans la tentative, même sans capture finale ou en cas d'échec. Une migration de format future devra être explicite.

Les données de fichiers produites par l'adaptateur injecté sont **virtuelles**, conservées dans le journal. Les tests n'écrivent pas du code client dans un espace d'application et n'exécutent aucun script de ce code. Les protections de chemins testées ici sont des allocations logiques ; l'isolation réelle du système de fichiers, des processus et du réseau relève de l'étape 4.

## Démarrage et capacités

`npm start` initialise le journal et expose le diagnostic v1. L'instance livrée dans `server/index.mjs` ne reçoit aucun adaptateur : `available:false`, `liveGeneration:false`. Un brief peut être enregistré comme brouillon `mode:example`, mais `start` est refusé avec `ORCHESTRATOR_UNAVAILABLE`. Aucune variable d'environnement n'active une génération réelle ou un adaptateur de démonstration.

L'injection est une API de code côté serveur, utilisée par les tests : `createOrchestrator({directory, adapter, checkRunner, limits})`. Aucun client HTTP ne choisit `directory`, l'adaptateur, les commandes, les consignes ou les plafonds. Le pont CLI conserve son activation indépendante, désactivée par défaut et en lecture seule ; il n'est pas utilisé comme adaptateur du moteur.

Les runs et enveloppes du moteur sont uniquement `mode:example`, les preuves portent `provenance:test-adapter`, et la lecture d'un run expose toujours `deliveryVerified:false`. `completed` désigne la fin du pipeline injecté, sans valider une livraison applicative réelle.

## Contrat de l'adaptateur injecté

L'objet possède `mode:'example'`, `start(input)` et `confirmStopped(executionId)`. `start` reçoit une copie de la mission v1, les consignes de confiance séparées du brief, un identifiant de tentative serveur, les outils ci-dessous et quatre callbacks. Il doit retourner `{cancel()}`.

- `onSession(sessionId)` identifie la session de l'adaptateur avant tout usage d'outil. Une session déjà utilisée dans le run est refusée ; le reviewer reçoit les sessions auteurs dans `mustDifferFromExecutionIds`. Ces identités sont des identités de test dans ce lot, pas une preuve de sessions Codex réelles.
- `onResult(objectOrJson)` remet l'unique résultat final. Sa sortie partielle est conservée avant validation de structure, dans la limite configurée. La décision sémantique attend `onClose(0)`.
- `onError(message)` signale un échec et demande l'arrêt. Un retour tardif ne remplace pas cet échec par un succès.
- `onClose(exitCode)` confirme l'arrêt et libère la réservation ; seul un résultat valide et une sortie 0 permettent l'acceptation.

Une exception dans `start`, une poignée d'arrêt absente ou un `cancel` qui échoue ne prouvent pas l'arrêt du processus. La réservation reste conservée jusqu'à `onClose` ou une réconciliation confirmée par le contrôleur de confiance. Les callbacks d'une ancienne tentative ou d'une instance fermée sont ignorés.

Les outils correspondent aux opérations du contrat v1, ici sur des données virtuelles : `writeArtifact`, `readArtifact`, `captureArtifacts`, `runCheck` et `readEvidence`. Les chemins et droits sont vérifiés côté moteur, les captures sont liées au contenu et les références sont attribuées par le serveur. Il n'existe aucun outil shell, réseau, publication ou commande libre. Le `checkRunner` injecté est synchrone et retourne `{status:'passed'|'failed', log}` ; il ne lance pas de commande dans les tests. Sans ce contrôleur, `runCheck` retourne `not_run` sans preuve.

La QA exige `typecheck`, `test`, `build`, `browser-check`, chacun lié au bon critère, à la tentative et à l'empreinte courante des sources/tests/configurations. Un test ajouté ou modifié invalide les preuves précédentes ; un rapport ajouté sous `docs/` ne modifie pas cette empreinte. Un rapport QA `needs_changes` valide peut être transmis au reviewer, mais le run ne devient pas `completed` tant qu'un constat de correction subsiste. La création automatique de cycles de correction complets reste à l'étape 5.

## États et transitions

| État du run | Transition autorisée |
| --- | --- |
| `draft` | `start` si adaptateur disponible, créneau libre et budget disponible ; `cancel` sans lancer de mission |
| `running` | Enchaînement après acceptation de la mission ; `pause` ou `cancel` |
| `pause_requested` | Fin de la mission active et enregistrement du point de reprise ; aucun nouveau départ |
| `paused` | `resume` explicite ; conserve les missions acceptées |
| `blocked` | Diagnostic visible ; `retry` après arrêt confirmé, dans les plafonds ; `cancel` |
| `interrupted` | Après redémarrage avec ancienne réservation : réconciliation de l'arrêt puis nouvelle tentative explicite |
| `cancel_requested` | Attend l'arrêt confirmé avant `cancelled` et libération du créneau |
| `needs_changes` | Pipeline de première passe ayant identifié des corrections ; pas de livraison validée |
| `completed`, `cancelled` | États terminaux ; pas de relance silencieuse |

Chaque mission conserve ses tentatives numérotées et ses états `queued`, `running`, `accepted`, `needs_changes`, `blocked`, `failed` ou `unknown`. Une nouvelle tentative ne réécrit pas l'historique. Un résultat invalide, une référence non résoluble, un fichier requis absent ou un contrôle QA manquant bloque la dépendance suivante. La présence de texte dans un fichier ne garantit pas sa qualité produit : cette étape vérifie contrats et transitions, pas l'acceptation métier d'une vraie application.

## Plafonds et coûts

Valeurs par défaut fixées côté serveur :

| Limite | Valeur |
| --- | --- |
| Missions simultanées | 1 pour le moteur |
| Durée par tentative | 120 secondes |
| Tentatives par mission | 2 au maximum |
| Tentatives cumulées par run | 12 |
| Durée active cumulée par run | 900 secondes |
| Sorties par tentative | 256 Kio cumulés pour fichiers écrits, journaux de contrôle et réponse finale |
| Fichiers virtuels par run | 256 |
| Preuves par run | 256 |

Les durées sont imputées au journal sur fermeture, échec et récupération, sans réinitialisation lors d'une reprise. Un arrêt incertain continue de réserver le créneau. Les plafonds d'un run ne peuvent pas être augmentés par le navigateur ou par `retry`. Une nouvelle décision de budget au-delà du plafond n'est pas implémentée dans cette étape : le run reste bloqué. Aucune consommation monétaire n'est mesurée ; aucun plafond financier garanti n'est annoncé. Ce lot ne fait aucun appel modèle facturable.

## API HTTP versionnée

Les routes conservent les contrôles Host/Origin du serveur local et ne publient pas de CORS permissif. Toute mutation exige `Content-Type: application/json`, corps limité à 64 Kio et refus des champs inconnus.

| Route | Corps et résultat |
| --- | --- |
| `GET /api/v1/orchestration` | Diagnostic, plafonds, réservation et absence de génération réelle |
| `POST /api/v1/runs` | `{brief}` uniquement ; 201 avec run brouillon et identifiants serveur |
| `GET /api/v1/runs` | Liste des runs enregistrés |
| `GET /api/v1/runs/:id` | Run, missions, tentatives, journal, fichiers virtuels et preuves |
| `POST /api/v1/runs/:id/start` | `{}` ; démarrage d'un brouillon |
| `POST /api/v1/runs/:id/pause` | `{}` ; pause demandée ou effective au point de reprise |
| `POST /api/v1/runs/:id/resume` | `{}` ; reprise d'une pause effective |
| `POST /api/v1/runs/:id/cancel` | `{}` ; annulation avec arrêt confirmé si nécessaire |
| `POST /api/v1/runs/:id/retry` | `{}` ; nouvelle tentative explicite après échec/interruption et arrêt confirmé |
| `POST /api/v1/runs/:id/reconcile` | `{}` ; demande au contrôleur de vérifier l'arrêt, jamais une affirmation du navigateur |

Codes structurés notamment : `INVALID_BRIEF`, `INVALID_TRANSITION`, `ORCHESTRATOR_UNAVAILABLE`, `ORCHESTRATOR_BUSY`, `INVALID_OUTPUT`, `MISSING_ARTIFACT`, `INVALID_EVIDENCE`, `VERIFICATION_REQUIRED`, `INDEPENDENCE_VIOLATION`, `BUDGET_EXHAUSTED`, `ATTEMPTS_EXHAUSTED`, `SHUTDOWN_UNCONFIRMED`, `STORE_CORRUPT` et `STORE_UNAVAILABLE`.

## Reprise et exploitation locale

Chaque candidat publie un marqueur unique `owner-<PID>-<UUID>.lock` avant de rechercher les autres propriétaires. Le propriétaire retenu conserve son marqueur jusqu'à la fermeture ; deux candidats simultanés peuvent se refuser mutuellement avec un diagnostic de saturation plutôt que travailler ensemble. Un marqueur d'un PID vivant ou dont l'accès ne peut être vérifié bloque l'ouverture. Un marqueur de PID confirmé absent est retiré par son nom unique. Même un marqueur vide laissé avant l'écriture de son contenu contient le PID dans son nom et reste récupérable. Aucun verrou de démarrage anonyme n'est utilisé.

Après fermeture normale, le marqueur est libéré mais une réservation non confirmée reste dans le journal. Un journal corrompu reste intact et bloque l'initialisation ; restaurer une sauvegarde vérifiée plutôt que le réinitialiser implicitement. Les écritures synchronisées et renommées protègent le journal contre une interruption de processus ; la résistance à une panne matérielle n'a pas été testée. Ce mécanisme vise le stockage local sur une machine, pas un partage réseau distribué.

Au redémarrage, une tentative active devient `unknown`, le run `interrupted` et la réservation est conservée. `reconcile` exige une confirmation de `adapter.confirmStopped` ; ensuite `retry` crée une nouvelle tentative. Aucun appel IA ni succès synthétique ne sert à résoudre une issue inconnue.

## Vérification et limites

`npm run test:orchestrator` exerce le moteur avec adaptateur et contrôleur factices et journaux temporaires. `npm test` inclut ces tests, les tests du pont existant et ceux du frontend. [QA-ORCHESTRATOR.md](QA-ORCHESTRATOR.md) rapporte les résultats observés et [REVIEW-ORCHESTRATOR.md](REVIEW-ORCHESTRATOR.md) la revue indépendante.

L'interface utilise encore le parcours de simulation existant. L'adaptateur réel, le système de fichiers isolé et l'outillage de processus sont l'étape 4 ; la boucle de correction complète est l'étape 5 ; le raccordement de l'interface, l'aperçu et l'export sont l'étape 6.

Références des bibliothèques utilisées : [Ajv — JSON Schema 2020-12](https://ajv.js.org/json-schema.html) et [smol-toml — parseur TOML](https://github.com/squirrelchat/smol-toml). Leur présence n'implique aucun appel distant à l'exécution du moteur.
