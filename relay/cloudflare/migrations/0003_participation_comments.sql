-- v0.5 additive : aucune réécriture des définitions ou empreintes historiques.
CREATE TABLE participations (
  participation_id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 60),
  UNIQUE(poll_id, participation_id)
);
ALTER TABLE ballots ADD COLUMN participation_id TEXT REFERENCES participations(participation_id);
ALTER TABLE ballots ADD COLUMN submission_digest TEXT CHECK(submission_digest IS NULL OR length(submission_digest)=64);
CREATE UNIQUE INDEX ballot_participation_unique ON ballots(participation_id) WHERE participation_id IS NOT NULL;
CREATE TABLE comments (
  comment_id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  action_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 300),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending','visible','hidden')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
  participation_id TEXT REFERENCES participations(participation_id),
  FOREIGN KEY(poll_id,action_id) REFERENCES ballots(poll_id,action_id) ON DELETE CASCADE,
  UNIQUE(poll_id,action_id)
);
CREATE INDEX comments_public ON comments(poll_id,moderation_status,comment_id);
CREATE INDEX comments_admin ON comments(poll_id,comment_id);
CREATE INDEX participations_admin ON participations(poll_id,participation_id);

CREATE TRIGGER participation_validate BEFORE INSERT ON participations BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM polls WHERE poll_id=NEW.poll_id
    AND status='published' AND json_extract(definition,'$.participationIdentityMode')='identified')
    THEN RAISE(ABORT,'INVALID_PARTICIPATION') END);
END;
CREATE TRIGGER ballot_identity_validate BEFORE INSERT ON ballots BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM polls p WHERE p.poll_id=NEW.poll_id AND (
    (coalesce(json_extract(p.definition,'$.participationIdentityMode'),'anonymous')='anonymous' AND NEW.participation_id IS NULL)
    OR (json_extract(p.definition,'$.participationIdentityMode')='identified' AND EXISTS(
      SELECT 1 FROM participations x WHERE x.poll_id=NEW.poll_id AND x.participation_id=NEW.participation_id))))
    THEN RAISE(ABORT,'INVALID_BALLOT_IDENTITY') END);
END;
CREATE TRIGGER comment_validate BEFORE INSERT ON comments BEGIN
  SELECT (CASE WHEN NEW.moderation_status!='pending' OR NOT EXISTS(
    SELECT 1 FROM polls p JOIN ballots b USING(poll_id) WHERE p.poll_id=NEW.poll_id
      AND json_extract(p.definition,'$.commentMode')='optional'
      AND b.action_id=NEW.action_id AND b.choice_id=NEW.choice_id
      AND b.participation_id IS NEW.participation_id)
    THEN RAISE(ABORT,'INVALID_COMMENT') END);
END;
CREATE TRIGGER comment_immutable BEFORE UPDATE OF comment_id,poll_id,action_id,choice_id,text,participation_id ON comments
BEGIN SELECT RAISE(ABORT,'COMMENT_IMMUTABLE'); END;
CREATE TRIGGER participation_immutable BEFORE UPDATE ON participations
BEGIN SELECT RAISE(ABORT,'PARTICIPATION_IMMUTABLE'); END;
CREATE TRIGGER comment_moderation_validate BEFORE UPDATE OF moderation_status,revision ON comments BEGIN
  SELECT (CASE WHEN NEW.revision!=OLD.revision+1 OR NOT EXISTS(SELECT 1 FROM polls WHERE poll_id=NEW.poll_id
    AND json_extract(definition,'$.commentVisibility')='public_with_results')
    THEN RAISE(ABORT,'INVALID_MODERATION') END);
END;
