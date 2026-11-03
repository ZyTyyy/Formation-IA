# Revue indépendante du MVP

Revue effectuée par le sous-agent Code Reviewer sur le domaine, la persistance, les composants React et le backend local. Les références ci-dessous correspondent à l’état examiné avant corrections du coordinateur. Aucun appel modèle réel ni test de bout en bout n’a été déclenché par cette revue.

## Vérification des corrections

Dernière lecture des corrections, sans relancer les tests pris en charge par le QA.

| Constat | Statut observé | Preuve et limite |
| --- | --- | --- |
| Isolation des outils externes | Résolu pour la configuration livrée | `server/bridge.mjs:36-44` ignore la configuration personnelle, impose la configuration stricte et désactive agents, apps, plugins, mémoires et demande de permissions. `.codex/config.toml` ne déclare aucun MCP. `src/components/Connections.tsx:30` précise désormais cette portée et exige une nouvelle vérification si la configuration change. Ces options ne constituent pas un blocage générique d’un futur serveur MCP ajouté au projet. Le runtime CLI authentifié n’a pas été exercé par la revue. |
| Timeout sans fermeture | Résolu à la lecture | `requestStop()` place immédiatement le job en échec ; `shutdownUnconfirmed` réserve le processus et refuse tout second lancement jusqu’à un vrai `close`. `health()` explique ce blocage. Les nouveaux tests couvrent absence de fermeture et fermeture tardive. L’arrêt du processus OS reste une opération dont la réussite doit être confirmée. |
| Suivi lié à Connexions | Résolu à la lecture | `src/useRealJobs.ts` détient le polling au niveau d’App, avec reprise après erreur. Les tests du hook couvrent résultat obtenu sans monter Connexions et coupure réseau. `src/App.tsx:25-26` dérive aussi le résultat de la modale depuis son identifiant ; la modale suit donc les mises à jour du job. |

Le traitement d’une réponse API 404 place explicitement la mission dans l’état frontend `unknown`, arrête le polling et ne prétend confirmer ni succès ni échec du modèle. `markLost()` utilise une mise à jour fonctionnelle par identifiant et préserve donc le dernier résultat partiel et les événements observés. Deux tests dédiés examinent la perte de mission et la préservation de cette sortie. Ce dernier ajustement est résolu à la lecture.

La navigation mobile fermée porte `inert`, et l’ouverture gère focus, boucle de tabulation et Échap (`src/App.tsx:27-50,74`). Vérification de code seulement par ce reviewer ; le contrôle navigateur à 320 px appartient au coordinateur et au rapport QA.

Revue clôturée : les trois constats initiaux et les ajustements complémentaires sont corrigés dans le périmètre décrit. Aucun autre défaut bloquant n’a été identifié dans les corrections examinées. Les tests supplémentaires ont été examinés, pas exécutés lors de ces dernières passes. Le QA conserve la responsabilité de consigner les résultats d’exécution dans son rapport.

## Constats initiaux

### P1 — Le sandbox fichiers ne désactive pas les outils externes

`server/bridge.mjs:33` lance `codex exec --json --sandbox read-only` sans isoler la configuration utilisateur. La configuration MCP/apps/plugins peut être héritée. Le prompt demande de ne pas écrire, mais cette consigne ne retire pas les capacités d’écriture de services distants. `src/components/Connections.tsx:50` affirme cependant que les outils externes du pont sont désactivés. Une mission issue du navigateur peut donc disposer de capacités supérieures à la promesse produit. Désactiver structurellement les outils externes et vérifier les options supportées du CLI ; ne pas assimiler `read-only` à un contrôle des services distants.

### P2 — Le timeout peut laisser le pont occupé sans borne

`server/bridge.mjs:145-148` appelle `cancel()` sans transition terminale indépendante. La libération de `activeId` dépend exclusivement de `onClose` (`:135-143`). Un arrêt refusé ou un processus qui ne ferme pas conserve le job `running` et bloque tous les nouveaux jobs en 409. Reproduction locale sans modèle : injecter un runner dont `cancel()` ne déclenche pas `onClose`, choisir `timeoutMs:10`, attendre 30 ms ; le job porte l’erreur de durée maximale mais reste `running` et actif. Prévoir une politique bornée d’arrêt, un état explicite si l’arrêt n’est pas confirmé et un test de cette branche.

### P2 — Le suivi réel s’arrête quand on quitte Connexions

Le polling réside dans `src/components/Connections.tsx:26-35` et son nettoyage supprime le timer au démontage. Les jobs sont stockés dans `App`, mais l’historique (`src/App.tsx:63`) n’effectue aucun rafraîchissement. Après lancement réel, aller dans Historique et attendre la fin serveur laisse le job affiché « En cours » et le résultat vide. Le retour dans Connexions rétablit le suivi. Centraliser le suivi au niveau de la session ou rafraîchir les jobs de l’historique.

## Points vérifiés à la lecture

- Les six étapes sont ordonnées ; pause et reprise ne produisent pas de livrable supplémentaire.
- Les documents sont explicitement des modèles de simulation, avec absence de tests ou code réels indiquée.
- Le chargement valide le schéma et les invariants principaux ; un projet actif est mis en pause au rechargement.
- Les livrables sont rendus en texte React, sans injection de HTML.
- L’API borne les entrées, utilise des rôles autorisés, fixe le répertoire et le programme, passe le brief via stdin et n’utilise pas de shell.
- Host, Origin, type JSON, concurrence et taille de sortie font l’objet de contrôles.
- Un résultat réel n’est déclaré terminé qu’après `turn.completed` et sortie réussie du processus.

## Limites de cette revue

Inspection statique et reproduction isolée du timeout seulement. La feuille de style était en cours ; aucune conclusion visuelle, de contraste ou responsive. Le CLI authentifié, les contrôles effectivement appliqués par le runtime et la facturation n’ont pas été exercés. La validation finale doit reporter les corrections et les tests réellement exécutés, sans convertir ces points de lecture en certification.
