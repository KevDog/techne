# Workflow

## Starting a new project or major phase

1. Socratic brainstorm → `REQUIREMENTS.md`
2. Socratic brainstorm → `ARCHITECTURE.md`
3. Write `PLAN.md`
4. Socratic interview → `USER_STORIES.md` (one story per requirement; include acceptance criteria)

## Branch Strategy

- `main` is protected — no direct pushes, all changes via PR
- Branch naming: `feat/`, `fix/`, `chore/` prefixes (e.g. `feat/materials-upload`)
- One branch per feature or decision

## Starting a feature or critical decision

1. Create a branch: `git checkout -b feat/<feature-name>`
2. Socratic brainstorm (use `superpowers:brainstorming` skill)
3. Design UI with Tailwind Plus components (use `frontend-design` agent) — every feature
4. Update `PLAN.md` if scope changes
5. Set up isolated workspace (`superpowers:using-git-worktrees` skill)
6. Check `GLOSSARY.md` — define any new domain terms before naming things
7. Ask: can any tasks run in parallel? → `superpowers:dispatching-parallel-agents` skill
8. Implement (use `superpowers:test-driven-development` skill — tests first)
9. Verify (use `superpowers:verification-before-completion` skill before claiming done)
10. Request code review (`superpowers:requesting-code-review` skill)
11. If ADR-worthy decision made → append to `DECISIONS.md`
12. Update `LEARNINGS.md` if a new orchestration pattern was used
13. Close branch (`superpowers:finishing-a-development-branch` skill)

## When receiving code review feedback

- Use `superpowers:receiving-code-review` skill before acting on any feedback

## When hitting a bug

- Use `superpowers:systematic-debugging` skill before proposing any fix

## Before features touching auth, data access, or external APIs

- Run security review (`review-security` skill)
