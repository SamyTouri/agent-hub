---
title: EvalLayer — l'évaluateur qui a essayé sérieusement, gagné 2,47 $ sur quatre mois, et changé de métier
type: acteur
updated: 2026-08-04
---

# EvalLayer — le meilleur cas d'école du siège vide

Résout la contradiction posée le matin du 2026-08-04 entre notre mesure (75 évaluateurs
enregistrés, aucun revenu) et l'annonce d'EvalLayer (190 à 246 évaluations traitées). Complète
[[2026-08-01-siege-evaluateur-vide]] et [[qui-tient-le-terrain-de-la-livraison]].

## La résolution, dans leurs propres mots

**MESURÉ le 04/08** sur `evallayer.ai/ecosystem`, page publique et datée sans ambiguïté :

> *« EvalLayer's engine shipped first as an autonomous evaluator inside the Virtuals Agent
> Commerce Protocol on Base mainnet. […] 247 on-chain evaluation jobs settled (Mar–Jun 2026).
> $0.01 USDC per verdict, paid by agents. »*

**Le rôle d'évaluateur a fonctionné quatre mois, s'est arrêté en juin, et rapportait un cent par
verdict.** 247 jobs × 0,01 $ = **2,47 $ de revenu total, sur toute la durée du déploiement.**

Le site actuel classe lui-même ce déploiement comme **« historical… not part of the commercial
Authorize/Evaluate product »**. EvalLayer vend aujourd'hui une API d'autorisation d'actions et
d'évaluation post-hoc, en abonnement mensuel classique — **Free (0 $), Pro (99 $/mois), Enterprise
(499 $/mois et plus)**, avec une option de paiement à l'appel en x402 (0,01 $ par décision), et un
export de données payant. Rien de tout ça ne transite plus par ACP ni par un escrow on-chain.

## Ce que ça change pour notre mesure du 01/08

**Rien à la conclusion, tout à la solidité de l'exemple.** Nos 75 agents enregistrés sans revenu et
les 2,47 $ lifetime d'EvalLayer racontent la même histoire par deux méthodes indépendantes : le
siège d'évaluateur payé ne fait pas vivre son occupant, même sérieux.

C'est même un exemple plus fort que le nôtre, parce qu'EvalLayer n'est pas un candidat passif :
c'est un constructeur qui a bâti un vrai pipeline (extraction de revendications, appariement de
preuves, score de qualité), a été salué publiquement par l'agent officiel de Virtuals (« Butler »)
pour avoir détecté un faux partenariat OpenAI et une fausse revendication de décentralisation sur
Base, et a **quand même quitté le rôle** pour vendre le même jugement en abonnement classique.

**Ce qui reste non tranché** : si les 2,47 $ figuraient dans le champ de revenu qu'on a lu le 01/08
ou dans une comptabilité séparée. Vu le montant, la question n'a plus d'enjeu pratique — mais elle
reste techniquement ouverte.

## Précision de méthode qu'on retient

**Ce qu'on avait appelé « l'implémentation de référence » de la norme n'est peut-être pas
littéralement le contrat déployé par Virtuals ACP.** Le texte normatif ERC-8183 qu'on a lu ligne à
ligne dit que l'évaluateur n'est payé que sur approbation. Le taux annoncé ici — 0,01 $ **par
verdict**, payé par les agents — pourrait décrire soit ce même mécanisme (le taux affiché est le
tarif en cas d'approbation), soit un tarif fixe versé quel que soit le verdict, ce qui protégerait
justement contre l'incitation au silence qu'on a documentée. **Rien dans les pages publiques
d'EvalLayer ne tranche laquelle des deux c'est.** À vérifier avant toute affirmation ferme sur le
mécanisme réel d'ACP par opposition au texte générique de la norme.

## Correction sur les publications déjà faites

Deux commentaires publiés le 04/08 (`168ec9a7-…` et `dd9e3ea9-…`, en fil sur
`fb7895a1-b6aa-4f25-8eb6-9ab8bcb9f94b`) posent la question puis apportent la réponse trouvée sans
attendre de réaction — demande explicite de Samy de ne pas laisser la recherche dépendre d'un tiers
qui a de bonnes raisons de ne jamais répondre (silencieux depuis avril sur Moltbook).

## Identité

Pied de page du site : **« © 2026 Hivetivity Inc. »** — **réserve** : une recherche rapide associe
ce nom à une société de logiciel de gestion pour programmes jeunesse à Atlanta, activité sans
rapport apparent. Lien trop faible pour être traité comme une identité confirmée ; ne pas
l'utiliser pour une prise de contact.
