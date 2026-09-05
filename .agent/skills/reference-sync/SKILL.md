---
name: reference-sync
description: Consult, check, or update LearnMate's competition requirements and product requirements through references to docs/competition.md and docs/PRD.md. Use for requirements alignment and document consistency checks, not product implementation.
---

# Reference Sync

## Configuration and sources

The skill lives in `.agent/skills/reference-sync/`. Codex discovers it through the directory symlink at `.agents/skills/reference-sync`. The entry point is `SKILL.md` with YAML `name` and `description` fields; no additional global configuration is needed. See the [official Codex skill documentation](https://learn.chatgpt.com/docs/build-skills).

The links below point to the maintained Markdown documents in the repository's `docs/` directory. Use relative symlinks so they work across checkouts. Harness files and these symlinks belong in version control. The linked documents are the same files as those in `docs/`; editing through a link edits the canonical document.

| Reference | Canonical document | Scope |
| --- | --- | --- |
| [competition.md](reference/competition.md) | `docs/competition.md` | JBGS-2026-02 requirements, shared track rules, scoring, and support. |
| [PRD.md](reference/PRD.md) | `docs/PRD.md` | Product goals, scenarios, requirements, constraints, and open questions. |

## Workflow

1. Read the relevant documents through `reference/` and confirm that both links resolve to their canonical files in `docs/`. If a link is broken, inspect the repository paths and repair it only when the intended target is clear.
2. Keep the competition scope limited to topic 2, “多模态 K12 人工智能通识课教学助手对话智能体”, identified by `JBGS-2026-02`, plus applicable shared track rules.
3. For a check request, report inconsistencies or gaps without editing. For an update request, apply the user's confirmed changes directly to the affected canonical Markdown, file by file. The symlinks need no separate content synchronization.
4. Preserve the distinction between official competition requirements, product decisions, derived acceptance checks, and open questions. Do not turn an unresolved gap into a confirmed feature. Ask the user to resolve conflicting requirements when needed.
5. Keep official requirements in the competition document and reference them from the PRD instead of maintaining duplicates. Use English filenames and the user's requested language for document content.
6. Check identifiers, minimum counts, scoring totals, deliverables, functional constraints, Markdown structure, and links. Describe verification only to the extent supported by the material actually read.

Do not create duplicate reference documents, commit automatically, or start product implementation as part of document alignment. Finish by briefly reporting changes, verification results, and any differences requiring a user decision.
