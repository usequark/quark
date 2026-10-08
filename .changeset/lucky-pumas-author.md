---
"@usequark/quark-create-app": patch
---

Author the release commit as the token's own user, so the release PR is mergeable.

The release PR showed `Bobnoddle` as its author while its head commit was
authored by `github-actions[bot]`, and GitHub held every `pull_request` run on
it at `action_required` with no check result — so the PR was permanently
`BLOCKED` and the release could not be merged. Eight changesets were pending
against it.

The two identities come from different credentials. `changesets/action` opens
the PR with its `github-token` input (`RELEASE_PR_TOKEN`), but it pushes the
branch with git, authenticated by the checkout's persisted `GITHUB_TOKEN`. Git
attributes the commit to the pusher, and it gates the run on the commit author,
not the PR author.

The existing `Verify the release PR token` step could not see this: it inspects
the secret rather than the resulting commit, so it logged "Release PRs will be
opened by Bobnoddle" in the very run that pushed the bot-authored commit. That
is a green run reproducing the exact bug the step exists to prevent.

`changesets/action`'s `ensureGitUser()` sets `user.name`/`user.email` to
`github-actions[bot]`, but only when a *complete* author **and** committer
identity is not already resolvable — it probes with `git -c
user.useConfigOnly=true var GIT_AUTHOR_IDENT` and `GIT_COMMITTER_IDENT`. A
partial identity does not satisfy it. All four `GIT_AUTHOR_*`/`GIT_COMMITTER_*`
variables are now exported, so the action leaves them alone. The new step also
re-probes through the same lens and fails the run if either identity is still
unresolvable, so a bot-authored release commit is now a red run rather than a
green one followed by an unmergeable PR.

No change to what gets published, or when. This only affects who the commit is
attributed to.
