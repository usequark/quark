---
"@usequark/quark-db": patch
---

Preserve audit records when the actor is deleted, and keep them attributable.

`AuditLog.userId` was `NOT NULL` with `onDelete: Cascade`, so deleting a user
destroyed every record of what that user did — including the records of the
deletion itself. The column is now nullable with `onDelete: SetNull`, so the rows
survive.

`actorEmail` snapshots the actor's address at write time. `SetNull` alone leaves
the row naming nobody, so the snapshot is what keeps a record attributable once
its actor is gone. `auditLog.create` derives it from `userId` when the caller does
not supply it, so a caller that forgets the field does not get a permanent record
of an unknown actor.

Migration `20261007000000_preserve_audit_log_on_user_delete` makes the column
nullable, adds `actorEmail`, backfills it from the users the rows still point at,
and switches the foreign key to `ON DELETE SET NULL`. The scaffold's squashed
initial migration is updated to match, so a fresh project starts with the
preserving behaviour rather than needing the migration.

The foreign key still rejects a `userId` that names no user at write time —
`SetNull` only relaxes the delete side.