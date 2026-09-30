---
"@techstream/quark-create-app": patch
---

Point changesets at the token input it actually reads

#184 (and its release guard) set `GITHUB_TOKEN` in the step's `env:` and
declared the release PR would be opened by `RELEASE_PR_TOKEN`. It was not.
`changesets/action` takes its credential from the **`github-token` input**,
which defaults to `${{ github.token }}`, and ignores the ambient `GITHUB_TOKEN`
environment variable entirely. Every API call it makes - the branch push, the
commit, the PR - used the default.

Observed on the run after the secret was added: the new `Verify the release PR
token` step passed and logged `Release PRs will be opened by Bobnoddle.`, and
the release PR was still authored by `github-actions[bot]`, still reported an
empty check rollup, and was still `BLOCKED`. A correct-looking guard over a
setting that had no effect - the same shape as the two attempts before it, and
worth recording so it is not tried a third time.

The token now goes in `with: github-token`, which is the value that decides the
PR author. The `env:` entry stays so the `changeset publish` child process sees
the same credential.

The guard added in #186 is kept, and it is what makes this diagnosable: it names
the actor in the run log, so the next mismatch between that line and the PR
author is visible immediately instead of inferred from a stalled check.
