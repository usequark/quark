---
"@techstream/quark-create-app": patch
---

Release PRs now open with a PAT, and a missing token fails the run

Changesets opened the release PR with `GITHUB_TOKEN`. GitHub applies an
anti-recursion guard to anything triggered by a `GITHUB_TOKEN`-authored PR:
every workflow on it is held at `action_required` until a human approves it, and
the run reports **no check result at all**. The required status checks therefore
could never be satisfied, so the release PR sat unmergeable and every release
needed a manual click.

The release PR is now opened with a dedicated `RELEASE_PR_TOKEN` — a personal
access token with the `repo` and `workflow` scopes — because a PAT is an
ordinary actor whose PRs' checks run normally. It is deliberately separate from
`NPM_PUBLISH_TOKEN` so the publish credential stays isolated.

**Setup required once:** add `RELEASE_PR_TOKEN` to the repository secrets.
Until it exists, the Release workflow now fails on a missing token rather than
reporting green while falling back to `GITHUB_TOKEN`. The step also resolves the
token's login and refuses `github-actions[bot]`, and logs the actor it will use,
so the identity behind a release is visible in the run log instead of being
something to infer afterwards.

Two approaches tried first, recorded so nobody repeats them:

- `pull_request_target` on a separate approver workflow. It runs in the base
  repository's context with a write-scoped token, which sounds exactly right,
  but it is subject to the same guard. Verified: its only two runs were skipped.
- `workflow_run` on the workflows being approved. This one does fire — 18
  successful runs — so the event itself is not blocked. Whether it can actually
  clear `action_required` was never established, because it was abandoned in
  favour of fixing the cause upstream. Do not read its earlier dismissal as
  "this does not run".
