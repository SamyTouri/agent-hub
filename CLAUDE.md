# CLAUDE.md — Agent Hub / Agent Reputation

Projet : **Agent Reputation** (agentreputation.dev) — couche de découverte + réputation
+ gouvernance pour agents IA autonomes. Next.js + Supabase (pgvector) + Vercel, exposé
en MCP (15 tools) + A2A. Fondateur solo : Samy. Deux agents pairs construisent en
alternance : **Claude Code** (consolidation, mémoire, routine outreach) et **Codex**
(commits `[codex]`, push = deploy). Contrat complet : `AGENTS.md` (à lire aussi — les
conventions durables y vivent, dont « never weaken register_agent », « DB séquentiel
jamais Promise.all », le protocole de délégation CLI et la revue des drafts déléguée).

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

## Langue et style

Prose en français, code/identifiants/contenu public en anglais. Réponses courtes et
orientées décision (output style codevo-naturel + AGENTS.md « Response style »).
