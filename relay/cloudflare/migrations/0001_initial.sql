PRAGMA foreign_keys = ON;
CREATE TABLE polls (
  poll_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('draft','published','closed')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0 AND revision <= 9007199254740991),
  definition TEXT NOT NULL CHECK(json_valid(definition)),
  style TEXT NOT NULL CHECK(json_valid(style)),
  access_rules TEXT NOT NULL CHECK(json_valid(access_rules)),
  result_rules TEXT NOT NULL CHECK(json_valid(result_rules)),
  semantic_hash TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
  capability_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  closed_at INTEGER
);
CREATE TABLE publications (
  poll_id TEXT PRIMARY KEY REFERENCES polls(poll_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  signature TEXT NOT NULL
);
CREATE TABLE ballots (
  poll_id TEXT NOT NULL REFERENCES polls(poll_id),
  action_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  PRIMARY KEY(poll_id, action_id)
) WITHOUT ROWID;
CREATE TABLE asset_links (
  poll_id TEXT NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  metadata TEXT NOT NULL CHECK(json_valid(metadata)),
  PRIMARY KEY(poll_id, asset_id)
) WITHOUT ROWID;
CREATE TABLE asset_refs (
  poll_id TEXT NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  PRIMARY KEY(poll_id, asset_id)
) WITHOUT ROWID;
CREATE TABLE r2_garbage (object_key TEXT PRIMARY KEY, delete_after INTEGER NOT NULL);
CREATE TABLE mutation_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok = 1));

-- Ces triggers et l'INSERT appartiennent à UNE transaction SQLite/D1.
CREATE TRIGGER ballot_validate BEFORE INSERT ON ballots BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM polls p, json_each(p.definition, '$.choices') c
    WHERE p.poll_id = NEW.poll_id AND p.status = 'published'
      AND json_extract(c.value, '$.id') = NEW.choice_id
  ) THEN RAISE(ABORT, 'INVALID_BALLOT') END;
END;
CREATE TRIGGER ballot_lock AFTER INSERT ON ballots BEGIN
  UPDATE polls SET locked = 1, revision = revision + 1 + abs(random() % 1000000)
  WHERE poll_id = NEW.poll_id;
END;
CREATE TRIGGER definition_locked BEFORE UPDATE OF definition, result_rules, access_rules, semantic_hash ON polls
WHEN OLD.locked = 1 AND (OLD.definition != NEW.definition OR OLD.result_rules != NEW.result_rules
 OR OLD.access_rules != NEW.access_rules OR OLD.semantic_hash != NEW.semantic_hash)
BEGIN SELECT RAISE(ABORT, 'POLL_LOCKED'); END;
CREATE TRIGGER refs_insert AFTER INSERT ON polls BEGIN
  INSERT OR IGNORE INTO asset_refs SELECT NEW.poll_id, json_extract(NEW.definition, '$.pollImageAssetId')
    WHERE json_extract(NEW.definition, '$.pollImageAssetId') IS NOT NULL;
  INSERT OR IGNORE INTO asset_refs SELECT NEW.poll_id, json_extract(value, '$.imageRef')
    FROM json_each(NEW.definition, '$.choices') WHERE json_extract(value, '$.imageRef') IS NOT NULL;
END;
CREATE TRIGGER refs_update AFTER UPDATE OF definition ON polls BEGIN
  DELETE FROM asset_refs WHERE poll_id = NEW.poll_id;
  INSERT OR IGNORE INTO asset_refs SELECT NEW.poll_id, json_extract(NEW.definition, '$.pollImageAssetId')
    WHERE json_extract(NEW.definition, '$.pollImageAssetId') IS NOT NULL;
  INSERT OR IGNORE INTO asset_refs SELECT NEW.poll_id, json_extract(value, '$.imageRef')
    FROM json_each(NEW.definition, '$.choices') WHERE json_extract(value, '$.imageRef') IS NOT NULL;
END;
CREATE TRIGGER asset_deleted AFTER DELETE ON asset_links BEGIN
  INSERT OR IGNORE INTO r2_garbage VALUES(OLD.object_key, unixepoch());
END;
