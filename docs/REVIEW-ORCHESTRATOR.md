# Revue indépendante — orchestrateur persistant

Date : 4 novembre 2026. Statut : **ready** pour le lot usine de l'étape 3, avec adaptateur injecté `example`. Aucun constat correctif ouvert. Ce statut ne valide aucune génération réelle ni livraison d'application cliente.

## Mandat, indépendance et version

Revue native bornée du lot usine « étape 3 », confiée par le coordinateur. Cette invocation `/root/review_orchestrator` est distincte de `/root`, seul auteur déclaré du code et des tests examinés. Le coordinateur a confirmé une création avec `fork_turns:none`, sans réutilisation de contexte d'auteur. Cette confirmation décrit les invocations natives du chat ; elle ne prouve aucune session de l'adaptateur applicatif.

Le seul fichier modifié par le reviewer est ce rapport. Sources examinées : `server/orchestrator.mjs`, `server/orchestration-contracts.mjs`, `server/orchestration-store.mjs`, `server/orchestrator.test.mjs`, intégration `server/app.mjs` et `server/index.mjs`, manifestes et dépendances directes, schémas et consignes v1. Référence Git : `aa75d593df60cb26ecf6436278370ce620e1e763`, complétée par les modifications locales non commitées du lot. Les documents amont actualisés et [QA-ORCHESTRATOR.md](QA-ORCHESTRATOR.md), rédigé par le coordinateur auteur du code/tests, ont été lus ; ses observations sont distinguées de celles du reviewer ci-dessous.

Empreintes SHA-256 de la version finale corrigée et relue :

| Fichier | SHA-256 |
| --- | --- |
| `server/orchestrator.mjs` | `09C9A46765E3F9F4E49D3100477AB3140868D07227C1DB10824F013D2E26B544` |
| `server/orchestration-store.mjs` | `56F60B88D9BF84ACFA4764B7D4E08B3B70749AC955ADA9520C1D69A16183DE11` |
| `server/orchestrator.test.mjs` | `86DF365CDA8718688D06F0BCD612A66E58E51316DA5ACC158C3830CD5A3E91E4` |
| `package.json` | `AA2B4C02FEE3639E924B4EFD1E2262498D2F74CD4861226376AE92D67124F498` |
| `package-lock.json` | `4A548E35F8E734AED977339169210ADADAAE8A8202DE5DFA6C77A0B7B598F5C1` |
| `docs/ROADMAP.md` | `FA9B0E0D68B33C5E381F3BBFA24D1052BE974187BD59B8D95828D8A8186D596B` |
| `docs/QA-ORCHESTRATOR.md` | `820C79CF06603117B57063441008D5BD76CD876AD13AF8F8677B764541CDB847` |

Les modules `orchestration-contracts.mjs`, `app.mjs` et `index.mjs` conservent leurs empreintes de première passe ci-dessous. Les versions exactes Ajv 8.20.0 et smol-toml 1.9.1 correspondent au manifeste et au verrou.

Empreintes SHA-256 de la première passe :

| Fichier | SHA-256 |
| --- | --- |
| `server/orchestrator.mjs` | `B504372E685DA3216461F33699FEB02843F8C74B7A8E9379500D574751E809EA` |
| `server/orchestration-contracts.mjs` | `8DF21D6700175284613E7C433321BD13C34E5E516482949C1CA4C2B9C624C1E2` |
| `server/orchestration-store.mjs` | `23C94C00722006399A708B4675456E51F9A6264DC68AAA086945C104167A3C43` |
| `server/orchestrator.test.mjs` | `13DA904BA701E0DB73381559DF4AEE1BFA4855C026C8417C7B22B4DF36F5587D` |
| `server/app.mjs` | `707F44F312700D1A5434FB8C15202725D2296DCBDAC6312A69E1415B9DD014C1` |
| `server/index.mjs` | `262BF6AE0979961BB6F30EF4DC8E077651D0586278C0ABD3EDB332B376613355` |

## Historique des constats — tous clos après relecture

### R1 — P1 — Une reprise écrase les sorties partielles non capturées — clos

Fichier/ligne de la première passe : `server/orchestrator.mjs:111`.

`writeArtifact` remplace directement `run.files[path]`. Le contenu n'est historisé dans une tentative que si l'adaptateur appelle ensuite `captureArtifacts`. Après un échec survenu avant cette capture, l'écriture du même chemin par la tentative suivante détruit le contenu précédent dans tout le journal. L'historique conserve l'échec mais perd sa sortie partielle, contrairement au contrat de conservation après erreur/reprise.

