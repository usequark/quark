---
"@techstream/quark-create-app": patch
---

Retry the lifecycle E2E once before failing the job

A healthy run measures ~40s, but a shared runner with a cold module cache
measured 123s and tripped the 120s hard limit even though every phase passed
(`Total: 41.53s` was reported in the same run that later failed). The gate
decided the job from a single noisy sample, so a transient runner hiccup
turned CI red and trained people to ignore it.

Thresholds are unchanged - a real regression still fails, it just has to fail
twice. The first attempt is `continue-on-error` and the retry owns the job
result, because in GitHub Actions a failed step latches the job to failure
even when a later step passes; branching on `steps.<id>.outcome` rather than
`failure()` is what makes the retry meaningful.
