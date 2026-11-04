# Génération de fichiers — étape 4

## État et périmètre

Implémentation serveur disponible, désactivée par défaut. Le transport OpenAI Responses, les droits par rôle et les instantanés sur disque sont testés hors ligne avec des réponses HTTP injectées. Aucun appel modèle réel n'a encore été observé dans ce lot : la clé API et le modèle ne sont pas configurés. **L'étape 4 reste ouverte** jusqu'au premier projet réellement généré et à l'enregistrement de sa preuve.

Le choix de cette première version est une génération sans outils : le modèle produit des données structurées, le serveur écrit les seuls fichiers alloués. Le modèle ne reçoit aucun shell, système de fichiers, navigateur, MCP ou connecteur. Les six rôles correspondent à des requêtes successives distinctes, pas à six processus autonomes permanents. Le pont CLI d'analyse reste indépendant et en lecture seule.

Le moteur Docker installé n'était pas accessible pendant l'inspection ; WSL refusait l'énumération dans le contexte courant. Aucun contournement ni activation automatique n'a été effectué. L'exécution des commandes clientes et l'aperçu exigeront leur propre isolation aux étapes 5 et 6. Un répertoire dédié seul ne serait pas un sandbox permettant d'exécuter du code non fiable.

## Critères de ce lot

| Identifiant | Condition vérifiable | Vérification |
| --- | --- | --- |
| G-1 | Activation explicite côté serveur, clé et modèle requis ; mode d'un projet immuable | Configuration et tests de changement de mode |
| G-2 | Instructions des rôles épinglées, seules entrées versionnées autorisées transmises | Inspection de chaque requête injectée |
| G-3 | Aucun outil ni commande libre fourni au modèle ; sorties structurées puis contrat v1 validés | Rejets des commandes, outils et preuves inventées |
| G-4 | Écritures dans des instantanés propres au projet ; chemins portables, liens et collisions refusés | Tests de jonctions, hardlinks, traversée, casse et altération |
| G-5 | Manifeste/verrou fournis par le serveur ; sources, points d'entrée, configurations et README attendus | Test du socle et des fichiers requis ; compilation cliente encore non vérifiée |
| G-6 | Budget, arrêt, pause et reprise conservés ; aucune relance automatique après interruption | Tests timeout, annulation tardive, redémarrage et panne de journal |
| G-7 | Identités et tokens observés conservés, y compris réponse invalide ; aucune preuve factice réelle | Tests de provenance et de rejet QA |
| G-8 | Premier projet issu du fournisseur réel, avec instantané et identités observées | **Non vérifié : configuration API absente** |

## Transport et validation

`server/generation-adapter.mjs` appelle exclusivement `https://api.openai.com/v1/responses`, sans redirection, avec `store:false`, `tools:[]`, `tool_choice:none` et un format JSON Schema strict. Aucun `previous_response_id` ni conversation d'auteur n'est réutilisé. Instructions globales, contrat, consignes TOML du rôle, mission et contenus autorisés sont transmis ; aucun fichier arbitraire de l'usine ni variable d'environnement n'est envoyé. Le modèle API est choisi explicitement par `FACTORY_GENERATION_MODEL` et doit être disponible pour le compte utilisé.

Le schéma de transport contient `files` (chemin et contenu), statut, résumé, constats, obstacles et suite. Le serveur rétablit les identités de mission, calcule les empreintes, fournit les contrôles `not_run`, valide le contrat v1 complet, écrit via `writeArtifact` et capture via `captureArtifacts`. Cette projection du contrat ne donne au modèle aucun droit d'inventer révision, preuve ou identité. Un appel HTTP, un refus ou une proposition malformée échoue sans relance automatique. Les corps d'erreur fournisseur et exceptions réseau brutes ne sont pas enregistrés.

Le `resp_…` observé sert d'identité de requête distincte. Il est enregistré avant la validation du statut ou du JSON métier ; les tokens d'entrée/sortie rapportés sont associés à l'événement `provider_response`. Une panne réseau, une réponse trop grande ou une annulation peuvent empêcher de les observer : absence d'usage rapporté ne signifie pas coût nul. Aucun prix ni plafond financier n'est calculé.

Le développeur reçoit le manifeste de `templates/react/`. Le serveur ajoute lui-même `package.json` et `package-lock.json`, refuse leur remplacement par le modèle et conserve l'empreinte du socle dans la provenance. Le verrou a été dérivé du verrou de l'usine puis normalisé avec `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund` ; aucune installation de dépendances cliente ni script généré n'a été exécuté. Les commandes fixes sont `typecheck`, `test`, `build` et `dev`. Les configurations et sources produites restent du code non fiable à vérifier à l'étape 5.

## Stockage et frontières

Le journal reste dans `.local/orchestrator/`. Un instantané complet se trouve dans `.local/projects/<workspaceId>/<empreinte-manifeste>/`. L'identifiant est un UUID créé par le serveur ; le navigateur ne choisit ni racine ni chemin système. Les versions antérieures sont conservées. Les fichiers virtuels partiels et leurs versions restent dans le journal avant publication du prochain instantané.

Avant publication : validation de chaque chemin, de la taille, du nombre de fichiers, des empreintes et des collisions fichier/répertoire ou de casse ; résolution canonique des répertoires et refus des liens, jonctions, noms Windows réservés, segments cachés, chemins absolus, traversées et flux alternatifs. Les fichiers sont créés exclusivement dans un répertoire temporaire unique puis publiés par renommage. La vérification relit le contenu et refuse liens physiques, fichiers manquants, modifications et entrées inattendues. Un instantané existant n'est jamais réécrit pour masquer une altération.

