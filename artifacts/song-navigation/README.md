# Transition home -> son

## Defaut reproduit

L'enregistrement Chrome de la navigation montre un frame ou la photo de destination est absente et seul le fond bleu apparait. Le test precedent de handoff WebGL ne mesurait pas les pixels du nouveau document : il ne pouvait pas detecter ce second defaut.

La photo etait deja complete au premier echantillon DOM, mais son decodage asynchrone autorisait un paint sans elle. En ne changeant que son attribut decoding vers sync, le frame vide disparait dans le meme test, avant toute modification des timings.

## Changements

- BessShared.tsx : choix du mode de decodage, async par defaut pour les autres photos.
- BessSongPage.tsx : decoding="sync" uniquement sur la cover du hero.
- BessHomeHero.tsx : agrandissement de 1000 a 650 ms. Sortie des lettres conservee.
- bess.css : suppression des 80 ms de delai initial du titre de destination ; cascade et flou conserves, autres textes apres le titre.
- tests/october-pages.test.mjs : verification du mode de decodage des quatre covers rendues par le serveur.
- scripts/verify-song-navigation.cjs : capture des frames de navigation Chrome, mesure du demarrage du titre et detection du fond bleu seul.

## Resultats

Avant : un frame vide detecte, titre a environ 1,26 s apres le clic.
Apres, Laisse Aller : aucun frame vide detecte ; titre vers 0,77-0,87 s sur les essais normaux, 1,20 s avec reseau ralenti. La navigation native reste dependante du chargement du document, sans attente artificielle supplementaire pour le titre.

Chrome : desktop et mobile emule, cache froid/chaud, latence et debit reduits, mobile sans WebGL ; navigation des quatre morceaux testee. Aucun frame de fond bleu seul detecte dans ces enregistrements.

Playwright WebKit : six parcours Laisse Aller (desktop/mobile, cache froid/chaud et sans WebGL) passent les controles DOM de handoff, asset identique et retour a l'accueil. Ce test WebKit ne capture pas les frames inter-documents comme le test Chrome.

[Avant](before.png) et [apres](after.png) sont des planches chronologiques d'images capturees pendant la navigation. Les chiffres sous les images sont les millisecondes depuis le clic.

## Rejouer

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright OUT=/tmp/song-navigation node scripts/verify-song-navigation.cjs
```

Options : BASE_URL (defaut http://127.0.0.1:4174), WIDTH, WARM=1, SLOW=1, NO_GL=1, SLIDE=0/1/3 pour les autres morceaux. Chrome macOS est utilise. Le seuil temporel du test normal est destine au serveur local, pas a un benchmark de reseau distant.

## Limites

Le detecteur repere la disparition totale de la photo vers le fond bleu ; il ne prouve pas l'absence de tous les changements subtils de luminosite. Le mode sync est une indication au navigateur. Safari reel et iPhone physique non testes. Pas de deploiement en production.
