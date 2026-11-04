# Revue indépendante — simplification UX

Périmètre : `src/App.tsx`, `Composer.tsx`, `ProjectWorkspace.tsx`, `Library.tsx`, `Settings.tsx`, `ui.tsx`, `styles.css`, et lecture des règles de domaine et de persistance conservées. Revue de code uniquement, sans modification de l’application, sans exécution de tests, de navigateur ou d’appel modèle.

## Résultat

Aucun défaut bloquant identifié dans le parcours simplifié « idée → préparation automatique → dossier ». Les six tâches internes restent cohérentes avec les trois étapes présentées à l’utilisateur ; aucune gestion d’agents n’est nécessaire dans le parcours principal.

Revue clôturée après vérification de la correction du point de libellé suivant :

- **P3 résolu — Confirmation de sauvegarde trop générale.** Le footer annonçait auparavant « Enregistré sur cet appareil » même lorsque le stockage échouait. `src/App.tsx:70` choisit désormais « Session temporaire · export conseillé » si `storageError` est présent. Le test de régression dans `src/App.test.tsx:79` provoque un refus d’écriture et vérifie l’alerte ainsi que l’absence de fausse confirmation. Correction cohérente à la lecture ; aucun défaut bloquant restant identifié dans ce périmètre.

## Vérifications à la lecture

- `Composer.tsx:15-18` utilise un vrai formulaire, un label accessible, des bornes de saisie et un bouton désactivé pour un brief trop court ; Ctrl/Cmd+Entrée passe par `requestSubmit()`.
- `App.tsx:46-52` valide le projet avec le domaine avant de démarrer la simulation et d’ouvrir son espace. Les exceptions sont affichées dans le formulaire.
- `App.tsx:36-40` poursuit la simulation dans la session, et `storage.ts:30` remet un projet actif en pause au rechargement. La reprise reste explicite.
- `ProjectWorkspace.tsx:20` regroupe les documents par deux, ce qui correspond aux trois étapes et aux six tâches du moteur. Le dernier document est créé au même passage que l’état `completed`.
- Le dossier final contient les six documents réellement présents en mémoire. Les documents intermédiaires sont consultables au fur et à mesure. Aucun HTML utilisateur n’est injecté.
- `Composer.tsx:23`, `ProjectWorkspace.tsx:19,24` et `Settings.tsx:27` exposent le mode de démonstration et l’absence de génération d’application fonctionnelle. Les animations ne sont pas présentées comme des agents IA réels.
- La bibliothèque filtre les projets sans modifier leur contenu. L’export JSON inclut l’enveloppe versionnée et les projets persistants.
- Les contrôles principaux sont natifs (`button`, `textarea`, `details`, `summary`). Les titres reçoivent le focus après navigation ; les fenêtres utilisent `dialog.showModal()` avec fermeture Échap et bouton nommé.
- Les styles prévoient focus visible, réduction des animations, contraste renforcé et réduction de la transparence. Les contrôles navigateur restent distincts de cette revue de code.
- La connexion CLI est rangée dans les réglages avancés. Le consentement de quota, le pont activé, la disponibilité du CLI et l’absence de mission active conditionnent le bouton réel. L’API et le backend restent l’autorité de validation.
- `Settings.tsx:29` limite correctement sa promesse d’isolation à la configuration livrée, sans prétendre qu’un futur serveur MCP serait automatiquement neutralisé.
- Le suivi réel reste détenu par `useRealJobs` dans `App`, donc fermer les réglages n’arrête pas le suivi. Les résultats réels sont étiquetés et leur conservation en mémoire est annoncée.

## Limites

Cette passe n’a exécuté aucun test. Le coordinateur a rapporté 52 tests réussis (39 frontend, 13 backend), un build TypeScript/Vite réussi, ainsi que les contrôles navigateur du parcours automatique, du dossier, d’Échap dans la modale, du focus de navigation et des largeurs 320/768/1024/1440 px. Ces résultats sont rapportés par le coordinateur ; leurs détails appartiennent au rapport QA.

Le backend n’a pas été modifié ni réaudité intégralement dans cette passe. Les contrôles effectifs du CLI authentifié, la facturation, la compatibilité entre plusieurs moteurs de navigateur et le comportement des téléchargements n’ont pas été exercés par le reviewer. Aucun appel modèle ou coût n’a été déclenché par la revue.
