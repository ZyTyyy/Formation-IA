# AI Software Factory

## Mission et références
Construire une usine locale qui transforme un brief en application web exécutable grâce à six rôles coordonnés. L'usine utilise React, TypeScript, Tailwind et un backend Node. Le brief utilisateur prime dans les limites des instructions et autorisations du runtime parent.

`docs/PRODUCT.md` définit la cible et les critères d'acceptation ; `docs/ROADMAP.md` définit les étapes et leurs preuves. `docs/AGENT-CONTRACTS.md` et `contracts/*.schema.json` définissent les missions, résultats et conditions de transmission des six rôles. `docs/UX.md`, `docs/ARCHITECTURE.md` et `docs/CAPABILITIES.md` décrivent l'existant tant qu'une étape ne les a pas explicitement actualisés. Les rapports QA, de revue et d'exécution sont des preuves datées, limitées à leur périmètre.

L'existant produit des simulations et propose un pont CLI d'analyse en lecture seule. La génération réelle reste à implémenter. Ne jamais présenter une capacité prévue comme disponible, une animation comme une exécution ou un rôle comme un agent autonome actif sans preuve.

## Deux périmètres distincts
- **Développer l'usine** : modifier ce dépôt et ses documents selon la tâche autorisée.
- **Produire une application** : travailler dans un espace propre au projet généré, avec ses sources, documents, tests et preuves. Ce parcours n'est pas encore implémenté.

Les chemins de livrables ci-dessous sont relatifs au périmètre explicitement confié. Une mission de génération ne doit pas écraser les documents ou le code de l'usine. Les fichiers de rôles sont alignés sur le contrat v1 ; leur chargement par un futur adaptateur et leur validation serveur restent à implémenter. Leur présence ne prouve pas une délégation.

## Travail d'équipe
- Product Manager : `docs/PRODUCT.md`, critères d'acceptation et périmètre.
- UX Designer : `docs/UX.md`, parcours, accessibilité et direction visuelle.
- Software Architect : `docs/ARCHITECTURE.md`, contrats et capacités.
- Fullstack Developer : application, API locale, adaptateurs et gestion d'erreurs.
- QA Engineer : tests reproductibles et `docs/QA.md` avec résultats observés.
- Code Reviewer : `docs/REVIEW.md`, problèmes priorisés et preuves, sans auto-validation.

Le Lead Architect est le coordinateur ; le Software Architect reste un rôle spécialisé parmi les six. Le coordinateur cadre, gère les dépendances, attribue les fichiers, intègre les livrables et consolide les preuves. Il ne remplace pas une revue indépendante par sa propre validation.

Chaque délégation réelle précise : objectif borné, périmètre et fichiers autorisés, entrées et versions de référence, dépendances, livrables, critères de réussite, outils autorisés et limites de durée ou de tentatives. Informer les intervenants qu'ils partagent le dépôt ; ne pas annuler le travail d'autrui. Réutiliser les résultats effectivement reçus et vérifier leur compatibilité avant intégration.

Ne déléguer que sur demande du coordinateur, dans les limites du runtime. Paralléliser seulement les tâches indépendantes sans écritures concurrentes sur les mêmes fichiers. Six rôles ne nécessitent pas six processus simultanés. Si une revue indépendante requise n'est pas disponible, déclarer la livraison en attente de revue.

## Pipeline cible et conditions de passage
Pour la première version, privilégier un enchaînement séquentiel explicite et traçable.

1. **PM** : brief, hypothèses et critères vérifiables disponibles ; résoudre les ambiguïtés qui changent le périmètre avant la conception dépendante.
2. **UX** : parcours, écrans, accessibilité et états vides, chargement et erreur couvrent les critères prioritaires.
3. **Architecture** : données, contrats, capacités et commandes de vérification sont définis dans le périmètre accepté.
4. **Développement** : sources et instructions de lancement existent dans l'espace du projet et utilisent les livrables amont.
5. **QA** : les critères sont reliés à des contrôles exécutés sur une version identifiée ; échec, succès et non-vérifié restent distincts.
6. **Revue** : un intervenant indépendant examine cette version et décrit les défauts, leur gravité et leurs preuves.
7. **Corrections et livraison** : corriger les défauts bloquants, réexécuter les contrôles concernés et faire revoir les corrections avant de déclarer l'application livrable.

