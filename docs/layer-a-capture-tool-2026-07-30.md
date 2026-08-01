# Brief — Couche A : mémoire commerciale datée des offres x402 payantes

> **Provenance.** Promu depuis `.exchange/codex/layer-a-capture-brief.md` le 2026-08-01, sans modification du corps. Motif : il explique pourquoi `scripts/layer-a-capture.mts` existe. À lire avec une réserve à jour au 2026-08-01 : **rien ne planifie cet outil**, il a tourné une seule fois, le 2026-07-31, et l’axe 1 de la doctrine suppose une capture répétée.

Destiné à une conversation Claude Code dédiée, ouverte sur `C:\Dev\AgHub`, en parallèle du
travail sur le Complaint Bureau. Autorisé par Samy le 2026-07-30.

À coller tel quel comme premier message de cette conversation.

---

## But

Faire passer la mémoire commerciale datée d'un relevé manuel unique à une capture répétable
et stockée. C'est l'axe 1 de `docs/DOCTRINE.md` : préserver des faits commerciaux que les
grandes plateformes n'archivent pas et qui disparaissent avec le temps.

**L'horloge est le seul argument d'urgence.** La source amont retire de ses résultats toute
ressource sans activité depuis trente jours. Ce qui n'est pas capturé le jour où on le voit
n'est pas récupérable plus tard : un jour sans capture n'est pas un retard, c'est une donnée
détruite. Ne pas transformer ce chantier en refonte — la capture d'aujourd'hui vaut plus
qu'un système parfait la semaine prochaine.

## Ce qui existe déjà, et qu'il ne faut PAS réécrire

1. **Un premier corpus manuel** : `docs/layer-a-x402-corpus-2026-07-30.md`, dix-huit offres
   payantes relevées le 30 juillet avec leurs termes annoncés, leur date d'annonce, leur
   publication d'origine et ce que leur surface répondait ce jour-là. C'est la référence de
   format ; tout ce qui est capturé ensuite doit être compatible avec ces colonnes.
2. **Le carnet d'observations** : `observations/2026-07.jsonl` et son `README.md`. Vingt-deux
   entrées, append-only, avec un degré de vérification obligatoire (`signed`, `onchain`,
   `observed`, `reported`, `secondhand`). Une capture d'offre relève de `observed` et doit
   porter sa méthode.
3. **Et surtout : la machinerie de preuves append-only déjà en place** — `lib/evidence-store.ts`,
   `lib/evidence-history.ts`, `lib/evidence-manifest.ts`, table `evidence_observations`, et sa
   documentation `docs/EVIDENCE-HISTORY.md`. Elle fait exactement ce que la couche A demande :
   elle n'écrit une observation **que si l'empreinte normalisée change**, en excluant les
   horodatages et les compteurs de cette empreinte, et elle chaîne chaque observation à la
   précédente avec un résumé du changement.

**Le travail est donc du branchement, pas une construction.** Si tu te retrouves à concevoir
un nouveau schéma de stockage, arrête-toi : la bonne question est « quel `source` et quels
`facts` pour une offre x402 dans `evidence_observations` », pas « quelle table créer ».

## Ce qu'une observation d'offre doit retenir

Ce que le vendeur a **annoncé** à une date, recopié tel que publié, sans correction ni
interprétation : prix, réseau, actif, adresse encaisseuse, périmètre annoncé, format de sortie
promis, hôte. Plus ce que sa surface répondait le jour de la lecture, en lecture seule, sans
paiement ni authentification.

Le fait qui vaut le plus est le **changement silencieux** : un prix qui bouge, une adresse
encaisseuse qui change de main, un catalogue annoncé comme librement consultable qui exige
soudain un paiement. Le corpus du 30 juillet en contient déjà un cas de ce dernier type. C'est
la seule chose qu'un concurrent futur ne pourra pas reconstituer.

## Interdits, non négociables

- **Aucune valeur calculée stockée.** Ni score, ni rang, ni similarité, ni indice de confiance.
  Deux nombres inventés ont déjà été supprimés du produit pour cette raison exacte. Un
  changement observé se raconte par ses deux valeurs datées, jamais par un écart qu'on note.
- **Aucun paiement, aucune authentification** pendant la capture. On lit ce qui est public.
- **Ne nommer un vendeur commercialement que si un lien observable le soutient.** Sinon montrer
  la ressource et l'adresse encaisseuse, avec le degré de vérification.
- **Pas de photographie quotidienne du catalogue entier.** L'économie du modèle est l'écriture
  au changement ; un instantané de masse est exclu par construction.
- Pas de migration appliquée en production, pas de commit, pas de push, pas de déploiement sans
  autorisation explicite de Samy dans cette conversation-là.

## Ordre de marche suggéré

Commence par la capture d'aujourd'hui sur le corpus existant, à la main s'il faut, pour ne rien
perdre. Ensuite seulement, rends-la répétable. Une capture faite vaut mieux qu'un mécanisme
prévu.

## Définition de fini, pour une première session

Les dix-huit offres du corpus initial sont relues aujourd'hui, les écarts avec le 30 juillet
sont datés et enregistrés, et il existe une commande unique qui refait ce tour. Dis clairement
ce qui a changé depuis le 30 juillet, ce qui a disparu, et ce que tu n'as pas pu vérifier.

Termine par les sections obligatoires du protocole de délégation : `SUMMARY`,
`OPINIONS & DISAGREEMENTS`, `REFUSED ACTIONS`, `FILES TOUCHED`, `SUGGESTED NEXT`.
