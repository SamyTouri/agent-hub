# CLAUDE.md — Agent Hub / Agent Reputation

Projet : **Agent Reputation** (agentreputation.dev) — couche indépendante de preuves et
d'analyse avant l'achat d'un service d'agent. Next.js + Supabase + Vercel, exposé
en MCP + A2A. **La doctrine produit courante fait autorité : `docs/DOCTRINE.md`** — la lire
avant de toucher un document actif ou une promesse publique. Fondateur solo : Samy. **ChatGPT Work est son cockpit conversationnel
principal** ; OpenAI et Claude Code sont des agents pairs qui traduisent ses décisions
métier en analyse, code, tests, revues et opérations. L'alias Claude Code `opus` en
effort HIGH doit être utilisé souvent pour construire et revoir le développement, pas
seulement en dernier recours. Claude peut committer et pousser lorsqu'une mission
autorise explicitement la publication, avec build local vert et préfixe `[claude]`.
Contrat complet et prioritaire : `AGENTS.md`.

## ⚠️ Mémoires antérieures au pivot du 2026-07-29

Le pivot « Complaint Bureau » est acté ; `docs/DOCTRINE.md` fait autorité. Les mémoires
écrites avant cette date décrivent l'ancien positionnement (découverte / annuaire /
gouvernance par vote) — notamment `agent-hub-concept.md`, `agent-hub-terrain-moltbook.md`
et `agent-hub-strategie-historique.md`. Elles restent utiles comme historique de décision,
mais ne jamais re-dériver la stratégie depuis elles : trancher sur la doctrine.

## Réflexe de reprise (OBLIGATOIRE en début de session)

Le projet évolue plusieurs fois par jour. Avant tout avis ou action :

1. `MEMORY.md` de la mémoire projet (index auto-chargé) → ouvrir les fichiers du thème
   concerné, en priorité **codex-journal.md** (dernières entrées = ce que Codex a fait)
   et **claude-responses.md** (mes derniers avis remis à Samy).
2. `git log --oneline -15` — repérer ce qui a shippé depuis la dernière entrée connue.
3. `.context/live-snapshot.json` — chiffres d'usage frais (refresh horaire).
4. `.exchange/codex/` — les notes datées récentes de Codex (handoffs, consultations).
5. En cas de doute sur l'univers de Samy hors projet (clients, pricing, précédents) :
   wiki Obsidian via `mcp__smart-connections__search_by_text` (voir CLAUDE.md global,
   section 4 — le réflexe vaut depuis CE projet aussi).

## Mémoire — stratification par quantité (règle Samy 2026-07-20)

La mémoire projet est **thématique** et **bornée en taille**, pas en temps :

- Fichier vivant > ~30 Ko → **archiver** : déplacer les entrées les plus anciennes vers
  `<nom>-archive-NNN.md` (numéroté, append-only), garder les récentes + une ligne de
  pointeur vers l'archive. Celui qui APPENDE vérifie le seuil après son append.
- Les branches thématiques évoluent avec le projet (technique / politique-gouvernance /
  commercial-relations agents / opérationnel / visuel…) : créer un nouveau fichier
  thématique plutôt que gonfler un fourre-tout. Détail : `memory-structure.md`.
- Les archives ne sont PAS lues par défaut en début de session — seulement à la demande.

## Langue

Prose en français, code/identifiants/contenu public en anglais.
