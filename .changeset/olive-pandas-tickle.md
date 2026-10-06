---
"@usequark/quark-create-app": patch
---

Delete the database row before the stored bytes, so a failed delete cannot
destroy a file.

`DELETE /api/files/[id]` removed the storage object first and the row second:

```js
await storage.delete(record.storageKey);
await file.delete(record.id);
```

`File` has no incoming relations today, so the row delete cannot currently fail
on a foreign key — but the moment one is added, `prisma.file.delete` throws and
the bytes are already gone. The row survives pointing at an object that no
longer exists, and there is no way back: the blob was the only copy. The same
inverted order was in the worker's orphaned-file cleanup job.

Both now delete the row first and the storage object second, which inverts the
failure mode. A refused row delete leaves an orphaned blob — junk that the
existing cleanup job sweeps up — instead of a row pointing at deleted bytes. A
`P2003` foreign-key error is now reported as a `409`, with the stored bytes
intact.

The row delete also uses a new `file.deleteIfPresent()` (`deleteMany`, returning
a count) instead of `file.delete()`, which throws `P2025` when the row is
already gone. Two overlapping DELETEs both pass the ownership check; the loser
now gets a `404` and skips the storage delete rather than racing the winner's.
Previously it would throw `P2025` and surface as a `500`.

A failed storage delete still returns `200`: the row is already gone, so the
delete succeeded as far as the caller is concerned, and an error the client
cannot act on would be misleading. The failure is logged rather than swallowed.