# Transfert vers l'iMac

Ce dossier contient la copie autonome du projet et tous ses assets locaux.

## Prerequis

- Node.js 22 LTS (22.13.0 minimum) ou Node.js 24+
- npm
- Une connexion Internet lors de la premiere installation des dependances

## Installation

Dans Terminal, ouvrir ce dossier puis lancer :

```sh
npm ci
npm run dev
```

La galerie sera disponible sur `http://localhost:3000/v13`.

## Contenu important

- `app/` : toutes les versions de la galerie, de `v1` a `v13`
- `public/gallery-01.jpg`, `public/gallery-02.jpg`, `public/gallery-03.jpg` : images de la galerie
- `package.json` et `package-lock.json` : dependances exactes
- `.openai/hosting.json`, `vite.config.ts` et `worker/` : configuration du projet

Aucun fichier `.env` n'est requis. Aucun asset du site ne pointe vers le Bureau ou vers un chemin absolu de l'ancien Mac.