Reproduction exécutée avec adaptateur `example` et journal temporaire : démarrer le PM, écrire `PARTIAL_FIRST_ATTEMPT` dans `docs/PRODUCT.md`, appeler `onClose(1)` sans capture, puis `retry` et écrire `SECOND_ATTEMPT` au même chemin. Avant reprise, la première chaîne existe dans le run ; après la seconde écriture, elle est absente de tout `JSON.stringify(engine.find(id))` et `attempts[0].captures` est vide. Aucune exécution modèle ni écriture de sources clientes n'intervient.

Correction relue : `server/orchestrator.mjs:112` archive chaque version écrite dans `partialArtifacts` de la tentative. Reproduction indépendante finale : deux contenus successifs dans la tentative 1, échec, réécriture et échec en tentative 2, fermeture/réouverture ; les deux contenus initiaux restent présents et inchangés. Le test de sortie JSON malformée puis reprise réussit également.

### R2 — P1 — Le journal accepte un état terminal incompatible avec les missions — clos

Fichier/ligne de la première passe : `server/orchestration-store.mjs:38`.

La validation contrôle le schéma et certains compteurs mais n'établit pas les relations sémantiques entre l'état du run et les décisions de ses missions. Un journal structurellement valide peut annoncer `completed` alors qu'aucune mission n'a commencé. Une réouverture lui accorde alors le statut terminal déclaré au lieu de signaler `STORE_CORRUPT`.

Reproduction exécutée dans un journal temporaire : créer un brouillon, fermer le moteur, remplacer uniquement `runs[0].state` par `completed` dans `journal.json`, puis réouvrir. Résultat observé : `state:completed` et six missions `queued`, sans rejet. `deliveryVerified:false` demeure présent, mais ne corrige pas le faux état du pipeline. Le validateur doit aussi préserver les relations requises entre décisions, résultats et preuves persistées.

La relecture a identifié une autre variante : un run `paused` avec PM `accepted` sans tentative permettait de lancer UX sans entrée PM ; un ancien résultat accepté pouvait aussi être remis à `queued`. Correction finale : `server/orchestration-store.mjs:57` exige une tentative correspondant à l'état et limite la remise en file aux échecs/blocages/issues inconnues dont l'arrêt est confirmé ; les lignes 69–87 contrôlent résultat, instantané, preuves, dépendances et complétion. Les trois altérations ont été rejouées indépendamment : elles sont maintenant refusées avec `STORE_CORRUPT`.

### R3 — P2 — Les journaux des contrôles échappent au budget cumulatif de sortie — clos

Fichier/ligne de la première passe : `server/orchestrator.mjs:143`.

`runCheck` limite la taille de chaque journal mais ne l'impute pas à `attempt.outputBytes`. Les plafonds de nombre de preuves et de taille du journal global limitent finalement le stockage ; ils ne respectent pas le budget annoncé par tentative et peuvent provoquer un blocage général de persistance au lieu d'un arrêt local prévisible.

Reproduction exécutée : atteindre la QA avec `maxOutputBytes:4096`, puis demander dix fois `runCheck('test',['test'])` à un contrôleur injecté retournant un journal de 1 000 octets. Résultat : 10 000 octets de journaux persistés, compteur de sortie QA égal à zéro, run toujours `running`. Aucun contrôle système n'est exécuté.

Correction relue : `server/orchestrator.mjs:149` applique le plafond cumulé, et la ligne 154 impute les journaux au compteur. Reproduction indépendante finale : après quatre journaux de 1 000 octets, le cinquième retourne `OUTPUT_LIMIT`, compteur à 4 000, run `blocked` et réservation conservée tant que l'arrêt n'est pas confirmé. La documentation annonce le même périmètre de sortie.

### R4 — P2 — Un verrou d'ouverture abandonné exige une intervention manuelle — clos

Fichier/ligne de la première passe : `server/orchestration-store.mjs:88`.

Un arrêt brutal entre la création de `opening.lock` et son retrait laisse un verrou sans identité de propriétaire. Toute réouverture échoue avec `STORE_LOCKED`, même si `owner.lock` est absent ou périmé. Reproduction exécutée avec l'artefact exact d'un arrêt à cet endroit : fermer un journal temporaire, y créer un `opening.lock` vide, puis réouvrir ; `STORE_LOCKED` est retourné.

Correction relue : `server/orchestration-store.mjs:101` utilise un marqueur unique portant PID et UUID, créé avant le scan des autres propriétaires et conservé pendant toute la possession. Aucun verrou anonyme de démarrage n'est désormais créé. Le test exécuté indépendamment lance un processus Node vide, attend sa fin, crée son marqueur vide et vérifie la récupération sans suppression manuelle. Un propriétaire vivant bloque toujours un concurrent. La documentation décrit le refus mutuel possible de deux candidats simultanés, le stockage local et l'absence de garantie distribuée.

