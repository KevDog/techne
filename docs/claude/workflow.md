# Workflow

## Starting a new project or major phase

1. Socratic brainstorm → `REQUIREMENTS.md`
2. Socratic brainstorm → `ARCHITECTURE.md`
3. Write `PLAN.md`

## Starting a feature or critical decision

1. Socratic brainstorm (use `superpowers:brainstorming` skill)
2. Update `PLAN.md` if scope changes
3. Set up isolated workspace (`superpowers:using-git-worktrees` skill)
4. Check `GLOSSARY.md` — define any new domain terms before naming things
5. Ask: can any tasks run in parallel? → `superpowers:dispatching-parallel-agents` skill
6. Implement (use `superpowers:test-driven-development` skill — tests first)
7. Verify (use `superpowers:verification-before-completion` skill before claiming done)
8. Request code review (`superpowers:requesting-code-review` skill)
9. If ADR-worthy decision made → append to `DECISIONS.md`
10. Update `LEARNINGS.md` if a new orchestration pattern was used
11. Close branch (`superpowers:finishing-a-development-branch` skill)

## When receiving code review feedback

- Use `superpowers:receiving-code-review` skill before acting on any feedback

## When hitting a bug

- Use `superpowers:systematic-debugging` skill before proposing any fix

## Before features touching auth, data access, or external APIs

- Run security review (`review-security` skill)
