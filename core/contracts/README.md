# Radio House — provisional interchange contracts (v1)

These are **schema-only proposals**; no existing browser, database, transmitter, Cloudflare Worker, Android app, or Supabase function reads them yet. They do not create accounts, ownership, editorial consent, broadcast access or a station clock.

- `recording.v1.schema.json`: immutable source identity plus attributed metadata, rights and review *assertions*.
- `station.v1.schema.json`: stable station identity and declared candidate engines; not an active deployment switch.
- `program.v1.schema.json`: exact-order future-effective proposed programming, not publication authority.
- `witness.v1.schema.json`: one attributed observation/receipt, not a universal proof that audio was heard.

Rules: recording IDs do not change on station reassignment; SHA-256 identifies source bytes, not rights; `published` and `approved` are separate checks; `publishedSchedule` is not `deviceHeard`; a proposed contract payload is never a credential or R2 write instruction. Any adapter to production must verify current source capabilities and permissions independently. Schemas use JSON Schema Draft 2020-12 and reject unspecified fields at each top level.

**No migration or media conversion is part of Radio House 001.**