Avant une nouvelle mission, les instantanés acceptés sont revérifiés ; les fichiers courants du journal sont matérialisés s'il s'agit d'une nouvelle version partielle. Une divergence d'un instantané existant bloque avant l'appel modèle. Une capture puis l'acceptation vérifient également la version sur disque. Un crash peut laisser un répertoire `pending-…` non référencé, jamais considéré comme livrable ; aucun nettoyage destructif automatique n'est effectué.

Limites : 256 fichiers, 16 Mio par instantané, journal de 32 Mio, pas de quota disque global ni de rétention automatique. Les projets sont des fichiers texte UTF-8. L'isolation couvre les capacités offertes au modèle et les opérations du serveur mono-utilisateur ; elle ne protège pas contre un autre processus local hostile qui remplacerait simultanément les chemins entre deux contrôles. Ne pas donner à du code généré ou à un autre utilisateur un accès en écriture à ces répertoires.

Les instantanés ne sont pas exposés comme une racine HTTP et ne sont jamais importés ou exécutés par l'usine. Étape 6 : aperçu sur origine distincte, sans accès aux capacités privilégiées, et export sans secrets, métadonnées internes ou dépendances installées.

## Arrêt et plafonds

| Limite réelle | Valeur |
| --- | --- |
| Requêtes simultanées | 1 dans cet orchestrateur |
| Tentatives par rôle | 2, reprise explicite |
| Tentatives par projet | 12 |
| Durée par mission | 180 s |
| Durée cumulée du projet | 18 min |
| Livrables et résultat cumulés par tentative | 512 Kio |
| Corps d'entrée / réponse fournisseur | 1 Mio chacun |
| Tokens de sortie par requête | 16 384 maximum demandés au fournisseur |

Une pause laisse la requête active atteindre son point de contrôle, puis empêche la suivante. Une annulation ou un timeout avorte le transport local et interdit toute publication tardive. La réservation reste en place jusqu'à la fin locale confirmée. Après redémarrage, l'issue est inconnue ; réconciliation et nouvelle tentative sont explicites et consomment le budget existant.

**L'arrêt local ne garantit pas l'arrêt du calcul distant ni de la facturation.** Le contrôleur confirme seulement que l'ancienne requête ne peut plus écrire dans ce serveur. Une requête interrompue peut avoir été consommée et une nouvelle tentative peut entraîner une consommation supplémentaire. Le serveur affiche cette limite avant activation ; `monetaryUsageMeasured` reste faux.

Les adaptateurs de test et leurs preuves restent `example`. Une exécution `real` refuse un contrôleur de tests factice et toute preuve persistée `test-adapter`. À cette étape les quatre contrôles QA sont `not_run`. QA doit rendre `blocked` si les vérifications requises sont impossibles ; un constat exploitable `needs_changes` peut aller au reviewer, mais ne permet jamais la livraison. `deliveryVerified` reste faux.

## Configuration et premier essai

Les variables doivent être définies dans l'environnement du serveur ; `.env.example` n'est pas chargé automatiquement :

```powershell
$env:FACTORY_GENERATION_ENABLED = '1'
$env:FACTORY_GENERATION_MODEL = '<modèle disponible pour votre compte API>'
# Définir OPENAI_API_KEY localement via votre gestion des secrets.
npm run generation:check
```

Cette commande vérifie la présence des paramètres sans appel API. Un diagnostic incomplet sort avec code 2. Ne jamais transmettre la clé dans le chat, dans le navigateur ou dans Git. La connexion au CLI et le modèle choisi pour ce chat ne configurent pas cet adaptateur API.

Après vérification du quota et acceptation de la consommation possible, le premier essai local est prêt :

```powershell
npm run generation:smoke
```

Il prend le scénario de dépenses, utilise le même journal verrouillé que le serveur, affiche l'identité du run et le chemin de l'instantané, puis s'arrête sur le statut observé. Arrêter d'abord un serveur qui possède déjà ce journal. Le script ne lance ni installation ni test client ni aperçu. Son code 0 signifie uniquement que le développeur a été accepté ; le rapport conserve `deliveryVerified:false`, et QA est normalement bloquée avant l'étape 5. Le premier essai devra être consigné avec modèle, identités, versions, usage observé et limites avant de clore G-8.

Pour l'API v1, `npm start` avec les mêmes variables injecte l'adaptateur réel. Le diagnostic expose mode, capacités et plafonds ; les routes de création et de pilotage restent celles de [ORCHESTRATION.md](ORCHESTRATION.md). L'interface est raccordée à l'étape 6. Aucun appel réel n'est lancé au démarrage du serveur.

## Preuves et références

Tests hors ligne : `npm run test:generation`. Rapport du coordinateur : [QA-GENERATION.md](QA-GENERATION.md). Revue indépendante : [REVIEW-GENERATION.md](REVIEW-GENERATION.md). Ces preuves n'établissent aucune réussite fournisseur réelle ni compilation d'application générée.

Choix du format fondé sur OpenAI Docs : [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) et [migration vers Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses). Les frontières d'exécution restent guidées par la [sécurité des sandboxes](https://developers.openai.com/api/docs/guides/agents-api/environments/security).
