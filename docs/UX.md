# UX — AI Software Factory

## Intention

Un atelier logiciel lisible : comprendre le projet en cours, repérer la prochaine étape et ouvrir les livrables. L’interface est intégralement en français ; les noms officiels des six rôles restent visibles pour correspondre aux consignes de délégation.

## Navigation et hiérarchie

- **Tableau de bord** : synthèse des projets, progression, dernier résultat et action « Nouveau projet ».
- **Projets** : liste filtrable, sélection d’un projet et accès à son brief, son pipeline et ses tâches.
- **Équipe IA** : six fiches de rôle présentant mission, entrées, livrables attendus et mécanisme utilisé.
- **Historique** : événements horodatés, projet concerné, provenance et ouverture des résultats.
- **Connexions** : état du backend local, disponibilité déclarée du CLI et prérequis d’une connexion réelle.

La barre latérale sombre porte la navigation. Le contenu commence par le titre de page, une explication courte et l’action principale. Les états et chiffres doivent provenir du magasin de données ; les données initiales sont identifiées comme exemples.

## Parcours principal

1. **Tableau de bord → Nouveau projet** : un bouton explicite ouvre un formulaire. L’état vide propose la même action avec une phrase expliquant son utilité.
2. **Brief** : nom obligatoire, description obligatoire, type de projet et priorité. Les champs ont des labels persistants, limites de longueur et messages d’erreur associés. Conserver la saisie lors d’une erreur. « Créer le projet » enregistre le brief puis affiche le projet créé.
3. **Simulation** : le bouton porte le texte « Lancer la simulation ». Une mention voisine précise « Exécution locale déterministe, sans appel à un modèle IA ». Les tâches avancent selon leurs dépendances. Une progression visuelle ne vaut jamais preuve d’activité d’un véritable sous-agent.
4. **Tâches** : chaque ligne montre intitulé, responsable, état textuel et livrable. Sélectionner une tâche ouvre son contexte et son résultat disponible. Une tâche terminée pendant une simulation reste marquée « Simulé ».
5. **Livrables** : aperçu lisible, provenance, date, rôle et projet. Copier ou exporter le résultat fournit un retour de succès ou d’échec. L’historique permet de le retrouver après rechargement.

## Pipeline des six rôles

Ordre par défaut : Product Manager → UX Designer → Software Architect → Fullstack Developer → QA Engineer → Code Reviewer. Sur grand écran, une ligne relie six étapes compactes ; sur mobile, la même séquence devient verticale. Chaque étape affiche un numéro, un nom, un état et le livrable attendu. Les états sont « En attente », « En cours », « Terminé » et « Échec » ; un libellé de provenance distinct indique « Simulation » ou « Exécution réelle ».

Les fiches expliquent que les rôles configurés ne sont pas des processus autonomes continuellement actifs. Un résultat réel exige un événement et une sortie du mécanisme réellement appelé. Les délégations effectuées pour construire ce dépôt ne deviennent pas des exécutions du projet utilisateur.

## Direction visuelle et tokens

| Usage | Valeur |
| --- | --- |
| Fond de l’application | `#F6F5F1` |
| Surface de contenu | `#FFFFFF` |
| Texte principal | `#222620` |
| Texte secondaire | `#62675E` |
| Barre latérale | `#20251F` |
| Texte de navigation | `#F6F5F1` |
| Accent / action principale | `#A84320` avec texte blanc |
| Bordure | `#DDDFD7` |
| Succès | `#276443`, accompagné d’un libellé |
| Erreur | `#A82D2D`, accompagnée d’un message |
| Espacements | multiples de 4 px ; 16–24 px entre blocs |
| Rayons | 6 px pour champs/boutons, 10 px pour panneaux |
| Typographie | pile système sans-serif ; 14–16 px pour le corps |

Privilégier des surfaces sobres, des tableaux lisibles, des bordures fines et une seule action dominante par contexte. Les titres courts et les chiffres utilisent une hiérarchie nette. Les accents orange signalent une action ou une sélection, sans recouvrir toutes les cartes.

## Accessibilité et adaptation

- Utiliser des liens, boutons, listes, labels et titres sémantiques ; un seul `h1` par vue.
- Assurer un contraste AA, un focus visible et des cibles tactiles d’au moins 44 px pour les actions principales.
- Une boîte de dialogue native gère le focus, permet Échap et rend le focus au déclencheur à sa fermeture.
- Les erreurs utilisent `aria-describedby` ; les confirmations utilisent une région `aria-live="polite"` sans annoncer chaque changement de compteur.
- Tous les états comprennent du texte et éventuellement une icône ; la couleur ne porte aucune information seule.
- Respecter `prefers-reduced-motion`. Éviter toute animation permanente donnant une fausse impression d’agent actif.
- Vérifier 320, 768, 1024 et 1440 px : navigation repliable, cartes en une colonne sur téléphone, formulaires sans débordement. Les tableaux larges disposent d’un défilement identifié.
- Prévoir des états vides, un stockage local indisponible, un backend absent et un appel réel échoué avec action de reprise appropriée.

## Transparence des connexions et des coûts

Afficher séparément « Simulation disponible », « Backend local connecté / indisponible » et « Codex CLI détecté / non détecté ». La détection d’un exécutable ne prouve ni authentification ni capacité d’appeler un modèle. Avant une exécution réelle, montrer le rôle, le périmètre, les identifiants requis et le fait qu’une consommation du compte ou une facturation fournisseur peut s’appliquer. Ne jamais afficher un coût estimé comme une dépense mesurée.

Les identifiants ne sont pas saisis dans une simulation ni stockés dans le navigateur. Une connexion nécessitant une configuration système affiche des instructions concrètes ; une action indisponible conserve son explication visible. La version hébergée ne doit pas prétendre accéder au CLI de la machine du visiteur.

## Critères de validation UX

Le parcours création → simulation → résultat est réalisable au clavier ; un projet persiste après rechargement ; chaque résultat affiche sa provenance ; les six missions sont consultables ; aucune action ne laisse l’utilisateur sans retour ; l’interface ne déborde pas à 320 px ; un backend absent ne bloque pas la simulation.
