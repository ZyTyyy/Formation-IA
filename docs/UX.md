# Expérience Factory — refonte simplifiée

L’utilisateur décrit l’application souhaitée. Il ne configure et ne gère aucun agent.

## Parcours principal
1. Accueil : un seul champ de demande, trois inspirations facultatives, bouton « Créer mon app ». Aucun nom, type ou priorité à renseigner.
2. Préparation : démarrage automatique et trois étapes en langage courant (comprendre, préparer, vérifier). Une pause facultative et une reprise sont disponibles. Les six tâches internes restent ordonnées.
3. Résultat : dossier de préparation à télécharger et documents consultables. Le résultat est explicitement une démonstration sans code applicatif généré.

## Navigation et information
Deux entrées seulement : Créer et Mes projets. Les réglages, secondaires, expliquent le mode démo et proposent la connexion Codex avancée. Les rôles et leurs consignes restent dans le dépôt. Aucun dashboard d’agents, tableau de tâches ou compteur technique dans le parcours principal.

Les projets existants sont conservés au format de stockage v1. Une nouvelle session vierge ne crée plus de projets d’exemple automatiquement. Les simulations actives sont mises en pause au rechargement. Une erreur de stockage affiche un avertissement et un export ; le footer indique alors une session temporaire.

## Direction visuelle
Fond encre #080a10, typographie système Apple/Segoe, accents bleu perle et champagne. Surfaces translucides à contour fin, reflets internes, flou mesuré et coins doux. Aucun dégradé ne compromet le contraste des contrôles ou du texte courant. Pas de barre latérale ni grille de cartes blanches.

## Accessibilité
HTML sémantique, labels explicites, cible principale visible, focus contrasté et déplacement du focus vers le titre à la navigation. Dialogues natifs avec fermeture Échap et restauration du focus. Suivi vocal discret du nombre de documents. États identifiés par le texte. Clavier Ctrl/Cmd+Entrée pour envoyer une demande valide. Les préférences reduced-motion, reduced-transparency et contraste renforcé sont prises en compte. Vérification aux largeurs 320, 768, 1024 et 1440.

## Transparence
Le bouton de création démarre le moteur déterministe existant. Une mention près du champ annonce la portée démo. Le dossier n’est jamais présenté comme une application compilée. L’analyse réelle dans les réglages reste facultative, en lecture seule, avec consentement explicite au quota et pont désactivé par défaut.
