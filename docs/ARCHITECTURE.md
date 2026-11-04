# Architecture — AI Software Factory

## Évolution des étapes 3 et 4

Un orchestrateur persistant indépendant complète le pont : journal JSON local atomique et verrouillé, chargement explicite des consignes TOML, validation des contrats v1, six missions séquentielles, pause/reprise, annulation, tentatives et réconciliation après redémarrage. Son API est `/api/v1/`. Sans activation explicite, il n'a pas d'adaptateur. Les tests injectent des contrôleurs et réponses HTTP sans appel modèle.

L'étape 4 ajoute un transport OpenAI Responses sans outils : données structurées, écritures contrôlées et instantanés versionnés dans `.local/projects/`. Manifeste/verrou proviennent du socle serveur ; chemins, liens, collisions, contenus et versions sont contrôlés avant acceptation. Aucune commande cliente ou configuration générée n'est exécutée. La première génération fournisseur reste non vérifiée faute de configuration API. La QA réelle reste bloquée tant que ses contrôles sont indisponibles.

Les états et routes sont dans [ORCHESTRATION.md](ORCHESTRATION.md) ; transport, politique d'écriture, configuration, plafonds et frontières futures sont dans [GENERATION.md](GENERATION.md). Les sections suivantes conservent l'architecture historique du parcours de simulation et du pont CLI ; les descriptions de capacités futures doivent être lues avec l'état ci-dessus.

## Décision et périmètre

Le MVP sépare trois capacités : construire cette application avec de véritables sous-agents Codex, simuler un pipeline dans le navigateur et déclencher facultativement de vraies tâches Codex par un serveur local. Ces capacités ont des identités et des preuves distinctes. Les six cartes de rôles ne représentent pas six processus toujours actifs.

Le frontend utilise React, TypeScript, Tailwind CSS et Vite. Il fonctionne en hébergement statique et conserve les projets, tâches, résultats et événements de simulation dans le stockage local du navigateur. Aucun compte, secret ou service payant n'est nécessaire pour cette simulation. Le backend Node local fournit le diagnostic des capacités et un pont Codex optionnel. L'absence de ce backend ne doit pas empêcher la simulation.

## Composants et responsabilités

| Composant | Responsabilité | Frontière |
| --- | --- | --- |
| Interface React | Dashboard, brief, rôles, tâches, livrables et historique | N'exécute aucune commande système |
| Domaine TypeScript | Modèle des projets et transitions du pipeline | Fonctions déterministes testables |
| Persistance navigateur | Sauvegarde versionnée et récupération après rechargement | Données propres à ce navigateur ; aucun partage serveur |
| Simulateur | Produit des exemples de livrables et des événements explicitement simulés | N'appelle pas un modèle et ne crée pas réellement une application |
| API Node locale | Diagnostics, validation et cycle de vie des tâches réelles | Écoute uniquement sur l'interface de boucle locale |
| Adaptateur Codex | Lance le CLI avec arguments fixes et recueille sa sortie | Lecture seule, activation explicite côté serveur |

Le frontend interroge l'API au moyen d'une URL de même origine ou d'un proxy de développement. Une version statique distante n'accède pas automatiquement au serveur local de son visiteur. Le mode déconnecté doit afficher cette limite et préserver la simulation.

## Modèle de domaine

Un projet possède un identifiant stable, un nom, un brief, une date de création et une liste de tâches. Une tâche identifie son rôle, ses dépendances et son état. Un résultat identifie sa tâche, son contenu, sa date et sa provenance. Les identifiants sont générés à la création et ne dépendent pas du titre fourni.

Les projets simulés ont les états `draft`, `running`, `paused`, `completed` ; les tâches ont les états `queued`, `running`, `done`. Un passage à l'étape suivante exige la fin de ses dépendances. Les jobs réels ont les états serveur `running`, `completed`, `failed` ; le suivi frontend ajoute `unknown` si le job a disparu du serveur. Les sorties partielles restent conservées. La progression et les compteurs sont dérivés des tâches.

La provenance fait partie des données : `simulation` pour le moteur local, `codex` pour la sortie d'un processus réel. Les exemples initiaux, s'il y en a, sont identifiés comme exemples. Un résultat de simulation n'est jamais transformé en preuve d'une exécution réelle.

## Équipe et livrables

| Rôle | Responsabilité | Livrable vérifiable |
| --- | --- | --- |
| Product Manager | Cadrer le besoin, prioriser et définir l'acceptation | Brief, périmètre et critères dans `PRODUCT.md` |
| UX Designer | Définir les parcours, les états et l'accessibilité | Spécification dans `UX.md` |
| Software Architect | Définir composants, frontières et contrats | `ARCHITECTURE.md` et `CAPABILITIES.md` |
| Fullstack Developer | Implémenter l'interface, le domaine et le backend | Sources exécutables et instructions de lancement |
| QA Engineer | Vérifier les comportements et les échecs | Tests automatisés et rapport de validation |
| Code Reviewer | Examiner les risques et défauts indépendamment | Revue avec gravité, fichiers et corrections suivies |

