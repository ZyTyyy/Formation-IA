# Revue indépendante — contrats des six rôles

Date : 4 novembre 2026. Reviewer : sous-agent `review_contracts`, distinct du coordinateur auteur du lot. Revue documentaire et structurelle de la copie locale non commitée ; aucune génération réelle n'est évaluée ici.

## Périmètre

Lecture de `AGENTS.md`, `docs/PRODUCT.md`, `docs/ROADMAP.md`, `docs/AGENT-CONTRACTS.md`, des six fichiers `.codex/agents/*.toml`, des deux schémas et des exemples de `contracts/`, et de `scripts/check_agent_contracts.py`. La comparaison avec le pont existant porte sur le maintien de l'analyse en lecture seule, le rôle des descriptions `ROLES` et l'absence de chargement des contrats par ce pont.

Seul ce rapport est modifié par le reviewer. Les corrections des autres fichiers appartiennent au coordinateur. L'indépendance est celle d'une invocation de revue distincte ; cette revue de conception ne démontre pas la future séparation des sessions imposée par le moteur.

## Constats traités

### P2 résolu — Les patterns acceptaient une fin de ligne dans les identifiants et chemins

Fichiers : `contracts/agent-mission.schema.json` et `contracts/agent-result.schema.json`, patterns terminés par `$` (notamment `missionId` et `expectedArtifacts`).

Reproduction observée avec le validateur JSON Schema 2020-12 : charger la première mission d'exemple et remplacer `missionId` par `example-pm-1\n`, ou `expectedArtifacts` par `["docs/PRODUCT.md\n"]`. Les deux objets sont acceptés. L'ancrage `$` permet une correspondance avant un saut de ligne terminal.

Impact : des références non canoniques passent la validation de structure et peuvent échouer au moment de résoudre les identifiants ou fichiers. La validation sémantique future ne doit pas avoir à accepter ces variantes. Ce constat ne démontre aucune sortie du sandbox actuel.

Correction vérifiée : les patterns se terminent désormais par une assertion de fin absolue `(?![\s\S])`. Le script couvre les fins de ligne dans un chemin, un identifiant de mission et un identifiant de résultat. Sa nouvelle exécution retourne le code 0 avec vingt cas invalides rejetés. Aucun constat restant sur ce point.

### Clarification du protocole de références

`docs/AGENT-CONTRACTS.md:65` définit désormais le point de retour des références avant le JSON final : `capture_artifacts(paths)`, `run_check(commandId, criterionIds)` et `read_evidence(evidenceId)`. Le serveur devra vérifier permissions et budgets, conserver les preuves hors écritures d'agents et bloquer avec `CAPABILITY_UNAVAILABLE` si ces opérations ne peuvent être exposées. Clarification relue et suffisante pour le contrat ; les outils restent à implémenter aux étapes 3 et 4.

L'exemple reviewer inclut désormais `.evidence/changes.diff` dans ses entrées et ses chemins lisibles. L'exemple PM `ready` ne déclare aucun contrôle exécuté. Les fixtures restent explicitement fictives et ne constituent pas un pipeline réellement exécuté.

## Vérifications observées

Le reviewer a exécuté `python scripts/check_agent_contracts.py` avant et après correction. Dernier résultat : code 0, six TOML valides, deux schémas valides, sept exemples valides et vingt cas invalides rejetés. Les prérequis Python 3.11+ et `jsonschema` sont documentés ; le contrôle n'installe aucun paquet.

Le reviewer a exécuté la reproduction spécifique des sauts de ligne : les deux objets invalides indiqués ci-dessus sont acceptés dans la version initialement relue. `git diff --check` retourne le code 0 avec des avertissements de conversion de fins de ligne LF vers CRLF.

Contrôles rapportés par le coordinateur le 4 novembre 2026, non réexécutés par le reviewer : `npm run typecheck` code 0 ; `npm test` code 0, 39 tests frontend et 13 tests backend, soit 52 réussites ; `npm run build` code 0, Vite et 1 588 modules. La résolution des liens Markdown locaux dans AGENTS, PRODUCT, ROADMAP et AGENT-CONTRACTS a également réussi, code 0. Ces contrôles portent sur l'usine actuelle. Le reviewer n'a lancé ni navigateur, ni CLI Codex, ni appel modèle, ni test d'isolation système.

## État de la revue

Aucun défaut bloquant ni constat correctif ouvert dans le périmètre relu. La clôture finale de `docs/ROADMAP.md` a été relue : l'étape 2 est terminée pour les contrats, le moteur reste explicitement non implémenté, les contrôles sont attribués au coordinateur et les étapes 3 à 6 restent à réaliser.

Les statuts, dépendances et droits sont définis comme contrats cibles ; aucun validateur serveur, chargeur de TOML, stockage d'exécution ou pipeline réel n'est validé par cette revue. Les capacités et tests sémantiques des étapes 3 à 6 restent à réaliser.

## Version finale relue

Empreintes SHA-256 des fichiers locaux au terme de la relecture, sans commit de livraison créé par le reviewer :

| Fichier | Empreinte |
| --- | --- |
| `AGENTS.md` | `2586FB9D7EDA3A4F793AB737430A4EF2F55720E55D3D46DDFA2B0E229792073B` |
| `docs/PRODUCT.md` | `225EE927B8F6C990DF33591AB3AD704FDA424E1903126006B6C26BE064DFD128` |
| `docs/ROADMAP.md` | `6893D27BFDA9167C6CCB155A5DFF5CB119C9F026C9F4BA1F5B32DB19E3D6AEFB` |
| `docs/AGENT-CONTRACTS.md` | `F0005A17FA8F311ADC726EFAE004C8A13AA2AF5F45DDCAE579C7DBDE1EBB7A03` |
| `contracts/agent-mission.schema.json` | `C5A274F699992D4A42DE57E81C5313BF0EF8A028AD4F08FD0471CBDA28BFAACC` |
| `contracts/agent-result.schema.json` | `BFF588126D52F345B838A23AD7A93CD4711C43D429229BDC1A735AB27F154E1A` |
| `contracts/agent-contract-examples.json` | `F575CFF68EC43E69B1F5381F02D9C0247A5D0F91B5CF87B8EF9A07A947365567` |
| `scripts/check_agent_contracts.py` | `61FB3E5A875F44F99F58EE98F6CD4A231A93BEEEF80516BB925FDC1567F24FD6` |
| `.codex/agents/code_reviewer.toml` | `63FC65B0FCCAA0C32A531705C39EDB6851B0814F78FB7F7E8A3266C4A191BDF3` |
| `.codex/agents/fullstack_developer.toml` | `ACEB7E2EF22B006BEEBA9CF6617A3606678CF076152199B90B777F352029EB96` |
| `.codex/agents/product_manager.toml` | `7602EF46ACB610DFBE3A7F3A8458319731A08617341729F161A73EBE6B257116` |
| `.codex/agents/qa_engineer.toml` | `E7035CD0F22E4551B191A40A3D3AE3B26C12811B3292E85D79870878FC4A5F45` |
| `.codex/agents/software_architect.toml` | `FAD506ACC25FD355B022BD7C16AD42DE636A0B7402BF4CBDF8E39CE188A8EA4B` |
| `.codex/agents/ux_designer.toml` | `E5A76D537EECB3AADAC4EDD843E3686A461A9C166E810357690B774A0B2C63A6` |
