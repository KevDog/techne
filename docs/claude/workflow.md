# Workflow

## Starting a new project or major phase

Use the slash commands in order:

```
/explore    → defines the problem, users, why       → docs/PROJECT.md
/design     → decides the solution architecture     → docs/ARCHITECTURE.md, docs/SPEC.md
/plan       → slices into ordered tasks + stories   → docs/STORIES.md, docs/PLAN.md
/build-loop → builds, reviews, and commits per task → code + git history
```

Each phase interviews you with questions before writing. Re-run any phase to refine without losing prior work.

## Branch Strategy

- `main` is protected — no direct pushes, all changes via PR
- Branch naming: `feat/`, `fix/`, `chore/` prefixes (e.g. `feat/materials-upload`)
- One branch per feature or decision
- After `/build-loop` completes, use `/git-pr` to open the PR

## Starting a feature

```
git checkout -b feat/<feature-name>
/explore
/design
/plan
/build-loop
/git-pr
```

## When receiving code review feedback

- Use `superpowers:receiving-code-review` skill before acting on any feedback

## When hitting a bug

- Use `superpowers:systematic-debugging` skill before proposing any fix
