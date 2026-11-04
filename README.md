# AI Software Factory

Une interface React, TypeScript et Tailwind centrée sur une seule action : décrire son idée d’application. Design sombre inspiré du verre, navigation minimale, préparation automatique en trois étapes et dossier consultable. Interface française, responsive et accessible au clavier. Les six rôles restent internes au moteur.

## Démarrage local

Prérequis : Node.js 20.18 ou version compatible plus récente, npm.

```powershell
npm ci
npm start
```

Ouvrir `http://127.0.0.1:5173`. La commande démarre Vite et l’API Node locale sur le port 4318. `Ctrl+C` arrête les processus. Les ports doivent être libres. Pour le frontend seul : `npm run dev`. Le proxy Vite vise le port API 4318 ; si `PORT` change, adapter aussi `vite.config.ts`.

## Deux modes explicites

**Simulation locale, mode par défaut.** Décrivez votre idée puis choisissez « Créer mon app ». La préparation démarre automatiquement. Trois étapes regroupent les six rôles internes. Retrouvez ensuite le dossier, consultez ses documents et téléchargez-les. « Mes projets » conserve vos idées ; les réglages contiennent les détails avancés. Le moteur déterministe n’appelle aucun modèle. Les exemples sont étiquetés. Les documents sont des modèles de préparation, pas du code développé, des tests passés ou une revue réelle. Les projets sont sauvegardés dans le navigateur ; un rechargement met les simulations en pause. L’export JSON est une sauvegarde consultable ; l’import n’est pas implémenté.

**Missions Codex réelles, option locale.** Le backend peut lancer une analyse réelle avec le CLI, affectée à l’un des six rôles. Il ne lance pas un cycle de génération d’application et ne pilote pas les sous-agents internes de ce chat. Aucun résultat réel n’est remplacé par une simulation en cas d’échec.

Pour activer le pont, après connexion au CLI et vérification du quota :

```powershell
codex login
$env:CODEX_BRIDGE_ENABLED = '1'
npm start
```

L’authentification et la consommation éventuelle de quota dépendent de votre compte Codex. Aucune clé n’est demandée par l’interface. `.env.example` documente les variables ; les fichiers `.env` ne sont pas chargés automatiquement. Si nécessaire, définir `CODEX_BIN` avec le chemin absolu de `codex.exe`. Pour désactiver le pont, arrêter le serveur, définir `CODEX_BRIDGE_ENABLED=0` et relancer.

Le pont utilise les options disponibles dans le CLI inspecté `0.166.0-alpha.5.1`. Il ignore la configuration personnelle, désactive sous-agents, apps, plugins, mémoires et outil de demande de permissions, conserve l’authentification et applique le sandbox lecture seule. Le shell du sandbox reste disponible pour inspecter le dépôt. La configuration de projet livrée ne déclare aucun MCP. Ajouter un serveur MCP ou modifier les règles impose une nouvelle vérification des capacités : un sandbox de fichiers ne garantit pas la lecture seule d’un service distant.

Une seule mission réelle est admise, durée maximale 120 secondes, sortie limitée, arguments fixes et prompt transmis via stdin. Si l’arrêt après timeout n’est pas confirmé, le job échoue et le pont reste bloqué explicitement ; vérifier le processus avant de redémarrer le serveur. Les jobs et leurs résultats restent en mémoire (50 maximum), jusqu’au redémarrage du serveur ; le frontend les conserve pendant la session ouverte. Exportez les résultats utiles.

## Vérifier et compiler

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

`npm test` exécute les tests Vitest et Node. Les tests du pont utilisent un adaptateur injecté, sans appel IA et sans coûts de modèle. Les détails et limites réellement observés figurent dans [docs/QA-UX.md](docs/QA-UX.md) et [docs/REVIEW-UX.md](docs/REVIEW-UX.md). Le build statique est produit dans `dist/`.

## Équipe Codex réelle

Les six rôles ont reçu des missions par les outils natifs de délégation pendant cette construction, par vagues de trois sous-agents au maximum. Les preuves et contributions sont résumées dans [docs/EXECUTION.md](docs/EXECUTION.md). Les cartes de l’interface sont indépendantes de ces sessions.

`AGENTS.md` définit les consignes communes. `.codex/agents/*.toml` définit chaque rôle, sa mission et ses livrables pour les versions Codex compatibles. `.codex/config.toml` fixe un plafond de trois sous-agents ; la limite et les permissions du runtime parent restent prioritaires. Aucun modèle payant ni serveur MCP n’est imposé par le dépôt.

## Structure

```text
src/domain.ts                 Règles et moteur de simulation
src/storage.ts                Validation et sauvegarde versionnée
src/App.tsx                   Navigation et orchestration de l’interface
src/components/               Demande, dossier, bibliothèque et réglages
src/useRealJobs.ts            Suivi réel indépendant de la page affichée
server/app.mjs                API HTTP, contrôles Host/Origin et validation
server/bridge.mjs             Adaptateur CLI et cycle de vie des missions
.codex/agents/                Six rôles réutilisables
docs/                         Produit, UX, architecture, QA et revue
```

## Hébergement et limites

Le build est prêt pour un hébergement statique privé Sites, mais sa publication n’a pas été autorisée par la vérification automatique : l’accord explicite de l’utilisateur pour l’envoi du code vers cette destination externe reste nécessaire. Aucun code n’a été poussé. Une fiche Site privée non publiée a été créée ; son identifiant est conservé dans `.openai/hosting.json` pour reprendre sans doublon.

Une version hébergée conserverait les simulations dans le navigateur et n’accéderait pas au serveur local du visiteur. Les missions CLI réelles nécessitent la version lancée localement avec son backend. Il n’y a pas de compte applicatif, de base multi-utilisateur, de synchronisation cloud, de génération de code autonome depuis un brief, ni d’orchestration d’écriture dans ce MVP.

Configuration des rôles et CLI vérifiés avec la [documentation officielle des sous-agents](https://learn.chatgpt.com/docs/agent-configuration/subagents), la [référence de configuration](https://learn.chatgpt.com/docs/config-file/config-reference) et le [mode non interactif](https://learn.chatgpt.com/docs/non-interactive-mode).
