---
"@usequark/quark-create-app": patch
---

Author the release commit as the token's own user, so the release PR is mergeable.

The release PR showed `Bobnoddle` as its author while its head commit was
authored by `github-actions[bot]`, and GitHub held every `pull_request` run on
it at `action_required` with no check result — so the PR was permanently
`BLOCKED` and the release could not be merged. Eight changesets were pending
against it.

Two separate identities were wrong, and GitHub gates on both:

**The pusher.** GitHub decides whether a `pull_request` run may start from the
credential that pushed the head commit, not from the PR's author.
`changesets/action` opens the PR with its `github-token` input
(`RELEASE_PR_TOKEN`) but pushes the branch with the git CLI — and
`actions/checkout` persists an `http.https://github.com/.extraheader` carrying
the job's `GITHUB_TOKEN` into the local git config, which outranks whatever the
release step authenticates with. So the push went out as `github-actions[bot]`.
`persist-credentials: false` fixes that.

**The commit author.** The action runs with `setupGitUser` enabled, whose
`setupUser()` writes `user.name`/`user.email` = `github-actions[bot]` into the
repo config. Local config outranks the environment for those two, so exporting
`GIT_AUTHOR_*` alone does not help — the commit came out bot-authored even with
all four set. The repo config is now written too, which is what actually takes
effect.

The existing `Verify the release PR token` guard could not see either one: it
inspects the secret rather than the resulting commit or the pushing credential,
so it logged `Release PRs will be opened by Bobnoddle` in the very run that
pushed a bot-authored commit. That is a green run reproducing the exact bug the
step exists to prevent. A new probe fails the run if the author or committer
identity is still unresolvable, so a bot-authored release commit is now a red
run rather than a green one followed by an unmergeable PR.

No change to what gets published, or when. This only affects who the commit is
attributed to.