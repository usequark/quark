---
"@techstream/quark-create-app": patch
---

Stop stalling the release PR behind GitHub's GITHUB_TOKEN approval gate

Changesets opened the release PR with `GITHUB_TOKEN`. GitHub applies an
anti-recursion guard to anything triggered by `GITHUB_TOKEN`: every workflow on
that PR is held at `action_required` until a human approves it, and the run
reports no check result at all. The required status checks could therefore never
be satisfied, so the release PR sat unmergeable and every release needed a
manual click.

Two things I tried that did *not* work, recorded so nobody repeats them:

- `pull_request_target` on a separate approver workflow. It runs in the base
  repository's context with a write-scoped token, which sounds exactly right,
  but it is subject to the same guard and produced zero runs.
- `workflow_run` on the workflows being approved. Those workflows never reach a
  state that emits the event, so it also produced zero runs.

The fix is upstream of both: the release PR is opened with a dedicated
`RELEASE_PR_TOKEN` (a personal access token with `repo` and `workflow` scopes)
rather than `GITHUB_TOKEN`. A PAT is an ordinary actor, so its PRs' checks run
normally and no approval is needed.

**Setup required once:** add a `RELEASE_PR_TOKEN` secret to the repository —
a fine-grained or classic PAT with `repo` (private repositories) and
`workflow` scopes. Until that secret exists the release workflow will fail
loudly on a missing token rather than silently stalling.