Le Lead Architect orchestre les dépendances et intègre les livrables. Pendant la construction, les délégations passent par les outils de sous-agents du chat ; les fichiers de consignes rendent les rôles réutilisables. L'interface du MVP n'a pas accès à ces outils internes. Un appel CLI réel est une tâche assignée à un rôle ; il ne prouve pas à lui seul qu'un sous-agent natif supplémentaire a été créé.

## Contrat implémenté du pont local

Le contrat livré est :

| Route | Réponse attendue |
| --- | --- |
| `GET /api/health` | `mode`, `bridgeEnabled`, `cliAvailable`, `cliVersion`, `authenticationVerified:false`, `jobPersistence:'memory'`, `activeJobId`, `maxConcurrency:1`, `timeoutMs:120000`, `shutdownUnconfirmed`, `blocked`, `blockedJobId`, `blockReason` |
| `POST /api/jobs` | Corps `{ role, brief }` validé ; réponse `202` avec un job réel |
| `GET /api/jobs/:id` | Job `{id,role,brief,mode:'codex',state,createdAt,finishedAt?,events,result,error?}` |

L'API ne reçoit ni commande libre, ni chemin de travail, ni variable d'environnement, ni options du CLI. Le rôle appartient à une liste fixe des six rôles et le brief a une taille maximale. Les réponses d'erreur sont structurées : requête invalide, pont désactivé, CLI absent, saturation, tâche inconnue ou erreur d'exécution.

### Conditions d'exécution

- Le pont est désactivé par défaut et activé avec `CODEX_BRIDGE_ENABLED=1` côté serveur.
- Le serveur fixe son répertoire de travail au lancement ; le navigateur ne peut pas le modifier.
- Le processus est créé avec `spawn`, une liste d'arguments et `shell: false`. Le brief est envoyé par l'entrée standard, jamais interpolé dans une commande shell.
- Le CLI reçoit `--sandbox read-only` et `--json`. Aucun contournement du sandbox ou des approbations n'est utilisé.
- Il reçoit aussi `--ignore-user-config`, `--strict-config` et des overrides désactivant agents, apps, plugins, mémoires et outil de demande de permissions. L'authentification reste héritée. Aucun serveur MCP n'est déclaré dans la configuration projet livrée ; l'ajout futur d'un MCP doit être audité séparément.
- Un seul job s'exécute à la fois ; un second reçoit une réponse de saturation explicite.
- Chaque job a une durée maximale et un plafond de sortie. L'arrêt, l'erreur de démarrage et le code de sortie non nul produisent un état d'échec, jamais un succès synthétique.
- Après timeout, le job devient `failed` immédiatement. Si l'arrêt n'est pas confirmé par `close`, le pont retourne un blocage explicite et refuse tout nouveau processus. Un `close` tardif libère le pont sans convertir cet échec en succès.
- Le serveur écoute sur `127.0.0.1`, vérifie les en-têtes Host et Origin, accepte seulement les origines de développement prévues et exige `application/json` pour les mutations. Il ne publie pas de CORS avec `*`.
- Les journaux réels sont conservés séparément des simulations. Seuls les événements effectivement reçus peuvent justifier un statut terminé.

Le sandbox en lecture seule protège les fichiers ; il ne supprime ni le besoin d'authentification Codex, ni l'éventuelle consommation de quota. Le lancement d'une vraie tâche doit afficher son caractère connecté avant l'action. Aucune exécution facturable n'est requise pour les tests du MVP.

## Tests et vérification

1. Tests du domaine : validation du brief, dépendances, progression, arrêt et absence de faux résultats réels.
2. Tests de persistance : rechargement, contenu malformé, migration ou retour à un état sûr, indisponibilité du stockage.
3. Tests de l'API avec adaptateur factice : refus du pont désactivé, rôle inconnu, taille excessive, Origin refusé, saturation, timeout et erreurs CLI. Ces tests ne consomment pas de modèle.
4. Vérifications frontend : création, navigation, consultation des tâches et résultats, états vides, clavier et affichage responsive.
5. Vérification TypeScript et build de production, puis revue de code indépendante portant notamment sur les frontières de confiance.

Les contrôles réellement exécutés et leurs résultats sont consignés dans les livrables QA. Une vérification non exécutée reste déclarée comme telle.

## Évolutions prévues

Une orchestration d'écriture de code nécessiterait des espaces de travail isolés, une politique d'approbation des outils, un journal persistant côté serveur et une gestion explicite des coûts. Le partage multi-utilisateur nécessiterait une authentification et une base de données. Ces éléments ne sont pas implicitement fournis par le stockage navigateur ou par la présence du CLI.