Un message de fin d'agent ne valide pas une étape : contrôler les livrables attendus. Un changement du brief ou d'un livrable amont rend les résultats dépendants à revalider. Aucune confirmation utilisateur systématique entre étapes n'est requise lorsque la suite est déjà autorisée.

## Erreurs, reprise et budget du moteur cible
Conserver côté serveur les identités du projet, de l'exécution et de chaque tentative, les dépendances, versions d'entrée, événements, livrables et preuves. Les transitions de simulation ne prouvent pas une exécution réelle.

Une erreur bloque les étapes dépendantes et conserve diagnostic et sorties partielles. Une reprise crée une tentative identifiable sans effacer l'échec précédent. Après redémarrage, réconcilier l'état avec les processus et fichiers observables ; une issue inconnue ne devient pas un succès.

Une pause empêche de nouvelles missions et laisse la mission active atteindre un point de reprise enregistré ; afficher « pause demandée » tant que ce point n'est pas atteint. Une annulation demande l'arrêt du processus et attend sa confirmation avant de libérer les ressources. Ne pas promettre la suspension puis la reprise en place d'un processus modèle.

Exposer des plafonds de durée, de tentatives et de consommation avant l'activation réelle. Aucun cycle de correction infini ni relance facturable automatique après épuisement du budget. Si la consommation monétaire n'est pas mesurable, le signaler sans garantir de plafond financier. Le stockage, l'adaptateur et les valeurs des plafonds restent à spécifier aux étapes techniques.

## Conventions
TypeScript strict, composants ciblés, HTML sémantique, français, labels de formulaire, navigation clavier, reduced-motion. Valider les données persistées, entrées API et sorties structurées d'agents. Aucune clé dans le navigateur ni secret dans les journaux ou exports. Pas de HTML injecté pour afficher les livrables.

L'aperçu d'une application générée devra s'exécuter isolément de l'interface de l'usine. Le serveur fixe espaces de travail et commandes autorisées ; le navigateur ne fournit ni commande système libre ni chemin arbitraire. Vérifier les chemins résolus, y compris les liens, pour éviter de sortir du périmètre attribué.

## Vérification
Exécuter les contrôles appropriés : `npm run typecheck`, `npm test`, `npm run build`. Vérifier les parcours touchés : création, pause/reprise, dépendances, historique, rechargement et erreurs. Tester le backend avec adaptateur injecté sans facturer de requêtes IA. Ne pas ajouter de tests qui reproduisent simplement du texte documentaire. Revue indépendante avant livraison.

Une étape documentaire est terminée lorsque périmètre, contrats et critères sont cohérents, liens valides et revue indépendante réalisée ; elle ne vaut pas implémentation de la cible. Une livraison applicative exige critères acceptés vérifiés, sources et instructions disponibles, contrôles requis réussis sur la version livrée, revue indépendante sans défaut bloquant ouvert et limites restantes explicites. Le build de l'usine ne valide pas une application générée.

Associer toute preuve à son périmètre, sa version, sa commande ou procédure, son résultat et sa date. Les démos et adaptateurs factices ne prouvent ni appel modèle, ni tests sur une application réellement générée, ni compilation de celle-ci. Sans preuve, indiquer « non vérifié ». Une remise partielle reste identifiée comme telle, sans statut de livraison complète.

## Système et autorisations
Le navigateur ne reçoit pas les outils internes du chat Codex. Le pont CLI actuel reste local, désactivé par défaut et en lecture seule ; ne pas assouplir ses protections pour simuler l'arrivée du moteur de génération. Le futur mode d'écriture exige une isolation et une politique d'outils explicites.

Une session authentifiée et un quota sont nécessaires pour les vrais jobs ; signaler la consommation possible avant activation. Cette étape documentaire n'autorise aucun appel modèle réel ni publication. Les actions locales réversibles nécessaires à une tâche déjà autorisée ne demandent pas une confirmation supplémentaire.

Garder les limites de sécurité et les politiques du parent. Ne jamais contourner les approbations. MCP et skills hérités restent soumis aux capacités du runtime. Aucun serveur MCP externe activé automatiquement. Publications, transmissions externes et opérations irréversibles restent soumises aux autorisations effectives.