## Vérifications observées par le reviewer

| Procédure locale | Résultat au 4 novembre 2026 |
| --- | --- |
| Première passe `npm run test:orchestrator` | Infrastructure `spawn EPERM` lors du lancement du processus enfant ; cette tentative n'avait pas exécuté les tests. |
| Première passe `node server/orchestrator.test.mjs` | Code 0, 21 tests réussis ; exécution directe du même fichier sans processus enfant. |
| Version finale `npm run test:orchestrator` | Exécution locale autorisée hors sandbox de l'outil, code 0, **29 tests réussis**, aucun échec/non exécuté ; inclut marqueur de PID réellement terminé, persistance défaillante et instantanés historiques. |
| `node server/bridge.test.mjs` | Code 0, 13 tests réussis, incluant protections HTTP et arguments fixes en lecture seule avec processus injecté ; aucun CLI réel lancé. |
| Reproductions R1 à R4, programmes Node inline | Les quatre comportements décrits ont été observés ; journaux sous des dossiers temporaires dédiés, supprimés après fermeture. |
| Reproductions indépendantes après correction | R1, R2 et ses variantes, R3 et régression QA recontrôlés ; résultats attendus obtenus. R4 recontrôlé par lecture du protocole et exécution du test de PID mort. |
| Lecture du diff d'intégration HTTP | Contrôles Host/Origin/JSON conservés, lecture JSON factorisée, routes v1 distinctes ; ancien adaptateur CLI non activé. |
| Vérification documentaire finale | Clôtures de ROADMAP et QA relues après mise à jour ; périmètre `example` et étapes 4–6 restantes explicites. Dix documents inspectés, aucun lien Markdown local manquant. `git diff --check` : code 0. Empreintes finales code/tests inchangées. |

La revue couvre un moteur avec adaptateur et preuves virtuels `example`, sans shell, réseau ou appel modèle dans l'adaptateur. Elle ne valide ni génération réelle, ni isolation système d'une application cliente, ni commandes clientes, ni aperçu, ni boucle complète de correction. Les tests typecheck/build/frontend non exécutés par cette invocation restent non vérifiés ici ; les preuves du coordinateur doivent être distinguées des observations du reviewer.

Le rapport du coordinateur annonce sur cette version **81 tests** (39 frontend, 13 pont et 29 orchestrateur), typecheck, build, contrôle Python des contrats et `git diff --check` réussis. Ces exécutions consolidées n'ont pas été répétées intégralement par le reviewer ; leurs résultats restent des preuves attribuées au coordinateur. Les empreintes ci-dessus identifient le code/tests effectivement revus. Les modifications documentaires n'élargissent ni les capacités ni les permissions.

## Relecture intermédiaire des corrections

Une version intermédiaire de correction a introduit une régression liée à R2 : `validateResult` vérifiait chaque ancienne mission acceptée contre les fichiers de travail actuels. Reproduction indépendante : le développeur produit et capture `tests/existing.test.ts`, puis remet un résultat accepté ; la QA démarre et modifie ce fichier selon son allocation. L'écriture retournait `STORE_CORRUPT` et bloquait le moteur. Ce P1 a été communiqué avant clôture puis corrigé : `server/orchestrator.mjs:191` conserve `acceptedFiles`, et `server/orchestration-store.mjs:74` valide l'ancienne décision contre cet instantané. La reproduction finale indépendante va jusqu'à `completed`, puis réouvre le journal : la version DEV historique et la version QA courante sont distinctes et conservées. Ce constat est clos par le reviewer.

## Décision et limites finales

La revue requise du moteur injecté est complète, les corrections ont été examinées sur la nouvelle version et aucun P0/P1 ni P2/P3 correctif ne reste ouvert. Décision **ready** dans ce seul périmètre. L'indépendance de l'adaptateur est exercée avec des identités de test ; elle ne prouve pas l'indépendance de sessions d'un futur runtime réel.

Restent hors preuve : exécution modèle, authentification/quota, isolation physique de projets et commandes, résistance à une panne matérielle ou partage réseau, interface raccordée, aperçu, export et boucle complète de correction. Le contrôleur injecté est synchrone et de confiance ; cette étape ne teste pas un processus client réel. Les plafonds locaux et l'arrêt incertain restent explicites, et `deliveryVerified:false` est maintenu. L'étape 4 doit apporter ses propres preuves avant toute affirmation de génération réelle.
