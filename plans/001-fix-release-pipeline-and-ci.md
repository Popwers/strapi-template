# Plan 001: Make the semantic-release pipeline target `master` and add a CI quality gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 262c1cc..HEAD -- .github/workflows/versionning.yml package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `262c1cc`, 2026-06-12

## Why this matters

The repo's default branch is `master`, but the semantic-release workflow only triggers on pushes to `main` and the `package.json` release config also points at `main`. Result: the release pipeline has **never run and never will** on this repo as configured — no tags, no changelog, no GitHub releases. Additionally, the workflow releases without any lint/typecheck/build gate, so a broken commit can be released the moment the branch name is fixed. This plan fixes the branch mismatch and adds a verification job that must pass before the release job runs.

## Current state

- `.github/workflows/versionning.yml` — the only workflow in the repo. Triggers on `main` (lines 8–11), passes `branch: main` to the action (line 28), and has a single job with no build/lint step:

```yaml
# .github/workflows/versionning.yml:8-11
on:
    push:
        branches:
            - main
```

```yaml
# .github/workflows/versionning.yml:22-30
            - name: Semantic Release
              uses: cycjimmy/semantic-release-action@v4
              with:
                  extra_plugins: |
                      @semantic-release/changelog
                      @semantic-release/git
                  branch: main
              env:
                  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- `package.json:48-50` — release config uses the **deprecated** `branch` (singular) key and a placeholder repository URL:

```json
"release": {
    "branch": "main",
    "repositoryUrl": "https://github.com/your-repo",
```

Note: `repositoryUrl` is a template placeholder users fill in when they fork — leave it as is (it is handled by plan 006's template checklist). Only the branch key/value changes here.

- Repo conventions: YAML in this repo is indented with 4 spaces (see the existing workflow). Conventional-commit messages (`feat:`, `fix:`, `chore:` — see `git log --oneline -5`).
- Verification baseline: `vp check` (lint+fmt+typecheck) and `npm run build` both pass at commit `262c1cc`.

## Commands you will need

| Purpose   | Command                                            | Expected on success        |
|-----------|----------------------------------------------------|----------------------------|
| Lint/fmt/typecheck | `vp check`                                | exit 0, no warnings        |
| Build     | `npm run build`                                    | exit 0                     |
| YAML sanity | `node -e "const fs=require('fs');require('node:util');JSON.stringify(fs.readFileSync('.github/workflows/versionning.yml','utf8'))" && npx --yes js-yaml .github/workflows/versionning.yml` | parses, prints JSON, exit 0 |

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/versionning.yml`
- `package.json` (the `release` block only)

**Out of scope** (do NOT touch, even though they look related):
- `release.repositoryUrl` placeholder in `package.json` — covered by plan 006.
- Any other `package.json` field (deps, scripts, engines).
- Adding new workflow files for PR CI — desirable later, but this plan only gates the release push.

## Git workflow

- Branch: `chore/fix-release-pipeline`
- One commit, conventional style: `ci: target master branch and gate release on checks`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the branch references

In `.github/workflows/versionning.yml`:
1. Change the trigger branch from `main` to `master` (line 11).
2. Change `branch: main` to `branch: master` in the semantic-release-action `with:` block (line 28).

In `package.json`, replace the deprecated singular key:

```json
"release": {
    "branches": ["master"],
    "repositoryUrl": "https://github.com/your-repo",
```

(`branches` array is the semantic-release v20+ format; keep `repositoryUrl` untouched.)

**Verify**: `grep -n "main" .github/workflows/versionning.yml` → no matches; `grep -n '"branches"' package.json` → one match.

### Step 2: Add a verification job before release

In `versionning.yml`, add a `verify` job before the release job and make the release job depend on it. Target shape (4-space indent, matching the file):

```yaml
jobs:
    verify:
        runs-on: ubuntu-latest
        steps:
            - name: Checkout
              uses: actions/checkout@v4

            - name: Setup Node
              uses: actions/setup-node@v4
              with:
                  node-version: 22
                  cache: npm

            - name: Install dependencies
              run: npm ci

            - name: Lint and typecheck
              run: npx vp check

            - name: Build
              run: npm run build

    main:
        runs-on: ubuntu-latest
        needs: verify
        steps:
            # ... existing checkout + semantic-release steps unchanged ...
```

`vp` is provided by the `vite-plus` devDependency, so `npx vp check` works after `npm ci`.

**Verify**: `npx --yes js-yaml .github/workflows/versionning.yml` → parses and prints the structure, exit 0. Confirm `needs: verify` appears under the `main` job: `grep -n "needs: verify" .github/workflows/versionning.yml` → one match.

### Step 3: Run the local baseline

**Verify**: `vp check` → exit 0; `npm run build` → exit 0. (Confirms the gate you just wired would pass today.)

## Test plan

No unit tests apply (CI config only). Verification is the YAML parse check plus the local `vp check` / `npm run build` runs above. Full end-to-end confirmation happens on the next push to `master` on GitHub — note that in your report.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "master" .github/workflows/versionning.yml` ≥ 2 and `grep -c "main$" .github/workflows/versionning.yml` returns 0 matches for branch values (the job may still be named `main`)
- [ ] `grep -n '"branches": \["master"\]' package.json` → one match
- [ ] `npx --yes js-yaml .github/workflows/versionning.yml` exits 0
- [ ] `vp check` exits 0; `npm run build` exits 0
- [ ] `git status` shows only the two in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The workflow file no longer matches the excerpts above (drifted).
- The repo's default branch is no longer `master` (`git branch --show-current` / remote HEAD) — the right target may have changed.
- `npx vp check` is not available after `npm ci` in your environment — report instead of substituting another linter.

## Maintenance notes

- If the repo is later renamed to use a `main` default branch, both the workflow and `release.branches` must flip together — they were inconsistent once already.
- Reviewer should scrutinize: the `needs: verify` dependency (a typo silently de-gates the release) and the node version pinned in `setup-node` (keep in sync with `engines.node`).
- Deferred: a separate PR-triggered CI workflow (lint+build on pull requests). Worth doing, but out of this plan's scope.
