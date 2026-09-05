## Development

1. This project is a monorepo.
2. Development relies on [mattpocock/skills](https://github.com/mattpocock/skills). If these skills are unavailable in the user's development environment, guide the user through installation before proceeding.

## Rules

1. Follow test-driven development (TDD). Regardless of the tests used during development, retain only behavioral and regression tests in committed changes.
2. This is an early-stage greenfield project with a rapidly evolving design and structure. Do not retain backward-compatibility code for earlier versions.
3. Write agent harness instructions and configuration, including `AGENTS.md` and `SKILL.md`, in English. User-facing responses and product documents follow the user's requested language.

## Git and PRs

1. The main branch is protected. Contribute code through pull requests.
2. Write commit messages in English and follow the Conventional Commits format.

## Agent skills

### Issue tracker

- Track tasks in GitHub Issues for `LanternCX/LearnMate` using `gh`. When a skill requests publication, create an issue; when reading a task, include its body, comments, and labels.
- Maintain product requirements only in `docs/PRD.md`. Issues reference relevant sections and track scope, acceptance, and progress without duplicating the PRD. Record implementation choices and discussions in the relevant issue or PR; update the PRD when confirmed product requirements change. Do not create local mirrors of specs, plans, tickets, or task status.
- External PRs are not a triage request surface. Development PRs follow the normal review process.
- Add `bot-added` when an agent or other automation creates an issue or PR, including draft PRs. This source label can coexist with status labels.
- Pass multiline issue and PR bodies through `--body-file`.

### Triage labels

Map the five skill triage roles to GitHub labels with the same names:

| Label | Meaning |
| --- | --- |
| `needs-triage` | Awaiting maintainer evaluation |
| `needs-info` | Awaiting more information from the reporter |
| `ready-for-agent` | Fully specified and ready for an agent |
| `ready-for-human` | Requires human implementation |
| `wontfix` | Will not be actioned |

`bot-added` is a separate source label and does not replace a status label.

### Project context

- Read `docs/PRD.md`, relevant issues and PRs, and the actual code for task context. Surface conflicts explicitly instead of silently overriding confirmed requirements.
- Do not create or maintain ADRs, `CONTEXT.md`, `CONTEXT-MAP.md`, or other standalone long-term memory documents. When a skill asks to read them, use the sources above. When it asks to write them, record the relevant discussion in the corresponding issue or PR and update the PRD for product requirement changes.
- When a skill references `docs/agents/issue-tracker.md`, `triage-labels.md`, or `domain.md`, use the corresponding conventions in this section without creating duplicate configuration.
