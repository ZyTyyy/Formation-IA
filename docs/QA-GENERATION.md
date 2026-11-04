# Vérification de l'étape 4 — 4 novembre 2026

## Périmètre et résultat

Rapport du coordinateur `/root`, auteur du lot ; la revue indépendante est dans [REVIEW-GENERATION.md](REVIEW-GENERATION.md). Référence des critères : G-1 à G-8 dans [GENERATION.md](GENERATION.md). Base Git observée avant modifications : `011a9a86bc4fbd4dd7b85ca699eeef3d250f721f`.

Implémentation et frontières vérifiées hors ligne. **Premier appel fournisseur et application réellement générée : non vérifiés** ; la configuration API est absente. L'étape 4 demeure ouverte. Aucun coût de modèle n'a été engagé par les tests, aucun programme généré n'a été installé, compilé ou exécuté. Les fixtures déposées sur disque ne sont pas des applications validées.

## Contrôles exécutés

| Contrôle de l'usine | Résultat observé |
| --- | --- |
| `npm test` | Code 0 : 109 tests réussis, 39 frontend + 13 pont + 29 orchestrateur + 28 génération |
| `npm run typecheck` | Code 0, TypeScript valide |
| `npm run build` | Code 0, Vite : 1 588 modules transformés |
| `python scripts/check_agent_contracts.py` | Code 0 : 6 TOML, 2 schémas, 7 exemples valides et 20 cas invalides rejetés |
| `git diff --check` | Code 0 ; liens locaux vérifiés après réception de la revue |
| `npm run generation:check` | Code 2 attendu : activation désactivée, clé et modèle absents ; aucun appel API |
| Verrou du socle React | Normalisation hors ligne réussie, manifeste et dépendances du verrou cohérents dans le test dédié |

La suite complète a été exécutée avec les permissions nécessaires à Node/Vite pour créer leurs processus de test sur Windows. Une exécution directe dans le contexte restreint avait produit deux attentes expirées ; ce résultat n'est pas utilisé comme preuve de réussite. La suite complète autorisée a ensuite réussi, y compris les 28 cas de génération et le test de propriétaire de journal arrêté. L'erreur de nettoyage de répertoire vide dans une fixture a été corrigée avant cette suite.

## Couverture des frontières

- Chemins absolus, traversée, séparateurs Windows, flux alternatifs, noms de périphériques, fichiers cachés et répertoires réservés rejetés ; collisions de casse et fichier/répertoire rejetées.
- Versions physiques séparées par projet, empreintes vérifiées, refus de modification, absence ou ajout de fichier ; jonctions et hardlinks ne permettent pas d'atteindre un fichier extérieur.
- Manifestes trop grands, empreintes incohérentes, plus de 256 fichiers et dépendances proposées par le modèle rejetés.
- Requêtes successives avec instructions épinglées, seules entrées autorisées, destination fixe, redirections refusées, aucune continuité de session ni outil fournisseur.
- JSON invalide, champ commande, preuve inventée, chemin interdit, doublon et statut incohérent : blocage sans écriture de proposition acceptée ; HTTP 429, erreur réseau, refus, réponse incomplète, outil inattendu et réponse trop grande : aucun rejeu automatique.
- Budget, pause au point de contrôle, timeout, annulation et réponse tardive ; réservation conservée tant que le transport local n'a pas fini.
- Redémarrage sans relance : issue inconnue conservée, réconciliation puis nouvelle tentative explicites ; la réponse ancienne ne peut pas écraser les fichiers de la nouvelle tentative.
- Panne du journal pendant les callbacks fournisseur : moteur indisponible, réservation durable, aucune promesse rejetée non gérée puis reprise en état interrompu.
- Mode immuable, refus d'un contrôleur factice en réel et d'une preuve factice persistée ; QA sans contrôles ne devient pas réussie. Réemploi d'une identité auteur par le reviewer rejeté.

La revue a signalé un P2 de traçabilité : les réponses fournisseur invalides perdaient leur identité et leur consommation observée. Correction : identité `resp_…` et tokens rapportés sont enregistrés avant la validation métier, y compris en cas de refus ou réponse incomplète. Assertions ajoutées dans les cas négatifs et vérifiées. Une erreur réseau ou une interruption avant réception peut toujours laisser l'usage inconnu ; il n'est jamais déduit nul.

## Limites et suite

Le transport n'a pas encore été exercé contre l'API réelle : disponibilité du modèle, acceptation effective du schéma, authentification, quota, qualité du code produit et compilation restent non vérifiés. Le diagnostic peut annoncer un adaptateur configuré ; cela ne prouve pas un appel réussi.

L'isolation de cette étape découle de l'absence d'outils et d'exécution de code généré, plus des écritures contrôlées du serveur. Elle ne protège pas contre un processus local hostile concurrent. Aucun sandbox de commandes clientes, aperçu ou export n'est livré. Arrêt local confirmé ne signifie pas facturation distante interrompue ; aucun plafond financier garanti. La rétention et le quota disque global restent à traiter.

Prochaine vérification requise : configurer localement clé et modèle, lancer `generation:smoke` avec consommation possible connue, consigner run/versions/réponses et laisser QA non vérifiée. La boucle de qualité de l'étape 5 exige ensuite une exécution cliente isolée, des preuves réelles liées à la version et des corrections bornées suivies d'une revue indépendante.
