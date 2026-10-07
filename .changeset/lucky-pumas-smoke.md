---
"@usequark/quark-create-app": patch
---

Correct the `--packages` help text. It advertised `mobile` as a create-time option, but the
create command rejects `mobile` outright and tells you to run `quark add mobile` after
scaffolding. The help now lists the actual create-time set (`ui,jobs,pwa`), states that
`db`, `config`, and `ui` are always scaffolded, and points mobile at the post-create path.

Docs only otherwise. The embedded skill index shipped a table advertising five skills that
were removed from the template (`admin-dashboard`, `bookings`, `crm`, `cms`, `ai`), so an
agent reading it would try to load files that were not there. It now lists the eleven skills
that actually ship.