---
name: reference-sync
description: Consult, check, or update LearnMate's competition requirements and GitHub product requirements issue. Use for requirements alignment and source consistency checks, not product implementation.
---

# Reference Sync

## Configuration and sources

The skill lives directly in `.agents/skills/reference-sync/`.

Competition requirements live in the repository. Product requirements live only in the GitHub issue body. The competition reference is a relative symlink to the canonical file; do not create a local copy of the product requirements issue.

| Reference | Canonical document | Scope |
| --- | --- | --- |
| [competition.md](reference/competition.md) | `docs/competition.md` | JBGS-2026-02 requirements, shared track rules, scoring, and support. |
| [Product requirements issue #3](https://github.com/LanternCX/LearnMate/issues/3) | GitHub issue body | Product goals, scenarios, requirements, design constraints, acceptance checks, and open questions. |
| [Technology selection issue #2](https://github.com/LanternCX/LearnMate/issues/2) | GitHub issue body | Confirmed technology choices, responsibility boundaries, and unresolved technical decisions. |

## Workflow

1. Read competition requirements through `reference/competition.md` and confirm that the link resolves to `docs/competition.md`. Read the product requirements with `gh issue view 3 --repo LanternCX/LearnMate --json body,comments,labels`; read issue #2 the same way when technical context matters. If GitHub is unavailable, report the limitation rather than treating a local copy as authoritative.
2. Keep the competition scope limited to topic 2, the multimodal K12 AI literacy teaching assistant conversational agent, identified by `JBGS-2026-02`, plus applicable shared track rules.
3. For a check request, report inconsistencies or gaps without editing. For an update request, apply confirmed competition changes directly to the canonical Markdown file. Update confirmed product requirements in issue #3's body using `gh issue edit --body-file`, preserving unrelated content. Temporary transport files must stay outside the repository and be removed after verification; they are not maintained mirrors.
4. Preserve the distinction between official competition requirements, product decisions, derived acceptance checks, and open questions. Do not turn an unresolved gap into a confirmed feature. Ask the user to resolve conflicting requirements when needed.
5. Keep official requirements in the competition document and link to it from the product requirements issue using a full GitHub URL. Use comments for discussion and consolidate confirmed requirements into the issue body. Development issues reference its sections; technical decisions belong in issue #2 or the relevant implementation issue or PR. Close the product requirements issue for archival after the agreed scope is implemented and accepted and unfinished items are explicitly resolved or deferred. Retain the issue and discussion. Do not create ADRs, local PRDs, or standalone long-term memory documents. Use English filenames and harness instructions; product content follows the user's requested language.
6. Check identifiers, minimum counts, scoring totals, deliverables, functional constraints, Markdown structure, and links. Describe verification only to the extent supported by the material actually read.

Do not create duplicate reference documents, commit automatically, or start product implementation as part of document alignment. Finish by briefly reporting changes, verification results, and any differences requiring a user decision.
