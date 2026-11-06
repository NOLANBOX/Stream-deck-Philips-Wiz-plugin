# Philips WiZ Control pour Stream Deck

Ce plugin contrôle directement une ampoule Philips WiZ depuis une touche Stream Deck, sur le réseau local. Une même action peut être ajoutée plusieurs fois et configurée pour :

- basculer, allumer ou éteindre la lumière ;
- augmenter, réduire ou fixer la luminosité ;
- réchauffer, refroidir ou fixer la température de couleur.

Le bouton affiche l'état réel de l'ampoule et l'actualise automatiquement toutes les dix secondes.

## Prérequis

- Stream Deck 7.1 ou plus récent sur Windows 10+ ou macOS 12+ ;
- une ampoule Philips WiZ et l'ordinateur sur le même réseau local ;
- l'adresse IP de l'ampoule, idéalement réservée dans le routeur.

Certains firmwares WiZ récents exigent une clé de signature UDP. Le champ avancé du plugin accepte la clé hexadécimale de 32 caractères fournie par l'intégration locale WiZ. Elle est enregistrée en clair dans les réglages locaux de l'action et peut donc être incluse dans un profil, une sauvegarde ou un export Stream Deck. Ne partagez pas ces fichiers sans retirer la clé.

## Installation

1. Téléchargez `com.nolanbox.philips-wiz.streamDeckPlugin` depuis le dossier `dist/` ou depuis une version publiée.
2. Double-cliquez sur le fichier et confirmez l'installation dans l'application Stream Deck.
3. Recherchez **Philips WiZ Control** dans la liste des actions.

## Utilisation

1. Ajoutez l'action **Lumière WiZ** à une touche.
2. Saisissez l'adresse IP ou le nom réseau de l'ampoule.
3. Choisissez l'opération et, si nécessaire, la valeur ou le pas.
4. Appuyez sur la touche. Un avertissement apparaît si l'ampoule ne répond pas.

Le port WiZ standard est `38899`. La plage de luminosité est limitée à 10–100 %. La température est limitée à 2200–6500 K ; la plage réellement prise en charge dépend du modèle d'ampoule.

## Développement

```sh
npm ci
npm run check
npm run pack
```

Le paquet installable est créé dans `dist/`. Pour le développement avec l'application Stream Deck installée, liez d'abord `com.nolanbox.philips-wiz.sdPlugin` avec l'outil `streamdeck`, puis utilisez `npm run watch`.

Les tests automatisés couvrent le protocole WiZ, les commandes relatives, la signature HMAC et un échange UDP local. Un test final avec une vraie ampoule et l'application Stream Deck reste nécessaire, car ces deux éléments ne sont pas disponibles dans l'environnement cloud.
