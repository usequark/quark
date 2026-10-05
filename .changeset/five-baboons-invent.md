---

---

Correct the CHANGELOG title of both published packages.

Each file opened with `# @techstream/quark-create-app` and `# @techstream/quark-core`
after the scope migration in 1.23.0, because the rename deliberately skipped
generated history. The document title is not history though - npm auto-includes
CHANGELOG.md in every tarball regardless of `files`, so both packages shipped a
file titled with the scope they no longer use.

Only line 1 of each file is changed. The deeper `## @techstream/...` headings
inside past release entries keep the scope the package had at the time, as does
every install command and link in those entries, including the 1.23.0 entry that
documents the rename itself.

No changeset is warranted: this is a title correction inside generated history,
with no package behaviour change and nothing to release.